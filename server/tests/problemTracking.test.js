import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/leetcodeOwnership.service.js', () => ({ fetchLeetCodeOwnershipProfile: vi.fn() }));
vi.mock('../src/services/leetcode.service.js', () => ({ fetchLeetCodeStats: vi.fn() }));
vi.mock('../src/services/leetcodeSubmissions.service.js', () => ({
  RECENT_LIMIT: 20,
  fetchRecentAcceptedSubmissions: vi.fn(),
  fetchQuestionMeta: vi.fn(),
}));

import request from 'supertest';
import app from '../src/app.js';
import { fetchLeetCodeOwnershipProfile } from '../src/services/leetcodeOwnership.service.js';
import { fetchLeetCodeStats } from '../src/services/leetcode.service.js';
import { fetchRecentAcceptedSubmissions, fetchQuestionMeta } from '../src/services/leetcodeSubmissions.service.js';
import AppError from '../src/utils/AppError.js';
import CodingProfile from '../src/models/CodingProfile.js';
import CodingSubmission from '../src/models/CodingSubmission.js';
import SolvedProblem from '../src/models/SolvedProblem.js';
import { createSession } from './helpers.js';

const DAY = 86_400_000;
const daysAgo = (days, hour = 10) => {
  const date = new Date(Date.now() - days * DAY);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

const stats = {
  totalSolved: 3, easySolved: 1, mediumSolved: 1, hardSolved: 1,
  totalAvailable: 3000, easyAvailable: 800, mediumAvailable: 1600, hardAvailable: 600,
  contestRating: null, submissionCalendar: {}, fetchedAt: new Date(),
};

const META = {
  'two-sum': { titleSlug: 'two-sum', frontendId: '1', title: 'Two Sum', difficulty: 'Easy', topics: [{ name: 'Array', slug: 'array' }, { name: 'Hash Table', slug: 'hash-table' }] },
  'regular-expression-matching': { titleSlug: 'regular-expression-matching', frontendId: '10', title: 'Regular Expression Matching', difficulty: 'Hard', topics: [{ name: 'String', slug: 'string' }, { name: 'Dynamic Programming', slug: 'dynamic-programming' }, { name: 'Recursion', slug: 'recursion' }] },
  'merge-k-sorted-lists': { titleSlug: 'merge-k-sorted-lists', frontendId: '23', title: 'Merge k Sorted Lists', difficulty: 'Hard', topics: [{ name: 'Linked List', slug: 'linked-list' }, { name: 'Divide and Conquer', slug: 'divide-and-conquer' }, { name: 'Heap (Priority Queue)', slug: 'heap-priority-queue' }] },
};

let nextId = 1_000_000;
const sub = (titleSlug, submittedAt, lang = 'java') => ({ submissionId: String(nextId++), titleSlug, title: META[titleSlug]?.title ?? titleSlug, submittedAt, lang });

async function verifiedSession(prefix = 'track') {
  const session = await createSession(prefix);
  const username = `${prefix}_${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const start = await session.post('/api/coding-profiles/verification/start').send({ platform: 'leetcode', username });
  const token = start.body.data.challenge.token;
  fetchLeetCodeOwnershipProfile.mockResolvedValue({ username, aboutMe: token });
  const verified = await session.post('/api/coding-profiles/verification/verify').send({ platform: 'leetcode', token });
  expect(verified.status).toBe(200);
  return session;
}

const sync = (session, body = {}) => session.post('/api/coding-profiles/leetcode/sync').send(body);
// Skip the 10-minute throttle between test steps.
const ageLastSync = userId => CodingProfile.updateOne({ owner: userId, platform: 'leetcode' }, { $set: { submissionsSyncedAt: new Date(Date.now() - 11 * 60_000) } });
const solvedEvents = async session => (await session.get('/api/activity?type=problem_solved&limit=50')).body.data.items;

describe('LeetCode problem tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLeetCodeStats.mockResolvedValue(stats);
    fetchQuestionMeta.mockImplementation(async slug => {
      if (!META[slug]) throw new AppError('LeetCode returned incomplete problem details.', 502);
      return META[slug];
    });
  });

  it('reports not_connected for users without a verified LeetCode profile', async () => {
    const session = await createSession('track_none');
    const response = await sync(session);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'not_connected', newSolves: 0 });
    expect(fetchRecentAcceptedSubmissions).not.toHaveBeenCalled();
  });

  it('first sync backfills problems with details and pattern, without timeline events', async () => {
    const session = await verifiedSession();
    fetchRecentAcceptedSubmissions.mockResolvedValue([
      sub('two-sum', daysAgo(3)),
      sub('regular-expression-matching', daysAgo(2), 'python3'),
      sub('two-sum', daysAgo(1)),
    ]);

    const response = await sync(session);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'synced', stats: 'ok', submissions: 'ok', newSubmissions: 3, newSolves: 0 });

    const twoSum = await SolvedProblem.findOne({ owner: session.userId, titleSlug: 'two-sum' }).lean();
    expect(twoSum).toMatchObject({ frontendId: '1', difficulty: 'Easy', pattern: 'HashMap', patternTopic: 'hash-table', acceptedCount: 2, languages: ['java'] });
    expect(twoSum.firstAcceptedAt.getTime()).toBe(daysAgo(3).getTime());
    expect(twoSum.lastAcceptedAt.getTime()).toBe(daysAgo(1).getTime());
    const regex = await SolvedProblem.findOne({ owner: session.userId, titleSlug: 'regular-expression-matching' }).lean();
    expect(regex.pattern).toBe('Dynamic Programming');

    expect(await solvedEvents(session)).toHaveLength(0);
    const profile = await CodingProfile.findOne({ owner: session.userId }).lean();
    expect(profile.trackingSince).toBeTruthy();
  });

  it('throttles automatic syncs to one per 10 minutes', async () => {
    const session = await verifiedSession();
    fetchRecentAcceptedSubmissions.mockResolvedValue([]);
    await sync(session);
    const again = await sync(session);
    expect(again.body.data.status).toBe('fresh');
    expect(fetchRecentAcceptedSubmissions).toHaveBeenCalledTimes(1);
    expect(fetchLeetCodeStats).toHaveBeenCalledTimes(1);
  });

  it('records one verified event per problem per day, only for new accepted submissions', async () => {
    const session = await verifiedSession();
    const old = sub('two-sum', daysAgo(5));
    fetchRecentAcceptedSubmissions.mockResolvedValue([old]);
    await sync(session); // backfill
    await ageLastSync(session.userId);

    const newAt = daysAgo(0, 1);
    fetchRecentAcceptedSubmissions.mockResolvedValue([
      old,
      sub('merge-k-sorted-lists', newAt),
      sub('merge-k-sorted-lists', new Date(newAt.getTime() + 60_000)), // second AC, same day
      sub('two-sum', new Date(newAt.getTime() + 120_000)), // re-solve on a new day
    ]);
    const response = await sync(session);
    expect(response.body.data).toMatchObject({ newSubmissions: 3, newSolves: 2 });

    const events = await solvedEvents(session);
    expect(events.map(event => event.title).sort()).toEqual(['Solved again: 1. Two Sum', 'Solved: 23. Merge k Sorted Lists']);
    const merge = events.find(event => event.title.includes('Merge'));
    expect(merge).toMatchObject({ detail: 'Hard · Heap', source: 'verified', subjectType: 'problem' });
    expect(new Date(merge.occurredAt).getTime()).toBe(newAt.getTime());

    // Syncing the same submissions again is a no-op.
    await ageLastSync(session.userId);
    const repeat = await sync(session);
    expect(repeat.body.data).toMatchObject({ newSubmissions: 0, newSolves: 0 });
    expect(await solvedEvents(session)).toHaveLength(2);
    expect(await CodingSubmission.countDocuments({ owner: session.userId })).toBe(4);
  });

  it('concurrent syncs import once', async () => {
    const session = await verifiedSession();
    fetchRecentAcceptedSubmissions.mockResolvedValue([sub('two-sum', daysAgo(1))]);
    const results = await Promise.all([sync(session), sync(session), sync(session)]);
    expect(results.filter(result => result.body.data.status === 'synced')).toHaveLength(1);
    expect(fetchRecentAcceptedSubmissions).toHaveBeenCalledTimes(1);
  });

  it('a submission-provider failure writes nothing, keeps stats, and allows an immediate retry', async () => {
    const session = await verifiedSession();
    fetchRecentAcceptedSubmissions.mockRejectedValue(new AppError('Unable to reach LeetCode.', 503));
    const failed = await sync(session);
    expect(failed.status).toBe(200);
    expect(failed.body.data).toMatchObject({ stats: 'ok', submissions: 'failed' });
    expect(await CodingSubmission.countDocuments({ owner: session.userId })).toBe(0);

    fetchRecentAcceptedSubmissions.mockResolvedValue([sub('two-sum', daysAgo(1))]);
    const retry = await sync(session);
    expect(retry.body.data).toMatchObject({ status: 'synced', submissions: 'ok', newSubmissions: 1 });
  });

  it('returns 503 when both LeetCode calls fail, leaving saved stats untouched', async () => {
    const session = await verifiedSession();
    fetchRecentAcceptedSubmissions.mockResolvedValue([]);
    await sync(session);
    const before = (await CodingProfile.findOne({ owner: session.userId }).lean()).stats;

    await ageLastSync(session.userId);
    fetchLeetCodeStats.mockRejectedValue(new Error('LeetCode request timed out.'));
    fetchRecentAcceptedSubmissions.mockRejectedValue(new AppError('Unable to reach LeetCode.', 503));
    const response = await sync(session);
    expect(response.status).toBe(503);
    expect((await CodingProfile.findOne({ owner: session.userId }).lean()).stats.totalSolved).toBe(before.totalSolved);
  });

  it('stores problems whose details fail to load and fills them in on a later sync', async () => {
    const session = await verifiedSession();
    // Details are cached per problem for all users; start without a cached entry.
    const { default: LeetCodeQuestion } = await import('../src/models/LeetCodeQuestion.js');
    await LeetCodeQuestion.deleteOne({ _id: 'two-sum' });
    fetchQuestionMeta.mockRejectedValue(new AppError('LeetCode returned incomplete problem details.', 502));
    fetchRecentAcceptedSubmissions.mockResolvedValue([sub('two-sum', daysAgo(1))]);
    await sync(session);
    const pending = await SolvedProblem.findOne({ owner: session.userId, titleSlug: 'two-sum' }).lean();
    expect(pending).toMatchObject({ difficulty: null, pattern: null, title: 'Two Sum' });

    fetchQuestionMeta.mockImplementation(async slug => META[slug]);
    await ageLastSync(session.userId);
    await sync(session);
    const filled = await SolvedProblem.findOne({ owner: session.userId, titleSlug: 'two-sum' }).lean();
    expect(filled).toMatchObject({ difficulty: 'Easy', pattern: 'HashMap', frontendId: '1' });
  });

  it('lists the problem log newest first with top patterns, scoped to the caller', async () => {
    const session = await verifiedSession();
    fetchRecentAcceptedSubmissions.mockResolvedValue([
      sub('two-sum', daysAgo(3)),
      sub('merge-k-sorted-lists', daysAgo(1)),
      sub('regular-expression-matching', daysAgo(2)),
    ]);
    await sync(session);

    const response = await session.get('/api/coding-profiles/leetcode/problems?limit=2');
    expect(response.status).toBe(200);
    const { items, total, pages, topPatterns, trackingSince } = response.body.data;
    expect(items.map(item => item.titleSlug)).toEqual(['merge-k-sorted-lists', 'regular-expression-matching']);
    expect(items[0].owner).toBeUndefined();
    expect({ total, pages }).toEqual({ total: 3, pages: 2 });
    expect(topPatterns).toHaveLength(3);
    expect(trackingSince).toBeTruthy();

    const other = await createSession('track_other');
    const otherList = await other.get('/api/coding-profiles/leetcode/problems');
    expect(otherList.body.data.items).toEqual([]);

    expect((await session.get('/api/coding-profiles/leetcode/problems?limit=500')).status).toBe(400);
    expect((await session.get('/api/coding-profiles/leetcode/problems?page=0')).status).toBe(400);
    expect((await request(app).get('/api/coding-profiles/leetcode/problems')).status).toBe(401);
  });

  it('groups accepted problems by UTC day for the heatmap', async () => {
    const session = await verifiedSession();
    const day = daysAgo(2, 9);
    fetchRecentAcceptedSubmissions.mockResolvedValue([
      sub('two-sum', day),
      sub('two-sum', new Date(day.getTime() + 60_000)),
      sub('merge-k-sorted-lists', new Date(day.getTime() + 120_000)),
      sub('regular-expression-matching', daysAgo(1)),
    ]);
    await sync(session);

    const key = day.toISOString().slice(0, 10);
    const from = daysAgo(10).toISOString().slice(0, 10);
    const to = daysAgo(0).toISOString().slice(0, 10);
    const response = await session.get(`/api/coding-profiles/leetcode/days?from=${from}&to=${to}`);
    expect(response.status).toBe(200);
    expect(response.body.data.days[key]).toEqual([
      { titleSlug: 'two-sum', title: 'Two Sum', status: 'accepted', count: 2 },
      { titleSlug: 'merge-k-sorted-lists', title: 'Merge k Sorted Lists', status: 'accepted', count: 1 },
    ]);

    expect((await session.get('/api/coding-profiles/leetcode/days?from=2026-02-30&to=2026-03-01')).status).toBe(400);
    expect((await session.get('/api/coding-profiles/leetcode/days?from=2024-01-01&to=2026-01-01')).status).toBe(400);
    expect((await session.get(`/api/coding-profiles/leetcode/days?from=${to}&to=${from}`)).status).toBe(400);
  });

  it('validates the sync body and requires CSRF', async () => {
    const session = await verifiedSession();
    expect((await sync(session, { force: 'yes' })).status).toBe(400);
    expect((await sync(session, { username: 'someone-else' })).status).toBe(400);
    const noCsrf = await request(app).post('/api/coding-profiles/leetcode/sync').set('Cookie', session.cookie()).send({});
    expect(noCsrf.status).toBe(403);
  });

  it('deletes tracked problems when LeetCode is disconnected', async () => {
    const session = await verifiedSession();
    fetchRecentAcceptedSubmissions.mockResolvedValue([sub('two-sum', daysAgo(1))]);
    await sync(session);
    expect(await SolvedProblem.countDocuments({ owner: session.userId })).toBe(1);

    expect((await session.del('/api/coding-profiles/leetcode')).status).toBe(200);
    expect(await SolvedProblem.countDocuments({ owner: session.userId })).toBe(0);
    expect(await CodingSubmission.countDocuments({ owner: session.userId })).toBe(0);
  });
});
