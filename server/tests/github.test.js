import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

vi.mock('../src/services/githubApi.service.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    exchangeCode: vi.fn(),
    refreshAccessToken: vi.fn(),
    getAuthenticatedUser: vi.fn(),
    listInstallationRepos: vi.fn(),
    listCommits: vi.fn(),
    getCommitFiles: vi.fn(),
    revokeGrant: vi.fn(),
  };
});

vi.mock('../src/services/ai/anthropic.transport.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, createMessage: vi.fn() };
});

import app from '../src/app.js';
import { createMessage } from '../src/services/ai/anthropic.transport.js';
import { settleSecurityScans } from '../src/services/securityReview.service.js';
import SecurityReview from '../src/models/SecurityReview.js';
import config from '../src/config/config.js';
import * as gh from '../src/services/githubApi.service.js';
import Activity from '../src/models/Activity.js';
import GitHubCommit from '../src/models/GitHubCommit.js';
import GitHubConnection from '../src/models/GitHubConnection.js';
import OAuthState from '../src/models/OAuthState.js';
import Project from '../src/models/Project.js';
import User from '../src/models/User.js';
import { decryptSecret, encryptSecret, sha256 } from '../src/utils/tokenCrypto.js';
import { createSession, PASSWORD } from './helpers.js';

const BASE = '/api/integrations/github';
// Fake tokens generated per run: no secret-looking literal ever lives in the repository.
const fakeToken = () => `fake-${randomBytes(12).toString('hex')}`;
const sha = () => randomBytes(20).toString('hex');
let nextGitHubId = 5000;

function tokens(accessToken = fakeToken()) {
  return { accessToken, expiresIn: 28800, refreshToken: fakeToken(), refreshTokenExpiresIn: 15897600 };
}

// Runs the whole OAuth handshake for a session. Returns the callback response.
async function connect(session, { githubId = (nextGitHubId += 1), login = `octo${githubId}`, accessToken = fakeToken() } = {}) {
  const started = await session.post(`${BASE}/connect`).send({});
  const state = new URL(started.body.data.authorizeUrl).searchParams.get('state');
  const stateCookie = started.headers['set-cookie'].map(c => c.split(';')[0]).find(c => c.startsWith('devtrack_github_state='));
  gh.exchangeCode.mockResolvedValueOnce(tokens(accessToken));
  gh.getAuthenticatedUser.mockResolvedValueOnce({ id: githubId, login });
  // Real GitHub appends the RFC 9207 issuer.
  const callback = await request(app).get(`${BASE}/callback?code=abc123&state=${state}&iss=${encodeURIComponent('https://github.com/login/oauth')}`).set('Cookie', stateCookie);
  return { callback, state, stateCookie, githubId, login, accessToken };
}

const outcome = response => new URL(response.headers.location).searchParams.get('github');
const repo = (id, fullName) => ({ id, fullName, private: false, url: `https://github.com/${fullName}` });

async function project(session, title = 'Linked project') {
  const res = await session.post('/api/projects').send({ title, description: 'GitHub test', status: 'in_progress' });
  return res.body.project?._id || res.body.data?.project?._id;
}

beforeEach(() => {
  vi.clearAllMocks();
  gh.getCommitFiles.mockResolvedValue(['src/auth/login.js']);
  gh.revokeGrant.mockResolvedValue(null);
});

describe('GitHub connection', () => {
  it('requires authentication except for the OAuth callback', async () => {
    expect((await request(app).get(BASE)).status).toBe(401);
    expect((await request(app).post(`${BASE}/connect`)).status).toBe(401);
    expect((await request(app).get(`${BASE}/repos`)).status).toBe(401);
    expect((await request(app).get(`${BASE}/callback`)).status).toBe(303);
  });

  it('reports availability without a connection', async () => {
    const s = await createSession('gh_status');
    const res = await s.get(BASE);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ available: true, installUrl: 'https://github.com/apps/devtrack-test/installations/new', connection: null });
  });

  it('starts OAuth with PKCE and stores only a hash of the state', async () => {
    const s = await createSession('gh_start');
    const res = await s.post(`${BASE}/connect`).send({});
    expect(res.status).toBe(200);
    const url = new URL(res.body.data.authorizeUrl);
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('redirect_uri')).toBe(config.GITHUB.callbackUrl);

    const state = url.searchParams.get('state');
    const cookie = res.headers['set-cookie'].find(c => c.startsWith('devtrack_github_state='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/integrations\/github/);

    const stored = await OAuthState.findOne({ owner: s.userId }).lean();
    expect(stored.stateHash).toBe(sha256(state));
    expect(JSON.stringify(stored)).not.toContain(state);
    expect(stored.codeVerifier).toMatch(/^v1\./);
  });

  it('connects, encrypts tokens at rest and never returns them', async () => {
    const s = await createSession('gh_connect');
    const { callback, accessToken, login } = await connect(s);
    expect(callback.status).toBe(303);
    expect(callback.headers.location).toBe(`${config.CLIENT_ORIGIN}/app/settings?github=connected#github`);
    expect(callback.headers['set-cookie'].join(';')).toMatch(/devtrack_github_state=;/);

    const stored = await GitHubConnection.findOne({ owner: s.userId }).select('+accessToken +refreshToken').lean();
    expect(stored.accessToken).not.toContain(accessToken);
    expect(decryptSecret(stored.accessToken, `github:access:${s.userId}`)).toBe(accessToken);
    // A ciphertext moved to another user's row does not decrypt.
    expect(() => decryptSecret(stored.accessToken, 'github:access:000000000000000000000000')).toThrow(/could not be decrypted/);

    const status = await s.get(BASE);
    expect(status.body.data.connection).toMatchObject({ login, status: 'connected' });
    expect(JSON.stringify(status.body)).not.toMatch(/accessToken|refreshToken/);
    expect(JSON.stringify(status.body)).not.toContain(accessToken);
    expect(await Activity.countDocuments({ owner: s.userId, type: 'github_connected', source: 'verified' })).toBe(1);
  });

  it('uses each state once and only from the browser that started it', async () => {
    const s = await createSession('gh_state');
    const { state, stateCookie } = await connect(s);
    const replay = await request(app).get(`${BASE}/callback?code=abc123&state=${state}`).set('Cookie', stateCookie);
    expect(outcome(replay)).toBe('expired');

    const started = await s.post(`${BASE}/connect`).send({});
    const fresh = new URL(started.body.data.authorizeUrl).searchParams.get('state');
    const noCookie = await request(app).get(`${BASE}/callback?code=abc123&state=${fresh}`);
    expect(outcome(noCookie)).toBe('expired');
    const wrongCookie = await request(app).get(`${BASE}/callback?code=abc123&state=${fresh}`).set('Cookie', stateCookie);
    expect(outcome(wrongCookie)).toBe('expired');
    expect(gh.exchangeCode).toHaveBeenCalledTimes(1);
  });

  it('rejects an expired state, a denied request and malformed callbacks', async () => {
    const s = await createSession('gh_bad');
    const begin = async () => {
      const res = await s.post(`${BASE}/connect`).send({});
      const state = new URL(res.body.data.authorizeUrl).searchParams.get('state');
      return { state, cookie: `devtrack_github_state=${state}` };
    };

    let { state, cookie } = await begin();
    await OAuthState.updateOne({ owner: s.userId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(outcome(await request(app).get(`${BASE}/callback?code=abc&state=${state}`).set('Cookie', cookie))).toBe('expired');

    ({ state, cookie } = await begin());
    expect(outcome(await request(app).get(`${BASE}/callback?error=access_denied&state=${state}`).set('Cookie', cookie))).toBe('denied');

    ({ state, cookie } = await begin());
    expect(outcome(await request(app).get(`${BASE}/callback?code=a%20b&state=${state}`).set('Cookie', cookie))).toBe('failed');
    expect(outcome(await request(app).get(`${BASE}/callback?code=abc&state=${state}&next=https://evil.example`).set('Cookie', cookie))).toBe('failed');
    expect(outcome(await request(app).get(`${BASE}/callback?code=abc&state=${state}&iss=${encodeURIComponent('https://evil.example/login/oauth')}`).set('Cookie', cookie))).toBe('failed');
    expect(gh.exchangeCode).not.toHaveBeenCalled();
    expect(await GitHubConnection.exists({ owner: s.userId })).toBeNull();
  });

  it('fails safely when GitHub rejects the code', async () => {
    const s = await createSession('gh_reject');
    const res = await s.post(`${BASE}/connect`).send({});
    const state = new URL(res.body.data.authorizeUrl).searchParams.get('state');
    gh.exchangeCode.mockRejectedValueOnce(new gh.GitHubApiError('rejected'));
    const callback = await request(app).get(`${BASE}/callback?code=abc&state=${state}`).set('Cookie', `devtrack_github_state=${state}`);
    expect(outcome(callback)).toBe('failed');
    expect(await GitHubConnection.exists({ owner: s.userId })).toBeNull();
  });

  it('links one GitHub account to only one DevTrack account', async () => {
    const first = await createSession('gh_first');
    const second = await createSession('gh_second');
    const { githubId } = await connect(first);
    const { callback } = await connect(second, { githubId });
    expect(outcome(callback)).toBe('in_use');
    expect(await GitHubConnection.exists({ owner: second.userId })).toBeNull();
  });
});

describe('Repositories and commit sync', () => {
  it('links only repositories the installation can see, once per user', async () => {
    const s = await createSession('gh_link');
    const other = await createSession('gh_link_other');
    await connect(s);
    const p1 = await project(s, 'API server');
    const p2 = await project(s, 'Second project');
    const foreign = await project(other, 'Not yours');
    gh.listInstallationRepos.mockResolvedValue([repo(11, 'octo/api'), repo(12, 'octo/web')]);

    const list = await s.get(`${BASE}/repos`);
    expect(list.status).toBe(200);
    expect(list.body.data.repos.map(r => r.fullName)).toEqual(['octo/api', 'octo/web']);

    expect((await s.patch(`/api/projects/${p1}`).send({ repository: { githubId: 11 } })).status).toBe(400);

    const put = (id, body) => request(app).put(`/api/projects/${id}/repository`).set('Cookie', s.cookie()).set('x-csrf-token', s.csrfToken).send(body);
    expect((await put(p1, { repoId: 99 })).body.code).toBe('REPO_NOT_ACCESSIBLE');
    expect((await put(p1, { repoId: '11' })).status).toBe(400);
    expect((await put(p1, { repoId: 11, fullName: 'evil/repo' })).status).toBe(400);
    expect((await put(foreign, { repoId: 11 })).status).toBe(404);

    const linked = await put(p1, { repoId: 11 });
    expect(linked.status).toBe(200);
    expect(linked.body.data.repository).toMatchObject({ githubId: 11, fullName: 'octo/api', url: 'https://github.com/octo/api' });
    expect((await put(p2, { repoId: 11 })).body.code).toBe('REPO_ALREADY_LINKED');

    const again = await s.get(`${BASE}/repos`);
    expect(again.body.data.repos[0].linkedProject).toEqual({ id: p1, title: 'API server' });
  });

  it('syncs only commits the user authored, once, as verified activity', async () => {
    const s = await createSession('gh_sync');
    const { githubId, accessToken } = await connect(s);
    const p = await project(s, 'Sync project');
    gh.listInstallationRepos.mockResolvedValue([repo(21, 'octo/sync')]);
    await request(app).put(`/api/projects/${p}/repository`).set('Cookie', s.cookie()).set('x-csrf-token', s.csrfToken).send({ repoId: 21 });

    const mine = { sha: sha(), message: 'Add JWT refresh rotation\n\nLong body with details', committedAt: new Date(Date.now() - 3600_000), authorId: githubId };
    const theirs = { sha: sha(), message: 'Someone else', committedAt: new Date(), authorId: githubId + 999 };
    gh.listCommits.mockResolvedValue([mine, theirs]);

    const first = await s.post(`${BASE}/sync`).send({ manual: true });
    expect(first.body.data).toMatchObject({ status: 'synced', newCommits: 1 });
    expect(gh.listCommits).toHaveBeenCalledWith(accessToken, 'octo/sync', expect.objectContaining({ author: expect.any(String) }));

    const stored = await GitHubCommit.find({ owner: s.userId }).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ message: 'Add JWT refresh rotation', files: ['src/auth/login.js'], url: `https://github.com/octo/sync/commit/${mine.sha}` });
    const activity = await Activity.find({ owner: s.userId, type: 'commit_pushed' }).lean();
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({ source: 'verified', title: 'Add JWT refresh rotation', detail: 'octo/sync' });

    const updated = await Project.findById(p).lean();
    expect(updated.repository.lastCommitAt.getTime()).toBe(mine.committedAt.getTime());

    // Throttled inside the interval; after it, the same commits are not stored twice.
    expect((await s.post(`${BASE}/sync`).send({ manual: true })).body.data.status).toBe('skipped');
    await GitHubConnection.updateOne({ owner: s.userId }, { $set: { lastSyncAt: new Date(Date.now() - 3600_000) } });
    expect((await s.post(`${BASE}/sync`).send({})).body.data.newCommits).toBe(0);
    expect(await GitHubCommit.countDocuments({ owner: s.userId })).toBe(1);

    const commits = await s.get(`/api/projects/${p}/commits`);
    expect(commits.body.data.commits).toEqual([expect.objectContaining({ shortSha: mine.sha.slice(0, 7), message: 'Add JWT refresh rotation', fileCount: 1 })]);
    const outsider = await createSession('gh_sync_outsider');
    expect((await outsider.get(`/api/projects/${p}/commits`)).status).toBe(404);

    const review = await s.get(`/api/dashboard/weekly?today=${new Date().toISOString().slice(0, 10)}`);
    expect(review.body.data.code).toMatchObject({ connected: true });
  });

  it('reviews new commits with AI in the background only when the user turned AI on', async () => {
    const s = await createSession('github');
    const { githubId } = await connect(s);
    const p = await project(s);
    gh.listInstallationRepos.mockResolvedValue([repo(23, 'octo/ai')]);
    await request(app).put(`/api/projects/${p}/repository`).set('Cookie', s.cookie()).set('x-csrf-token', s.csrfToken).send({ repoId: 23 });

    gh.listCommits.mockResolvedValueOnce([{ sha: sha(), message: 'Add password reset', committedAt: new Date(), authorId: githubId }]);
    await s.post(`${BASE}/sync`).send({ manual: true });
    await settleSecurityScans();
    expect(createMessage).not.toHaveBeenCalled();

    createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      usage: { input_tokens: 900, output_tokens: 250 },
      content: [{ type: 'text', text: JSON.stringify({ commits: [{ ref: 0, relevant: true, area: 'Password reset', areaKey: 'authentication', checks: [{ text: 'Reset tokens expire and are single use', why: 'Old links could take over accounts.' }] }] }) }],
    });
    // Turning AI on reviews the commit that synced while it was off.
    const consent = await s.put('/api/ai/consent').send({ enabled: true });
    await settleSecurityScans();
    // This test has failed intermittently in full runs only; on failure, say what the scan saw.
    const diagnosis = async () => JSON.stringify({
      consent: { status: consent.status, data: consent.body.data && { enabled: consent.body.data.enabled, available: consent.body.data.available } },
      commits: await GitHubCommit.find({ owner: s.userId }).select('securityScan files message -_id').lean(),
      lastIssue: (await User.findById(s.userId).select('ai').lean())?.ai?.lastIssue,
    });
    expect(createMessage.mock.calls.length, createMessage.mock.calls.length === 1 ? '' : await diagnosis()).toBe(1);
    expect(await SecurityReview.countDocuments({ owner: s.userId, project: p })).toBe(1);

    // Unlinking the repository removes its checks along with its commits.
    expect((await request(app).delete(`/api/projects/${p}/repository`).set('Cookie', s.cookie()).set('x-csrf-token', s.csrfToken)).status).toBeLessThan(300);
    expect(await SecurityReview.countDocuments({ owner: s.userId })).toBe(0);
  });

  it('rejects bad sync bodies and reports a user without GitHub', async () => {
    const s = await createSession('gh_sync_bad');
    expect((await s.post(`${BASE}/sync`).send({ manual: 'yes' })).status).toBe(400);
    expect((await s.post(`${BASE}/sync`).send({ force: true })).status).toBe(400);
    expect((await s.post(`${BASE}/sync`).send({})).body.data.status).toBe('not_connected');
  });

  it('refreshes an expiring token and asks to reconnect when refresh is refused', async () => {
    const s = await createSession('gh_refresh');
    await connect(s);
    await project(s);
    const expire = () => GitHubConnection.updateOne({ owner: s.userId }, { $set: { accessTokenExpiresAt: new Date(Date.now() + 60_000) } });

    await expire();
    const renewed = fakeToken();
    gh.refreshAccessToken.mockResolvedValueOnce(tokens(renewed));
    gh.listInstallationRepos.mockResolvedValueOnce([]);
    expect((await s.get(`${BASE}/repos`)).status).toBe(200);
    expect(gh.listInstallationRepos).toHaveBeenCalledWith(renewed);
    const stored = await GitHubConnection.findOne({ owner: s.userId }).select('+accessToken').lean();
    expect(decryptSecret(stored.accessToken, `github:access:${s.userId}`)).toBe(renewed);

    await expire();
    gh.refreshAccessToken.mockRejectedValueOnce(new gh.GitHubApiError('unauthorized'));
    const refused = await s.get(`${BASE}/repos`);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('GITHUB_REAUTH_REQUIRED');
    expect((await s.get(BASE)).body.data.connection.status).toBe('reauth_required');
  });

  it('keeps existing links when GitHub is down or rate limited', async () => {
    const s = await createSession('gh_down');
    await connect(s);
    const p = await project(s);
    gh.listInstallationRepos.mockResolvedValueOnce([repo(31, 'octo/down')]);
    await request(app).put(`/api/projects/${p}/repository`).set('Cookie', s.cookie()).set('x-csrf-token', s.csrfToken).send({ repoId: 31 });

    gh.listInstallationRepos.mockRejectedValueOnce(new gh.GitHubApiError('unavailable'));
    expect((await s.get(`${BASE}/repos`)).status).toBe(502);
    gh.listCommits.mockRejectedValueOnce(new gh.GitHubApiError('rate_limited'));
    expect((await s.post(`${BASE}/sync`).send({ manual: true })).status).toBe(429);
    expect((await Project.findById(p).lean()).repository.fullName).toBe('octo/down');
  });

  it('disconnects: revokes at GitHub and removes tokens, links and commits', async () => {
    const s = await createSession('gh_disconnect');
    const { accessToken, githubId } = await connect(s);
    const p = await project(s);
    gh.listInstallationRepos.mockResolvedValue([repo(41, 'octo/gone')]);
    await request(app).put(`/api/projects/${p}/repository`).set('Cookie', s.cookie()).set('x-csrf-token', s.csrfToken).send({ repoId: 41 });
    gh.listCommits.mockResolvedValueOnce([{ sha: sha(), message: 'Work', committedAt: new Date(), authorId: githubId }]);
    await s.post(`${BASE}/sync`).send({ manual: true });
    expect(await GitHubCommit.countDocuments({ owner: s.userId })).toBe(1);

    // GitHub being down must not block the disconnect.
    gh.revokeGrant.mockRejectedValueOnce(new gh.GitHubApiError('unavailable'));
    expect((await s.del(BASE)).status).toBe(200);
    expect(gh.revokeGrant).toHaveBeenCalledWith(accessToken);
    expect(await GitHubConnection.exists({ owner: s.userId })).toBeNull();
    expect(await GitHubCommit.countDocuments({ owner: s.userId })).toBe(0);
    expect((await Project.findById(p).lean()).repository).toBeNull();
    expect((await s.del(BASE)).status).toBe(404);
  });

  it('deleting the account revokes GitHub access and removes all GitHub data', async () => {
    const s = await createSession('gh_delete');
    const { accessToken } = await connect(s);
    await s.post(`${BASE}/connect`).send({});
    const res = await s.del('/api/auth/account').send({ currentPassword: PASSWORD, confirmation: 'DELETE' });
    expect([200, 204]).toContain(res.status);
    expect(gh.revokeGrant).toHaveBeenCalledWith(accessToken);
    expect(await GitHubConnection.exists({ owner: s.userId })).toBeNull();
    expect(await OAuthState.exists({ owner: s.userId })).toBeNull();
  });
});

describe('Token encryption', () => {
  const key = randomBytes(32);
  it('round-trips, uses a fresh IV each time and detects tampering', () => {
    const a = encryptSecret('value-1', 'ctx', key);
    const b = encryptSecret('value-1', 'ctx', key);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, 'ctx', key)).toBe('value-1');

    const parts = a.split('.');
    const flipped = Buffer.from(parts[3], 'base64url');
    flipped[0] ^= 1;
    expect(() => decryptSecret([...parts.slice(0, 3), flipped.toString('base64url')].join('.'), 'ctx', key)).toThrow(/could not be decrypted/);
    expect(() => decryptSecret(a, 'other-context', key)).toThrow(/could not be decrypted/);
    expect(() => decryptSecret(a, 'ctx', randomBytes(32))).toThrow(/could not be decrypted/);
    expect(() => decryptSecret('plain-text', 'ctx', key)).toThrow(/unknown format/);
  });
});
