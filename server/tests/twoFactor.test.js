import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

vi.mock('../src/services/socialProviders.service.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, fetchSocialProfile: vi.fn() };
});

import app from '../src/app.js';
import { fetchSocialProfile } from '../src/services/socialProviders.service.js';
import AuthSession from '../src/models/AuthSession.js';
import LoginChallenge from '../src/models/LoginChallenge.js';
import TwoFactor from '../src/models/TwoFactor.js';
import { base32Encode, hotp, totpAt, verifyTotp, timeStep } from '../src/utils/totp.js';
import { createSession, PASSWORD } from './helpers.js';

const STEP_MS = 30_000;
const pairs = response => (response.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]);

// A signed-out browser with a CSRF cookie that keeps whatever cookies the server sets.
async function browser() {
  const jar = new Map();
  const absorb = response => {
    for (const pair of pairs(response)) {
      const name = pair.slice(0, pair.indexOf('='));
      if (pair.slice(name.length + 1)) jar.set(name, pair);
      else jar.delete(name);
    }
    return response;
  };
  absorb(await request(app).get('/api/auth/csrf'));
  const csrf = () => decodeURIComponent((jar.get('devtrack_csrf') || '=').split('=')[1]);
  const cookie = () => [...jar.values()].join('; ');
  return {
    jar,
    absorb,
    get: url => request(app).get(url).set('Cookie', cookie()),
    post: url => request(app).post(url).set('Cookie', cookie()).set('x-csrf-token', csrf()),
  };
}

// Turns 2FA on for a session; returns the secret and backup codes.
async function enable(s) {
  const setup = await s.post('/api/auth/2fa/setup').send({ currentPassword: PASSWORD });
  expect(setup.status).toBe(200);
  const { secret } = setup.body.data;
  const enabled = await s.post('/api/auth/2fa/enable').send({ code: totpAt(secret) });
  expect(enabled.status).toBe(200);
  return { secret, recoveryCodes: enabled.body.data.recoveryCodes };
}

// The code for the next 30-second step: the current one was already used to turn 2FA on.
const nextCode = secret => totpAt(secret, Date.now() + STEP_MS);
// Stands in for time passing, so a later step's code is accepted again.
const forgetUsedStep = userId => TwoFactor.updateOne({ owner: userId }, { $set: { lastUsedStep: null } });

async function passwordLogin(email) {
  const b = await browser();
  b.absorb(await b.post('/api/auth/login').send({ email, password: PASSWORD }));
  return b;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TOTP', () => {
  it('matches the RFC 6238 test vector and refuses replays, bad formats and far-off steps', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(hotp(secret, 1)).toBe('287082'); // RFC 6238 at T=59s, last 6 digits of 94287082
    expect(totpAt(secret, 59_000)).toBe('287082');

    const now = 1_700_000_000_000;
    const code = totpAt(secret, now);
    const step = verifyTotp(secret, code, { now });
    expect(step).toBe(timeStep(now));
    expect(verifyTotp(secret, code, { now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, now - STEP_MS), { now })).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, now - 3 * STEP_MS), { now })).toBeNull();
    for (const bad of ['12345', '1234567', 'abcdef', 123456, null]) expect(verifyTotp(secret, bad, { now })).toBeNull();
  });
});

describe('two-factor setup', () => {
  it('needs the password, stores only ciphertext and hashes, and turns on with a valid code', async () => {
    const s = await createSession('tfa_setup');
    expect((await request(app).get('/api/auth/2fa')).status).toBe(401);
    expect((await s.get('/api/auth/2fa')).body.data).toEqual({ enabled: false, enabledAt: null, recoveryCodesLeft: 0 });

    expect((await s.post('/api/auth/2fa/setup').send({})).status).toBe(400);
    expect((await s.post('/api/auth/2fa/setup').send({ currentPassword: 'wrong-password-1' })).status).toBe(400);
    const setup = await s.post('/api/auth/2fa/setup').send({ currentPassword: PASSWORD });
    const { secret, otpauthUrl, qrDataUrl } = setup.body.data;
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\/DevTrack%3A.+\?secret=[A-Z2-7]+&issuer=DevTrack/);
    expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const pending = await TwoFactor.findOne({ owner: s.userId }).select('+pendingSecret').lean();
    expect(pending.pendingSecret).toMatch(/^v1\./);
    expect(pending.pendingSecret).not.toContain(secret);

    expect((await s.post('/api/auth/2fa/enable').send({ code: '000000' })).status).toBe(400);
    expect((await s.post('/api/auth/2fa/enable').send({ code: '12345' })).status).toBe(400);
    const enabled = await s.post('/api/auth/2fa/enable').send({ code: totpAt(secret) });
    expect(enabled.status).toBe(200);
    const codes = enabled.body.data.recoveryCodes;
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    codes.forEach(code => expect(code).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/));

    const stored = await TwoFactor.findOne({ owner: s.userId }).select('+secret +recoveryCodes +pendingSecret').lean();
    expect(stored.pendingSecret).toBeNull();
    expect(JSON.stringify(stored)).not.toContain(secret);
    for (const code of codes) expect(JSON.stringify(stored)).not.toContain(code);
    expect((await s.get('/api/auth/2fa')).body.data).toMatchObject({ enabled: true, recoveryCodesLeft: 10 });
    // Already on: setup and enable refuse.
    expect((await s.post('/api/auth/2fa/setup').send({ currentPassword: PASSWORD })).status).toBe(409);
  });
});

describe('signing in with two-factor', () => {
  it('asks for a code after the password and signs in only with a valid, unused code', async () => {
    const s = await createSession('tfa_login');
    const { secret } = await enable(s);

    const b = await browser();
    const first = b.absorb(await b.post('/api/auth/login').send({ email: s.user.email, password: PASSWORD }));
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ twoFactorRequired: true });
    expect(first.body.user).toBeUndefined();
    const challengeCookie = first.headers['set-cookie'].find(c => c.startsWith('devtrack_2fa='));
    expect(challengeCookie).toMatch(/HttpOnly/i);
    expect(challengeCookie).toMatch(/Path=\/api\/auth\/2fa/);
    expect(pairs(first).some(pair => pair.startsWith('devtrack_access='))).toBe(false);
    expect((await b.get('/api/auth/me')).status).toBe(401);

    // The code that turned 2FA on cannot be used again.
    expect((await b.post('/api/auth/2fa/verify').send({ code: totpAt(secret) })).status).toBe(400);
    expect((await b.post('/api/auth/2fa/verify').send({ code: 'abcdef' })).status).toBe(400);
    expect((await b.post('/api/auth/2fa/verify').send({ code: '123456', recoveryCode: 'abcde-fghjk' })).status).toBe(400);
    const ok = b.absorb(await b.post('/api/auth/2fa/verify').send({ code: nextCode(secret) }));
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe(s.user.email);
    expect((await b.get('/api/auth/me')).status).toBe(200);
    expect(await LoginChallenge.countDocuments({ owner: s.userId })).toBe(0);
  });

  it('accepts each backup code once and ends a challenge after five wrong codes', async () => {
    const s = await createSession('tfa_backup');
    const { secret, recoveryCodes } = await enable(s);

    const b = await passwordLogin(s.user.email);
    expect((await b.post('/api/auth/2fa/verify').send({ recoveryCode: recoveryCodes[0].toUpperCase() })).status).toBe(200);
    expect((await s.get('/api/auth/2fa')).body.data.recoveryCodesLeft).toBe(9);

    const again = await passwordLogin(s.user.email);
    expect((await again.post('/api/auth/2fa/verify').send({ recoveryCode: recoveryCodes[0] })).status).toBe(400);

    const guesser = await passwordLogin(s.user.email);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await guesser.post('/api/auth/2fa/verify').send({ code: '000000' })).status).toBe(400);
    }
    const locked = await guesser.post('/api/auth/2fa/verify').send({ code: nextCode(secret) });
    expect(locked.status).toBe(401);
    expect(locked.body.code).toBe('TWO_FACTOR_CHALLENGE_EXPIRED');

    // No challenge cookie at all, or a missing CSRF header, gets nowhere.
    const stranger = await browser();
    expect((await stranger.post('/api/auth/2fa/verify').send({ code: '123456' })).status).toBe(401);
    expect((await request(app).post('/api/auth/2fa/verify').send({ code: '123456' })).status).toBe(403);
  });

  it('asks for the code after Google too', async () => {
    const s = await createSession('tfa_social');
    const { secret } = await enable(s);
    // Link Google to this account first.
    const linker = await browser();
    linker.jar.clear();
    for (const pair of s.cookie().split('; ')) linker.jar.set(pair.split('=')[0], pair);
    const person = { providerUserId: `pid-${randomBytes(4).toString('hex')}`, email: s.user.email, emailVerified: true, name: 'Me', login: '' };
    const linkStart = linker.absorb(await linker.post('/api/auth/oauth/google/link').send({}));
    fetchSocialProfile.mockResolvedValueOnce(person);
    await linker.get(`/api/auth/oauth/google/callback?code=abc&state=${new URL(linkStart.body.data.authorizeUrl).searchParams.get('state')}`);

    const b = await browser();
    const started = b.absorb(await b.post('/api/auth/oauth/google/login').send({}));
    fetchSocialProfile.mockResolvedValueOnce(person);
    const callback = b.absorb(await b.get(`/api/auth/oauth/google/callback?code=abc&state=${new URL(started.body.data.authorizeUrl).searchParams.get('state')}`));
    expect(callback.headers.location).toBe('http://localhost:5173/login?step=2fa');
    expect(pairs(callback).some(pair => pair.startsWith('devtrack_access='))).toBe(false);
    expect((await b.post('/api/auth/2fa/verify').send({ code: nextCode(secret) })).status).toBe(200);
    expect(await AuthSession.countDocuments({ owner: s.userId, method: 'google' })).toBe(1);
  });
});

describe('managing two-factor', () => {
  it('turns off only with the password and a code, and regenerates backup codes with a code', async () => {
    const s = await createSession('tfa_manage');
    const { secret, recoveryCodes } = await enable(s);

    expect((await s.post('/api/auth/2fa/recovery-codes').send({ code: '000000' })).status).toBe(400);
    const fresh = await s.post('/api/auth/2fa/recovery-codes').send({ code: nextCode(secret) });
    expect(fresh.status).toBe(200);
    expect(fresh.body.data.recoveryCodes).toHaveLength(10);
    // Old backup codes stop working.
    expect((await s.post('/api/auth/2fa/disable').send({ currentPassword: PASSWORD, recoveryCode: recoveryCodes[1] })).status).toBe(400);

    await forgetUsedStep(s.userId);
    expect((await s.post('/api/auth/2fa/disable').send({ code: totpAt(secret) })).status).toBe(400); // no password
    expect((await s.post('/api/auth/2fa/disable').send({ currentPassword: 'wrong-password-1', code: totpAt(secret) })).status).toBe(400);
    expect((await s.post('/api/auth/2fa/disable').send({ currentPassword: PASSWORD, code: totpAt(secret) })).status).toBe(200);
    expect(await TwoFactor.countDocuments({ owner: s.userId })).toBe(0);

    // Off again: password alone signs in.
    const b = await browser();
    const login = await b.post('/api/auth/login').send({ email: s.user.email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe(s.user.email);
  });

  it('is removed with the account', async () => {
    const s = await createSession('tfa_delete');
    await enable(s);
    expect((await s.del('/api/auth/account').send({ currentPassword: PASSWORD, confirmation: 'DELETE' })).status).toBeLessThan(300);
    expect(await TwoFactor.countDocuments({ owner: s.userId })).toBe(0);
  });
});
