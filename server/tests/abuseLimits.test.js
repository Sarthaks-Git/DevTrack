import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { RECORD_LIMITS } from '../src/utils/recordLimits.js';
import { limitWrites } from '../src/middlewares/rateLimit.middleware.js';
import { createSession } from './helpers.js';

const DEFAULT_LIMITS = { ...RECORD_LIMITS };
const goal = title => ({ title, description: 'Cap test', priority: 'high', status: 'in_progress', deadline: '2026-12-31' });
const project = title => ({ title, description: 'Cap test', status: 'in_progress', priority: 'high' });
// Limits are scaled ×100 under NODE_ENV=test, so policies are checked through the RateLimit headers.
const WRITE_POLICY = '"30000-in-15min"';
const REGISTER_POLICY = '"2000-in-1hr"';

afterEach(() => Object.assign(RECORD_LIMITS, DEFAULT_LIMITS));

describe('Per-user record limits', () => {
  it('stops creating goals at the cap and frees a slot after a delete', async () => {
    RECORD_LIMITS.goals = 2;
    const s = await createSession('caps');
    const first = await s.post('/api/goals').send(goal('One'));
    expect((await s.post('/api/goals').send(goal('Two'))).status).toBe(201);

    const blocked = await s.post('/api/goals').send(goal('Three'));
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('RECORD_LIMIT');

    expect((await s.del(`/api/goals/${first.body.goal._id}`)).status).toBe(200);
    expect((await s.post('/api/goals').send(goal('Three'))).status).toBe(201);
  });

  it('counts per user, so one account at the cap does not block another', async () => {
    RECORD_LIMITS.projects = 1;
    const a = await createSession('capsA');
    const b = await createSession('capsB');
    expect((await a.post('/api/projects').send(project('Alpha one'))).status).toBe(201);
    expect((await a.post('/api/projects').send(project('Alpha two'))).body.code).toBe('RECORD_LIMIT');
    expect((await b.post('/api/projects').send(project('Beta one'))).status).toBe(201);
  });

  it('caps journal entries', async () => {
    RECORD_LIMITS.journalEntries = 1;
    const s = await createSession('capsJ');
    expect((await s.post('/api/journal').send({ title: 'Day 1' })).status).toBe(201);
    expect((await s.post('/api/journal').send({ title: 'Day 2' })).body.code).toBe('RECORD_LIMIT');
  });
});

describe('Write and registration rate limits', () => {
  it('applies the per-user write limit to mutations but not reads', async () => {
    const s = await createSession('writes');
    const read = await s.get('/api/goals');
    expect(read.headers['ratelimit-policy']).not.toContain(WRITE_POLICY);

    for (const response of [
      await s.post('/api/goals').send(goal('Limited')),
      await s.post('/api/projects').send(project('Limited')),
      await s.post('/api/journal').send({ title: 'Limited' }),
      await s.del('/api/auth/sessions/507f1f77bcf86cd799439011'),
      await s.del('/api/coding-profiles/leetcode'),
    ]) {
      expect(response.headers['ratelimit-policy']).toContain(WRITE_POLICY);
    }
  });

  it('lets read requests through the write limiter untouched', () => {
    let passed = false;
    limitWrites({ method: 'GET' }, {}, () => { passed = true; });
    expect(passed).toBe(true);
  });

  it('counts every registration attempt per IP, not only failures', async () => {
    const response = await request(app).post('/api/auth/register').send({});
    expect(response.headers['ratelimit-policy']).toContain(REGISTER_POLICY);
  });
});
