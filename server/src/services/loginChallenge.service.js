import LoginChallenge from '../models/LoginChallenge.js';
import TwoFactor from '../models/TwoFactor.js';
import { randomToken, sha256 } from '../utils/tokenCrypto.js';

// Shared by password sign-in, social sign-in and the 2FA service (kept separate to avoid import cycles).
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function isTwoFactorEnabled(userId) {
  return Boolean(await TwoFactor.exists({ owner: userId, enabledAt: { $ne: null } }));
}

// After the first factor: a short-lived, single-use challenge instead of a session.
export async function createLoginChallenge(user, { method = 'password', userAgent = null, returnTo = 'app' } = {}) {
  const token = randomToken(32);
  await LoginChallenge.create({
    owner: user._id,
    tokenHash: sha256(token),
    method,
    returnTo,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 400) : null,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
  return token;
}
