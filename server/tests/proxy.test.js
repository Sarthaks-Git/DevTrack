import { describe, it, expect, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../src/app.js';
import config, { buildConfig, PROXY_HEADER } from '../src/config/config.js';

const SECRET = randomBytes(32).toString('base64url');
const saved = config.PROXY;

describe('Direct calls that skip the Vercel proxy', () => {
  afterEach(() => {
    config.PROXY = saved;
  });

  it('are refused in enforce mode, even with a faked X-Forwarded-For', async () => {
    config.PROXY = { mode: 'enforce', secret: SECRET };
    const direct = await request(app).post('/api/auth/login').set('X-Forwarded-For', '203.0.113.9').send({ email: 'a@b.co', password: 'x' });
    expect(direct.status).toBe(403);
    expect(direct.body.code).toBe('DIRECT_ACCESS');

    const wrong = await request(app).get('/api/goals').set(PROXY_HEADER, `${SECRET}x`);
    expect(wrong.status).toBe(403);

    const proxied = await request(app).get('/api/goals').set(PROXY_HEADER, SECRET);
    expect(proxied.status).toBe(401);
  });

  it('still reach the health check and the signed Razorpay webhook', async () => {
    config.PROXY = { mode: 'enforce', secret: SECRET };
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.proxied).toBe(false);
    expect(health.body).not.toHaveProperty('ip');
    expect((await request(app).get('/api/health').set(PROXY_HEADER, SECRET)).body.proxied).toBe(true);

    const webhook = await request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').send('{}');
    expect(webhook.status).not.toBe(403);
  });

  it('pass in report mode, and the health check says whether the header arrived', async () => {
    config.PROXY = { mode: 'report', secret: SECRET };
    expect((await request(app).get('/api/goals')).status).toBe(401);
    expect((await request(app).get('/api/health')).body).toMatchObject({ proxied: false });
    const health = await request(app).get('/api/health').set(PROXY_HEADER, SECRET);
    expect(health.body).toMatchObject({ proxied: true });
    expect(typeof health.body.ip).toBe('string');
  });

  it('change nothing when the check is off', async () => {
    config.PROXY = { mode: 'off' };
    expect((await request(app).get('/api/goals')).status).toBe(401);
    expect((await request(app).get('/api/health')).body).not.toHaveProperty('proxied');
  });

  it('config needs a long secret for report or enforce, and defaults to enforce when one is set', () => {
    const base = { NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/devtrack_test', JWT_SECRET: randomBytes(48).toString('base64url'), CLIENT_ORIGIN: 'http://localhost:5173' };
    expect(buildConfig(base).PROXY).toEqual({ mode: 'off' });
    expect(buildConfig({ ...base, PROXY_SECRET: SECRET }).PROXY).toEqual({ mode: 'enforce', secret: SECRET });
    expect(buildConfig({ ...base, PROXY_SECRET: SECRET, PROXY_CHECK: 'report' }).PROXY.mode).toBe('report');
    expect(() => buildConfig({ ...base, PROXY_SECRET: 'short' })).toThrow(/32 characters/);
    expect(() => buildConfig({ ...base, PROXY_CHECK: 'report' })).toThrow(/32 characters/);
    expect(() => buildConfig({ ...base, PROXY_SECRET: SECRET, PROXY_CHECK: 'maybe' })).toThrow(/off, report or enforce/);
  });
});
