import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import Goal from '../src/models/Goal.js';
import JournalEntry from '../src/models/JournalEntry.js';
import Activity from '../src/models/Activity.js';
import AuthSession from '../src/models/AuthSession.js';
import User from '../src/models/User.js';
import { createSession, login, uniqueUser, PASSWORD } from './helpers.js';

describe('Account management API', () => {
  it('requires authentication and CSRF for profile updates', async () => {
    const anonymous = await request(app).patch('/api/auth/profile').send({ username: 'someone' });
    expect([401, 403]).toContain(anonymous.status);

    const session = await createSession('acct');
    const noCsrf = await request(app).patch('/api/auth/profile').set('Cookie', session.cookie()).send({ username: 'renamed', currentPassword: PASSWORD });
    expect(noCsrf.status).toBe(403);
  });

  it('updates username after confirming the current password', async () => {
    const session = await createSession('acct');
    const newName = `renamed_${Date.now().toString(36)}`;

    const wrong = await session.patch('/api/auth/profile').send({ username: newName, currentPassword: 'not-the-password' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('INVALID_CURRENT_PASSWORD');

    const ok = await session.patch('/api/auth/profile').send({ username: newName, currentPassword: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.user.username).toBe(newName);
    expect(ok.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects taking another user\'s email and unknown fields', async () => {
    const first = await createSession('acct');
    const second = await createSession('acct');

    const taken = await second.patch('/api/auth/profile').send({ email: first.user.email, currentPassword: PASSWORD });
    expect(taken.status).toBe(409);

    const escalation = await second.patch('/api/auth/profile').send({ role: 'admin', username: 'valid_name', currentPassword: PASSWORD });
    expect(escalation.status).toBe(400);
    const stored = await User.findById(second.userId).lean();
    expect(stored.role).toBe('user');
  });

  it('changing email signs out other sessions but keeps the current one', async () => {
    const session = await createSession('acct');
    const other = await login(session.user);
    expect(other.response.status).toBe(200);

    const newEmail = `moved_${Date.now().toString(36)}@example.com`;
    const res = await session.patch('/api/auth/profile').send({ email: newEmail, currentPassword: PASSWORD });
    expect(res.status).toBe(200);

    expect((await session.get('/api/auth/me')).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', other.cookie)).status).toBe(401);
  });

  it('changes password, revokes other sessions, and accepts only the new password', async () => {
    const session = await createSession('acct');
    const other = await login(session.user);
    const newPassword = 'An0ther-Strong-Passphrase';

    const weak = await session.patch('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'short' });
    expect(weak.status).toBe(400);

    const tooLong = await session.patch('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'a'.repeat(73) });
    expect(tooLong.status).toBe(400);

    const res = await session.patch('/api/auth/password').send({ currentPassword: PASSWORD, newPassword });
    expect(res.status).toBe(200);

    expect((await session.get('/api/auth/me')).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', other.cookie)).status).toBe(401);
    expect((await login(session.user)).response.status).toBe(401);
    expect((await login({ ...session.user, password: newPassword })).response.status).toBe(200);
  });

  it('lists sessions with coarse device labels and can revoke one', async () => {
    const session = await createSession('acct');
    await login(session.user);

    const list = await session.get('/api/auth/sessions');
    expect(list.status).toBe(200);
    expect(list.body.sessions).toHaveLength(2);
    const current = list.body.sessions.find(item => item.current);
    expect(current.device).toBe('Chrome on Windows');
    expect(JSON.stringify(list.body)).not.toMatch(/tokenHash|usedTokenHashes/);

    const target = list.body.sessions.find(item => !item.current);
    expect((await session.del(`/api/auth/sessions/${target.id}`)).status).toBe(204);
    expect((await session.get('/api/auth/sessions')).body.sessions).toHaveLength(1);
  });

  it('cannot revoke another user\'s session', async () => {
    const victim = await createSession('acct');
    const attacker = await createSession('acct');
    const victimSession = await AuthSession.findOne({ owner: victim.userId }).lean();

    const res = await attacker.del(`/api/auth/sessions/${victimSession._id}`);
    expect(res.status).toBe(404);
    expect((await victim.get('/api/auth/me')).status).toBe(200);
  });

  it('deletes the account and every piece of owned data', async () => {
    const session = await createSession('acct');
    const bystander = await createSession('acct');
    await session.post('/api/goals').send({ title: 'Delete me goal' });
    await session.post('/api/journal').send({ title: 'Private note' });
    await bystander.post('/api/goals').send({ title: 'Keep me goal' });

    const noConfirm = await session.del('/api/auth/account').send({ currentPassword: PASSWORD });
    expect(noConfirm.status).toBe(400);

    const res = await session.del('/api/auth/account').send({ currentPassword: PASSWORD, confirmation: 'DELETE' });
    expect(res.status).toBe(204);

    expect(await User.exists({ _id: session.userId })).toBeNull();
    expect(await Goal.countDocuments({ owner: session.userId })).toBe(0);
    expect(await JournalEntry.countDocuments({ owner: session.userId })).toBe(0);
    expect(await Activity.countDocuments({ owner: session.userId })).toBe(0);
    expect(await AuthSession.countDocuments({ owner: session.userId })).toBe(0);
    expect(await Goal.countDocuments({ owner: bystander.userId })).toBe(1);
    expect((await session.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects registration passwords that contain the username', async () => {
    const user = uniqueUser('acct');
    const csrf = await request(app).get('/api/auth/csrf');
    const cookie = csrf.headers['set-cookie'][0].split(';')[0];
    const token = decodeURIComponent(cookie.split('=')[1]);
    const res = await request(app).post('/api/auth/register').set('Cookie', cookie).set('x-csrf-token', token)
      .send({ ...user, password: `${user.username}-long-enough` });
    expect(res.status).toBe(400);
    expect(res.body.errors.password).toMatch(/username/);
  });
});
