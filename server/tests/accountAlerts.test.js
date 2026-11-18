import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('../src/services/email.transport.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, sendEmail: vi.fn() };
});

import request from 'supertest';
import app from '../src/app.js';
import config from '../src/config/config.js';
import { sendEmail, EmailTransportError } from '../src/services/email.transport.js';
import { isPasswordBreached, rangeContains } from '../src/services/breachedPassword.service.js';
import { MAX_KNOWN_DEVICES } from '../src/services/loginAlert.service.js';
import AuthIdentity from '../src/models/AuthIdentity.js';
import AuthSession from '../src/models/AuthSession.js';
import EmailChangeUndo from '../src/models/EmailChangeUndo.js';
import Notification from '../src/models/Notification.js';
import PasswordReset from '../src/models/PasswordReset.js';
import User from '../src/models/User.js';
import { createSession, login, uniqueUser, PASSWORD } from './helpers.js';

const pairs = response => (response.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]);
const rawCookie = (response, name) => (response.headers['set-cookie'] || []).find(cookie => cookie.startsWith(`${name}=`));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const sha1 = value => crypto.createHash('sha1').update(value).digest('hex').toUpperCase();
const fresh = prefix => `${prefix}_${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`;
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

// A signed-out browser: CSRF cookie and token, plus any extra cookies (e.g. a device cookie).
async function browser(extraCookies = []) {
  const csrf = await request(app).get('/api/auth/csrf');
  const cookie = pairs(csrf).find(pair => pair.startsWith('devtrack_csrf='));
  const token = decodeURIComponent(cookie.split('=')[1]);
  const header = [cookie, ...extraCookies].join('; ');
  return { post: url => request(app).post(url).set('Cookie', header).set('x-csrf-token', token) };
}

const signIn = async (user, { device, userAgent = CHROME_MAC } = {}) => (await browser(device ? [device] : []))
  .post('/api/auth/login').set('User-Agent', userAgent).send({ email: user.email, password: user.password });

const signInAlerts = userId => Notification.find({ owner: userId, type: 'new_sign_in' }).lean();
const alertMailsTo = email => sendEmail.mock.calls.filter(([mail]) => mail.to === email && mail.subject === 'New sign-in to your DevTrack account');

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue(undefined);
});

describe('new sign-in alerts', () => {
  it('learns the registering browser silently and stays quiet when it signs in again', async () => {
    const s = await createSession('alert_known');
    const device = s.cookie().split('; ').find(pair => pair.startsWith('devtrack_device='));
    expect(device).toBeTruthy();

    const again = await signIn(s.user, { device });
    expect(again.status).toBe(200);
    expect(await signInAlerts(s.userId)).toHaveLength(0);
    expect(alertMailsTo(s.user.email)).toHaveLength(0);
  });

  it('alerts in the app and by email when an unfamiliar browser signs in', async () => {
    const s = await createSession('alert_new');
    const response = await signIn(s.user);
    expect(response.status).toBe(200);

    const alerts = await signInAlerts(s.userId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ subjectType: 'account', subjectId: null, title: 'New sign-in: Chrome on macOS', readAt: null });
    expect(alerts[0].body).toMatch(/password/);

    await vi.waitFor(() => expect(alertMailsTo(s.user.email)).toHaveLength(1));
    const mail = alertMailsTo(s.user.email)[0][0];
    expect(mail.text).toContain('Chrome on macOS');
    expect(mail.text).toContain(`${config.CLIENT_ORIGIN}/app/settings#security`);
    // No session tokens or cookie values travel in the email.
    expect(mail.text).not.toMatch(/devtrack_|refresh/i);

    // The browser now has a long-lived HttpOnly device cookie scoped to the auth routes.
    const cookie = rawCookie(response, 'devtrack_device');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);

    // Only a hash of the device token is stored.
    const token = pairs(response).find(pair => pair.startsWith('devtrack_device=')).split('=')[1];
    const stored = await User.findById(s.userId).select('+knownDevices').lean();
    expect(stored.knownDevices).toContain(sha256(token));
    expect(JSON.stringify(stored)).not.toContain(token);

    // Same browser next time: no second alert. The alert is listed like any notification.
    await signIn(s.user, { device: `devtrack_device=${token}` });
    expect(await signInAlerts(s.userId)).toHaveLength(1);
    const listed = await s.get('/api/notifications?limit=10');
    expect(listed.body.data.items.some(item => item.type === 'new_sign_in')).toBe(true);
  });

  it('treats a malformed device cookie as a new browser and replaces it', async () => {
    const s = await createSession('alert_forged');
    const response = await signIn(s.user, { device: 'devtrack_device=not-a-real-token' });
    expect(response.status).toBe(200);
    expect(await signInAlerts(s.userId)).toHaveLength(1);
    const token = pairs(response).find(pair => pair.startsWith('devtrack_device=')).split('=')[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('records nothing and alerts nobody when the password is wrong', async () => {
    const s = await createSession('alert_wrongpw');
    const before = (await User.findById(s.userId).select('+knownDevices').lean()).knownDevices;
    const response = await signIn({ ...s.user, password: 'Definitely-Wrong-99' });
    expect(response.status).toBe(401);
    expect(rawCookie(response, 'devtrack_device')).toBeUndefined();
    expect(await signInAlerts(s.userId)).toHaveLength(0);
    expect((await User.findById(s.userId).select('+knownDevices').lean()).knownDevices).toEqual(before);
  });

  it('still signs in when the alert email cannot be sent', async () => {
    const s = await createSession('alert_mailfail');
    sendEmail.mockRejectedValue(new EmailTransportError('unavailable'));
    const response = await signIn(s.user);
    expect(response.status).toBe(200);
    expect(await signInAlerts(s.userId)).toHaveLength(1);
  });

  it('keeps at most the newest known browsers', async () => {
    const s = await createSession('alert_cap');
    for (let i = 0; i < MAX_KNOWN_DEVICES + 2; i += 1) await signIn(s.user);
    const stored = await User.findById(s.userId).select('+knownDevices').lean();
    expect(stored.knownDevices).toHaveLength(MAX_KNOWN_DEVICES);
  });

  it('never exposes known devices through the API', async () => {
    const s = await createSession('alert_hidden');
    const me = await s.get('/api/auth/me');
    expect(JSON.stringify(me.body)).not.toMatch(/knownDevices/);
  });
});

describe('leaked-password check', () => {
  it('finds a suffix only with a positive count', () => {
    const body = 'AAAAA:3\r\nBBBBB:0\r\nCCCCC:12';
    expect(rangeContains(body, 'AAAAA')).toBe(true);
    expect(rangeContains(body, 'CCCCC')).toBe(true);
    expect(rangeContains(body, 'BBBBB')).toBe(false); // padding rows have a zero count
    expect(rangeContains(body, 'DDDDD')).toBe(false);
  });

  it('sends only the first five hash characters, with padding, and compares locally', async () => {
    const password = 'Some-Password-123';
    const digest = sha1(password);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: async () => `${digest.slice(5)}:42\r\n0000000000000000000000000000000000A:0` });

    expect(await isPasswordBreached(password, { enabled: true, fetchImpl })).toBe(true);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`);
    expect(url).not.toContain(digest.slice(5));
    expect(url).not.toContain(password);
    expect(options.headers['Add-Padding']).toBe('true');
    expect(options.redirect).toBe('error');
  });

  it('answers false for an unknown password and null when the service fails or the check is off', async () => {
    const miss = vi.fn().mockResolvedValue({ ok: true, text: async () => '0000000000000000000000000000000000A:5' });
    expect(await isPasswordBreached('Unlisted-Password-1', { enabled: true, fetchImpl: miss })).toBe(false);
    expect(await isPasswordBreached('x', { enabled: true, fetchImpl: vi.fn().mockRejectedValue(new Error('timeout')) })).toBe(null);
    expect(await isPasswordBreached('x', { enabled: true, fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }) })).toBe(null);
    const unused = vi.fn();
    expect(await isPasswordBreached('x', { enabled: false, fetchImpl: unused })).toBe(null);
    expect(unused).not.toHaveBeenCalled();
  });

  describe('on password routes', () => {
    const BREACHED = 'Breached-Password-2024';
    const SAFE = 'Fresh-Unique-Secret-77';
    let original;

    beforeEach(() => {
      original = config.PASSWORD_BREACH_CHECK;
      config.PASSWORD_BREACH_CHECK = true;
      // The range API "knows" BREACHED only. Supertest does not use fetch, so only the check sees this.
      vi.stubGlobal('fetch', vi.fn(async url => ({
        ok: true,
        text: async () => (url.endsWith(sha1(BREACHED).slice(0, 5)) ? `${sha1(BREACHED).slice(5)}:9` : '0000000000000000000000000000000000A:1'),
      })));
    });

    afterEach(() => {
      config.PASSWORD_BREACH_CHECK = original;
      vi.unstubAllGlobals();
    });

    it('rejects a breached password at registration and creates no account', async () => {
      const user = { ...uniqueUser('breach_reg'), password: BREACHED };
      const response = await (await browser()).post('/api/auth/register').send(user);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('PASSWORD_BREACHED');
      expect(response.body.errors.password).toMatch(/data breach/);
      expect(await User.exists({ email: user.email })).toBeNull();
    });

    it('rejects a breached new password and keeps the old one working', async () => {
      const s = await createSession('breach_change');
      const response = await s.patch('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: BREACHED });
      expect(response.status).toBe(400);
      expect(response.body.errors.newPassword).toMatch(/data breach/);
      expect((await login(s.user)).response.status).toBe(200);
      expect((await s.patch('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: SAFE })).status).toBe(200);
    });

    it('rejects a breached reset password without using up the code', async () => {
      const s = await createSession('breach_reset');
      const b = await browser();
      await b.post('/api/auth/password/forgot').send({ email: s.user.email });
      await vi.waitFor(() => expect(sendEmail.mock.calls.some(([mail]) => mail.to === s.user.email && /password reset/.test(mail.subject))).toBe(true));
      const code = sendEmail.mock.calls.filter(([mail]) => mail.to === s.user.email && /password reset/.test(mail.subject)).at(-1)[0].text.match(/\b(\d{6})\b/)[1];

      const rejected = await b.post('/api/auth/password/reset').send({ email: s.user.email, code, newPassword: BREACHED });
      expect(rejected.status).toBe(400);
      expect(rejected.body.errors.newPassword).toMatch(/data breach/);
      expect(await PasswordReset.exists({ owner: s.userId })).toBeTruthy();

      const accepted = await b.post('/api/auth/password/reset').send({ email: s.user.email, code, newPassword: SAFE });
      expect(accepted.status).toBe(200);
    });

    it('fails open: an outage of the range API does not block registration', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
      const user = { ...uniqueUser('breach_down'), password: BREACHED };
      expect((await (await browser()).post('/api/auth/register').send(user)).status).toBe(201);
    });
  });
});

describe('undoing an email change', () => {
  async function changeEmail(s, newEmail) {
    await s.patch('/api/auth/profile').send({ email: newEmail, currentPassword: PASSWORD });
    const code = sendEmail.mock.calls.filter(([mail]) => mail.to === newEmail).at(-1)[0].text.match(/\b(\d{6})\b/)[1];
    const confirmed = await s.post('/api/auth/email/change/confirm').send({ code });
    expect(confirmed.status).toBe(200);
  }

  async function changedAlertTo(email) {
    await vi.waitFor(() => expect(sendEmail.mock.calls.some(([mail]) => mail.to === email && mail.subject === 'Your DevTrack email was changed')).toBe(true));
    return sendEmail.mock.calls.filter(([mail]) => mail.to === email && mail.subject === 'Your DevTrack email was changed').at(-1)[0];
  }

  const tokenIn = mail => mail.text.match(/#token=([A-Za-z0-9_-]{43})/)?.[1];

  it('restores the old address, signs out everywhere, locks the password and drops foreign social sign-ins', async () => {
    const s = await createSession('undo_ok');
    const oldEmail = s.user.email;
    const attackerEmail = fresh('attacker');
    await AuthIdentity.create({ owner: s.userId, provider: 'google', providerUserId: `g_${Date.now()}`, email: oldEmail });
    await AuthIdentity.create({ owner: s.userId, provider: 'github', providerUserId: `h_${Date.now()}`, email: attackerEmail });

    await changeEmail(s, attackerEmail);
    const alert = await changedAlertTo(oldEmail);
    const token = tokenIn(alert);
    expect(token).toBeTruthy();
    expect(alert.text).toContain(`${config.CLIENT_ORIGIN}/undo-email-change#token=`);
    expect(alert.html).toContain('Undo this email change');
    // Only a hash of the link token is stored.
    const record = await EmailChangeUndo.findOne({ owner: s.userId }).lean();
    expect(record.tokenHash).toBe(sha256(token));
    expect(record.restoreEmail).toBe(oldEmail);

    const undone = await (await browser()).post('/api/auth/email/change/undo').send({ token });
    expect(undone.status).toBe(200);
    expect(undone.body.data.email).toBe(`${oldEmail[0]}•••@example.com`);

    const user = await User.findById(s.userId).lean();
    expect(user.email).toBe(oldEmail);
    expect(user.emailVerifiedAt).toBeTruthy();
    expect(await AuthSession.countDocuments({ owner: s.userId, revokedAt: null })).toBe(0);
    expect((await s.get('/api/auth/me')).status).toBe(401);
    // The attacker's password no longer works on either address.
    expect((await login({ email: oldEmail, password: PASSWORD })).response.status).toBe(401);
    expect((await login({ email: attackerEmail, password: PASSWORD })).response.status).toBe(401);
    const providers = (await AuthIdentity.find({ owner: s.userId }).lean()).map(identity => identity.provider);
    expect(providers).toEqual(['google']);

    // Single use.
    const again = await (await browser()).post('/api/auth/email/change/undo').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('UNDO_LINK_INVALID');
  });

  it('keeps the first restore address when the email is changed again while the link is valid', async () => {
    const s = await createSession('undo_twice');
    const original = s.user.email;
    const first = fresh('hop1');
    const second = fresh('hop2');
    await changeEmail(s, first);
    const token = tokenIn(await changedAlertTo(original));

    await changeEmail(s, second);
    const secondAlert = await changedAlertTo(first);
    expect(tokenIn(secondAlert)).toBeUndefined();
    expect(secondAlert.text).toMatch(/earlier email/);

    expect((await (await browser()).post('/api/auth/email/change/undo').send({ token })).status).toBe(200);
    expect((await User.findById(s.userId).lean()).email).toBe(original);
  });

  it('refuses expired links and leaves the account alone', async () => {
    const s = await createSession('undo_expired');
    const newEmail = fresh('late');
    await changeEmail(s, newEmail);
    const token = tokenIn(await changedAlertTo(s.user.email));
    await EmailChangeUndo.updateOne({ owner: s.userId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await (await browser()).post('/api/auth/email/change/undo').send({ token });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('UNDO_LINK_INVALID');
    expect((await User.findById(s.userId).lean()).email).toBe(newEmail);
  });

  it('does not hand the old address back when another account now owns it, and keeps the link', async () => {
    const s = await createSession('undo_taken');
    const oldEmail = s.user.email;
    await changeEmail(s, fresh('moved'));
    const token = tokenIn(await changedAlertTo(oldEmail));
    const squatter = await createSession('undo_squat');
    await User.updateOne({ _id: squatter.userId }, { $set: { email: oldEmail } });

    const response = await (await browser()).post('/api/auth/email/change/undo').send({ token });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('UNDO_EMAIL_TAKEN');
    expect(await EmailChangeUndo.exists({ owner: s.userId })).toBeTruthy();
  });

  it('validates the token shape and requires the CSRF header', async () => {
    const b = await browser();
    expect((await b.post('/api/auth/email/change/undo').send({ token: 'short' })).status).toBe(400);
    expect((await b.post('/api/auth/email/change/undo').send({ token: 'a'.repeat(43), extra: 1 })).status).toBe(400);
    expect((await b.post('/api/auth/email/change/undo').send({ token: { $ne: null } })).status).toBe(400);
    const unknown = await b.post('/api/auth/email/change/undo').send({ token: 'A'.repeat(43) });
    expect(unknown.status).toBe(400);
    expect(unknown.body.code).toBe('UNDO_LINK_INVALID');
    expect((await request(app).post('/api/auth/email/change/undo').send({ token: 'A'.repeat(43) })).status).toBe(403);
  });
});
