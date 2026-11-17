import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

vi.mock('../src/services/socialProviders.service.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, fetchSocialProfile: vi.fn() };
});

import app from '../src/app.js';
import { fetchSocialProfile, SocialProviderError } from '../src/services/socialProviders.service.js';
import AuthIdentity from '../src/models/AuthIdentity.js';
import AuthSession from '../src/models/AuthSession.js';
import OAuthState from '../src/models/OAuthState.js';
import User from '../src/models/User.js';
import { sha256 } from '../src/utils/tokenCrypto.js';
import { createSession, PASSWORD } from './helpers.js';

const CLIENT = 'http://localhost:5173';
const pairs = response => (response.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]);
const unique = () => randomBytes(5).toString('hex');

function profile(extra = {}) {
  const id = unique();
  return { providerUserId: `pid-${id}`, email: `social_${id}@example.com`, emailVerified: true, name: `Social ${id}`, login: `social${id}`, ...extra };
}

// A browser: a CSRF cookie plus whatever the server sets along the way.
async function browser() {
  const jar = new Map();
  const absorb = response => {
    for (const pair of pairs(response)) {
      const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
      if (value) jar.set(name, pair);
      else jar.delete(name);
    }
  };
  absorb(await request(app).get('/api/auth/csrf'));
  const csrf = () => decodeURIComponent((jar.get('devtrack_csrf') || '=').split('=')[1]);
  const cookie = () => [...jar.values()].join('; ');
  const send = (method, url) => request(app)[method](url).set('Cookie', cookie()).set('x-csrf-token', csrf());
  return {
    jar,
    absorb,
    get: url => request(app).get(url).set('Cookie', cookie()),
    post: url => send('post', url),
    patch: url => send('patch', url),
    del: url => send('delete', url),
  };
}

// Runs a whole sign-in (or link) round trip and returns the callback response.
async function roundTrip(b, provider, { mode = 'login', body = {}, profileValue, query } = {}) {
  const started = await b.post(`/api/auth/oauth/${provider}/${mode}`).send(body);
  expect(started.status).toBe(200);
  b.absorb(started);
  const state = new URL(started.body.data.authorizeUrl).searchParams.get('state');
  if (profileValue instanceof Error) fetchSocialProfile.mockRejectedValueOnce(profileValue);
  else if (profileValue) fetchSocialProfile.mockResolvedValueOnce(profileValue);
  const callback = await b.get(`/api/auth/oauth/${provider}/callback?${query ?? `code=abc123&state=${state}`}`);
  b.absorb(callback);
  return { callback, state };
}

const location = response => response.headers.location;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('starting social sign-in', () => {
  it('lists providers and builds a provider URL with state, PKCE where supported, and a pinned cookie', async () => {
    const providers = await request(app).get('/api/auth/oauth/providers');
    expect(providers.body.data.providers.map(p => [p.id, p.enabled])).toEqual([['google', true], ['github', true], ['linkedin', true]]);

    const b = await browser();
    const google = await b.post('/api/auth/oauth/google/login').send({});
    const url = new URL(google.body.data.authorizeUrl);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('redirect_uri')).toBe(`${CLIENT}/api/auth/oauth/google/callback`);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const state = url.searchParams.get('state');
    const stored = await OAuthState.findOne({ stateHash: sha256(state) }).lean();
    expect(stored).toMatchObject({ provider: 'google', purpose: 'login', owner: null });
    expect(JSON.stringify(stored)).not.toContain(state);
    const cookie = google.headers['set-cookie'].find(c => c.startsWith('devtrack_oauth_state='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/oauth/);

    const linkedin = new URL((await b.post('/api/auth/oauth/linkedin/login').send({})).body.data.authorizeUrl);
    expect(linkedin.origin).toBe('https://www.linkedin.com');
    expect(linkedin.searchParams.get('code_challenge')).toBeNull();
    expect(new URL((await b.post('/api/auth/oauth/github/login').send({})).body.data.authorizeUrl).searchParams.get('scope')).toBe('read:user user:email');
  });

  it('rejects unknown providers, missing CSRF, bad input and unauthenticated linking', async () => {
    const b = await browser();
    expect((await b.post('/api/auth/oauth/facebook/login').send({})).status).toBe(404);
    expect((await request(app).post('/api/auth/oauth/google/login').send({})).status).toBe(403);
    expect((await b.post('/api/auth/oauth/google/login').send({ returnTo: 'https://evil.example' })).status).toBe(400);
    expect((await b.post('/api/auth/oauth/google/login').send({ owner: 'x' })).status).toBe(400);
    expect((await b.post('/api/auth/oauth/google/link').send({})).status).toBe(401);
  });
});

describe('signing in', () => {
  it('creates a password-less account on first sign-in and signs the same account in again later', async () => {
    const b = await browser();
    const person = profile();
    const { callback } = await roundTrip(b, 'google', { profileValue: person });
    expect(callback.status).toBe(303);
    expect(location(callback)).toBe(`${CLIENT}/app`);
    expect(callback.headers['referrer-policy']).toBe('no-referrer');
    expect(fetchSocialProfile).toHaveBeenCalledWith('google', { code: 'abc123', codeVerifier: expect.stringMatching(/^[A-Za-z0-9_-]{40,}$/) });

    const me = await b.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: person.email, hasPassword: false });
    const user = await User.findOne({ email: person.email }).lean();
    expect(user.passwordSet).toBe(false);
    expect(await AuthIdentity.countDocuments({ owner: user._id, provider: 'google', providerUserId: person.providerUserId })).toBe(1);
    expect(await AuthSession.countDocuments({ owner: user._id, method: 'google' })).toBe(1);

    // No password works for this account, not even an empty or guessed one.
    const login = await (await browser()).post('/api/auth/login').send({ email: person.email, password: PASSWORD });
    expect(login.status).toBe(401);

    const again = await browser();
    const second = await roundTrip(again, 'google', { profileValue: { ...person, name: 'Renamed' } });
    expect(location(second.callback)).toBe(`${CLIENT}/app`);
    expect(await User.countDocuments({ email: person.email })).toBe(1);
    expect((await again.get('/api/auth/me')).body.user.id).toBe(String(user._id));
  });

  it('refuses unverified emails and never attaches to an existing account by email', async () => {
    const b = await browser();
    const unverified = profile({ emailVerified: false });
    expect(location((await roundTrip(b, 'linkedin', { profileValue: unverified })).callback)).toBe(`${CLIENT}/login?oauth=email_unverified&provider=linkedin`);
    expect(await User.exists({ email: unverified.email })).toBeNull();

    // Someone registered this address with a password; a provider login with the same email must not take it over.
    const victim = await createSession('social_victim');
    const sameEmail = profile({ email: victim.user.email });
    const attempt = await roundTrip(await browser(), 'github', { profileValue: sameEmail });
    expect(location(attempt.callback)).toBe(`${CLIENT}/login?oauth=email_exists&provider=github`);
    expect(pairs(attempt.callback).some(pair => pair.startsWith('devtrack_access='))).toBe(false);
    expect(await AuthIdentity.countDocuments({ owner: victim.userId })).toBe(0);
  });

  it('fails safely on state problems, denial, provider errors and junk callbacks', async () => {
    const b = await browser();
    const started = await b.post('/api/auth/oauth/google/login').send({});
    const state = new URL(started.body.data.authorizeUrl).searchParams.get('state');

    // No state cookie (another browser) → expired, and nothing is fetched.
    const foreign = await request(app).get(`/api/auth/oauth/google/callback?code=abc&state=${state}`);
    expect(location(foreign)).toBe(`${CLIENT}/login?oauth=expired&provider=google`);

    b.absorb(started);
    const wrongProvider = await b.get(`/api/auth/oauth/github/callback?code=abc&state=${state}`);
    expect(location(wrongProvider)).toBe(`${CLIENT}/login?oauth=expired&provider=github`);
    expect(fetchSocialProfile).not.toHaveBeenCalled();

    const b2 = await browser();
    const s2 = await b2.post('/api/auth/oauth/google/login').send({});
    b2.absorb(s2);
    const st2 = new URL(s2.body.data.authorizeUrl).searchParams.get('state');
    expect(location(await b2.get(`/api/auth/oauth/google/callback?error=access_denied&state=${st2}`))).toBe(`${CLIENT}/login?oauth=denied&provider=google`);
    // Single use: the same state cannot be replayed.
    expect(location(await b2.get(`/api/auth/oauth/google/callback?code=abc&state=${st2}`))).toBe(`${CLIENT}/login?oauth=expired&provider=google`);

    const failing = await roundTrip(await browser(), 'google', { profileValue: new SocialProviderError('rejected', 'invalid_grant') });
    expect(location(failing.callback)).toBe(`${CLIENT}/login?oauth=failed&provider=google`);

    const junk = await request(app).get('/api/auth/oauth/google/callback?code=abc&state=x&redirect=https://evil.example');
    expect(location(junk)).toBe(`${CLIENT}/login?oauth=failed&provider=google`);
  });
});

describe('linking and the password-less account', () => {
  it('links a provider to the signed-in account and refuses one that belongs to someone else', async () => {
    const s = await createSession('social_link');
    const b = await browser();
    b.jar.clear();
    for (const pair of s.cookie().split('; ')) b.jar.set(pair.split('=')[0], pair);

    const person = profile();
    const linked = await roundTrip(b, 'github', { mode: 'link', profileValue: person });
    expect(location(linked.callback)).toBe(`${CLIENT}/app/settings?signin=linked&provider=github#signin`);
    expect((await s.get('/api/auth/identities')).body.data.identities.map(i => [i.provider, i.email])).toEqual([['github', person.email]]);

    // A Google account already used by another DevTrack user cannot be linked here.
    const other = await roundTrip(await browser(), 'google', { profileValue: profile() });
    const theirs = await AuthIdentity.findOne({ provider: 'google' }).sort({ createdAt: -1 }).lean();
    expect(location(other.callback)).toBe(`${CLIENT}/app`);
    const steal = await roundTrip(b, 'google', { mode: 'link', profileValue: profile({ providerUserId: theirs.providerUserId }) });
    expect(location(steal.callback)).toBe(`${CLIENT}/app/settings?signin=in_use&provider=google#signin`);

    // Signing in with the linked GitHub account now opens this account.
    const viaGitHub = await browser();
    await roundTrip(viaGitHub, 'github', { profileValue: person });
    expect((await viaGitHub.get('/api/auth/me')).body.user.id).toBe(s.userId);

    // Unlinking a method from an account with a password needs that password.
    expect((await s.del('/api/auth/identities/github').send({})).status).toBe(400);
    expect((await s.del('/api/auth/identities/github').send({ currentPassword: 'wrong-password-1' })).status).toBe(400);
    expect((await s.del('/api/auth/identities/github').send({ currentPassword: PASSWORD })).status).toBe(200);
    expect(await AuthIdentity.countDocuments({ owner: s.userId })).toBe(0);
  });

  it('confirms sensitive changes by a recent sign-in, lets the user set a password, and keeps the last way in', async () => {
    const b = await browser();
    const person = profile();
    await roundTrip(b, 'google', { profileValue: person });
    const user = await User.findOne({ email: person.email }).lean();

    // Fresh sign-in: profile change works without a password.
    expect((await b.patch('/api/auth/profile').send({ username: `fresh_${unique()}` })).status).toBe(200);
    // The only sign-in method cannot be removed.
    const last = await b.del('/api/auth/identities/google').send({});
    expect(last.status).toBe(409);
    expect(last.body.code).toBe('LAST_SIGN_IN_METHOD');

    // Ten minutes later the same session must sign in again first.
    // createdAt is immutable in Mongoose, so age the session directly in the collection.
    await AuthSession.collection.updateMany({ owner: user._id }, { $set: { createdAt: new Date(Date.now() - 11 * 60 * 1000) } });
    const stale = await b.patch('/api/auth/profile').send({ username: `stale_${unique()}` });
    expect(stale.status).toBe(401);
    expect(stale.body.code).toBe('REAUTH_REQUIRED');
    expect((await b.del('/api/auth/account').send({ confirmation: 'DELETE' })).status).toBe(401);

    // Re-confirming through the provider returns to Settings with a fresh session.
    const again = await roundTrip(b, 'google', { body: { returnTo: 'settings' }, profileValue: person });
    expect(location(again.callback)).toBe(`${CLIENT}/app/settings?reauth=ok#account`);
    const newPassword = `Set-${unique()}-Pass9!`;
    expect((await b.patch('/api/auth/password').send({ newPassword })).status).toBe(200);
    expect((await b.get('/api/auth/me')).body.user.hasPassword).toBe(true);
    expect((await (await browser()).post('/api/auth/login').send({ email: person.email, password: newPassword })).status).toBe(200);
    // Now that a password exists, it is required.
    expect((await b.patch('/api/auth/profile').send({ username: `later_${unique()}` })).status).toBe(400);

    // Account deletion removes linked sign-ins too.
    expect((await b.del('/api/auth/account').send({ currentPassword: newPassword, confirmation: 'DELETE' })).status).toBeLessThan(300);
    expect(await AuthIdentity.countDocuments({ owner: user._id })).toBe(0);
  });
});
