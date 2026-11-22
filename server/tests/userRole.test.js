import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setUserRoleLogic } from '../src/services/userRole.service.js';
import { authMiddleware, requireRole } from '../src/middlewares/auth.middleware.js';
import User from '../src/models/User.js';
import { createSession } from './helpers.js';

// A throwaway admin-only route, so the test proves what the role actually unlocks.
const adminApp = express();
adminApp.use(cookieParser());
adminApp.get('/admin-only', authMiddleware, requireRole('admin'), (req, res) => res.json({ ok: true }));
adminApp.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code })); // eslint-disable-line no-unused-vars

describe('owner role script logic', () => {
  it('makes a user admin and back, effective on the next request without signing in again', async () => {
    const s = await createSession('role_set');
    const hit = () => request(adminApp).get('/admin-only').set('Cookie', s.cookie());

    expect((await hit()).status).toBe(403);

    await expect(setUserRoleLogic({ username: s.user.username.toUpperCase(), role: 'admin' }))
      .resolves.toEqual({ username: s.user.username, role: 'admin' });
    expect((await hit()).status).toBe(200);

    await setUserRoleLogic({ username: s.user.username, role: 'user' });
    expect((await hit()).status).toBe(403);
  });

  it('refuses unknown roles, bad usernames and missing users without changing anything', async () => {
    const s = await createSession('role_bad');
    await expect(setUserRoleLogic({ username: s.user.username, role: 'owner' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(setUserRoleLogic({ username: { $ne: null }, role: 'admin' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(setUserRoleLogic({ username: 'nobody_here_123', role: 'admin' })).rejects.toMatchObject({ statusCode: 404 });
    expect((await User.findById(s.userId).lean()).role).toBe('user');
  });

  it('cannot be reached over HTTP: the account API ignores a role in the body', async () => {
    const s = await createSession('role_http');
    await s.patch('/api/auth/profile').send({ role: 'admin', currentPassword: s.user.password });
    expect((await User.findById(s.userId).lean()).role).toBe('user');
  });
});
