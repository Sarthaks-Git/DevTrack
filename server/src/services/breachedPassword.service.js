import crypto from 'crypto';
import config from '../config/config.js';
import AppError from '../utils/AppError.js';

// Have I Been Pwned "range" API (k-anonymity): only the first 5 hex characters of the password's
// SHA-1 leave the server; the comparison against the returned suffixes happens here.
// Padding hides the real result size from anyone watching the traffic.
const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 3000;

/** True when `suffix` (35 upper-case hex chars) appears with a non-zero count in a range body. */
export function rangeContains(body, suffix) {
  if (typeof body !== 'string') return false;
  for (const line of body.split('\n')) {
    const [candidate, count] = line.trim().split(':');
    if (candidate === suffix && Number(count) > 0) return true;
  }
  return false;
}

/**
 * Resolves true (breached), false (not found) or null (check skipped or unavailable).
 * Never throws and never fails closed: an outage must not stop people from setting a password.
 */
export async function isPasswordBreached(password, { enabled = config.PASSWORD_BREACH_CHECK, fetchImpl = globalThis.fetch } = {}) {
  if (!enabled || typeof password !== 'string' || !password) return null;
  const digest = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  try {
    const response = await fetchImpl(`${RANGE_URL}${digest.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'DevTrack-password-check' },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return rangeContains(await response.text(), digest.slice(5));
  } catch {
    return null;
  }
}

/** Throws a field error for `field` when the password is in a known breach. */
export async function assertPasswordNotBreached(password, field = 'password') {
  if (await isPasswordBreached(password) !== true) return;
  const error = new AppError('This password has appeared in a data breach. Choose a different one.', 400, 'PASSWORD_BREACHED');
  error.errors = { [field]: 'This password has appeared in a data breach. Choose a different one.' };
  throw error;
}
