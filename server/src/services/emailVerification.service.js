import mongoose from 'mongoose';
import config from '../config/config.js';
import EmailVerification from '../models/EmailVerification.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { sendEmail } from './email.transport.js';
import { CODE_RULES, attemptsLeft, codeEmail, codeMatches, consumeAttempt, hashCode, sendWindow, storeCode, throttleError } from './emailCode.service.js';

export const EMAIL_RULES = CODE_RULES;
const PURPOSE = 'email';

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

function logFailure(kind) {
  if (process.env.NODE_ENV !== 'test') process.stderr.write(`Verification email failed: ${kind}\n`);
}

// Maps a transport failure to what the signed-in user is told (never provider details).
export function deliveryError(error, context = 'verification') {
  logFailure(error?.kind || 'unavailable');
  if (error?.kind === 'rejected') return new AppError('That email address cannot receive mail. Check it and change it if needed.', 400, 'EMAIL_UNDELIVERABLE');
  return new AppError(`The ${context} email could not be sent. Try again shortly.`, 502, 'EMAIL_SEND_FAILED');
}

/**
 * Sends a fresh 6-digit code to the account's current email. Throttled: one per minute and five
 * per hour per account. The previous code stops working.
 */
export async function sendVerificationCodeLogic(userId) {
  assertUserId(userId);
  const user = await User.findById(userId).select('email emailVerifiedAt accountStatus').lean();
  if (!user || user.accountStatus !== 'active') throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
  if (user.emailVerifiedAt) return { alreadyVerified: true };
  if (!config.EMAIL.enabled) throw new AppError('Email is not set up on this server yet', 503, 'EMAIL_NOT_CONFIGURED');

  const existing = await EmailVerification.findOne({ owner: userId }).lean();
  const window = sendWindow(existing, user.email);
  if (window.blocked) throw throttleError(window);

  const code = await storeCode(EmailVerification, { owner: user._id, email: user.email, purpose: PURPOSE, window });
  try {
    await sendEmail({ to: user.email, ...codeEmail(code, { title: 'verification', reason: 'If you did not create a DevTrack account, ignore this email; no account will be activated.' }) });
  } catch (error) {
    throw deliveryError(error);
  }
  return { sent: true, email: user.email, expiresInSeconds: CODE_RULES.codeTtlMs / 1000 };
}

// Checks the code: five tries per code, constant-time compare, single use.
export async function verifyEmailCodeLogic(userId, code) {
  assertUserId(userId);
  const user = await User.findById(userId).select('email emailVerifiedAt').lean();
  if (!user) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
  if (user.emailVerifiedAt) return { verified: true };

  const record = await consumeAttempt(EmailVerification, { owner: userId, email: user.email });
  if (!record) throw new AppError('This code has expired. Ask for a new one.', 400, 'EMAIL_CODE_EXPIRED');

  if (!codeMatches(record, hashCode(PURPOSE, user._id, user.email, code))) {
    const left = attemptsLeft(record);
    throw new AppError(left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Ask for a new one.', 400, 'EMAIL_CODE_INVALID');
  }

  // Only verifies the address the code was sent to (the email may have changed meanwhile).
  await User.updateOne({ _id: userId, email: record.email }, { $set: { emailVerifiedAt: new Date() } });
  await EmailVerification.deleteOne({ _id: record._id });
  return { verified: true };
}
