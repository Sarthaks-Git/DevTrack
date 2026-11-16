import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import Activity from '../src/models/Activity.js';
import CodingProfile from '../src/models/CodingProfile.js';
import Goal from '../src/models/Goal.js';
import Notification from '../src/models/Notification.js';
import SolvedProblem from '../src/models/SolvedProblem.js';
import { createSession } from './helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const today = new Date(todayMs).toISOString().slice(0, 10);
const weekday = (new Date(todayMs).getUTCDay() + 6) % 7; // Monday = 0
const weekStart = todayMs - weekday * DAY_MS; // Monday 00:00 UTC of this week
const lastWeekStart = weekStart - 7 * DAY_MS;
const dayKey = ms => new Date(ms).toISOString().slice(0, 10);

const goal = (title, extra = {}) => ({ title, description: 'Weekly review test', priority: 'high', status: 'in_progress', deadline: '2026-12-31', ...extra });

let slugSeq = 0;
function solve(owner, at, difficulty = 'Medium', pattern = 'Dynamic Programming') {
  slugSeq += 1;
  return SolvedProblem.create({
    owner, platform: 'leetcode', titleSlug: `weekly-problem-${slugSeq}-${Date.now()}`, title: `Problem ${slugSeq}`,
    difficulty, pattern, firstAcceptedAt: new Date(at), lastAcceptedAt: new Date(at), acceptedCount: 1,
  });
}

async function verifiedUser(prefix) {
  const session = await createSession(prefix);
  await CodingProfile.create({
    owner: session.userId, platform: 'leetcode', username: session.user.username,
    normalizedUsername: session.user.username.toLowerCase(), connectionStatus: 'verified', verifiedAt: new Date(),
  });
  return session;
}

const review = (session, query = '') => session.get(`/api/dashboard/weekly?today=${today}${query}`);

describe('Weekly review', () => {
  let alice;
  let bob;

  beforeAll(async () => {
    alice = await verifiedUser('wk_alice');
    bob = await createSession('wk_bob');

    // This week: a finished goal, a finished milestone, a journal entry and three verified solves.
    await alice.post('/api/goals').send(goal('Ship auth module', { status: 'completed' }));
    const open = await alice.post('/api/goals').send(goal('Learn system design'));
    await alice.post(`/api/goals/${open.body.goal._id}/milestones`).send({ title: 'Read chapter 1' });
    const milestoneId = (await Goal.findById(open.body.goal._id).lean()).milestones[0]._id;
    await alice.patch(`/api/goals/${open.body.goal._id}/milestones/${milestoneId}`).send({ done: true });
    await alice.post('/api/journal').send({ title: 'Week notes' });

    const thisWeek = Math.min(weekStart + 2 * 60 * 60 * 1000, Date.now() - 60 * 1000);
    await solve(alice.userId, thisWeek, 'Medium', 'Dynamic Programming');
    await solve(alice.userId, thisWeek, 'Hard', 'Dynamic Programming');
    await solve(alice.userId, thisWeek, 'Easy', 'Two Pointers');

    // Last week: one solve, used for the comparison.
    await solve(alice.userId, lastWeekStart + DAY_MS, 'Easy', 'Two Pointers');

    // Bob's data must never show up in Alice's review.
    await bob.post('/api/goals').send(goal('Bob private goal', { status: 'completed' }));
  });

  it('requires authentication', async () => {
    expect((await request(app).get(`/api/dashboard/weekly?today=${today}`)).status).toBe(401);
  });

  it('rejects bad timezones, weeks, dates and unknown fields', async () => {
    for (const query of ['&tz=900', '&tz=-721', '&tz=5.5', '&tz=abc', '&week=next', '&limit=5', '&tz[$gt]=0']) {
      expect((await review(alice, query)).status, query).toBe(400);
    }
    expect((await alice.get('/api/dashboard/weekly?today=2020-01-01')).status).toBe(400);
  });

  it('summarises what was finished, verified solves and consistency this week', async () => {
    const res = await review(alice);
    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.week).toMatchObject({ which: 'current', start: dayKey(weekStart), end: dayKey(weekStart + 6 * DAY_MS), daysElapsed: weekday + 1, complete: false });
    expect(data.finished.goals.map(g => g.title)).toEqual(['Ship auth module']);
    expect(data.finished.milestones).toEqual([expect.objectContaining({ title: 'Read chapter 1', parentTitle: 'Learn system design', kind: 'goal' })]);
    expect(data.verified).toMatchObject({ connected: true, solved: 3, easy: 1, medium: 1, hard: 1 });
    expect(data.verified.topPatterns[0]).toEqual({ pattern: 'Dynamic Programming', count: 2 });
    expect(data.consistency.days).toHaveLength(weekday + 1);
    expect(data.consistency.activeDays).toBeGreaterThanOrEqual(1);
    expect(data.consistency.journalEntries).toBe(1);
    expect(data.totals).toMatchObject({ solved: 3, finished: 2, journalEntries: 1 });
    expect(data.previous.solved).toBe(1);
  });

  it('reviews last week as a complete week', async () => {
    const data = (await review(alice, '&week=last')).body.data;
    expect(data.week).toMatchObject({ which: 'last', start: dayKey(lastWeekStart), daysElapsed: 7, complete: true });
    expect(data.verified.solved).toBe(1);
    expect(data.finished.goals).toEqual([]);
    expect(data.consistency.days).toHaveLength(7);
  });

  it('uses the viewer timezone for week boundaries', async () => {
    const carol = await verifiedUser('wk_carol');
    // 00:30 on Monday in India (UTC+5:30) is still Sunday evening in UTC.
    await solve(carol.userId, weekStart + 30 * 60 * 1000 - 330 * 60 * 1000);
    const india = (await review(carol, '&tz=330')).body.data;
    const utc = (await review(carol, '&tz=0')).body.data;
    expect(india.verified.solved).toBe(1);
    expect(utc.verified.solved).toBe(0);
    expect(utc.previous.solved).toBe(1);
  });

  it('never includes another user\'s records', async () => {
    const data = (await review(alice)).body.data;
    expect(JSON.stringify(data)).not.toContain('Bob private goal');
    const bobData = (await review(bob)).body.data;
    expect(bobData.verified).toMatchObject({ connected: false, solved: 0 });
    expect(bobData.finished.milestones).toEqual([]);
  });

  it('lists open work whose deadline passed during the week', async () => {
    const dave = await createSession('wk_dave');
    const created = await dave.post('/api/goals').send(goal('Finish portfolio'));
    await Goal.updateOne({ _id: created.body.goal._id }, { $set: { deadline: new Date(lastWeekStart + 2 * DAY_MS) } });
    const data = (await review(dave, '&week=last')).body.data;
    expect(data.slipped.overdue).toEqual([expect.objectContaining({ kind: 'goal', title: 'Finish portfolio' })]);
  });

  it('suggests at most three next steps for an active user and none for an empty one', async () => {
    const data = (await review(alice)).body.data;
    expect(data.focus.length).toBeLessThanOrEqual(3);
    const empty = (await review(await createSession('wk_empty'))).body.data;
    expect(empty.focus).toEqual([]);
    expect(empty.totals).toEqual({ solved: 0, finished: 0, activeDays: 0, journalEntries: 0 });
  });

  it('is rate-limited per user', async () => {
    const res = await review(alice);
    expect(res.headers['ratelimit-policy']).toContain('"12000-in-15min"');
  });
});

describe('Weekly review reminder', () => {
  const unread = session => session.get(`/api/notifications/unread-count?today=${today}`);
  const reviews = owner => Notification.find({ owner, type: 'weekly_review' }).lean();

  it('announces last week once, without titles or numbers, when the user was active', async () => {
    const erin = await createSession('wk_erin');
    await Activity.create({ owner: erin.userId, type: 'journal_created', subjectType: 'journal', title: 'Secret journal title', occurredAt: new Date(lastWeekStart + DAY_MS) });

    await unread(erin);
    const list = await reviews(erin.userId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ subjectType: 'review', subjectId: null, dedupeKey: `weekly_review:${dayKey(lastWeekStart)}` });
    expect(`${list[0].title} ${list[0].body}`).not.toContain('Secret journal title');

    await erin.patch('/api/notifications/settings').send({ stalledAfterDays: 15 }); // resets the throttle
    await unread(erin);
    expect(await reviews(erin.userId)).toHaveLength(1);
  });

  it('stays quiet for an inactive week or when turned off', async () => {
    const idle = await createSession('wk_idle');
    await unread(idle);
    expect(await reviews(idle.userId)).toHaveLength(0);

    const off = await createSession('wk_off');
    await Activity.create({ owner: off.userId, type: 'goal_created', subjectType: 'goal', title: 'x', occurredAt: new Date(lastWeekStart + DAY_MS) });
    const settings = await off.patch('/api/notifications/settings').send({ weeklyReview: false });
    expect(settings.body.data.weeklyReview).toBe(false);
    await unread(off);
    expect(await reviews(off.userId)).toHaveLength(0);
  });

  it('rejects a non-boolean weeklyReview setting', async () => {
    const s = await createSession('wk_bad');
    expect((await s.patch('/api/notifications/settings').send({ weeklyReview: 'yes' })).status).toBe(400);
  });
});
