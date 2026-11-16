import crypto from 'crypto';
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

// 32-byte key for encrypting third-party tokens at rest (AES-256-GCM), base64 or base64url.
function parseEncryptionKey(value) {
  if (!value) return null;
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || new Set(key).size < 16) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 random bytes encoded as base64');
  }
  return key;
}

// GitHub App (user-to-server OAuth). Disabled unless every value is present.
function buildGitHubConfig(env, { nodeEnv, clientOrigin }) {
  // Tests always use fake app values and a per-run random key, even when .env holds the real
  // GitHub App, so real credentials never reach a test run and no key literal lives in the repo.
  if (nodeEnv === 'test') {
    return {
      enabled: true,
      clientId: 'Iv-test-client',
      clientSecret: crypto.randomBytes(20).toString('hex'),
      appSlug: 'devtrack-test',
      callbackUrl: `${clientOrigin}/api/integrations/github/callback`,
      encryptionKey: crypto.randomBytes(32),
    };
  }
  const clientId = env.GITHUB_APP_CLIENT_ID || '';
  const clientSecret = env.GITHUB_APP_CLIENT_SECRET || '';
  const appSlug = env.GITHUB_APP_SLUG || '';
  const encryptionKey = parseEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  const enabled = Boolean(clientId && clientSecret && appSlug);

  if (!enabled) return { enabled: false, encryptionKey };
  if (!encryptionKey) throw new Error('TOKEN_ENCRYPTION_KEY is required when the GitHub App is configured');
  if (!/^[a-z0-9-]{1,100}$/i.test(appSlug)) throw new Error('GITHUB_APP_SLUG is invalid');

  const callbackUrl = env.GITHUB_CALLBACK_URL || `${clientOrigin}/api/integrations/github/callback`;
  let callback;
  try {
    callback = new URL(callbackUrl);
  } catch {
    throw new Error('GITHUB_CALLBACK_URL must be a valid absolute URL');
  }

  if (nodeEnv === 'production') {
    if (callback.protocol !== 'https:') throw new Error('GITHUB_CALLBACK_URL must use https in production');
    if (PLACEHOLDER_PATTERN.test(clientSecret)) throw new Error('GITHUB_APP_CLIENT_SECRET is a placeholder');
  }

  return { enabled: true, clientId, clientSecret, appSlug, callbackUrl: callback.toString(), encryptionKey };
}

// USD per million tokens (input, output), from Anthropic's published prices. The budget guard
// needs a price for every model it may call, so an unknown model is a startup error.
export const AI_MODEL_PRICES = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, label: 'Claude Haiku 5.5' },
  'claude-sonnet-5-5': { input: 2, output: 10, label: 'Claude Sonnet 5.5' },
  'claude-opus-5-5': { input: 4, output: 20, label: 'Claude Opus 5.5' },
};
// Owner rule: every AI feature uses the cheapest model unless the owner chooses otherwise.
const DEFAULT_AI_MODEL = 'claude-haiku-5-5';
export const AI_FEATURES = ['securityReview', 'codeReview'];

function buildAiConfig(env, { nodeEnv }) {
  const isTest = nodeEnv === 'test';
  // Tests never see the real key; the network module is mocked there.
  const apiKey = isTest ? 'test-key-never-sent' : env.ANTHROPIC_API_KEY || '';
  const models = {};
  for (const feature of AI_FEATURES) {
    const variable = `AI_MODEL_${feature.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`;
    const model = (!isTest && env[variable]) || DEFAULT_AI_MODEL;
    if (!AI_MODEL_PRICES[model]) throw new Error(`${variable} must be one of ${Object.keys(AI_MODEL_PRICES).join(', ')}`);
    models[feature] = model;
  }
  const budget = Number(isTest ? 4 : env.AI_MONTHLY_BUDGET_USD || 4);
  if (!Number.isFinite(budget) || budget < 0 || budget > 1000) throw new Error('AI_MONTHLY_BUDGET_USD must be between 0 and 1000');
  if (nodeEnv === 'production' && apiKey && PLACEHOLDER_PATTERN.test(apiKey)) throw new Error('ANTHROPIC_API_KEY is a placeholder');
  return {
    enabled: Boolean(apiKey),
    apiKey,
    models,
    monthlyBudgetMicroUsd: Math.round(budget * 1_000_000),
    userMonthlyLimit: isTest ? 100 : positiveInt(env.AI_USER_MONTHLY_LIMIT, 100, 10_000),
  };
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

    GITHUB: buildGitHubConfig(env, { nodeEnv, clientOrigin }),

    AI: buildAiConfig(env, { nodeEnv }),
  };
}

const config = buildConfig(process.env);

export default config;
