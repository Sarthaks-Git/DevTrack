import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import Goal from '../src/models/Goal.js';
import User from '../src/models/User.js';
import Notification from '../src/models/Notification.js';
import CodingProfile from '../src/models/CodingProfile.js';
import SolvedProblem from '../src/models/SolvedProblem.js';
import { createSession } from './helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const todayUtc = () => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};
const dayKey = offset => new Date(todayUtc() + offset * DAY_MS).toISOString().slice(0, 10);
const backdate = (id, days) => Goal.collection.updateOne({ _id: Goal.base.Types.ObjectId.createFromHexString(id) }, { $set: { updatedAt: new Date(todayUtc() - days * DAY_MS) } });
// Lets a test force the next read to regenerate immediately (the 5-minute throttle is tested separately).
const unthrottle = userId => User.updateOne({ _id: userId }, { $set: { remindersCheckedAt: null } });

describe('Notifications and reminders', () => {
  let alice;
  let mallory;

  beforeAll(async () => {
    alice = await createSession('nt_alice');
    mallory = await createSession('nt_mallory');
  });

  const list = (session, query = '') => session.get(`/api/notifications?today=${dayKey(0)}${query}`);
  const goal = async (session, body) => (await session.post('/api/goals').send(body)).body.goal;

  it('requires authentication on every route', async () => {
    for (const [method, url] of [['get', '/api/notifications'], ['get', '/api/notifications/unread-count'], ['get', '/api/notifications/settings'], ['patch', '/api/notifications/settings'], ['post', '/api/notifications/read-all']]) {
      expect((await request(app)[method](url)).status, url).toBe(401);
    }
  });

  it('requires CSRF on mutations', async () => {
    const response = await request(app).post('/api/notifications/read-all').set('Cookie', alice.cookie());
    expect(response.status).toBe(403);
  });

  it('creates overdue and stalled reminders once, with no duplicates on repeated reads', async () => {
    const overdue = await goal(alice, { title: 'Ship portfolio', deadline: dayKey(-3) });
    const stalled = await goal(alice, { title: 'Learn Docker', status: 'in_progress' });
    await backdate(stalled._id, 20);

    const first = await list(alice);
    expect(first.status).toBe(200);
    const types = first.body.data.items.map(item => `${item.type}:${item.subjectId}`);
    expect(types).toContain(`goal_overdue:${overdue._id}`);
    expect(types).toContain(`stalled:${stalled._id}`);
    expect(first.body.data.items[0]).not.toHaveProperty('owner');
    expect(first.body.data.items[0]).not.toHaveProperty('dedupeKey');

    await unthrottle(alice.userId);
    const second = await list(alice);
    expect(second.body.data.items).toHaveLength(first.body.data.items.length);
    expect(await Notification.countDocuments({ owner: alice.userId, subjectId: overdue._id })).toBe(1);
  });

  it('throttles regeneration to once per 5 minutes per user', async () => {
    const session = await createSession('nt_throttle');
    await list(session); // claims the refresh slot
    await goal(session, { title: 'Late after first check', deadline: dayKey(-1) });
    expect((await list(session)).body.data.items).toHaveLength(0);
    await unthrottle(session.userId);
    expect((await list(session)).body.data.items).toHaveLength(1);
  });

  it('marks one or all as read, keeps the first read time, and counts unread', async () => {
    const session = await createSession('nt_read');
    await goal(session, { title: 'Late one', deadline: dayKey(-2) });
    await goal(session, { title: 'Late two', deadline: dayKey(-2) });
    const { items, unread } = (await list(session)).body.data;
    expect(unread).toBe(2);

    const read = await session.patch(`/api/notifications/${items[0]._id}/read`);
    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toBeTruthy();
    const again = await session.patch(`/api/notifications/${items[0]._id}/read`);
    expect(again.body.data.readAt).toBe(read.body.data.readAt);
    expect((await session.get(`/api/notifications/unread-count?today=${dayKey(0)}`)).body.data.unread).toBe(1);

    const all = await session.post('/api/notifications/read-all');
    expect(all.body.data.updated).toBe(1);
    expect((await session.get(`/api/notifications/unread-count?today=${dayKey(0)}`)).body.data.unread).toBe(0);
  });

  it("cannot read or mark another user's notifications", async () => {
    const { items } = (await list(alice)).body.data;
    const target = items[0]._id;
    expect((await mallory.patch(`/api/notifications/${target}/read`)).status).toBe(404);
    expect((await list(mallory)).body.data.items.find(item => item._id === target)).toBeUndefined();
    await mallory.post('/api/notifications/read-all');
    expect((await Notification.findById(target).lean()).readAt).toBeNull();
  });

  it('validates queries, ids and settings', async () => {
    for (const query of ['limit=0', 'limit=51', 'before=nope', 'today=2001-01-01', 'evil=1', 'before[$gt]=a']) {
      expect((await alice.get(`/api/notifications?${query}`)).status, query).toBe(400);
    }
    expect((await alice.patch('/api/notifications/not-an-id/read')).status).toBe(400);
    for (const body of [{}, { stalledAfterDays: 2 }, { stalledAfterDays: 61 }, { stalledAfterDays: 7.5 }, { enabled: 'yes' }, { deadlineAlerts: 1 }, { stalledAfterDays: 7, remindersCheckedAt: null }]) {
      expect((await alice.patch('/api/notifications/settings').send(body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('applies settings: custom stall threshold (also on the dashboard), deadline alerts off, and disabled', async () => {
    const session = await createSession('nt_settings');
    expect((await session.get('/api/notifications/settings')).body.data).toEqual({ enabled: true, stalledAfterDays: 14, deadlineAlerts: true, weeklyReview: true, email: true });

    const idle = await goal(session, { title: 'Idle five days', status: 'in_progress' });
    await backdate(idle._id, 5);
    await goal(session, { title: 'Late but muted', deadline: dayKey(-1) });

    const saved = await session.patch('/api/notifications/settings').send({ stalledAfterDays: 4, deadlineAlerts: false });
    expect(saved.body.data).toEqual({ enabled: true, stalledAfterDays: 4, deadlineAlerts: false, weeklyReview: true, email: true });

    const types = (await list(session)).body.data.items.map(item => item.type);
    expect(types).toEqual(['stalled']);
    const attention = await session.get(`/api/dashboard/attention?today=${dayKey(0)}`);
    expect(attention.body.data.rules.stalledDays).toBe(4);

    const quiet = await createSession('nt_quiet');
    await quiet.patch('/api/notifications/settings').send({ enabled: false });
    await goal(quiet, { title: 'Late but disabled', deadline: dayKey(-1) });
    expect((await list(quiet)).body.data.items).toHaveLength(0);
  });

  it('announces a reached verified target', async () => {
    const session = await createSession('nt_target');
    await CodingProfile.create({ owner: session.userId, platform: 'leetcode', username: session.user.username, normalizedUsername: session.user.username.toLowerCase(), connectionStatus: 'verified', verifiedAt: new Date() });
    const target = await goal(session, { title: 'Two solves', target: { kind: 'leetcode_solved', count: 2 } });
    for (let i = 0; i < 2; i += 1) {
      await SolvedProblem.create({ owner: session.userId, platform: 'leetcode', titleSlug: `nt-${i}-${Date.now()}`, title: `NT ${i}`, difficulty: 'Easy', pattern: 'Array', firstAcceptedAt: new Date(), lastAcceptedAt: new Date() });
    }
    const items = (await list(session)).body.data.items;
    expect(items.find(item => item.type === 'target_reached' && item.subjectId === target._id)).toBeTruthy();
  });

  it('paginates with a cursor', async () => {
    const session = await createSession('nt_page');
    for (let i = 0; i < 3; i += 1) await goal(session, { title: `Late goal ${i}`, deadline: dayKey(-1) });
    const first = (await list(session, '&limit=2')).body.data;
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = (await list(session, `&limit=2&before=${first.nextCursor}`)).body.data;
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('removes reminders when their goal is deleted', async () => {
    const session = await createSession('nt_delete');
    const late = await goal(session, { title: 'Delete me', deadline: dayKey(-1) });
    expect((await list(session)).body.data.items).toHaveLength(1);
    await session.del(`/api/goals/${late._id}`);
    expect(await Notification.countDocuments({ owner: session.userId })).toBe(0);
  });
});
