import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

function createUser() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return { username: `auth_${id}`, email: `auth_${id}@example.com`, password: 'TestPassword123!' };
}

async function csrfContext() {
  const response = await request(app).get('/api/auth/csrf');
  const setCookies = response.headers['set-cookie'] || [];
  const csrfCookie = setCookies.map(value => value.split(';')[0]).join('; ');
  const csrfToken = decodeURIComponent(csrfCookie.split('; ').find(value => value.startsWith('devtrack_csrf='))?.slice('devtrack_csrf='.length) || '');
  return { csrfCookie, csrfToken };
}

const cookiePairs = setCookies => (setCookies || []).map(value => value.split(';')[0]).join('; ');

describe('Authentication API', () => {
  it('rejects registration without a valid CSRF token', async () => {
    const response = await request(app).post('/api/auth/register').send(createUser());
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CSRF_INVALID');
  });

  it('registers a user and issues HttpOnly access and refresh cookies', async () => {
    const user = createUser();
    const csrf = await csrfContext();
    const response = await request(app).post('/api/auth/register')
      .set('Cookie', csrf.csrfCookie).set('x-csrf-token', csrf.csrfToken).send(user);

    expect(response.status).toBe(201);
    expect(response.body.user.username).toBe(user.username.toLowerCase());
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.user.passwordHash).toBeUndefined();
    const cookies = response.headers['set-cookie'];
    expect(cookies.some(value => value.startsWith('devtrack_access=') && /HttpOnly/i.test(value))).toBe(true);
    expect(cookies.some(value => value.startsWith('devtrack_refresh=') && /HttpOnly/i.test(value))).toBe(true);
  });

  it('authenticates /me and revokes the session on logout', async () => {
    const user = createUser();
    const csrf = await csrfContext();
    const register = await request(app).post('/api/auth/register')
      .set('Cookie', csrf.csrfCookie).set('x-csrf-token', csrf.csrfToken).send(user);
    expect(register.status).toBe(201);
    const cookies = `${cookiePairs(register.headers['set-cookie'])}; ${csrf.csrfCookie}`;

    const me = await request(app).get('/api/auth/me').set('Cookie', cookies);
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe(user.username.toLowerCase());

    const logout = await request(app).post('/api/auth/logout')
      .set('Cookie', cookies).set('x-csrf-token', csrf.csrfToken);
    expect(logout.status).toBe(204);

    const afterLogout = await request(app).get('/api/auth/me').set('Cookie', cookies);
    expect(afterLogout.status).toBe(401);
  });

  it('rotates refresh tokens and rejects replay of the previous token', async () => {
    const user = createUser();
    const csrf = await csrfContext();
    const register = await request(app).post('/api/auth/register')
      .set('Cookie', csrf.csrfCookie).set('x-csrf-token', csrf.csrfToken).send(user);
    expect(register.status).toBe(201);
    const originalCookies = register.headers['set-cookie'];
    const originalRefresh = originalCookies.find(value => value.startsWith('devtrack_refresh='))?.split(';')[0];
    const originalAccess = originalCookies.find(value => value.startsWith('devtrack_access='))?.split(';')[0];
    const originalCookieHeader = `${originalAccess}; ${originalRefresh}; ${csrf.csrfCookie}`;

    const refreshed = await request(app).post('/api/auth/refresh')
      .set('Cookie', originalCookieHeader).set('x-csrf-token', csrf.csrfToken);
    expect(refreshed.status).toBe(200);
    const rotatedRefresh = refreshed.headers['set-cookie'].find(value => value.startsWith('devtrack_refresh='))?.split(';')[0];
    expect(rotatedRefresh).toBeDefined();
    expect(rotatedRefresh).not.toBe(originalRefresh);

    const replay = await request(app).post('/api/auth/refresh')
      .set('Cookie', originalCookieHeader).set('x-csrf-token', csrf.csrfToken);
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('SESSION_REUSED');

    const currentAccess = refreshed.headers['set-cookie'].find(value => value.startsWith('devtrack_access='))?.split(';')[0];
    const afterReplay = await request(app).get('/api/auth/me')
      .set('Cookie', `${currentAccess}; ${rotatedRefresh}; ${csrf.csrfCookie}`);
    expect(afterReplay.status).toBe(401);
  });
});
