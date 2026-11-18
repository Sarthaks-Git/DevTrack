import bcrypt from 'bcrypt';
import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../config/config.js';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import AuthIdentity from '../models/AuthIdentity.js';
import EmailChange from '../models/EmailChange.js';
import EmailChangeUndo, { UNDO_TTL_MS } from '../models/EmailChangeUndo.js';
import LoginChallenge from '../models/LoginChallenge.js';
import EmailVerification from '../models/EmailVerification.js';
import PasswordReset from '../models/PasswordReset.js';
import AppError from '../utils/AppError.js';
import { randomToken, sha256 } from '../utils/tokenCrypto.js';
import { sendEmail } from './email.transport.js';
import { attemptsLeft, codeEmail, codeMatches, consumeAttempt, hashCode, maskEmail, sendWindow, storeCode, throttleError } from './emailCode.service.js';
import { deliveryError } from './emailVerification.service.js';

const PURPOSE = 'change';

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

const emailTaken = () => new AppError('That username or email is already in use', 409, 'ACCOUNT_EXISTS');

async function sendChangeCode(user, newEmail, existing) {
  if (!config.EMAIL.enabled) throw new AppError('Email is not set up on this server yet', 503, 'EMAIL_NOT_CONFIGURED');
  const window = sendWindow(existing, newEmail);
  if (window.blocked) throw throttleError(window);
  const code = await storeCode(EmailChange, { owner: user._id, email: newEmail, purpose: PURPOSE, window, extra: { fromEmail: user.email } });
  try {
    await sendEmail({
      to: newEmail,
      ...codeEmail(code, { title: 'email change', reason: 'Enter it in DevTrack Settings to move your account to this address. If you did not ask for this, ignore this email; nothing changes.' }),
    });
  } catch (error) {
    throw deliveryError(error, 'confirmation');
  }
  return { pendingEmail: newEmail, emailSent: true };
}

/**
 * Called by the profile update after the owner was confirmed (password or recent sign-in). The
 * account keeps its current email until the code sent to the new one is entered.
 */
export async function startEmailChangeLogic(user, newEmail) {
  const existing = await EmailChange.findOne({ owner: user._id }).lean();
  return sendChangeCode(user, newEmail, existing);
}

export async function getEmailChangeLogic(userId) {
  assertUserId(userId);
  const record = await EmailChange.findOne({ owner: userId }).select('email expiresAt attempts').lean();
  if (!record) return { pendingEmail: null };
  return { pendingEmail: record.email, expiresAt: record.expiresAt, codeUsable: record.expiresAt > new Date() && attemptsLeft(record) > 0 };
}

export async function resendEmailChangeLogic(userId) {
  assertUserId(userId);
  const [user, existing] = await Promise.all([
    User.findById(userId).select('email accountStatus').lean(),
    EmailChange.findOne({ owner: userId }).lean(),
  ]);
  if (!user || user.accountStatus !== 'active') throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
  if (!existing) throw new AppError('There is no email change waiting', 404, 'EMAIL_CHANGE_NOT_FOUND');
  return sendChangeCode(user, existing.email, existing);
}

export async function cancelEmailChangeLogic(userId) {
  assertUserId(userId);
  await EmailChange.deleteOne({ owner: userId });
}

const UNDO_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const undoLinkInvalid = () => new AppError('This link has expired or was already used.', 400, 'UNDO_LINK_INVALID');

/**
 * Creates the undo link for a change away from `oldEmail`. Returns the token, or null when a link
 * from an earlier change is still valid: that link keeps restoring the original address.
 */
async function issueUndoToken(owner, oldEmail) {
  const now = new Date();
  await EmailChangeUndo.deleteMany({ owner, expiresAt: { $lte: now } });
  if (await EmailChangeUndo.exists({ owner })) return null;
  const token = randomToken(32);
  try {
    await EmailChangeUndo.create({ owner, restoreEmail: oldEmail, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + UNDO_TTL_MS) });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
  return token;
}

function sendEmailChangedAlert(oldEmail, newEmail, undoToken) {
  const intro = `The email on your DevTrack account was changed to ${maskEmail(newEmail)}, and your other devices were signed out.`;
  const undoUrl = undoToken ? `${config.CLIENT_ORIGIN}/undo-email-change#token=${undoToken}` : null;
  const notYou = undoUrl
    ? 'If it was not you, undo it with the link below. It puts this address back, signs out every device and asks for a new password. The link works for 7 days.'
    : 'If it was not you, use the undo link in the earlier email about the first change, or reply to this email for help.';
  const parts = [intro, 'If this was you, there is nothing else to do.', notYou];
  const text = [...parts, ...(undoUrl ? [undoUrl] : [])].join('\n\n');
  const html = parts.map(part => `<p>${part}</p>`).join('')
    + (undoUrl ? `<p><a href="${undoUrl}">Undo this email change</a></p>` : '');
  sendEmail({
    to: oldEmail,
    subject: 'Your DevTrack email was changed',
    text,
    html,
  }).catch(error => {
    if (process.env.NODE_ENV !== 'test') process.stderr.write(`Email change alert failed: ${error?.kind || 'unavailable'}\n`);
  });
}

/**
 * Moves the account to the new address with the code sent there. Five tries per code, single use.
 * The address is checked again for another account at this moment, and the switch only applies
 * while the account still has the email it had when the change started.
 */
export async function confirmEmailChangeLogic(userId, sessionId, code) {
  assertUserId(userId);
  const user = await User.findById(userId).select('email accountStatus').lean();
  if (!user || user.accountStatus !== 'active') throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');

  const record = await consumeAttempt(EmailChange, { owner: user._id });
  if (!record) throw new AppError('This code has expired. Ask for a new one.', 400, 'EMAIL_CODE_EXPIRED');
  if (!codeMatches(record, hashCode(PURPOSE, user._id, record.email, code))) {
    const left = attemptsLeft(record);
    throw new AppError(left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Ask for a new one.', 400, 'EMAIL_CODE_INVALID');
  }

  if (record.fromEmail !== user.email) {
    await EmailChange.deleteOne({ _id: record._id });
    throw new AppError('Your email changed in the meantime. Start the change again.', 409, 'EMAIL_CHANGE_STALE');
  }
  if (await User.exists({ email: record.email, _id: { $ne: user._id } })) {
    await EmailChange.deleteOne({ _id: record._id });
    throw emailTaken();
  }

  // Claim the code before switching, so two racing requests cannot both use it.
  const claimed = await EmailChange.deleteOne({ _id: record._id, codeHash: record.codeHash });
  if (!claimed.deletedCount) throw new AppError('This code has expired. Ask for a new one.', 400, 'EMAIL_CODE_EXPIRED');

  const now = new Date();
  let updated;
  try {
    updated = await User.updateOne({ _id: user._id, email: user.email }, { $set: { email: record.email, emailVerifiedAt: now } });
  } catch (error) {
    if (error?.code === 11000) throw emailTaken();
    throw error;
  }
  if (!updated.matchedCount) throw new AppError('Your email changed in the meantime. Start the change again.', 409, 'EMAIL_CHANGE_STALE');

  await Promise.all([
    // Account recovery moved: sign out every other device.
    AuthSession.updateMany({ owner: user._id, revokedAt: null, _id: { $ne: sessionId } }, { $set: { revokedAt: now, revokeReason: 'email_change' } }),
    // Codes sent to the old address must not keep working.
    PasswordReset.deleteMany({ owner: user._id }),
    EmailVerification.deleteMany({ owner: user._id }),
  ]);
  sendEmailChangedAlert(user.email, record.email, await issueUndoToken(user._id, user.email));
  return { email: record.email };
}

/**
 * "This wasn't me": public, authorized only by the token mailed to the old address. Puts the old
 * address back, signs out every device, replaces the password with an unusable one (the owner sets
 * a new one with Forgot password, whose code now goes to the restored address), and removes social
 * sign-ins whose email is not the restored address. Single use.
 */
export async function undoEmailChangeLogic(token) {
  if (typeof token !== 'string' || !UNDO_TOKEN_PATTERN.test(token)) throw undoLinkInvalid();
  const now = new Date();
  const record = await EmailChangeUndo.findOne({ tokenHash: sha256(token), expiresAt: { $gt: now } }).lean();
  if (!record) throw undoLinkInvalid();

  const user = await User.findById(record.owner).select('email').lean();
  if (!user) throw undoLinkInvalid();

  const taken = () => new AppError('That address now belongs to another account. Reply to the alert email for help.', 409, 'UNDO_EMAIL_TAKEN');
  if (await User.exists({ email: record.restoreEmail, _id: { $ne: user._id } })) throw taken();

  // Claim the link before changing anything, so two racing requests cannot both use it.
  const claimed = await EmailChangeUndo.deleteOne({ _id: record._id, tokenHash: record.tokenHash });
  if (!claimed.deletedCount) throw undoLinkInvalid();

  const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12);
  try {
    await User.updateOne(
      { _id: user._id },
      { $set: { email: record.restoreEmail, emailVerifiedAt: now, passwordHash: unusableHash, passwordChangedAt: now } }
    );
  } catch (error) {
    if (error?.code === 11000) throw taken();
    throw error;
  }

  await Promise.all([
    AuthSession.updateMany({ owner: user._id, revokedAt: null }, { $set: { revokedAt: now, revokeReason: 'email_change_undone' } }),
    LoginChallenge.deleteMany({ owner: user._id }),
    EmailChange.deleteMany({ owner: user._id }),
    PasswordReset.deleteMany({ owner: user._id }),
    EmailVerification.deleteMany({ owner: user._id }),
    AuthIdentity.deleteMany({ owner: user._id, email: { $ne: record.restoreEmail } }),
  ]);
  return { email: maskEmail(record.restoreEmail) };
}
