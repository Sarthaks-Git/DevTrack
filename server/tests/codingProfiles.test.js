
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/services/leetcodeOwnership.service.js', () => ({
    fetchLeetCodeOwnershipProfile: vi.fn(),
}));

vi.mock('../src/services/leetcode.service.js', () => ({
    fetchLeetCodeStats: vi.fn(),
}));

import { fetchLeetCodeOwnershipProfile } from '../src/services/leetcodeOwnership.service.js';
import { fetchLeetCodeStats } from '../src/services/leetcode.service.js';
import CodingProfile from '../src/models/CodingProfile.js';
import app from '../src/app.js';

function createUser() {
    const uniqueId = `${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    return {
        username: `coding_${uniqueId}`,
        email: `coding_${uniqueId}@example.com`,
        password: 'TestPassword123!',
    };
}

async function createAuthenticatedUser() {
    const user = createUser();
    const csrfResponse = await request(app).get('/api/auth/csrf');
    const csrfSetCookie = csrfResponse.headers['set-cookie'] || [];
    const csrfCookie = csrfSetCookie.map(value => value.split(';')[0]).join('; ');
    const csrfToken = decodeURIComponent((csrfCookie.split('; ').find(value => value.startsWith('devtrack_csrf=')) || '').slice('devtrack_csrf='.length));

    const registerResponse = await request(app)
        .post('/api/auth/register')
        .set('Cookie', csrfCookie)
        .set('x-csrf-token', csrfToken)
        .send(user);
    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('Cookie', csrfCookie)
        .set('x-csrf-token', csrfToken)
        .send({ email: user.email, password: user.password });
    expect(loginResponse.status).toBe(200);

    const authCookies = (loginResponse.headers['set-cookie'] || []).map(value => value.split(';')[0]).join('; ');
    const cookies = { cookieHeader: [authCookies, csrfCookie].filter(Boolean).join('; '), csrfToken };
    return { user, cookies };
}

async function createVerifiedProfile(cookies, username) {
    const startResponse = await request(app)
        .post('/api/coding-profiles/verification/start')
        .set('Cookie', cookies.cookieHeader)
        .set('x-csrf-token', cookies.csrfToken)
        .send({
            platform: 'leetcode',
            username,
        });

    expect(startResponse.status).toBe(201);

    const token = startResponse.body.data.challenge.token;

    fetchLeetCodeOwnershipProfile.mockResolvedValue({
        username,
        aboutMe: `DevTrack verification: ${token}`,
    });

    const verifyResponse = await request(app)
        .post('/api/coding-profiles/verification/verify')
        .set('Cookie', cookies.cookieHeader)
        .set('x-csrf-token', cookies.csrfToken)
        .send({
            platform: 'leetcode',
            token,
        });

    expect(verifyResponse.status).toBe(200);

    return verifyResponse.body.data.profile;
}

const validStats = {
    totalSolved: 100,
    easySolved: 40,
    mediumSolved: 45,
    hardSolved: 15,
    totalAvailable: 3000,
    easyAvailable: 800,
    mediumAvailable: 1500,
    hardAvailable: 700,
    contestRating: 1500,
    submissionCalendar: { '1790000000': 3 },
    lastFetchedAt: new Date('2026-10-01T10:00:00.000Z'),
};

describe('Coding Profiles API security', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects unauthenticated profile verification', async () => {
        const response = await request(app)
            .post('/api/coding-profiles/verification/start')
            .send({ platform: 'leetcode', username: 'testuser' });

        expect(response.status).toBe(401);
    });

    it('rejects unsupported verification platforms', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .post('/api/coding-profiles/verification/start')
            .set('Cookie', cookies.cookieHeader)
        .set('x-csrf-token', cookies.csrfToken)
            .send({ platform: 'unsupported', username: 'testuser' });

        expect(response.status).toBe(400);
    });

    it('rejects verification when no challenge exists', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .post('/api/coding-profiles/verification/verify')
            .set('Cookie', cookies.cookieHeader)
        .set('x-csrf-token', cookies.csrfToken)
            .send({
                platform: 'leetcode',
                token: `devtrack-verify-${'a'.repeat(48)}`,
            });

        expect(response.status).toBe(400);
    });

    it('rejects username-only profile linking', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .put('/api/coding-profiles/leetcode')
            .set('Cookie', cookies.cookieHeader)
        .set('x-csrf-token', cookies.csrfToken)
            .send({ platform: 'leetcode', username: 'someuser' });

        expect([400, 410]).toContain(response.status);
    });

    it('rejects refreshing stats without a verified profile', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .post('/api/coding-profiles/leetcode/stats/refresh')
            .set('Cookie', cookies.cookieHeader)
            .set('x-csrf-token', cookies.csrfToken);

        expect([403, 404]).toContain(response.status);
    });

    it('starts an ownership verification challenge', async () => {
        const { cookies } = await createAuthenticatedUser();

        const response = await request(app)
            .post('/api/coding-profiles/verification/start')
            .set('Cookie', cookies.cookieHeader)
        .set('x-csrf-token', cookies.csrfToken)
            .send({ platform: 'leetcode', username: 'start_testuser' });

        expect(response.status).toBe(201);
        expect(response.body.data.challenge.platform).toBe('leetcode');
        expect(response.body.data.challenge.username).toBe('start_testuser');
        expect(response.body.data.challenge.token).toMatch(
            /^devtrack-verify-[a-f0-9]{48}$/
        );
    });

    it('verifies ownership and saves the profile', async () => {
        const { cookies } = await createAuthenticatedUser();
        const username = `verified_${Date.now()}`;

        const startResponse = await request(app)
            .post('/api/coding-profiles/verification/start')
            .set('Cookie', cookies.cookieHeader)
        .set('x-csrf-token', cookies.csrfToken)
            .send({ platform: 'leetcode', username });

        expect(startResponse.status).toBe(201);

        const token = startResponse.body.data.challenge.token;

        fetchLeetCodeOwnershipProfile.mockResolvedValue({
            username,
            aboutMe: `My DevTrack verification token: ${token}`,
        });

        const verifyResponse = await request(app)
            .post('/api/coding-profiles/verification/verify')
            .set('Cookie', cookies.cookieHeader)
        .set('x-csrf-token', cookies.csrfToken)
            .send({ platform: 'leetcode', token });

        expect(verifyResponse.status).toBe(200);
        expect(verifyResponse.body.data.profile.connectionStatus).toBe('verified');
        expect(verifyResponse.body.data.profile.username).toBe(username);
    });

    it('rejects an incorrect token', async () => {
        const { cookies } = await createAuthenticatedUser();
        const username = `wrongtoken_${Date.now()}`;

        const startResponse = await request(app)
            .post('/api/coding-profiles/verification/start')
            .set('Cookie', cookies.cookieHeader)
        .set('x-csrf-token', cookies.csrfToken)
            .send({ platform: 'leetcode', username });

        expect(startResponse.status).toBe(201);

        const response = await request(app)
            .post('/api/coding-profiles/verification/verify')
            .set('Cookie', cookies.cookieHeader)
        .set('x-csrf-token', cookies.csrfToken)
            .send({
                platform: 'leetcode',
                token: `devtrack-verify-${'a'.repeat(48)}`,
            });

        expect(response.status).toBe(400);
        expect(fetchLeetCodeOwnershipProfile).not.toHaveBeenCalled();
    });

    it('preserves existing stats when the provider fails', async () => {
        const { cookies } = await createAuthenticatedUser();
        const username = `providerfail_${Date.now()}`;

        await createVerifiedProfile(cookies, username);

        await CodingProfile.updateOne(
            { platform: 'leetcode', normalizedUsername: username.toLowerCase() },
            { $set: { stats: validStats } }
        );

        fetchLeetCodeStats.mockRejectedValue(
            new Error('LeetCode is temporarily unavailable')
        );

        const response = await request(app)
            .post('/api/coding-profiles/leetcode/stats/refresh')
            .set('Cookie', cookies.cookieHeader)
            .set('x-csrf-token', cookies.csrfToken);

        expect(response.status).toBeGreaterThanOrEqual(500);

        const savedProfile = await CodingProfile.findOne({
            platform: 'leetcode',
            normalizedUsername: username.toLowerCase(),
        }).lean();

        expect(savedProfile.stats.totalSolved).toBe(100);
        expect(savedProfile.stats.easySolved).toBe(40);
        expect(savedProfile.stats.submissionCalendar).toEqual(
            validStats.submissionCalendar
        );
        expect(savedProfile.stats.lastFetchedAt.toISOString()).toBe(
            validStats.lastFetchedAt.toISOString()
        );
    });

    it('preserves existing stats when the provider returns incomplete counts', async () => {
        const { cookies } = await createAuthenticatedUser();
        const username = `incompletestats_${Date.now()}`;

        await createVerifiedProfile(cookies, username);

        await CodingProfile.updateOne(
            { platform: 'leetcode', normalizedUsername: username.toLowerCase() },
            { $set: { stats: validStats } }
        );

        fetchLeetCodeStats.mockResolvedValue({
            ...validStats,
            totalSolved: null,
        });

        const response = await request(app)
            .post('/api/coding-profiles/leetcode/stats/refresh')
            .set('Cookie', cookies.cookieHeader)
            .set('x-csrf-token', cookies.csrfToken);

        expect(response.status).toBe(502);

        const savedProfile = await CodingProfile.findOne({
            platform: 'leetcode',
            normalizedUsername: username.toLowerCase(),
        }).lean();

        expect(savedProfile.stats.totalSolved).toBe(100);
        expect(savedProfile.stats.easySolved).toBe(40);
        expect(savedProfile.stats.submissionCalendar).toEqual(
            validStats.submissionCalendar
        );
    });
});
