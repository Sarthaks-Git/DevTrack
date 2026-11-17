import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/services/email.transport.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, sendEmail: vi.fn() };
});

import app from '../src/app.js';
import { sendEmail, EmailTransportError } from '../src/services/email.transport.js';
import EmailVerification from '../src/models/EmailVerification.js';
import User from '../src/models/User.js';
import { createSession, PASSWORD } from './helpers.js';

// The code is only in the email body; read it from the mocked transport.
const lastCode = () => sendEmail.mock.calls.at(-1)[0].text.match(/\b(\d{6})\b/)[1];
const age = (userId, ms) => EmailVerification.collection.updateOne({ owner: new User({ _id: userId })._id }, { $set: { sentAt: new Date(Date.now() - ms) } });

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue(undefined);
});

describe('email verification', () => {
  it('sends a code at sign-up and keeps the app locked until it is entered', async () => {
    const s = await createSession('mail_signup', { verified: false });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe(s.user.email);
    expect(mail.subject).toMatch(/^\d{6} is your DevTrack verification code$/);
    const code = lastCode();
    // Only a hash is stored.
    const stored = await EmailVerification.findOne({ owner: s.userId }).lean();
    expect(JSON.stringify(stored)).not.toContain(code);

    const me = await s.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.emailVerified).toBe(false);
    for (const url of ['/api/goals', '/api/projects', '/api/dashboard', '/api/ai', '/api/auth/2fa', '/api/auth/identities']) {
      const blocked = await s.get(url);
      expect(blocked.status, url).toBe(403);
      expect(blocked.body.code, url).toBe('EMAIL_NOT_VERIFIED');
    }
    expect((await s.post('/api/goals').send({ title: 'x' })).status).toBe(403);

    expect((await s.post('/api/auth/email/verify').send({ code: '12345' })).status).toBe(400);
    const wrong = code === '000000' ? '111111' : '000000';
    const miss = await s.post('/api/auth/email/verify').send({ code: wrong });
    expect(miss.status).toBe(400);
    expect(miss.body.message).toMatch(/4 tries left/);

    expect((await s.post('/api/auth/email/verify').send({ code })).status).toBe(200);
    expect((await s.get('/api/auth/me')).body.user.emailVerified).toBe(true);
    expect((await s.get('/api/goals')).status).toBe(200);
    expect(await EmailVerification.countDocuments({ owner: s.userId })).toBe(0);
  });

  it('limits resends and wrong guesses, and refuses expired codes', async () => {
    const s = await createSession('mail_limits', { verified: false });
    const first = lastCode();
    const tooSoon = await s.post('/api/auth/email/send').send({});
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.code).toBe('EMAIL_RESEND_COOLDOWN');

    await age(s.userId, 61_000);
    expect((await s.post('/api/auth/email/send').send({})).status).toBe(200);
    const second = lastCode();
    // The old code stops working once a new one is sent (unless they happen to match).
    if (first !== second) expect((await s.post('/api/auth/email/verify').send({ code: first })).status).toBe(400);

    for (let i = 0; i < 6; i += 1) {
      await s.post('/api/auth/email/verify').send({ code: second === '999999' ? '888888' : '999999' });
    }
    const locked = await s.post('/api/auth/email/verify').send({ code: second });
    expect(locked.status).toBe(400);
    expect(locked.body.code).toBe('EMAIL_CODE_EXPIRED');

    // Five sends an hour.
    for (let sent = 2; sent < 5; sent += 1) {
      await age(s.userId, 61_000);
      expect((await s.post('/api/auth/email/send').send({})).status).toBe(200);
    }
    await age(s.userId, 61_000);
    const capped = await s.post('/api/auth/email/send').send({});
    expect(capped.status).toBe(429);
    expect(capped.body.code).toBe('EMAIL_RESEND_LIMIT');

    // An expired code is refused even if correct.
    const other = await createSession('mail_expiry', { verified: false });
    const code = lastCode();
    await EmailVerification.updateOne({ owner: other.userId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await other.post('/api/auth/email/verify').send({ code })).body.code).toBe('EMAIL_CODE_EXPIRED');
  });

  it('lets an unverified user fix a mistyped email, and re-verifies a changed email', async () => {
    const s = await createSession('mail_fix', { verified: false });
    const typo = lastCode();
    const fixed = `fixed_${Date.now()}@example.com`;
    const changed = await s.patch('/api/auth/profile').send({ email: fixed, currentPassword: PASSWORD });
    expect(changed.status).toBe(200);
    expect(changed.body.emailSent).toBe(true);
    expect(sendEmail.mock.calls.at(-1)[0].to).toBe(fixed);
    // A code sent to the old address does not verify the new one.
    const fresh = lastCode();
    if (typo !== fresh) expect((await s.post('/api/auth/email/verify').send({ code: typo })).status).toBe(400);
    expect((await s.post('/api/auth/email/verify').send({ code: fresh })).status).toBe(200);

    // Verified users keep their email (and the app) until the new address is confirmed (tests/emailChange.test.js).
    const v = await createSession('mail_change');
    const moved = await v.patch('/api/auth/profile').send({ email: `moved_${Date.now()}@example.com`, currentPassword: PASSWORD });
    expect(moved.body.user.email).toBe(v.user.email);
    expect((await v.get('/api/goals')).status).toBe(200);
  });

  it('keeps sign-out, sessions and account deletion open to unverified accounts, and needs sign-in for the rest', async () => {
    expect((await request(app).post('/api/auth/email/send').send({})).status).toBe(401); // signed out
    const s = await createSession('mail_open', { verified: false });
    expect((await s.get('/api/auth/sessions')).status).toBe(200);
    expect((await s.del('/api/auth/account').send({ currentPassword: PASSWORD, confirmation: 'DELETE' })).status).toBeLessThan(300);
    expect(await User.exists({ _id: s.userId })).toBeNull();
    expect(await EmailVerification.countDocuments({ owner: s.userId })).toBe(0);
  });

  it('reports delivery problems without leaking details', async () => {
    sendEmail.mockRejectedValueOnce(new EmailTransportError('unavailable'));
    const s = await createSession('mail_fail', { verified: false });
    await age(s.userId, 61_000);
    sendEmail.mockRejectedValueOnce(new EmailTransportError('rejected'));
    const bounced = await s.post('/api/auth/email/send').send({});
    expect(bounced.status).toBe(400);
    expect(bounced.body.code).toBe('EMAIL_UNDELIVERABLE');
    await age(s.userId, 61_000);
    sendEmail.mockRejectedValueOnce(new EmailTransportError('misconfigured'));
    const down = await s.post('/api/auth/email/send').send({});
    expect(down.status).toBe(502);
    expect(down.body.message).not.toMatch(/key|brevo/i);
  });
});
