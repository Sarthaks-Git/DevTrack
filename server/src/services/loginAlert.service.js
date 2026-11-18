import config from '../config/config.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendEmail } from './email.transport.js';
import { randomToken, sha256 } from '../utils/tokenCrypto.js';

// New-sign-in alerts. Each browser gets a random HttpOnly device cookie; the account keeps hashes
// of the cookies that signed in. A sign-in from a browser it has not seen raises an in-app alert
// and an email. No IP address or location is stored or looked up.
export const MAX_KNOWN_DEVICES = 20;
const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const METHOD_LABELS = { password: 'password', google: 'Google', github: 'GitHub', linkedin: 'LinkedIn' };

const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const logFailure = (what, kind) => {
  if (config.NODE_ENV !== 'test') process.stderr.write(`Sign-in alert ${what} failed: ${kind}\n`);
};

/**
 * Records this browser on the account. Returns the device token to keep in the cookie and whether
 * to alert. Accounts with no known devices yet (new accounts, accounts from before this feature)
 * learn the first browser silently, so only later unfamiliar browsers raise an alert.
 */
export async function recognizeDevice(userId, presentedToken) {
  const deviceToken = typeof presentedToken === 'string' && DEVICE_TOKEN_PATTERN.test(presentedToken) ? presentedToken : randomToken(32);
  const deviceHash = sha256(deviceToken);
  // Atomic: concurrent sign-ins from the same browser add it once and alert at most once.
  const before = await User.findOneAndUpdate(
    { _id: userId, knownDevices: { $ne: deviceHash } },
    { $push: { knownDevices: { $each: [deviceHash], $slice: -MAX_KNOWN_DEVICES } } },
    { projection: { knownDevices: 1 }, returnDocument: 'before' }
  ).lean();
  return { deviceToken, isNewDevice: Boolean(before?.knownDevices?.length) };
}

function alertEmail({ device, method, when }) {
  const settingsUrl = `${config.CLIENT_ORIGIN}/app/settings#security`;
  const text = [
    `Your DevTrack account was signed in from a browser it has not seen before.`,
    `Device: ${device}\nSigned in with: ${method}\nTime: ${when} (UTC)`,
    `If this was you, there is nothing to do.`,
    `If it was not, open Settings → Security to sign that device out, change your password and turn on two-factor authentication: ${settingsUrl}`,
  ].join('\n\n');
  const html = [
    `<p>Your DevTrack account was signed in from a browser it has not seen before.</p>`,
    `<p>Device: ${escapeHtml(device)}<br>Signed in with: ${escapeHtml(method)}<br>Time: ${escapeHtml(when)} (UTC)</p>`,
    `<p>If this was you, there is nothing to do.</p>`,
    `<p>If it was not, <a href="${escapeHtml(settingsUrl)}">open Settings → Security</a> to sign that device out, change your password and turn on two-factor authentication.</p>`,
  ].join('');
  return { subject: 'New sign-in to your DevTrack account', text, html };
}

/** In-app notification plus an email. Never throws: an alert failure must not block the sign-in. */
export async function sendNewSignInAlert(user, { sessionId, deviceLabel, method, at = new Date() }) {
  const device = deviceLabel || 'Unknown browser';
  const methodLabel = METHOD_LABELS[method] || 'password';
  const when = at.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });

  try {
    await Notification.create({
      owner: user._id,
      type: 'new_sign_in',
      subjectType: 'account',
      subjectId: null,
      dedupeKey: `new_sign_in:${sessionId}`,
      title: `New sign-in: ${device}`,
      body: `Signed in with ${methodLabel}. Not you? Sign that session out in Settings and change your password.`,
    });
  } catch {
    logFailure('notification', 'unavailable');
  }

  if (!config.EMAIL.enabled || !user.email) return;
  sendEmail({ to: user.email, ...alertEmail({ device, method: methodLabel, when }) })
    .catch(error => logFailure('email', error?.kind || 'unavailable'));
}
