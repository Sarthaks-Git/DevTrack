import { createHash } from 'node:crypto';
import RateLimitHit from '../models/RateLimitHit.js';

// express-rate-limit store backed by MongoDB, so limits hold across multiple server instances.
// Each limiter gets its own prefix so their counters never collide.
export class MongoRateLimitStore {
  constructor(prefix) {
    this.prefix = `${prefix}:`;
    this.localKeys = false;
    this.windowMs = 60_000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  // Keys contain IPs and emails; store only a hash so the collection holds no personal data.
  key(key) {
    return `${this.prefix}${createHash('sha256').update(String(key)).digest('hex')}`;
  }

  // One atomic round trip: start a fresh window if none is active, otherwise count the hit.
  async increment(key) {
    const now = new Date();
    const freshReset = new Date(now.getTime() + this.windowMs);
    const doc = await RateLimitHit.collection.findOneAndUpdate(
      { _id: this.key(key) },
      [
        { $set: { expired: { $or: [{ $not: ['$resetAt'] }, { $lte: ['$resetAt', now] }] } } },
        {
          $set: {
            hits: { $cond: ['$expired', 1, { $add: ['$hits', 1] }] },
            resetAt: { $cond: ['$expired', freshReset, '$resetAt'] },
          },
        },
        { $unset: 'expired' },
      ],
      { upsert: true, returnDocument: 'after' }
    );
    return { totalHits: doc.hits, resetTime: doc.resetAt };
  }

  async decrement(key) {
    await RateLimitHit.collection.updateOne(
      { _id: this.key(key), hits: { $gt: 0 }, resetAt: { $gt: new Date() } },
      { $inc: { hits: -1 } }
    );
  }

  async resetKey(key) {
    await RateLimitHit.collection.deleteOne({ _id: this.key(key) });
  }

  async get(key) {
    const doc = await RateLimitHit.collection.findOne({ _id: this.key(key), resetAt: { $gt: new Date() } });
    return doc ? { totalHits: doc.hits, resetTime: doc.resetAt } : undefined;
  }
}
