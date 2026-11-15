import { rateLimit } from 'express-rate-limit';
import config from '../config/config.js';
import { MongoRateLimitStore } from '../utils/mongoRateLimitStore.js';

const handler = (req, res) => res.status(429).json({ message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' });

// The whole test suite shares one IP; scale limits so suites do not throttle each other.
const SCALE = config.NODE_ENV === 'test' ? 100 : 1;
const WINDOW_MS = 15 * 60 * 1000;

// With the shared store, a database outage fails open: every route needs the database anyway,
// so blocking all traffic would add nothing.
const storeOptions = name => (config.RATE_LIMIT_STORE === 'mongo'
  ? { store: new MongoRateLimitStore(name), passOnStoreError: true }
  : {});

export function createRateLimit({ name, limit, windowMs = WINDOW_MS, ...options }) {
  return rateLimit({ standardHeaders: 'draft-8', legacyHeaders: false, handler, windowMs, limit: limit * SCALE, ...storeOptions(name), ...options });
}

// Keyed by authenticated user, so one account cannot spread attempts across IPs.
const byUser = req => `user:${req.auth?.userId || 'anonymous'}`;
// Keyed by target email, so credential stuffing against one account is throttled across IPs.
const byEmail = req => `email:${typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : 'none'}`;

// Flood guard only. Generous because users on campus or office networks share one public IP;
// account-level abuse is handled by the per-email and per-user limits below.
export const apiRateLimit = createRateLimit({ name: 'api', limit: 1000 });
export const authRateLimit = createRateLimit({ name: 'auth', limit: 10, skipSuccessfulRequests: true });
export const loginAccountRateLimit = createRateLimit({ name: 'loginAccount', limit: 10, skipSuccessfulRequests: true, keyGenerator: byEmail });
export const sensitiveAuthRateLimit = createRateLimit({ name: 'sensitiveAuth', limit: 30 });
export const passwordCheckRateLimit = createRateLimit({ name: 'passwordCheck', limit: 10, skipSuccessfulRequests: true, keyGenerator: byUser });
export const verificationRateLimit = createRateLimit({ name: 'verification', limit: 20, keyGenerator: byUser });
export const statsRefreshRateLimit = createRateLimit({ name: 'statsRefresh', limit: 30, keyGenerator: byUser });
// Auto-sync is called on page loads but throttled server-side, so most calls are cheap no-ops.
export const codingSyncRateLimit = createRateLimit({ name: 'codingSync', limit: 60, keyGenerator: byUser });
