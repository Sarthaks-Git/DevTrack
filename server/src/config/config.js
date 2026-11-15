
import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

const mongoUri =
  process.env.MONGODB_URI ||
  (nodeEnv === 'test'
    ? process.env.MONGODB_TEST_URI ||
      'mongodb://127.0.0.1:27017/devtrack_test'
    : undefined);

const jwtSecret =
  process.env.JWT_SECRET ||
  (nodeEnv === 'test'
    ? 'test-only-secret-that-is-at-least-32-characters-long'
    : undefined);

const clientOrigin =
  process.env.CLIENT_ORIGIN ||
  (nodeEnv === 'production' ? undefined : 'http://localhost:5173');

const sameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();

const secure =
  process.env.COOKIE_SECURE === 'true' || nodeEnv === 'production';

const positiveInt = (value, fallback, max) => {
  const n = Number(value || fallback);

  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error('Invalid numeric environment configuration');
  }

  return n;
};

if (!mongoUri) throw new Error('MONGODB_URI is required');

const rateLimitStore = (process.env.RATE_LIMIT_STORE || 'memory').toLowerCase();

if (!['memory', 'mongo'].includes(rateLimitStore)) {
  throw new Error('RATE_LIMIT_STORE must be memory or mongo');
}

if (!clientOrigin) {
  throw new Error('CLIENT_ORIGIN is required in production');
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}

if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV is invalid');
}

if (
  !['lax', 'strict', 'none'].includes(sameSite) ||
  (sameSite === 'none' && !secure) ||
  (nodeEnv === 'production' && !secure)
) {
  throw new Error('Cookie security configuration is invalid');
}

try {
  new URL(clientOrigin);
} catch {
  throw new Error('CLIENT_ORIGIN must be a valid absolute URL');
}

const config = {
  MONGO_URI: mongoUri,
  JWT_SECRET: jwtSecret,
  NODE_ENV: nodeEnv,
  CLIENT_ORIGIN: clientOrigin,
  COOKIE_SECURE: secure,
  COOKIE_SAME_SITE: sameSite,

  ACCESS_TOKEN_TTL_MINUTES: positiveInt(
    process.env.ACCESS_TOKEN_TTL_MINUTES,
    15,
    30
  ),

  REFRESH_TOKEN_TTL_DAYS: positiveInt(
    process.env.REFRESH_TOKEN_TTL_DAYS,
    60,
    90
  ),

  PORT: positiveInt(process.env.PORT, 5000, 65535),

  // Number of reverse-proxy hops to trust for client IPs (0 = clients connect directly).
  TRUST_PROXY: process.env.TRUST_PROXY ? positiveInt(process.env.TRUST_PROXY, 1, 10) : 0,

  // memory: per-process counters (single instance). mongo: shared across instances.
  RATE_LIMIT_STORE: rateLimitStore,
};

export default config;
