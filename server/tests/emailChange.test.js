import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/services/email.transport.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, sendEmail: vi.fn() };
});

import request from 'supertest';
import app from '../src/app.js';
import { sendEmail } from '../src/services/email.transport.js';
import EmailChange from '../src/models/EmailChange.js';
import User from '../src/models/User.js';
import { createSession, login, PASSWORD } from './helpers.js';

const lastCodeTo = email => sendEmail.mock.calls.filter(([mail]) => mail.to === email).at(-1)[0].text.match(/\b(\d{6})\b/)[1];
const wrongCode = code => (code === '000000' ? '111111' : '000000');
const fresh = prefix => `${prefix}_${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`;

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue(undefined);
});

describe('changing a verified email', () => {
  it('keeps the old email until the code sent to the new one is entered, then switches everywhere', async () => {
    const s = await createSession('chg_ok');
    const other = await createSession('chg_ok');
    const oldEmail = s.user.email;
    const newEmail = fresh('moved');

    const started = await s.patch('/api/auth/profile').send({ email: newEmail, currentPassword: PASSWORD });
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({ pendingEmail: newEmail, emailSent: true });
    expect(started.body.user.email).toBe(oldEmail);
    expect(sendEmail.mock.calls.at(-1)[0].to).toBe(newEmail);
    const code = lastCodeTo(newEmail);
    expect(JSON.stringify(await EmailChange.findOne({ owner: s.userId }).lean())).not.toContain(code);

    // Nothing changed yet, and the app keeps working.
    expect((await s.get('/api/auth/me')).body.user).toMatchObject({ email: oldEmail, emailVerified: true });
    expect((await s.get('/api/goals')).status).toBe(200);
    expect((await s.get('/api/auth/email/change')).body.data).toMatchObject({ pendingEmail: newEmail, codeUsable: true });

    // Codes do not cross accounts or purposes.
    expect((await other.post('/api/auth/email/change/confirm').send({ code })).status).toBe(400);
    expect((await s.post('/api/auth/email/verify').send({ code })).body.data.verified).toBe(true); // already verified: no-op
    expect((await s.get('/api/auth/me')).body.user.email).toBe(oldEmail);

    const miss = await s.post('/api/auth/email/change/confirm').send({ code: wrongCode(code) });
    expect(miss.status).toBe(400);
    expect(miss.body.message).toMatch(/4 tries left/);
    expect((await s.get('/api/auth/me')).body.user.email).toBe(oldEmail);

    const second = await login({ email: oldEmail, password: PASSWORD });
    const confirmed = await s.post('/api/auth/email/change/confirm').send({ code });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.email).toBe(newEmail);

    expect((await s.get('/api/auth/me')).body.user).toMatchObject({ email: newEmail, emailVerified: true });
    expect(await EmailChange.countDocuments({ owner: s.userId })).toBe(0);
    // Other devices signed out; sign-in moves to the new address.
    expect((await request(app).get('/api/auth/me').set('Cookie', second.cookie)).status).toBe(401);
    expect((await login({ email: oldEmail, password: PASSWORD })).response.status).toBe(401);
    expect((await login({ email: newEmail, password: PASSWORD })).response.status).toBe(200);
    // The old address is told, with the new one masked.
    await vi.waitFor(() => expect(sendEmail.mock.calls.some(([mail]) => mail.to === oldEmail && mail.subject === 'Your DevTrack email was changed')).toBe(true));
    const alert = sendEmail.mock.calls.find(([mail]) => mail.to === oldEmail && mail.subject === 'Your DevTrack email was changed')[0];
    expect(alert.text).not.toContain(newEmail);
    expect(alert.text).toContain(`${newEmail[0]}•••@example.com`);
  });

  it('cancels, resends with a cooldown, and locks a code after five wrong tries', async () => {
    const s = await createSession('chg_cancel');
    const newEmail = fresh('cancel');
    await s.patch('/api/auth/profile').send({ email: newEmail, currentPassword: PASSWORD });
    const tooSoon = await s.post('/api/auth/email/change/resend').send({});
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.code).toBe('EMAIL_RESEND_COOLDOWN');
    await EmailChange.updateOne({ owner: s.userId }, { $set: { sentAt: new Date(Date.now() - 61_000) } });
    expect((await s.post('/api/auth/email/change/resend').send({})).status).toBe(200);
    const code = lastCodeTo(newEmail);

    for (let i = 0; i < 5; i += 1) await s.post('/api/auth/email/change/confirm').send({ code: wrongCode(code) });
    const locked = await s.post('/api/auth/email/change/confirm').send({ code });
    expect(locked.body.code).toBe('EMAIL_CODE_EXPIRED');
    expect((await s.get('/api/auth/email/change')).body.data.codeUsable).toBe(false);

    expect((await s.del('/api/auth/email/change')).status).toBe(204);
    expect((await s.get('/api/auth/email/change')).body.data).toEqual({ pendingEmail: null });
    expect((await s.post('/api/auth/email/change/resend').send({})).status).toBe(404);
    expect((await s.get('/api/auth/me')).body.user.email).toBe(s.user.email);
  });

  it('refuses the switch when another account took the address meanwhile, and expired codes', async () => {
    const s = await createSession('chg_race');
    const newEmail = fresh('race');
    await s.patch('/api/auth/profile').send({ email: newEmail, currentPassword: PASSWORD });
    const code = lastCodeTo(newEmail);
    const taker = await createSession('chg_taker');
    await User.updateOne({ _id: taker.userId }, { $set: { email: newEmail } });
    const refused = await s.post('/api/auth/email/change/confirm').send({ code });
    expect(refused.status).toBe(409);
    expect((await s.get('/api/auth/me')).body.user.email).toBe(s.user.email);

    const later = fresh('later');
    await s.patch('/api/auth/profile').send({ email: later, currentPassword: PASSWORD });
    await EmailChange.updateOne({ owner: s.userId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await s.post('/api/auth/email/change/confirm').send({ code: lastCodeTo(later) })).body.code).toBe('EMAIL_CODE_EXPIRED');
  });

  it('needs the password, rejects taken emails up front, and changes the username at once', async () => {
    const s = await createSession('chg_rules');
    const taken = await createSession('chg_taken');
    vi.clearAllMocks();
    expect((await s.patch('/api/auth/profile').send({ email: fresh('nopw') })).status).toBe(400);
    expect((await s.patch('/api/auth/profile').send({ email: fresh('badpw'), currentPassword: 'wrong-password-1' })).status).toBe(400);
    expect((await s.patch('/api/auth/profile').send({ email: taken.user.email, currentPassword: PASSWORD })).status).toBe(409);
    expect(sendEmail).not.toHaveBeenCalled();

    const name = `renamed_${Date.now().toString(36)}`;
    const both = await s.patch('/api/auth/profile').send({ username: name, email: fresh('both'), currentPassword: PASSWORD });
    expect(both.status).toBe(200);
    expect(both.body.user.username).toBe(name);
    expect(both.body.user.email).toBe(s.user.email);
    expect(both.body.pendingEmail).toMatch(/^both_/);

    expect((await s.post('/api/auth/email/change/confirm').send({ code: '12345' })).status).toBe(400);
  });

  it('is only for signed-in, verified accounts', async () => {
    expect((await request(app).get('/api/auth/email/change')).status).toBe(401);
    const u = await createSession('chg_unverified', { verified: false });
    expect((await u.get('/api/auth/email/change')).status).toBe(403);
  });
});
