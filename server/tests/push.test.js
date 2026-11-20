import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { createECDH, randomBytes } from 'node:crypto';

vi.mock('web-push', () => ({ default: { sendNotification: vi.fn() } }));

import request from 'supertest';
import webpush from 'web-push';
import app from '../src/app.js';
import config from '../src/config/config.js';
import Notification from '../src/models/Notification.js';
import PushSubscription from '../src/models/PushSubscription.js';
import User from '../src/models/User.js';
import { MAX_DEVICES } from '../src/services/push.service.js';
import { runReminderPushes } from '../src/services/reminderPush.service.js';
import { isAllowedPushEndpoint } from '../src/validators/push.validator.js';
import { createSession } from './helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const b64url = buffer => buffer.toString('base64url');
const morning = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0));
};
const dayKey = offset => new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);

function vapid() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { enabled: true, publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(ecdh.getPrivateKey()).padStart(43, 'A'), subject: 'mailto:owner@example.com' };
}

// A browser PushSubscription as JSON, at Google's push service.
function browserSubscription(host = 'fcm.googleapis.com') {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    endpoint: `https://${host}/fcm/send/${b64url(randomBytes(24))}`,
    expirationTime: null,
    keys: { p256dh: b64url(ecdh.getPublicKey()), auth: b64url(randomBytes(16)) },
  };
}

const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36';
const sentPayloads = () => webpush.sendNotification.mock.calls.map(([, payload]) => JSON.parse(payload));

describe('Phone and browser notifications (Web Push)', () => {
  const originalPush = config.PUSH;
  let ann;
  let ben;

  beforeAll(async () => {
    config.PUSH = vapid();
    ann = await createSession('push_ann');
    ben = await createSession('push_ben');
  });

  afterAll(() => {
    config.PUSH = originalPush;
  });

  beforeEach(async () => {
    config.PUSH = config.PUSH.enabled ? config.PUSH : vapid();
    webpush.sendNotification.mockReset();
    webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
    await PushSubscription.deleteMany({ owner: { $in: [ann.userId, ben.userId] } });
  });

  it('is unavailable without VAPID keys', async () => {
    const saved = config.PUSH;
    config.PUSH = { enabled: false };
    try {
      const status = await ann.get('/api/push');
      expect(status.body.data).toEqual({ available: false, publicKey: null, devices: [] });
      expect((await ann.post('/api/push/subscriptions').send(browserSubscription())).status).toBe(503);
    } finally {
      config.PUSH = saved;
    }
  });

  it('saves a subscription without ever returning its endpoint or keys', async () => {
    const subscription = browserSubscription();
    const response = await ann.post('/api/push/subscriptions').set('User-Agent', ANDROID).send(subscription);
    expect(response.status).toBe(201);
    expect(response.body.data.publicKey).toBe(config.PUSH.publicKey);
    expect(response.body.data.devices).toHaveLength(1);
    expect(response.body.data.devices[0].label).toBe('Chrome on Android');
    const text = JSON.stringify(response.body);
    expect(text).not.toContain(subscription.endpoint);
    expect(text).not.toContain(subscription.keys.auth);
    expect(text).not.toContain(subscription.keys.p256dh);
  });

  it('refuses endpoints outside the browser push services (SSRF) and malformed keys', async () => {
    const bad = [
      'http://fcm.googleapis.com/fcm/send/x',
      'https://127.0.0.1/push',
      'https://localhost/push',
      'https://fcm.googleapis.com.evil.example/x',
      'https://evil.example/fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://169.254.169.254/latest/meta-data',
    ];
    for (const endpoint of bad) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(false);
      expect((await ann.post('/api/push/subscriptions').send({ ...browserSubscription(), endpoint })).status, endpoint).toBe(400);
    }
    for (const host of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2-db5p.notify.windows.com']) {
      expect(isAllowedPushEndpoint(`https://${host}/x`), host).toBe(true);
    }
    const good = browserSubscription();
    expect((await ann.post('/api/push/subscriptions').send({ ...good, keys: { ...good.keys, auth: 'short' } })).status).toBe(400);
    expect((await ann.post('/api/push/subscriptions').send({ ...good, keys: { ...good.keys, p256dh: '!'.repeat(87) } })).status).toBe(400);
    expect((await ann.post('/api/push/subscriptions').send({ ...good, owner: ben.userId })).status).toBe(400);
    expect(await PushSubscription.countDocuments({ owner: ann.userId })).toBe(0);
  });

  it('needs the CSRF token', async () => {
    const response = await request(app).post('/api/push/subscriptions').set('Cookie', ann.cookie()).send(browserSubscription());
    expect(response.status).toBe(403);
  });

  it('moves a browser to whoever subscribes it last, and keeps at most five devices per account', async () => {
    const shared = browserSubscription();
    await ann.post('/api/push/subscriptions').send(shared);
    await ben.post('/api/push/subscriptions').send(shared);
    expect(await PushSubscription.countDocuments({ owner: ann.userId })).toBe(0);
    expect(await PushSubscription.countDocuments({ owner: ben.userId })).toBe(1);

    for (let i = 0; i < MAX_DEVICES + 2; i += 1) await ann.post('/api/push/subscriptions').send(browserSubscription());
    expect(await PushSubscription.countDocuments({ owner: ann.userId })).toBe(MAX_DEVICES);
  });

  it('only removes your own devices', async () => {
    const mine = browserSubscription();
    const added = await ann.post('/api/push/subscriptions').send(mine);
    const deviceId = added.body.data.devices[0].id;

    expect((await ben.del('/api/push/subscriptions').send({ endpoint: mine.endpoint })).status).toBe(200);
    expect((await ben.del(`/api/push/subscriptions/${deviceId}`)).status).toBe(404);
    expect(await PushSubscription.countDocuments({ owner: ann.userId })).toBe(1);

    expect((await ann.del('/api/push/subscriptions').send({ endpoint: mine.endpoint })).body.data.devices).toEqual([]);
  });

  it('sends a test, removes subscriptions the push service says are gone, and reports failures', async () => {
    expect((await ann.post('/api/push/test')).status).toBe(409);

    await ann.post('/api/push/subscriptions').send(browserSubscription());
    const ok = await ann.post('/api/push/test');
    expect(ok.status).toBe(200);
    expect(ok.body.data.sent).toBe(1);
    const [subscription, , options] = webpush.sendNotification.mock.calls[0];
    expect(subscription.endpoint).toMatch(/^https:\/\/fcm\.googleapis\.com\//);
    expect(options.vapidDetails).toEqual({ subject: config.PUSH.subject, publicKey: config.PUSH.publicKey, privateKey: config.PUSH.privateKey });
    expect(options.TTL).toBeGreaterThan(0);

    webpush.sendNotification.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    expect((await ann.post('/api/push/test')).status).toBe(502);
    expect(await PushSubscription.countDocuments({ owner: ann.userId })).toBe(1);

    webpush.sendNotification.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));
    expect((await ann.post('/api/push/test')).status).toBe(502);
    expect(await PushSubscription.countDocuments({ owner: ann.userId })).toBe(0);
  });

  describe('daily reminder push', () => {
    const run = (ids, now = morning()) => runReminderPushes({ now, onlyUserIds: ids });
    const reset = id => User.updateOne({ _id: id }, { $set: { pushDigestDay: null, remindersCheckedAt: null } });

    it('sends a count only, once a day, and marks the reminders pushed', async () => {
      await ann.post('/api/push/subscriptions').send(browserSubscription());
      await ann.post('/api/goals').send({ title: 'Secret interview prep', deadline: dayKey(-2) });
      await reset(ann.userId);

      const first = await run([ann.userId]);
      expect(first.sent).toBe(1);
      const [payload] = sentPayloads();
      expect(payload).toMatchObject({ title: '1 new reminder', url: '/app/notifications', tag: 'devtrack-reminders' });
      expect(JSON.stringify(payload)).not.toContain('Secret interview prep');
      expect(await Notification.countDocuments({ owner: ann.userId, type: 'goal_overdue', pushedAt: null })).toBe(0);

      webpush.sendNotification.mockClear();
      expect((await run([ann.userId])).checked).toBe(0);
      await reset(ann.userId);
      expect((await run([ann.userId])).sent).toBe(0);
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('skips accounts without devices, with reminders off, and runs before 8 am India time', async () => {
      await ben.post('/api/goals').send({ title: 'Overdue thing', deadline: dayKey(-3) });
      await reset(ben.userId);
      expect((await run([ben.userId])).checked).toBe(0);

      await ben.post('/api/push/subscriptions').send(browserSubscription());
      const early = new Date(morning().getTime() - 3 * 60 * 60 * 1000);
      expect(await run([ben.userId], early)).toEqual({ skipped: 'before_send_hour' });

      await ben.patch('/api/notifications/settings').send({ enabled: false });
      await reset(ben.userId);
      expect((await run([ben.userId])).checked).toBe(0);
      await ben.patch('/api/notifications/settings').send({ enabled: true });
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('keeps reminders unpushed when no device accepted the notification', async () => {
      await ben.post('/api/push/subscriptions').send(browserSubscription());
      await ben.post('/api/goals').send({ title: 'Another overdue', deadline: dayKey(-4) });
      await reset(ben.userId);
      await Notification.updateMany({ owner: ben.userId }, { $set: { pushedAt: null } });
      webpush.sendNotification.mockRejectedValue(Object.assign(new Error('down'), { statusCode: 503 }));
      const result = await run([ben.userId]);
      expect(result).toMatchObject({ sent: 0, failed: 1 });
      expect(await Notification.countDocuments({ owner: ben.userId, type: 'goal_overdue', pushedAt: null })).toBeGreaterThan(0);
    });
  });
});
