import crypto from 'crypto';

// Time-based one-time passwords (RFC 6238, the codes authenticator apps show), built on Node's
// crypto only. SHA-1, 6 digits, 30-second steps: the settings every authenticator app supports.
export const TOTP = { digits: 6, stepSeconds: 30, window: 1, secretBytes: 20 };

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const generateTotpSecret = () => base32Encode(crypto.randomBytes(TOTP.secretBytes));

export const timeStep = (now = Date.now()) => Math.floor(now / 1000 / TOTP.stepSeconds);

// HOTP (RFC 4226) for one counter value.
export function hotp(secretBase32, counter, digits = TOTP.digits) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', base32Decode(secretBase32)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export const totpAt = (secretBase32, now = Date.now()) => hotp(secretBase32, timeStep(now));

/**
 * Checks a code against the current step and one step either side (clock drift).
 * Returns the matching step so the caller can refuse it next time (no replay), or null.
 * Steps at or before `lastUsedStep` are never accepted.
 */
export function verifyTotp(secretBase32, code, { now = Date.now(), lastUsedStep = null } = {}) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const current = timeStep(now);
  const expected = Buffer.from(code);
  for (let offset = -TOTP.window; offset <= TOTP.window; offset += 1) {
    const step = current + offset;
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    if (crypto.timingSafeEqual(Buffer.from(hotp(secretBase32, step)), expected)) return step;
  }
  return null;
}

// otpauth:// link that authenticator apps read from the QR code.
export function otpauthUrl({ secret, account, issuer = 'DevTrack' }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(TOTP.digits), period: String(TOTP.stepSeconds) });
  return `otpauth://totp/${label}?${params}`;
}
