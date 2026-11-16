import crypto from 'crypto';
import config from '../config/config.js';

// AES-256-GCM for third-party tokens at rest. Format: v1.<iv>.<tag>.<ciphertext> (base64url).
// The context (e.g. "github:access:<userId>") is bound as associated data, so a ciphertext copied
// into another user's row or another field fails to decrypt.
const VERSION = 'v1';

function keyOrThrow(key) {
  if (!key || key.length !== 32) throw new Error('Token encryption is not configured');
  return key;
}

export function encryptSecret(plaintext, context, key = config.GITHUB.encryptionKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyOrThrow(key), iv);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(payload, context, key = config.GITHUB.encryptionKey) {
  const parts = typeof payload === 'string' ? payload.split('.') : [];
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error('Stored secret has an unknown format');
  const [iv, tag, ciphertext] = parts.slice(1).map(part => Buffer.from(part, 'base64url'));
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyOrThrow(key), iv);
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Never echo the payload or key material.
    throw new Error('Stored secret could not be decrypted');
  }
}

export const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
