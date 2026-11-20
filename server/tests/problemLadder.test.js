import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/services/leetcodeSubmissions.service.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, postGraphQL: vi.fn() };
});

import app from '../src/app.js';
import CodingProfile from '../src/models/CodingProfile.js';
import LeetCodeTagList from '../src/models/LeetCodeTagList.js';
import ProblemLadder from '../src/models/ProblemLadder.js';
import SolvedProblem from '../src/models/SolvedProblem.js';
import { postGraphQL } from '../src/services/leetcodeSubmissions.service.js';
import { buildSteps, parseQuestionList, questionsFor } from '../src/services/problemLadder.service.js';
import AppError from '../src/utils/AppError.js';
import { createSession } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const today = () => new Date().toISOString().slice(0, 10);

// A LeetCode questionList answer: n free problems of one difficulty (plus one paid one to skip).
function catalogue(tag, difficulty, n) {
  const data = Array.from({ length: n }, (_, i) => ({
    acRate: 90 - i,
    difficulty,
    questionFrontendId: String(1000 + i),
    isPaidOnly: false,
    title: `${tag} ${difficulty} ${i}`,
    titleSlug: `${tag}-${difficulty.toLowerCase()}-${i}`,
  }));
  data.push({ acRate: 99, difficulty, questionFrontendId: '9', isPaidOnly: true, title: 'Paid', titleSlug: `${tag}-paid` });
  return { questionList: { data } };
}

// Answers by the requested filters, like LeetCode would.
function fakeLeetCode() {
  postGraphQL.mockImplementation(async (query, variables) => {
    const difficulty = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }[variables.filters.difficulty];
    return catalogue(variables.filters.tags[0], difficulty, 10);
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

let seq = 0;
const solve = (owner, { pattern = 'BFS', difficulty = 'Easy', slug, daysAgo = 5 } = {}) => {
  seq += 1;
  const at = new Date(Date.now() - daysAgo * DAY);
  return SolvedProblem.create({
    owner, platform: 'leetcode', titleSlug: slug || `ladder-solve-${seq}-${Date.now()}`, title: `Solved ${seq}`,
    difficulty, pattern, firstAcceptedAt: at, lastAcceptedAt: at, acceptedCount: 1,
  });
};

beforeEach(async () => {
  vi.clearAllMocks();
  await LeetCodeTagList.deleteMany({});
  fakeLeetCode();
});

describe('Practice ladders', () => {
  it('suggests weak patterns, builds a ladder at the user’s level, and ticks steps off from verified solves', async () => {
    const s = await verifiedUser('ladder');
    // BFS: 6 Easy over 30 days -> stuck on easy, recommended Medium.
    for (let i = 0; i < 6; i += 1) await solve(s.userId, { pattern: 'BFS', difficulty: 'Easy', daysAgo: 30 - i * 6 });

    const list = await s.get(`/api/coding-profiles/leetcode/ladders?today=${today()}`);
    expect(list.status).toBe(200);
    expect(list.body.data.suggestions[0]).toMatchObject({ pattern: 'BFS', reason: 'stuck_on_easy', level: 'Medium' });
    expect(list.body.data.suggestions.some(item => item.reason === 'not_started')).toBe(true);

    const created = await s.post('/api/coding-profiles/leetcode/ladders').send({ pattern: 'BFS' });
    expect(created.status).toBe(201);
    const { ladder } = created.body.data;
    // Medium level: 1 Easy, 3 Medium, 2 Hard, easiest first, never the paid one.
    expect(ladder.steps.map(step => step.difficulty)).toEqual(['Easy', 'Medium', 'Medium', 'Medium', 'Hard', 'Hard']);
    expect(ladder.steps[1].titleSlug).toBe('breadth-first-search-medium-0');
    expect(ladder.steps.some(step => /paid/.test(step.titleSlug))).toBe(false);
    expect(ladder).toMatchObject({ pattern: 'BFS', reason: 'stuck_on_easy', solved: 0, total: 6, next: 'breadth-first-search-easy-0' });
    const filters = postGraphQL.mock.calls.map(([, variables]) => variables.filters);
    expect(filters).toEqual(expect.arrayContaining([{ tags: ['breadth-first-search'], difficulty: 'MEDIUM' }]));

    // A verified solve of the first step ticks it off on the next read.
    await solve(s.userId, { slug: 'breadth-first-search-easy-0' });
    const after = await s.get(`/api/coding-profiles/leetcode/ladders?today=${today()}`);
    const [mine] = after.body.data.ladders;
    expect(mine).toMatchObject({ solved: 1, next: 'breadth-first-search-medium-0', completedAt: null });
    expect(after.body.data.suggestions.some(item => item.pattern === 'BFS')).toBe(false);

    // Solving every step completes the ladder.
    for (const step of mine.steps.slice(1)) await solve(s.userId, { slug: step.titleSlug });
    const done = (await s.get(`/api/coding-profiles/leetcode/ladders?today=${today()}`)).body.data.ladders[0];
    expect(done.solved).toBe(6);
    expect(done.completedAt).not.toBeNull();
  });

  it('skips problems already solved and fills short lists from other difficulties', () => {
    const lists = {
      Easy: parseQuestionList(catalogue('t', 'Easy', 4), 'Easy'),
      Medium: parseQuestionList(catalogue('t', 'Medium', 1), 'Medium'),
      Hard: [],
    };
    const steps = buildSteps(lists, 'Medium', new Set(['t-easy-0']));
    expect(steps.map(step => step.titleSlug)).toEqual(['t-easy-1', 't-easy-2', 't-easy-3', 't-medium-0']);
    expect(steps.every(step => step.solvedAt === null)).toBe(true);
  });

  it('drops malformed and paid rows from LeetCode', () => {
    const rows = parseQuestionList({ questionList: { data: [
      { acRate: 50, difficulty: 'Easy', questionFrontendId: '1', isPaidOnly: false, title: 'Two Sum', titleSlug: 'two-sum' },
      { acRate: 60, difficulty: 'Easy', questionFrontendId: '2', isPaidOnly: false, title: 'Bad', titleSlug: '../etc' },
      { acRate: 70, difficulty: 'Medium', questionFrontendId: '3', isPaidOnly: false, title: 'Wrong level', titleSlug: 'wrong-level' },
      { acRate: 80, difficulty: 'Easy', questionFrontendId: '4', isPaidOnly: true, title: 'Paid', titleSlug: 'paid' },
      { acRate: 90, difficulty: 'Easy', questionFrontendId: 'x', isPaidOnly: false, title: 'Bad id', titleSlug: 'bad-id' },
    ] } }, 'Easy');
    expect(rows.map(row => row.titleSlug)).toEqual(['two-sum']);
  });

  it('caches lists for a week, keeps a good list over a bad answer, and falls back when LeetCode is down', async () => {
    await questionsFor('greedy', 'Easy');
    await questionsFor('greedy', 'Easy');
    expect(postGraphQL).toHaveBeenCalledTimes(1);

    const later = new Date(Date.now() + 8 * DAY);
    postGraphQL.mockResolvedValueOnce({ questionList: { data: [] } });
    expect(await questionsFor('greedy', 'Easy', later)).toHaveLength(10);
    postGraphQL.mockRejectedValueOnce(new AppError('Unable to reach LeetCode.', 503, 'PROVIDER_UNAVAILABLE'));
    expect(await questionsFor('greedy', 'Easy', later)).toHaveLength(10);

    postGraphQL.mockRejectedValueOnce(new AppError('Unable to reach LeetCode.', 503, 'PROVIDER_UNAVAILABLE'));
    await expect(questionsFor('trie', 'Easy')).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });

  it('needs a verified LeetCode profile, a known pattern, CSRF and ownership; limits duplicates', async () => {
    const plain = await createSession('ladder_plain');
    expect((await plain.post('/api/coding-profiles/leetcode/ladders').send({ pattern: 'BFS' })).body.code).toBe('LEETCODE_NOT_VERIFIED');
    expect((await plain.get(`/api/coding-profiles/leetcode/ladders?today=${today()}`)).body.data).toMatchObject({ connected: false, ladders: [] });

    const s = await verifiedUser('ladder_rules');
    for (const body of [{}, { pattern: 'Other' }, { pattern: 'constructor' }, { pattern: 'BFS', extra: 1 }, { pattern: ['BFS'] }]) {
      expect((await s.post('/api/coding-profiles/leetcode/ladders').send(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await request(app).post('/api/coding-profiles/leetcode/ladders').set('Cookie', s.cookie()).send({ pattern: 'BFS' })).status).toBe(403);

    const created = await s.post('/api/coding-profiles/leetcode/ladders').send({ pattern: 'Trie' });
    expect(created.status).toBe(201);
    expect((await s.post('/api/coding-profiles/leetcode/ladders').send({ pattern: 'Trie' })).body.code).toBe('LADDER_EXISTS');

    const other = await verifiedUser('ladder_other');
    expect((await other.del(`/api/coding-profiles/leetcode/ladders/${created.body.data.ladder.id}`)).status).toBe(404);
    expect((await s.del(`/api/coding-profiles/leetcode/ladders/${created.body.data.ladder.id}`)).status).toBe(204);

    for (const pattern of ['Trie', 'Heap', 'Greedy', 'Stack', 'Queue']) await s.post('/api/coding-profiles/leetcode/ladders').send({ pattern });
    expect((await s.post('/api/coding-profiles/leetcode/ladders').send({ pattern: 'Graph' })).body.code).toBe('LADDER_LIMIT');
    expect(await ProblemLadder.countDocuments({ owner: s.userId })).toBe(5);
  });
});
