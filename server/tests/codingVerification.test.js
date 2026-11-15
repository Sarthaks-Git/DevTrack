import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/leetcodeOwnership.service.js', () => ({ fetchLeetCodeOwnershipProfile: vi.fn() }));
vi.mock('../src/services/leetcode.service.js', () => ({ fetchLeetCodeStats: vi.fn() }));

import { fetchLeetCodeOwnershipProfile } from '../src/services/leetcodeOwnership.service.js';
import { fetchLeetCodeStats } from '../src/services/leetcode.service.js';
import AppError from '../src/utils/AppError.js';
import VerificationChallenge from '../src/models/VerificationChallenge.js';
import { createSession } from './helpers.js';

const stats = totalSolved => ({
  totalSolved, easySolved: totalSolved, mediumSolved: 0, hardSolved: 0,
  totalAvailable: 3000, easyAvailable: 800, mediumAvailable: 1600, hardAvailable: 600,
  contestRating: null, submissionCalendar: {}, fetchedAt: new Date(),
});

async function startChallenge(session, username) {
  const res = await session.post('/api/coding-profiles/verification/start').send({ platform: 'leetcode', username });
  expect(res.status).toBe(201);
  return res.body.data.challenge.token;
}

const verify = (session, token) => session.post('/api/coding-profiles/verification/verify').send({ platform: 'leetcode', token });

describe('Coding verification hardening', () => {
  beforeEach(() => vi.clearAllMocks());

  it('provider outages do not consume verification attempts', async () => {
    const s = await createSession('cfv');
    const username = `outage_${Date.now()}`;
    const token = await startChallenge(s, username);

    fetchLeetCodeOwnershipProfile.mockRejectedValue(new AppError('Unable to reach LeetCode.', 503));
    for (let i = 0; i < 6; i += 1) expect((await verify(s, token)).status).toBe(503);

    const challenge = await VerificationChallenge.findOne({ owner: s.userId }).lean();
    expect(challenge.attemptCount).toBe(0);

    fetchLeetCodeOwnershipProfile.mockResolvedValue({ username, aboutMe: token });
    expect((await verify(s, token)).status).toBe(200);
  });

  it('locks the challenge after five wrong-token attempts', async () => {
    const s = await createSession('cfv');
    await startChallenge(s, `locked_${Date.now()}`);
    const wrong = `devtrack-verify-${'b'.repeat(48)}`;
    for (let i = 0; i < 5; i += 1) expect((await verify(s, wrong)).status).toBe(400);
    const sixth = await verify(s, wrong);
    expect(sixth.status).toBe(400);
    expect(sixth.body.message).toMatch(/start again/i);
  });

  it('records verification on the timeline, but stats refreshes no longer add events', async () => {
    const s = await createSession('cfv');
    const username = `timeline_${Date.now()}`;
    const token = await startChallenge(s, username);
    fetchLeetCodeOwnershipProfile.mockResolvedValue({ username, aboutMe: token });
    expect((await verify(s, token)).status).toBe(200);

    fetchLeetCodeStats.mockResolvedValue(stats(10));
    await s.post('/api/coding-profiles/leetcode/stats/refresh');
    await s.post('/api/coding-profiles/leetcode/stats/refresh');
    fetchLeetCodeStats.mockResolvedValue(stats(13));
    await s.post('/api/coding-profiles/leetcode/stats/refresh');

    const items = (await s.get('/api/activity')).body.data.items;
    // The timeline records accepted problems instead (problem tracking, decision D6).
    expect(items.map(item => item.type)).toEqual(['platform_verified']);
    expect(items[0].source).toBe('verified');
  });
});
