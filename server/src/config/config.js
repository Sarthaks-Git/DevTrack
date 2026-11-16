import dotenv from 'dotenv';
dotenv.config();

const TEST_JWT_SECRET = 'test-only-secret-that-is-at-least-32-characters-long';

// Values copied from .env.example or docs must never reach a real deployment.
const PLACEHOLDER_PATTERN = /replace-with|change-?me|your[-_]|example|placeholder|test-only/i;

const positiveInt = (value, fallback, max) => {
  const n = Number(value || fallback);

  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error('Invalid numeric environment configuration');
  }

  return n;
};

const databaseName = (uri) => {
  try {
    return new URL(uri).pathname.replace(/^\//, '');
  } catch {
    throw new Error('MONGODB_URI must be a valid connection string');
  }
};

// Production-only guards. Error messages name the variable, never its value.
function assertProductionSafe({ mongoUri, jwtSecret, clientOrigin, env }) {
  if (PLACEHOLDER_PATTERN.test(jwtSecret) || jwtSecret === TEST_JWT_SECRET) {
    throw new Error('JWT_SECRET is a placeholder; generate a random secret');
  }

  // A long but repetitive secret (e.g. "aaaa...") is guessable.
  if (jwtSecret.length < 48 || new Set(jwtSecret).size < 16) {
    throw new Error('JWT_SECRET must be at least 48 random characters in production');
  }

  if (/test/i.test(databaseName(mongoUri)) || (env.MONGODB_TEST_URI && env.MONGODB_TEST_URI === mongoUri)) {
    throw new Error('MONGODB_URI must not point at a test database in production');
  }

  if (new URL(clientOrigin).protocol !== 'https:') {
    throw new Error('CLIENT_ORIGIN must use https in production');
  }
}

export function buildConfig(env) {
  const nodeEnv = env.NODE_ENV || 'development';

  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV is invalid');
  }

  const mongoUri =
    env.MONGODB_URI ||
    (nodeEnv === 'test' ? env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/devtrack_test' : undefined);

  // The fixed fallback secret exists only so the test suite runs without a .env file.
  const jwtSecret = env.JWT_SECRET || (nodeEnv === 'test' ? TEST_JWT_SECRET : undefined);

  const clientOrigin = env.CLIENT_ORIGIN || (nodeEnv === 'production' ? undefined : 'http://localhost:5173');

  const sameSite = (env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  const secure = env.COOKIE_SECURE === 'true' || nodeEnv === 'production';

  if (!mongoUri) throw new Error('MONGODB_URI is required');

  const rateLimitStore = (env.RATE_LIMIT_STORE || 'memory').toLowerCase();

  if (!['memory', 'mongo'].includes(rateLimitStore)) {
    throw new Error('RATE_LIMIT_STORE must be memory or mongo');
  }

  if (!clientOrigin) {
    throw new Error('CLIENT_ORIGIN is required in production');
  }

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
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

  if (nodeEnv === 'production') {
    assertProductionSafe({ mongoUri, jwtSecret, clientOrigin, env });
  }

  return {
    MONGO_URI: mongoUri,
    JWT_SECRET: jwtSecret,
    NODE_ENV: nodeEnv,
    CLIENT_ORIGIN: clientOrigin,
    COOKIE_SECURE: secure,
    COOKIE_SAME_SITE: sameSite,

    ACCESS_TOKEN_TTL_MINUTES: positiveInt(env.ACCESS_TOKEN_TTL_MINUTES, 15, 30),

    REFRESH_TOKEN_TTL_DAYS: positiveInt(env.REFRESH_TOKEN_TTL_DAYS, 60, 90),

    PORT: positiveInt(env.PORT, 5000, 65535),

    // Number of reverse-proxy hops to trust for client IPs (0 = clients connect directly).
    TRUST_PROXY: env.TRUST_PROXY ? positiveInt(env.TRUST_PROXY, 1, 10) : 0,

    // memory: per-process counters (single instance). mongo: shared across instances.
    RATE_LIMIT_STORE: rateLimitStore,
  };
}

const config = buildConfig(process.env);

export default config;
