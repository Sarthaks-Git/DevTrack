import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../config/config.js';
import EmailVerification from '../models/EmailVerification.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { sendEmail } from './email.transport.js';

export const EMAIL_RULES = {
  codeTtlMs: 15 * 60 * 1000,
  resendCooldownMs: 60 * 1000,
  windowMs: 60 * 60 * 1000,
  maxSendsPerWindow: 5,
  maxAttempts: 5,
};

// Bound to the owner and address, so a code for one account or email never works for another.
const codeHash = (owner, email, code) => crypto.createHash('sha256').update(`devtrack-email:${owner}:${email}:${code}`).digest('hex');

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

function logFailure(kind) {
  if (process.env.NODE_ENV !== 'test') process.stderr.write(`Verification email failed: ${kind}\n`);
}

function message(code) {
  const minutes = EMAIL_RULES.codeTtlMs / 60000;
  return {
    subject: `${code} is your DevTrack verification code`,
    text: `Your DevTrack verification code is ${code}.\n\nIt expires in ${minutes} minutes. If you did not create a DevTrack account, ignore this email; no account will be activated.`,
    html: `<p>Your DevTrack verification code is</p><p style="font-size:24px;font-weight:600;letter-spacing:4px">${code}</p><p>It expires in ${minutes} minutes. If you did not create a DevTrack account, ignore this email; no account will be activated.</p>`,
  };
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

  const now = new Date();
  const existing = await EmailVerification.findOne({ owner: userId }).lean();
  if (existing && existing.email === user.email && now - existing.sentAt < EMAIL_RULES.resendCooldownMs) {
    const wait = Math.ceil((EMAIL_RULES.resendCooldownMs - (now - existing.sentAt)) / 1000);
    throw new AppError(`Please wait ${wait} seconds before asking for another code`, 429, 'EMAIL_RESEND_COOLDOWN');
  }
  const windowFresh = !existing || now - existing.windowStartedAt >= EMAIL_RULES.windowMs;
  if (!windowFresh && existing.sendsInWindow >= EMAIL_RULES.maxSendsPerWindow) {
    throw new AppError('Too many codes requested. Try again in an hour.', 429, 'EMAIL_RESEND_LIMIT');
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await EmailVerification.findOneAndUpdate(
    { owner: userId },
    {
      $set: {
        email: user.email,
        codeHash: codeHash(userId, user.email, code),
        attempts: 0,
        sentAt: now,
        expiresAt: new Date(now.getTime() + EMAIL_RULES.codeTtlMs),
        windowStartedAt: windowFresh ? now : existing.windowStartedAt,
        sendsInWindow: windowFresh ? 1 : existing.sendsInWindow + 1,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  try {
    await sendEmail({ to: user.email, ...message(code) });
  } catch (error) {
    logFailure(error?.kind || 'unavailable');
    if (error?.kind === 'rejected') throw new AppError('That email address cannot receive mail. Check it and change it if needed.', 400, 'EMAIL_UNDELIVERABLE');
    throw new AppError('The verification email could not be sent. Try again shortly.', 502, 'EMAIL_SEND_FAILED');
  }
  return { sent: true, email: user.email, expiresInSeconds: EMAIL_RULES.codeTtlMs / 1000 };
}

// Checks the code: five tries per code, constant-time compare, single use.
export async function verifyEmailCodeLogic(userId, code) {
  assertUserId(userId);
  const user = await User.findById(userId).select('email emailVerifiedAt').lean();
  if (!user) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
  if (user.emailVerifiedAt) return { verified: true };

  const record = await EmailVerification.findOneAndUpdate(
    { owner: userId, email: user.email, expiresAt: { $gt: new Date() }, attempts: { $lt: EMAIL_RULES.maxAttempts } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  ).lean();
  if (!record) throw new AppError('This code has expired. Ask for a new one.', 400, 'EMAIL_CODE_EXPIRED');

  const expected = Buffer.from(record.codeHash);
  const given = Buffer.from(codeHash(userId, user.email, code));
  if (!crypto.timingSafeEqual(expected, given)) {
    const left = EMAIL_RULES.maxAttempts - record.attempts;
    throw new AppError(left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Ask for a new one.', 400, 'EMAIL_CODE_INVALID');
  }

  // Only verifies the address the code was sent to (the email may have changed meanwhile).
  await User.updateOne({ _id: userId, email: record.email }, { $set: { emailVerifiedAt: new Date() } });
  await EmailVerification.deleteOne({ _id: record._id });
  return { verified: true };
}
