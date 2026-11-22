import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/services/email.transport.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, sendEmail: vi.fn() };
});

import app from '../src/app.js';
import { sendEmail, EmailTransportError } from '../src/services/email.transport.js';
import AuthSession from '../src/models/AuthSession.js';
import PasswordReset from '../src/models/PasswordReset.js';
import User from '../src/models/User.js';
import { totpAt } from '../src/utils/totp.js';
import { createSession, login, PASSWORD } from './helpers.js';

const NEW_PASSWORD = 'BrandNewSecret42!x';
const pairs = response => (response.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]);

// A signed-out browser: CSRF cookie and token only.
async function signedOut() {
  const csrf = await request(app).get('/api/auth/csrf');
  const cookie = pairs(csrf).find(pair => pair.startsWith('devtrack_csrf='));
  const token = decodeURIComponent(cookie.split('=')[1]);
  return { post: url => request(app).post(url).set('Cookie', cookie).set('x-csrf-token', token) };
}

// The code is sent after the response; wait for the mocked transport to receive it. The 5 s timeout
// covers slow full runs against the remote test database (the 1 s default flaked).
async function codeSentTo(email) {
  await vi.waitFor(() => expect(sendEmail.mock.calls.some(([mail]) => mail.to === email && /password reset/.test(mail.subject))).toBe(true), { timeout: 5000 });
  const mail = sendEmail.mock.calls.filter(([m]) => m.to === email && /password reset/.test(m.subject)).at(-1)[0];
  return mail.text.match(/\b(\d{6})\b/)[1];
}
// Registration sends a verification email too; count only reset codes.
const resetMails = () => sendEmail.mock.calls.filter(([mail]) => /password reset/.test(mail.subject));
const wrongCode = code => (code === '000000' ? '111111' : '000000');
const ageCode = userId => PasswordReset.collection.updateOne({ owner: new User({ _id: userId })._id }, { $set: { sentAt: new Date(Date.now() - 61_000) } });

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue(undefined);
});

describe('forgot password', () => {
  it('resets the password with the emailed code, signs out every device and alerts the owner', async () => {
    const s = await createSession('reset_ok');
    const b = await signedOut();
    const asked = await b.post('/api/auth/password/forgot').send({ email: s.user.email });
    expect(asked.status).toBe(200);
    const code = await codeSentTo(s.user.email);
    // Only a hash is stored.
    expect(JSON.stringify(await PasswordReset.findOne({ owner: s.userId }).lean())).not.toContain(code);

    const done = await b.post('/api/auth/password/reset').send({ email: s.user.email, code, newPassword: NEW_PASSWORD });
    expect(done.status).toBe(200);
    // Not signed in by the reset itself.
    expect(pairs(done).some(pair => pair.startsWith('devtrack_access='))).toBe(false);

    expect((await s.get('/api/auth/me')).status).toBe(401);
    expect(await AuthSession.countDocuments({ owner: s.userId, revokedAt: null })).toBe(0);
    expect((await login({ email: s.user.email, password: PASSWORD })).response.status).toBe(401);
    expect((await login({ email: s.user.email, password: NEW_PASSWORD })).response.status).toBe(200);
    await vi.waitFor(() => expect(sendEmail.mock.calls.some(([mail]) => mail.to === s.user.email && mail.subject === 'Your DevTrack password was changed')).toBe(true));

    // Single use.
    const again = await b.post('/api/auth/password/reset').send({ email: s.user.email, code, newPassword: 'AnotherSecret77!z' });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('RESET_CODE_INVALID');
  });

  it('answers the same for unknown emails and sends nothing', async () => {
    const b = await signedOut();
    const known = await createSession('reset_known');
    const a = await b.post('/api/auth/password/forgot').send({ email: known.user.email });
    const u = await b.post('/api/auth/password/forgot').send({ email: `nobody_${Date.now()}@example.com` });
    expect(u.status).toBe(a.status);
    expect(u.body).toEqual(a.body);
    await codeSentTo(known.user.email);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(resetMails()).toHaveLength(1);

    const reset = await b.post('/api/auth/password/reset').send({ email: `nobody_${Date.now()}@example.com`, code: '123456', newPassword: NEW_PASSWORD });
    expect(reset.status).toBe(400);
    expect(reset.body.code).toBe('RESET_CODE_INVALID');
  });

  it('allows five tries per code, refuses expired codes and codes for another account', async () => {
    const victim = await createSession('reset_tries');
    const other = await createSession('reset_other');
    const b = await signedOut();
    await b.post('/api/auth/password/forgot').send({ email: victim.user.email });
    const code = await codeSentTo(victim.user.email);
    await b.post('/api/auth/password/forgot').send({ email: other.user.email });
    const otherCode = await codeSentTo(other.user.email);

    // A code works only for the account it was sent to.
    if (otherCode !== code) {
      expect((await b.post('/api/auth/password/reset').send({ email: victim.user.email, code: otherCode, newPassword: NEW_PASSWORD })).status).toBe(400);
    }
    for (let i = 0; i < 5; i += 1) {
      const miss = await b.post('/api/auth/password/reset').send({ email: victim.user.email, code: wrongCode(code), newPassword: NEW_PASSWORD });
      expect(miss.body.code).toBe('RESET_CODE_INVALID');
      // Never says how many tries are left (that would reveal the account exists).
      expect(miss.body.message).not.toMatch(/left/);
    }
    expect((await b.post('/api/auth/password/reset').send({ email: victim.user.email, code, newPassword: NEW_PASSWORD })).status).toBe(400);
    expect((await login({ email: victim.user.email, password: PASSWORD })).response.status).toBe(200);

    await PasswordReset.updateOne({ owner: other.userId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await b.post('/api/auth/password/reset').send({ email: other.user.email, code: otherCode, newPassword: NEW_PASSWORD })).status).toBe(400);
  });

  it('sends one code a minute per account, silently', async () => {
    const s = await createSession('reset_throttle');
    const b = await signedOut();
    await b.post('/api/auth/password/forgot').send({ email: s.user.email });
    await codeSentTo(s.user.email);
    const second = await b.post('/api/auth/password/forgot').send({ email: s.user.email });
    expect(second.status).toBe(200);
    // Give a would-be second send time to happen.
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(resetMails()).toHaveLength(1);
    await ageCode(s.userId);
    await b.post('/api/auth/password/forgot').send({ email: s.user.email });
    await vi.waitFor(() => expect(resetMails()).toHaveLength(2));
  });

  it('still asks for the authenticator code after a reset when 2FA is on', async () => {
    const s = await createSession('reset_2fa');
    const setup = await s.post('/api/auth/2fa/setup').send({ currentPassword: PASSWORD });
    expect((await s.post('/api/auth/2fa/enable').send({ code: totpAt(setup.body.data.secret) })).status).toBe(200);

    const b = await signedOut();
    await b.post('/api/auth/password/forgot').send({ email: s.user.email });
    const code = await codeSentTo(s.user.email);
    expect((await b.post('/api/auth/password/reset').send({ email: s.user.email, code, newPassword: NEW_PASSWORD })).status).toBe(200);

    const { response } = await login({ email: s.user.email, password: NEW_PASSWORD });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ twoFactorRequired: true });
    expect(pairs(response).some(pair => pair.startsWith('devtrack_access='))).toBe(false);
  });

  it('checks the new password rules, verifies an unverified email, and lets social accounts set a password', async () => {
    const s = await createSession('reset_rules', { verified: false });
    const b = await signedOut();
    await b.post('/api/auth/password/forgot').send({ email: s.user.email });
    const code = await codeSentTo(s.user.email);
    const short = await b.post('/api/auth/password/reset').send({ email: s.user.email, code, newPassword: 'short' });
    expect(short.status).toBe(400);
    const named = await b.post('/api/auth/password/reset').send({ email: s.user.email, code, newPassword: `${s.user.username}-Secret1` });
    expect(named.status).toBe(400);
    expect(named.body.errors.newPassword).toMatch(/username/);

    await User.updateOne({ _id: s.userId }, { $set: { passwordSet: false } });
    expect((await b.post('/api/auth/password/reset').send({ email: s.user.email, code, newPassword: NEW_PASSWORD })).status).toBe(200);
    const user = await User.findById(s.userId).lean();
    expect(user.passwordSet).toBe(true);
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it('validates input, needs CSRF, and hides delivery failures', async () => {
    const b = await signedOut();
    expect((await request(app).post('/api/auth/password/forgot').send({ email: 'a@example.com' })).status).toBe(403);
    expect((await b.post('/api/auth/password/forgot').send({ email: 'not-an-email' })).status).toBe(400);
    expect((await b.post('/api/auth/password/forgot').send({ email: { $ne: null } })).status).toBe(400);
    expect((await b.post('/api/auth/password/forgot').send({ email: 'a@example.com', extra: 1 })).status).toBe(400);
    expect((await b.post('/api/auth/password/reset').send({ email: 'a@example.com', code: '12345', newPassword: NEW_PASSWORD })).status).toBe(400);

    sendEmail.mockRejectedValueOnce(new EmailTransportError('unavailable'));
    const s = await createSession('reset_fail');
    const failed = await b.post('/api/auth/password/forgot').send({ email: s.user.email });
    expect(failed.status).toBe(200);
  });
});
