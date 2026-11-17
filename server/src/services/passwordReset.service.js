import bcrypt from 'bcrypt';
import config from '../config/config.js';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import LoginChallenge from '../models/LoginChallenge.js';
import EmailVerification from '../models/EmailVerification.js';
import PasswordReset from '../models/PasswordReset.js';
import AppError from '../utils/AppError.js';
import { passwordProblem } from '../validators/account.validator.js';
import { SALT_ROUNDS } from './auth.service.js';
import { sendEmail } from './email.transport.js';
import { codeEmail, codeMatches, consumeAttempt, hashCode, sendWindow, storeCode } from './emailCode.service.js';

const PURPOSE = 'reset';

// Every answer to a wrong, used, expired or unknown code (or unknown email) is the same, so the
// reset form never reveals which emails have accounts.
const invalidCode = () => new AppError('That code is wrong or has expired. Ask for a new one.', 400, 'RESET_CODE_INVALID');

function logFailure(stage, kind) {
  if (process.env.NODE_ENV !== 'test') process.stderr.write(`Password reset ${stage} failed: ${kind}\n`);
}

async function issueResetCode(user) {
  const existing = await PasswordReset.findOne({ owner: user._id }).lean();
  const window = sendWindow(existing, user.email);
  // Throttled silently: the caller already answered with the generic message.
  if (window.blocked) return;
  const code = await storeCode(PasswordReset, { owner: user._id, email: user.email, purpose: PURPOSE, window });
  await sendEmail({
    to: user.email,
    ...codeEmail(code, { title: 'password reset', reason: 'If you did not ask to reset your password, ignore this email; your password stays the same.' }),
  });
}

/**
 * Starts a reset. Always answers the same way, and the lookup is the only work done before
 * answering, so neither the response nor its timing shows whether the email has an account.
 */
export async function requestPasswordResetLogic(email) {
  const user = await User.findOne({ email }).select('email accountStatus').lean();
  if (user && user.accountStatus === 'active' && config.EMAIL.enabled) {
    issueResetCode(user).catch(error => logFailure('email', error?.kind || 'unavailable'));
  }
  return { sent: true };
}

function sendPasswordChangedAlert(email) {
  const text = 'Your DevTrack password was just reset, and every device was signed out.\n\nIf this was you, nothing else to do. If it was not, reset your password again from the sign-in page right away and turn on two-factor authentication in Settings.';
  sendEmail({
    to: email,
    subject: 'Your DevTrack password was changed',
    text,
    html: text.split('\n\n').map(part => `<p>${part}</p>`).join(''),
  }).catch(error => logFailure('alert', error?.kind || 'unavailable'));
}

/**
 * Sets a new password with the emailed code. Single use, five tries per code. Signs out every
 * device. Does not sign in: the next sign-in still asks for the authenticator code when 2FA is on.
 */
export async function resetPasswordLogic({ email, code, newPassword }) {
  const user = await User.findOne({ email }).select('username email accountStatus emailVerifiedAt');
  if (!user || user.accountStatus !== 'active') throw invalidCode();

  const record = await consumeAttempt(PasswordReset, { owner: user._id, email: user.email });
  if (!record || !codeMatches(record, hashCode(PURPOSE, user._id, user.email, code))) throw invalidCode();

  const problem = passwordProblem(newPassword, { username: user.username, email: user.email });
  if (problem) {
    const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    error.errors = { newPassword: problem };
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  // Claim the code before changing anything, so two racing requests cannot both use it.
  const claimed = await PasswordReset.deleteOne({ _id: record._id, codeHash: record.codeHash });
  if (!claimed.deletedCount) throw invalidCode();

  const now = new Date();
  const updated = await User.updateOne(
    { _id: user._id, email: user.email, accountStatus: 'active' },
    {
      $set: {
        passwordHash,
        passwordChangedAt: now,
        passwordSet: true,
        // The code reached this inbox, which proves the address.
        ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: now }),
      },
    }
  );
  if (!updated.matchedCount) throw invalidCode();

  await Promise.all([
    AuthSession.updateMany({ owner: user._id, revokedAt: null }, { $set: { revokedAt: now, revokeReason: 'password_reset' } }),
    // Sign-ins waiting for an authenticator code were started with the old password.
    LoginChallenge.deleteMany({ owner: user._id }),
    EmailVerification.deleteMany({ owner: user._id }),
  ]);
  sendPasswordChangedAlert(user.email);
  return { reset: true };
}
