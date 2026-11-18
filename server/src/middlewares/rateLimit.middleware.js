import crypto from 'crypto';
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

// Same idea for unauthenticated recovery routes, without keeping the address in the limit store.
const byEmailHash = req => `emailHash:${crypto.createHash('sha256').update(typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : 'none').digest('hex')}`;

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
// Bell polling is about 1 request per 2 minutes per tab; this leaves room for several tabs.
export const notificationRateLimit = createRateLimit({ name: 'notifications', limit: 300, keyGenerator: byUser });
export const codingSyncRateLimit = createRateLimit({ name: 'codingSync', limit: 60, keyGenerator: byUser });
// Account creation counts every attempt, successful or not, so one IP cannot mass-register.
export const registerRateLimit = createRateLimit({ name: 'register', limit: 20, windowMs: 60 * 60 * 1000 });
// Per-user cap on create/update/delete so one account cannot hammer the database from many IPs.
export const writeRateLimit = createRateLimit({ name: 'writes', limit: 300, keyGenerator: byUser });

// The weekly review runs about a dozen queries; cap it per user well above normal use.
export const reviewRateLimit = createRateLimit({ name: 'review', limit: 120, keyGenerator: byUser });

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Mount after authMiddleware: applies writeRateLimit to mutations only.
export function limitWrites(req, res, next) {
  if (READ_METHODS.has(req.method)) return next();
  return writeRateLimit(req, res, next);
}

// GitHub: starting a connection, the OAuth callback (unauthenticated, so per IP), repo listing
// (several GitHub calls each) and sync (auto on app open plus "Sync now").
export const githubConnectRateLimit = createRateLimit({ name: 'githubConnect', limit: 20, keyGenerator: byUser });
export const githubCallbackRateLimit = createRateLimit({ name: 'githubCallback', limit: 30 });
// Social sign-in: starting and finishing the redirect, per IP (the user may not be signed in yet).
export const socialStartRateLimit = createRateLimit({ name: 'socialStart', limit: 30 });
export const socialCallbackRateLimit = createRateLimit({ name: 'socialCallback', limit: 30 });
// Authenticator codes at sign-in, per IP; each challenge also allows only 5 attempts.
// Verification emails per account (the service also allows one a minute and five an hour).
export const emailSendRateLimit = createRateLimit({ name: 'emailSend', limit: 10, keyGenerator: byUser });
export const twoFactorVerifyRateLimit = createRateLimit({ name: 'twoFactorVerify', limit: 20, skipSuccessfulRequests: true });
export const githubReadRateLimit = createRateLimit({ name: 'githubRead', limit: 60, keyGenerator: byUser });
export const githubSyncRateLimit = createRateLimit({ name: 'githubSync', limit: 60, keyGenerator: byUser });

// AI settings and security checks: reads are cheap; turning AI on starts a background scan.
export const aiSettingsRateLimit = createRateLimit({ name: 'aiSettings', limit: 30, keyGenerator: byUser });
export const securityReviewRateLimit = createRateLimit({ name: 'securityReviews', limit: 300, keyGenerator: byUser });
export const codeFindingRateLimit = createRateLimit({ name: 'codeFindings', limit: 300, keyGenerator: byUser });

// Forgot password always answers 200, so these count every request. Per IP, and per target email
// across IPs (the service also sends at most one code a minute and five an hour per account).
export const passwordForgotRateLimit = createRateLimit({ name: 'passwordForgot', limit: 10 });
export const passwordForgotEmailRateLimit = createRateLimit({ name: 'passwordForgotEmail', limit: 5, windowMs: 60 * 60 * 1000, keyGenerator: byEmailHash });
// Code guesses: per IP and per email (each code also allows only 5 attempts).
export const passwordResetRateLimit = createRateLimit({ name: 'passwordReset', limit: 20, skipSuccessfulRequests: true });
// Undo links are 256-bit random tokens; this only stops token guessing and noise.
export const emailChangeUndoRateLimit = createRateLimit({ name: 'emailChangeUndo', limit: 10, skipSuccessfulRequests: true });
export const passwordResetEmailRateLimit = createRateLimit({ name: 'passwordResetEmail', limit: 10, skipSuccessfulRequests: true, keyGenerator: byEmailHash });
