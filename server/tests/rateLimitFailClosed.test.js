import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimit } from '../src/middlewares/rateLimit.middleware.js';
import { errorMiddleware } from '../src/middlewares/error.middleware.js';

// A store whose database calls fail, as when the limiter collection is unreachable or forbidden.
class BrokenStore {
  init() {}
  async increment() {
    throw new Error('store unavailable');
  }
  async decrement() {}
  async resetKey() {}
}

function appWith(limiter) {
  const app = express();
  app.post('/guess', limiter, (req, res) => res.json({ ok: true }));
  app.use(errorMiddleware);
  return app;
}

describe('rate limiter store failures', () => {
  it('refuses requests on a fail-closed limiter when the store fails', async () => {
    const limiter = createRateLimit({ name: `fc${Date.now()}`, limit: 10, failClosed: true, store: new BrokenStore() });
    const res = await request(appWith(limiter)).post('/guess');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('RATE_LIMIT_UNAVAILABLE');
  });

  it('lets requests through on an ordinary limiter when the store fails', async () => {
    const limiter = createRateLimit({ name: `fo${Date.now()}`, limit: 10, store: new BrokenStore() });
    const res = await request(appWith(limiter)).post('/guess');
    expect(res.status).toBe(200);
  });

  it('still limits normally on a fail-closed limiter when the store works', async () => {
    const limiter = createRateLimit({ name: `fw${Date.now()}`, limit: 1, failClosed: true });
    const app = appWith(limiter);
    let last;
    for (let i = 0; i < 101; i += 1) last = await request(app).post('/guess');
    expect(last.status).toBe(429);
  });
});
