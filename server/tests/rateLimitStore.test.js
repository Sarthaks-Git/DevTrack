import { describe, it, expect } from 'vitest';
import { MongoRateLimitStore } from '../src/utils/mongoRateLimitStore.js';
import RateLimitHit from '../src/models/RateLimitHit.js';

describe('MongoRateLimitStore', () => {
  function store(windowMs = 60_000) {
    const instance = new MongoRateLimitStore(`test${Math.random().toString(36).slice(2, 8)}`);
    instance.init({ windowMs });
    return instance;
  }

  it('counts hits atomically within a window', async () => {
    const limiter = store();
    const results = await Promise.all(Array.from({ length: 10 }, () => limiter.increment('203.0.113.7')));
    expect(results.map(result => result.totalHits).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(results.map(result => result.resetTime.getTime())).size).toBe(1);
    expect((await limiter.get('203.0.113.7')).totalHits).toBe(10);
  });

  it('starts a fresh window once the previous one expired', async () => {
    const limiter = store(50);
    await limiter.increment('k');
    await limiter.increment('k');
    await new Promise(resolve => setTimeout(resolve, 80));
    const next = await limiter.increment('k');
    expect(next.totalHits).toBe(1);
  });

  it('supports decrement and reset, and keeps prefixes apart', async () => {
    const a = store();
    const b = store();
    await a.increment('same');
    await a.increment('same');
    await b.increment('same');

    await a.decrement('same');
    expect((await a.get('same')).totalHits).toBe(1);
    expect((await b.get('same')).totalHits).toBe(1);

    await a.resetKey('same');
    expect(await a.get('same')).toBeUndefined();
    expect((await b.get('same')).totalHits).toBe(1);
  });

  it('stores only hashed keys, never raw emails or IPs', async () => {
    const limiter = store();
    await limiter.increment('email:someone@example.com');
    const ids = (await RateLimitHit.find({}).select('_id').lean()).map(doc => doc._id);
    expect(ids.some(id => id.includes('someone@example.com'))).toBe(false);
    expect(ids.some(id => /^test\w+:[0-9a-f]{64}$/.test(id))).toBe(true);
  });
});
