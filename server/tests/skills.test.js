import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import CodingProfile from '../src/models/CodingProfile.js';
import SolvedProblem from '../src/models/SolvedProblem.js';
import { createSession } from './helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const todayUtc = () => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};
const daysAgo = days => new Date(todayUtc() - days * DAY_MS + 12 * 60 * 60 * 1000);

let slugSeq = 0;
async function solved(owner, pattern, difficulty, firstDaysAgo, lastDaysAgo = firstDaysAgo) {
  slugSeq += 1;
  return SolvedProblem.create({
    owner, platform: 'leetcode', titleSlug: `skill-problem-${slugSeq}-${Date.now()}`, title: `Problem ${slugSeq}`,
    difficulty, pattern, firstAcceptedAt: daysAgo(firstDaysAgo), lastAcceptedAt: daysAgo(lastDaysAgo), acceptedCount: 1,
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

const skills = session => session.get('/api/coding-profiles/leetcode/skills');
const patternOf = (response, name) => response.body.data.patterns.find(item => item.pattern === name);

describe('LeetCode skills', () => {
  let alice;

  beforeAll(async () => {
    alice = await verifiedUser('sk_alice');
    // Graphs: 6 solves over 30 days, all Easy -> stuck on easy.
    for (let i = 0; i < 6; i += 1) await solved(alice.userId, 'BFS', 'Easy', 30 - i * 6);
    // DP: solid (5 harder incl. a Hard), last solved 40 days ago -> fading.
    for (const [difficulty, age] of [['Medium', 60], ['Medium', 55], ['Medium', 50], ['Hard', 45], ['Medium', 40]]) {
      await solved(alice.userId, 'Dynamic Programming', difficulty, age);
    }
    // Two Pointers: 2 Easy recently -> starting, no signal, should try Medium next.
    await solved(alice.userId, 'Two Pointers', 'Easy', 3);
    await solved(alice.userId, 'Two Pointers', 'Easy', 1);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/coding-profiles/leetcode/skills')).status).toBe(401);
  });

  it('rejects bad dates and unknown query fields', async () => {
    for (const query of ['today=2026-02-30', 'today=nope', 'limit=5', 'today[$ne]=1']) {
      expect((await alice.get(`/api/coding-profiles/leetcode/skills?${query}`)).status, query).toBe(400);
    }
  });

  it('reports not connected without a verified LeetCode profile, even if rows exist', async () => {
    const bob = await createSession('sk_bob');
    await solved(bob.userId, 'BFS', 'Easy', 2);
    const response = await skills(bob);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ connected: false, totalSolved: 0, patterns: [], focus: null });
  });

  it('summarises each pattern with counts, level and recommended next difficulty', async () => {
    const response = await skills(alice);
    expect(response.status).toBe(200);
    const { data } = response.body;
    expect(data.connected).toBe(true);
    expect(data.totalSolved).toBe(13);

    expect(patternOf(response, 'BFS')).toMatchObject({ total: 6, easy: 6, medium: 0, harderShare: 0, level: 'starting', recommendedDifficulty: 'Medium' });
    expect(patternOf(response, 'Dynamic Programming')).toMatchObject({ total: 5, medium: 4, hard: 1, level: 'solid', recommendedDifficulty: 'Hard' });
    expect(patternOf(response, 'Two Pointers')).toMatchObject({ total: 2, level: 'starting', recommendedDifficulty: 'Medium', signals: [] });
    expect(data.patterns[0].pattern).toBe('BFS');
  });

  it('flags stuck-on-easy and fading, and focuses on the stuck topic first', async () => {
    const response = await skills(alice);
    expect(patternOf(response, 'BFS').signals).toEqual([{ code: 'stuck_on_easy', spanDays: 30, harderShare: 0 }]);
    expect(patternOf(response, 'Dynamic Programming').signals).toEqual([{ code: 'fading', idleDays: 40 }]);
    expect(response.body.data.focus).toMatchObject({ pattern: 'BFS', signal: { code: 'stuck_on_easy' }, recommendedDifficulty: 'Medium' });
  });

  it('lists untouched core patterns', async () => {
    const { untouchedCore } = (await skills(alice)).body.data;
    expect(untouchedCore).toContain('Sliding Window');
    expect(untouchedCore).not.toContain('BFS');
    expect(untouchedCore).not.toContain('Dynamic Programming');
  });

  it('respects threshold edges: 4 Easy solves or a short span are not stuck; 20% harder is not stuck', async () => {
    const carol = await verifiedUser('sk_carol');
    for (let i = 0; i < 4; i += 1) await solved(carol.userId, 'Stack', 'Easy', 40 - i * 10);
    for (let i = 0; i < 6; i += 1) await solved(carol.userId, 'Greedy', 'Easy', 10 - i);
    for (const difficulty of ['Easy', 'Easy', 'Easy', 'Easy', 'Medium']) await solved(carol.userId, 'Trie', difficulty, 25);
    await solved(carol.userId, 'Trie', 'Easy', 2);

    const response = await skills(carol);
    expect(patternOf(response, 'Stack').signals).toEqual([]);
    expect(patternOf(response, 'Greedy').signals).toEqual([]);
    // 1 of 6 known is ~17% harder -> still stuck; prove the 20% boundary with one more Medium.
    expect(patternOf(response, 'Trie').signals[0].code).toBe('stuck_on_easy');
    await solved(carol.userId, 'Trie', 'Medium', 2);
    expect(patternOf(await skills(carol), 'Trie').signals.map(signal => signal.code)).not.toContain('stuck_on_easy');
  });

  it('counts unknown difficulty in totals but not in shares', async () => {
    const dave = await verifiedUser('sk_dave');
    await solved(dave.userId, null, null, 5);
    await solved(dave.userId, 'Heap', null, 5);
    const response = await skills(dave);
    expect(patternOf(response, 'Other')).toMatchObject({ total: 1, unknown: 1, harderShare: null });
    expect(patternOf(response, 'Heap')).toMatchObject({ total: 1, unknown: 1, harderShare: null, signals: [] });
  });

  it("never includes another user's problems", async () => {
    const mallory = await verifiedUser('sk_mallory');
    for (let i = 0; i < 3; i += 1) await solved(mallory.userId, 'Segment Tree', 'Hard', 2);
    const response = await skills(alice);
    expect(patternOf(response, 'Segment Tree')).toBeUndefined();
    expect(response.body.data.totalSolved).toBe(13);
  });
});
