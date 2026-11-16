import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildConfig } from '../src/config/config.js';

// Generated per run so the repository never contains a secret-looking literal (scanners flag those).
const STRONG_SECRET = randomBytes(48).toString('base64url');

const production = (overrides = {}) => ({
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://cluster.example.net/devtrack',
  JWT_SECRET: STRONG_SECRET,
  CLIENT_ORIGIN: 'https://devtrack.app',
  ...overrides,
});

describe('Configuration guards', () => {
  it('accepts a complete production configuration and forces secure cookies', () => {
    const config = buildConfig(production());
    expect(config.NODE_ENV).toBe('production');
    expect(config.COOKIE_SECURE).toBe(true);
  });

  it('refuses placeholder or test secrets in production', () => {
    expect(() => buildConfig(production({ JWT_SECRET: 'replace-with-at-least-32-random-characters-xxxxxxxxxxxxxxxx' }))).toThrow(/placeholder/);
    expect(() => buildConfig(production({ JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters-long' }))).toThrow(/placeholder/);
  });

  it('refuses short or repetitive secrets in production', () => {
    expect(() => buildConfig(production({ JWT_SECRET: STRONG_SECRET.slice(0, 40) }))).toThrow(/48 random/);
    expect(() => buildConfig(production({ JWT_SECRET: 'ab'.repeat(30) }))).toThrow(/48 random/);
  });

  it('refuses a test database or non-https origin in production', () => {
    expect(() => buildConfig(production({ MONGODB_URI: 'mongodb+srv://cluster.example.net/devtrack_test' }))).toThrow(/test database/);
    expect(() => buildConfig(production({ CLIENT_ORIGIN: 'http://devtrack.app' }))).toThrow(/https/);
  });

  it('requires a database, secret and origin in production', () => {
    expect(() => buildConfig(production({ MONGODB_URI: '' }))).toThrow(/MONGODB_URI/);
    expect(() => buildConfig(production({ JWT_SECRET: '' }))).toThrow(/JWT_SECRET/);
    expect(() => buildConfig(production({ CLIENT_ORIGIN: '' }))).toThrow(/CLIENT_ORIGIN/);
  });

  it('never puts secret values in error messages', () => {
    const secret = 'replace-with-a-very-recognisable-secret-value-1234567890';
    try {
      buildConfig(production({ JWT_SECRET: secret }));
      throw new Error('expected a configuration error');
    } catch (error) {
      expect(error.message).not.toContain(secret);
    }
  });

  it('keeps development permissive so the app runs locally', () => {
    const config = buildConfig({ NODE_ENV: 'development', MONGODB_URI: 'mongodb://127.0.0.1:27017/devtrack', JWT_SECRET: 'replace-with-at-least-32-random-characters' });
    expect(config.COOKIE_SECURE).toBe(false);
    expect(config.CLIENT_ORIGIN).toBe('http://localhost:5173');
  });
});
