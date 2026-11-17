import crypto from 'crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import LoginChallenge from '../models/LoginChallenge.js';
import TwoFactor from '../models/TwoFactor.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { decryptSecret, encryptSecret, sha256 } from '../utils/tokenCrypto.js';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '../utils/totp.js';
import { createLoginSession } from './auth.service.js';
import { isTwoFactorEnabled } from './loginChallenge.service.js';
import { confirmAccountOwner } from './socialAuth.service.js';

export const TWO_FACTOR_RULES = {
  setupTtlMs: 10 * 60 * 1000,
  maxAttempts: 5,
  recoveryCodes: 10,
};

// Backup codes: 10 characters without look-alikes (no 0/o, 1/l/i), shown as xxxxx-xxxxx.
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const pendingContext = owner => `totp:pending:${owner}`;
const secretContext = owner => `totp:secret:${owner}`;
const recoveryHash = code => sha256(`devtrack-recovery:${code}`);
const normalizeRecovery = value => String(value || '').toLowerCase().replace(/[\s-]/g, '');

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

function newRecoveryCodes() {
  const codes = Array.from({ length: TWO_FACTOR_RULES.recoveryCodes }, () => {
    const raw = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)]).join('');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, stored: codes.map(code => ({ hash: recoveryHash(normalizeRecovery(code)), usedAt: null })) };
}

const invalidCode = () => new AppError('That code is not valid. Check your authenticator app and try again.', 400, 'INVALID_2FA_CODE');

export async function getTwoFactorStatusLogic(userId) {
  assertUserId(userId);
  const record = await TwoFactor.findOne({ owner: userId }).select('+recoveryCodes').lean();
  const enabled = Boolean(record?.enabledAt);
  return {
    enabled,
    enabledAt: record?.enabledAt || null,
    recoveryCodesLeft: enabled ? record.recoveryCodes.filter(code => !code.usedAt).length : 0,
  };
}

/**
 * Accepts a current authenticator code (never the same 30-second step twice) or an unused backup
 * code. Both checks are atomic, so two requests racing with one code cannot both succeed.
 */
async function consumeSecondFactor(owner, { code, recoveryCode }) {
  if (typeof code === 'string' && code) {
    const record = await TwoFactor.findOne({ owner, enabledAt: { $ne: null } }).select('+secret').lean();
    if (!record) throw invalidCode();
    const step = verifyTotp(decryptSecret(record.secret, secretContext(owner)), code, { lastUsedStep: record.lastUsedStep });
    if (step === null) throw invalidCode();
    const claimed = await TwoFactor.updateOne(
      { _id: record._id, $or: [{ lastUsedStep: null }, { lastUsedStep: { $lt: step } }] },
      { $set: { lastUsedStep: step } }
    );
    if (!claimed.modifiedCount) throw invalidCode();
    return 'totp';
  }
  const normalized = normalizeRecovery(recoveryCode);
  if (!/^[a-z0-9]{10}$/.test(normalized)) throw invalidCode();
  const used = await TwoFactor.updateOne(
    { owner, enabledAt: { $ne: null }, recoveryCodes: { $elemMatch: { hash: recoveryHash(normalized), usedAt: null } } },
    { $set: { 'recoveryCodes.$.usedAt': new Date() } }
  );
  if (!used.modifiedCount) throw invalidCode();
  return 'recovery';
}

// Step 1 of turning 2FA on: a fresh secret, shown as a QR code and as text for manual entry.
export async function startTwoFactorSetupLogic(userId, sessionId, currentPassword) {
  const user = await confirmAccountOwner(userId, sessionId, currentPassword);
  if (await isTwoFactorEnabled(user._id)) throw new AppError('Two-factor authentication is already on', 409, 'TWO_FACTOR_ENABLED');
  const secret = generateTotpSecret();
  await TwoFactor.findOneAndUpdate(
    { owner: user._id },
    { $set: { pendingSecret: encryptSecret(secret, pendingContext(user._id)), pendingExpiresAt: new Date(Date.now() + TWO_FACTOR_RULES.setupTtlMs) } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  const url = otpauthUrl({ secret, account: user.email });
  const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 220 });
  return { secret, otpauthUrl: url, qrDataUrl, expiresInSeconds: TWO_FACTOR_RULES.setupTtlMs / 1000 };
}

// Step 2: the user proves the app is set up by typing its current code. Returns the backup codes once.
export async function enableTwoFactorLogic(userId, code) {
  assertUserId(userId);
  const record = await TwoFactor.findOne({ owner: userId }).select('+pendingSecret').lean();
  if (record?.enabledAt) throw new AppError('Two-factor authentication is already on', 409, 'TWO_FACTOR_ENABLED');
  if (!record?.pendingSecret || !record.pendingExpiresAt || record.pendingExpiresAt <= new Date()) {
    throw new AppError('Setup expired. Start again to get a new QR code.', 409, 'TWO_FACTOR_SETUP_EXPIRED');
  }
  const secret = decryptSecret(record.pendingSecret, pendingContext(userId));
  const step = verifyTotp(secret, code);
  if (step === null) throw invalidCode();
  const { codes, stored } = newRecoveryCodes();
  const now = new Date();
  const updated = await TwoFactor.updateOne(
    { _id: record._id, enabledAt: null },
    {
      $set: {
        secret: encryptSecret(secret, secretContext(userId)),
        enabledAt: now,
        lastUsedStep: step,
        recoveryCodes: stored,
        recoveryGeneratedAt: now,
        pendingSecret: null,
        pendingExpiresAt: null,
      },
    }
  );
  if (!updated.modifiedCount) throw new AppError('Two-factor authentication is already on', 409, 'TWO_FACTOR_ENABLED');
  return { enabled: true, recoveryCodes: codes };
}

// Needs the account confirmation (password, or a recent sign-in) and a second-factor code.
export async function disableTwoFactorLogic(userId, sessionId, { currentPassword, code, recoveryCode }) {
  const user = await confirmAccountOwner(userId, sessionId, currentPassword);
  if (!(await isTwoFactorEnabled(user._id))) throw new AppError('Two-factor authentication is not on', 409, 'TWO_FACTOR_DISABLED');
  await consumeSecondFactor(user._id, { code, recoveryCode });
  await TwoFactor.deleteOne({ owner: user._id });
  return { enabled: false };
}

export async function regenerateRecoveryCodesLogic(userId, code) {
  assertUserId(userId);
  if (!(await isTwoFactorEnabled(userId))) throw new AppError('Two-factor authentication is not on', 409, 'TWO_FACTOR_DISABLED');
  await consumeSecondFactor(userId, { code });
  const { codes, stored } = newRecoveryCodes();
  await TwoFactor.updateOne({ owner: userId }, { $set: { recoveryCodes: stored, recoveryGeneratedAt: new Date() } });
  return { recoveryCodes: codes };
}

/**
 * Finishes a sign-in with the authenticator code or a backup code. Each challenge allows a few
 * attempts; the last failure, or success, deletes it.
 */
export async function completeLoginChallengeLogic({ token, code, recoveryCode }) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
    throw new AppError('Your sign-in expired. Please sign in again.', 401, 'TWO_FACTOR_CHALLENGE_EXPIRED');
  }
  const tokenHash = sha256(token);
  const challenge = await LoginChallenge.findOneAndUpdate(
    { tokenHash, expiresAt: { $gt: new Date() }, attempts: { $lt: TWO_FACTOR_RULES.maxAttempts } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  ).lean();
  if (!challenge) throw new AppError('Your sign-in expired. Please sign in again.', 401, 'TWO_FACTOR_CHALLENGE_EXPIRED');

  try {
    await consumeSecondFactor(challenge.owner, { code, recoveryCode });
  } catch (error) {
    if (challenge.attempts >= TWO_FACTOR_RULES.maxAttempts) await LoginChallenge.deleteOne({ _id: challenge._id });
    throw error;
  }

  // Single use even if two correct requests race: only the one that deletes it signs in.
  const removed = await LoginChallenge.deleteOne({ _id: challenge._id });
  if (!removed.deletedCount) throw new AppError('Your sign-in expired. Please sign in again.', 401, 'TWO_FACTOR_CHALLENGE_EXPIRED');
  const user = await User.findById(challenge.owner);
  if (!user || user.accountStatus !== 'active') throw new AppError('Your sign-in expired. Please sign in again.', 401, 'TWO_FACTOR_CHALLENGE_EXPIRED');
  const session = await createLoginSession(user, { userAgent: challenge.userAgent, method: challenge.method });
  return { session, returnTo: challenge.returnTo };
}
