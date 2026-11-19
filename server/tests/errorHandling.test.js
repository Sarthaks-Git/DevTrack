import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { errorMiddleware, describeUnexpectedError } from '../src/middlewares/error.middleware.js';
import authRouter from '../src/routes/auth.routes.js';
import goalRouter from '../src/routes/goal.routes.js';
import projectRouter from '../src/routes/project.routes.js';
import codingProfileRouter from '../src/routes/codingProfile.routes.js';
import journalRouter from '../src/routes/journal.routes.js';
import activityRouter from '../src/routes/activity.routes.js';
import dashboardRouter from '../src/routes/dashboard.routes.js';
import notificationRouter from '../src/routes/notification.routes.js';
import githubRouter from '../src/routes/github.routes.js';
import { aiRouter, codeFindingRouter, securityReviewRouter } from '../src/routes/ai.routes.js';
import { createSession } from './helpers.js';

// Anything that would reveal internals: stack frames, file paths, database or driver text.
const LEAK = /node_modules|[\\/]src[\\/]|\bat \S+ \(|\bMongo\w*Error|E11000|Cast to|\$__|stack|ECONN|mongodb(\+srv)?:\/\//i;

function throwingApp(error) {
  const local = express();
  local.use(express.json());
  local.post('/boom', () => { throw error; });
  local.use(errorMiddleware);
  return local;
}

describe('Global error handling', () => {
  it('turns unexpected errors into a generic 500 without their message', async () => {
    const secret = new Error('connect failed for mongodb+srv://admin:hunter2@cluster.example.net');
    const response = await request(throwingApp(secret)).post('/boom');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(response.body)).not.toMatch(/hunter2|mongodb/);
  });

  it('hides database duplicate-key details, which include the conflicting value', async () => {
    const duplicate = Object.assign(new Error('E11000 duplicate key error collection: users index: email_1 dup key: { email: "a@example.com" }'), { code: 11000 });
    const response = await request(throwingApp(duplicate)).post('/boom');
    expect(response.status).toBe(409);
    expect(JSON.stringify(response.body)).not.toMatch(/a@example\.com|E11000|email_1/);
  });

  it('keeps the status of client errors from body parsing but replaces their text', async () => {
    const unsupported = await request(throwingApp(new Error('unused')))
      .post('/boom').set('Content-Type', 'application/json; charset=klingon').send('{"a":1}');
    expect(unsupported.status).toBe(415);
    expect(unsupported.body).toEqual({ message: 'Unsupported request body encoding', code: 'BAD_REQUEST' });

    const invalid = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('INVALID_JSON');
  });

  it('describes an unexpected error by type and location only, never by message', () => {
    const error = new TypeError('cannot read token abc123 of user bob@example.com');
    const text = describeUnexpectedError(error, { method: 'POST', baseUrl: '/api/goals', route: { path: '/:id' } });
    expect(text).toMatch(/^TypeError at (src\/\S+:\d+|unknown) \(POST \/api\/goals\/:id\)$/);
    expect(text).not.toMatch(/abc123|bob@example\.com/);
  });
});

describe('Every endpoint answers bad input without leaking internals', () => {
  const ROUTERS = { authRouter, goalRouter, projectRouter, codingProfileRouter, journalRouter, activityRouter, dashboardRouter, notificationRouter, githubRouter, aiRouter, codeFindingRouter, securityReviewRouter };
  // Read the mounts from app.js itself, so a newly mounted router cannot be skipped silently.
  const mounts = [...fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8').matchAll(/app\.use\('(\/api\/[^']+)', (\w+)\)/g)]
    .map(([, prefix, name]) => ({ prefix, name, router: ROUTERS[name] }));

  const routes = mounts.flatMap(({ prefix, router }) => (router?.stack || [])
    .filter(layer => layer.route)
    .flatMap(layer => Object.keys(layer.route.methods).map(method => ({ method, path: `${prefix}${layer.route.path}` }))));

  // Signing out or ending sessions would cut the sweep short; those routes are covered elsewhere.
  const ENDS_SESSION = /\/auth\/(logout|logout-all|sessions)\b/;
  const fill = (path, value) => path.replace(/:\w+/g, value);
  const signedIn = (method, url) => request(app)[method](url).set('Cookie', session.cookie()).set('x-csrf-token', session.csrfToken);
  const hostileBody = { $where: 'sleep(1000)', title: { $ne: null }, email: ['a@b.c'], constructor: { prototype: { polluted: true } }, deep: { a: { b: { c: { d: { e: 'x'.repeat(5000) } } } } } };

  let session;
  beforeAll(async () => {
    session = await createSession('eh_sweep');
  });

  it('finds every mounted router', () => {
    expect(mounts.length).toBeGreaterThanOrEqual(12);
    for (const mount of mounts) expect(mount.router, `${mount.name} is mounted in app.js but not listed in this test`).toBeTruthy();
    expect(routes.length).toBeGreaterThan(50);
  });

  it('never returns a 500 or internal details, signed out or signed in, with bad ids and hostile bodies', async () => {
    const problems = [];
    let signedInAnswers = 0;
    const check = (label, response) => {
      if (label.startsWith('auth') && response.status !== 401) signedInAnswers += 1;
      const text = response.text || '';
      if (response.status >= 500 && response.status !== 502 && response.status !== 503) problems.push(`${label} -> ${response.status}`);
      if (LEAK.test(text)) problems.push(`${label} leaked: ${text.slice(0, 120)}`);
    };

    for (const { method, path } of routes) {
      for (const id of ['not-an-id', new mongoose.Types.ObjectId().toString()]) {
        const url = fill(path, id);
        const label = `${method.toUpperCase()} ${url}`;
        check(`anon ${label}`, await request(app)[method](url).send(hostileBody));
        if (ENDS_SESSION.test(path)) continue;
        check(`auth ${label}`, await signedIn(method, url).send(hostileBody));
        if (['post', 'put', 'patch'].includes(method)) {
          check(`auth raw ${label}`, await signedIn(method, url).set('Content-Type', 'application/json').send('{"broken":'));
        }
      }
    }
    expect(problems).toEqual([]);
    // The signed-in pass must really be signed in (not 401 everywhere), or it proves nothing.
    expect(signedInAnswers).toBeGreaterThan(routes.length);
  }, 180_000);
});
