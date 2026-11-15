import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import config from '../src/config/config.js';
import { createSession, PASSWORD } from './helpers.js';

describe('Security middleware', () => {
  it('rejects MongoDB operator injection in login', async () => {
    const s = await createSession('sec');
    const res = await request(app).post('/api/auth/login')
      .set('Cookie', s.cookie()).set('x-csrf-token', s.csrfToken)
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty('user');
  });

  it('rejects operator and prototype keys nested in request bodies', async () => {
    const s = await createSession('sec');
    expect((await s.post('/api/journal').send({ title: 'x', tags: [{ $gt: '' }] })).body.code).toBe('UNSAFE_INPUT');
    const proto = await s.post('/api/journal').set('Content-Type', 'application/json').send('{"title":"x","__proto__":{"admin":true}}');
    expect(proto.status).toBe(400);
  });

  it('marks API responses as non-cacheable and hides framework headers', async () => {
    const s = await createSession('sec');
    const res = await s.get('/api/auth/me');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers).not.toHaveProperty('x-powered-by');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns 401 (not 500) for tokens with forged or malformed claims', async () => {
    const sign = claims => jwt.sign(claims, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m', issuer: 'devtrack-api', audience: 'devtrack-client' });
    for (const claims of [{ sub: 'not-an-id', sid: 'nope' }, { sub: '507f1f77bcf86cd799439011', sid: '507f1f77bcf86cd799439011' }, {}]) {
      const res = await request(app).get('/api/auth/me').set('Cookie', `devtrack_access=${sign(claims)}`);
      expect(res.status).toBe(401);
    }
  });

  it('rejects tokens signed with a different secret or algorithm', async () => {
    const forged = jwt.sign({ sub: '507f1f77bcf86cd799439011', sid: '507f1f77bcf86cd799439011' }, 'attacker-secret-attacker-secret-1234', { issuer: 'devtrack-api', audience: 'devtrack-client' });
    expect((await request(app).get('/api/auth/me').set('Cookie', `devtrack_access=${forged}`)).status).toBe(401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"507f1f77bcf86cd799439011"}').toString('base64url')}.`;
    expect((await request(app).get('/api/auth/me').set('Cookie', `devtrack_access=${none}`)).status).toBe(401);
  });

  it('logout with a stolen session id but wrong refresh token does not revoke the session', async () => {
    const s = await createSession('sec');
    const sessions = (await s.get('/api/auth/sessions')).body.sessions;
    const forgedRefresh = `${sessions[0].id}.forged-token-value`;
    await request(app).post('/api/auth/logout')
      .set('Cookie', `devtrack_refresh=${forgedRefresh}; devtrack_csrf=${s.csrfToken}`).set('x-csrf-token', s.csrfToken);
    expect((await s.get('/api/auth/me')).status).toBe(200);
  });

  it('never returns password hashes from auth endpoints', async () => {
    const s = await createSession('sec');
    const me = await s.get('/api/auth/me');
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const login = await request(app).post('/api/auth/login').set('Cookie', s.cookie()).set('x-csrf-token', s.csrfToken)
      .send({ email: s.user.email, password: PASSWORD });
    expect(JSON.stringify(login.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});
