import { describe, it, expect, beforeAll } from 'vitest';
import CodingProfile from '../src/models/CodingProfile.js';
import SolvedProblem from '../src/models/SolvedProblem.js';
import Goal from '../src/models/Goal.js';
import { createSession } from './helpers.js';

let seq = 0;
const solve = (owner, { pattern = 'Dynamic Programming', difficulty = 'Medium', at = new Date() } = {}) => {
  seq += 1;
  return SolvedProblem.create({
    owner, platform: 'leetcode', titleSlug: `target-${seq}-${Date.now()}`, title: `Target problem ${seq}`,
    pattern, difficulty, firstAcceptedAt: at, lastAcceptedAt: at, acceptedCount: 1,
  });
};

async function verify(session) {
  await CodingProfile.create({
    owner: session.userId, platform: 'leetcode', username: session.user.username,
    normalizedUsername: session.user.username.toLowerCase(), connectionStatus: 'verified', verifiedAt: new Date(),
  });
}

const DP_MEDIUM = { kind: 'leetcode_solved', pattern: 'Dynamic Programming', difficulty: 'Medium', count: 3 };

describe('Goals with verified targets', () => {
  let alice;

  beforeAll(async () => {
    alice = await createSession('gt_alice');
    await verify(alice);
  });

  async function targetGoal(session = alice, target = DP_MEDIUM) {
    const response = await session.post('/api/goals').send({ title: 'Get good at DP', target });
    expect(response.status).toBe(201);
    return response.body.goal;
  }

  it('stores the target with a server-set start time and reports zero progress', async () => {
    const goal = await targetGoal();
    expect(goal.target).toMatchObject({ ...DP_MEDIUM });
    expect(new Date(goal.target.since).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(goal.targetProgress).toEqual({ connected: true, current: 0, count: 3, reached: false, source: 'verified' });
  });

  it('counts only matching problems first solved after the target was set', async () => {
    const goal = await targetGoal();
    await solve(alice.userId, { at: new Date(Date.now() - 86_400_000) }); // before the target: ignored
    await solve(alice.userId, { difficulty: 'Easy' }); // wrong difficulty
    await solve(alice.userId, { pattern: 'BFS' }); // wrong pattern
    await solve(alice.userId);
    await solve(alice.userId);

    const response = await alice.get(`/api/goals/${goal._id}`);
    expect(response.body.goal.targetProgress).toMatchObject({ current: 2, count: 3, reached: false });

    await solve(alice.userId);
    await solve(alice.userId);
    const list = await alice.get('/api/goals');
    const listed = list.body.goals.find(item => item._id === goal._id);
    expect(listed.targetProgress).toMatchObject({ current: 3, count: 3, reached: true });
  });

  it('does not let the client set since or progress', async () => {
    const response = await alice.post('/api/goals').send({ title: 'Cheat goal', target: { ...DP_MEDIUM, since: '2000-01-01' } });
    expect(response.status).toBe(400);
    const progress = await alice.post('/api/goals').send({ title: 'Cheat goal', target: DP_MEDIUM, targetProgress: { current: 99 } });
    expect(progress.status).toBe(201);
    expect(progress.body.goal.targetProgress.current).toBe(0);
    const patch = await alice.patch(`/api/goals/${progress.body.goal._id}`).send({ targetProgress: { current: 99 } });
    expect(patch.status).toBe(400);
  });

  it('rejects malformed targets', async () => {
    const bad = [
      'nope', [], { ...DP_MEDIUM, kind: 'github_commits' }, { ...DP_MEDIUM, pattern: 'Telepathy' },
      { ...DP_MEDIUM, difficulty: 'Insane' }, { ...DP_MEDIUM, count: 0 }, { ...DP_MEDIUM, count: 1001 },
      { ...DP_MEDIUM, count: 2.5 }, { ...DP_MEDIUM, count: '3' }, { kind: 'leetcode_solved' },
    ];
    for (const target of bad) {
      const response = await alice.post('/api/goals').send({ title: 'Bad target goal', target });
      expect(response.status, JSON.stringify(target)).toBe(400);
    }
  });

  it('keeps progress when only the count changes, restarts when the scope changes, and can be removed', async () => {
    const goal = await targetGoal(alice, { kind: 'leetcode_solved', pattern: 'Trie', difficulty: null, count: 2 });
    await solve(alice.userId, { pattern: 'Trie', difficulty: 'Hard' });

    const bigger = await alice.patch(`/api/goals/${goal._id}`).send({ target: { kind: 'leetcode_solved', pattern: 'Trie', difficulty: null, count: 5 } });
    expect(bigger.status).toBe(200);
    expect(bigger.body.goal.target.since).toBe(goal.target.since);
    expect(bigger.body.goal.targetProgress).toMatchObject({ current: 1, count: 5 });

    const rescoped = await alice.patch(`/api/goals/${goal._id}`).send({ target: { kind: 'leetcode_solved', pattern: 'Trie', difficulty: 'Medium', count: 5 } });
    expect(new Date(rescoped.body.goal.target.since).getTime()).toBeGreaterThan(new Date(goal.target.since).getTime());
    expect(rescoped.body.goal.targetProgress.current).toBe(0);

    const removed = await alice.patch(`/api/goals/${goal._id}`).send({ target: null });
    expect(removed.body.goal.target).toBeNull();
    expect(removed.body.goal.targetProgress).toBeUndefined();
  });

  it('shows not connected (and no progress) without a verified LeetCode profile', async () => {
    const bob = await createSession('gt_bob');
    await solve(bob.userId);
    const goal = await targetGoal(bob);
    await solve(bob.userId);
    expect((await bob.get(`/api/goals/${goal._id}`)).body.goal.targetProgress).toEqual({ connected: false, current: 0, count: 3, reached: false, source: 'verified' });
  });

  it("never counts another user's solves", async () => {
    const carol = await createSession('gt_carol');
    await verify(carol);
    const goal = await targetGoal(carol, { kind: 'leetcode_solved', pattern: null, difficulty: null, count: 10 });
    const mallory = await createSession('gt_mallory');
    for (let i = 0; i < 3; i += 1) await solve(mallory.userId);
    await solve(carol.userId, { pattern: 'Greedy', difficulty: 'Easy' });
    expect((await carol.get(`/api/goals/${goal._id}`)).body.goal.targetProgress.current).toBe(1);
    expect(await Goal.countDocuments({ owner: mallory.userId })).toBe(0);
  });

  it('leaves goals without a target unchanged', async () => {
    const response = await alice.post('/api/goals').send({ title: 'Plain goal' });
    expect(response.body.goal.target).toBeNull();
    expect(response.body.goal.targetProgress).toBeUndefined();
  });
});
