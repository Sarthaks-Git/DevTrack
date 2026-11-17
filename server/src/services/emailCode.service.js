import crypto from 'crypto';
import AppError from '../utils/AppError.js';

// Shared rules for the 6-digit codes DevTrack emails: verifying an address, resetting a password
// and confirming a new email. Each purpose has its own collection and hash prefix, so a code for
// one purpose never works for another.
export const CODE_RULES = {
  codeTtlMs: 15 * 60 * 1000,
  resendCooldownMs: 60 * 1000,
  windowMs: 60 * 60 * 1000,
  maxSendsPerWindow: 5,
  maxAttempts: 5,
};

export const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

// Bound to the purpose, the owner and the address the code went to.
export const hashCode = (purpose, owner, email, code) =>
  crypto.createHash('sha256').update(`devtrack-${purpose}:${owner}:${email}:${code}`).digest('hex');

export function codeMatches(record, expectedHash) {
  const stored = Buffer.from(record.codeHash);
  const given = Buffer.from(expectedHash);
  return stored.length === given.length && crypto.timingSafeEqual(stored, given);
}

/**
 * Resend throttling: one code a minute to the same address, five an hour per account. Returns the
 * window fields to store, or { blocked: 'cooldown' | 'limit', waitSeconds } when a send must wait.
 */
export function sendWindow(existing, targetEmail, now = new Date()) {
  if (existing && existing.email === targetEmail && now - existing.sentAt < CODE_RULES.resendCooldownMs) {
    return { blocked: 'cooldown', waitSeconds: Math.ceil((CODE_RULES.resendCooldownMs - (now - existing.sentAt)) / 1000) };
  }
  const fresh = !existing || now - existing.windowStartedAt >= CODE_RULES.windowMs;
  if (!fresh && existing.sendsInWindow >= CODE_RULES.maxSendsPerWindow) return { blocked: 'limit' };
  return { windowStartedAt: fresh ? now : existing.windowStartedAt, sendsInWindow: fresh ? 1 : existing.sendsInWindow + 1 };
}

// The usual answer to a blocked send, for flows that may say so (signed-in users only).
export function throttleError(window) {
  if (window.blocked === 'cooldown') return new AppError(`Please wait ${window.waitSeconds} seconds before asking for another code`, 429, 'EMAIL_RESEND_COOLDOWN');
  return new AppError('Too many codes requested. Try again in an hour.', 429, 'EMAIL_RESEND_LIMIT');
}

// Stores a fresh code (only its hash) and returns the code for the email. The previous code stops working.
export async function storeCode(Model, { owner, email, purpose, window, extra = {}, now = new Date() }) {
  const code = newCode();
  await Model.findOneAndUpdate(
    { owner },
    {
      $set: {
        ...extra,
        email,
        codeHash: hashCode(purpose, owner, email, code),
        attempts: 0,
        sentAt: now,
        expiresAt: new Date(now.getTime() + CODE_RULES.codeTtlMs),
        windowStartedAt: window.windowStartedAt,
        sendsInWindow: window.sendsInWindow,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return code;
}

// Counts one attempt atomically; null when there is no live code or its attempts are used up.
export function consumeAttempt(Model, filter) {
  return Model.findOneAndUpdate(
    { ...filter, expiresAt: { $gt: new Date() }, attempts: { $lt: CODE_RULES.maxAttempts } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  ).lean();
}

export const attemptsLeft = record => CODE_RULES.maxAttempts - record.attempts;

// "s•••@gmail.com": enough for the owner to recognise, not enough to read the address.
export function maskEmail(email) {
  const [name, domain] = String(email).split('@');
  return `${name.slice(0, 1)}•••@${domain}`;
}

export function codeEmail(code, { title, reason }) {
  const minutes = CODE_RULES.codeTtlMs / 60000;
  return {
    subject: `${code} is your DevTrack ${title} code`,
    text: `Your DevTrack ${title} code is ${code}.\n\nIt expires in ${minutes} minutes. ${reason}`,
    html: `<p>Your DevTrack ${title} code is</p><p style="font-size:24px;font-weight:600;letter-spacing:4px">${code}</p><p>It expires in ${minutes} minutes. ${reason}</p>`,
  };
}
