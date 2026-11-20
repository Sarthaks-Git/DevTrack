import mongoose from 'mongoose';
import webpush from 'web-push';
import config from '../config/config.js';
import PushSubscription from '../models/PushSubscription.js';
import AppError from '../utils/AppError.js';

// Web Push: phone and browser notifications through the browser vendor's push service. Payloads are
// encrypted end to end by web-push and carry counts only, never goal or project names, because
// they can show on a lock screen.

export const MAX_DEVICES = 5;
// A reminder older than this is not worth waking a phone for.
const TTL_SECONDS = 12 * 60 * 60;
const SEND_TIMEOUT_MS = 10 * 1000;

const ownerId = userId => new mongoose.Types.ObjectId(String(userId));

function assertAvailable() {
  if (!config.PUSH.enabled) throw new AppError('Notifications are not set up on this server', 503, 'PUSH_UNAVAILABLE');
}

/** "Chrome on Android" style label from the User-Agent, for the device list only. */
export function deviceLabel(userAgent = '') {
  const ua = String(userAgent);
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /SamsungBrowser\//.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const system = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown device';
  return `${browser} on ${system}`;
}

export async function getPushStatusLogic(userId) {
  const devices = config.PUSH.enabled
    ? await PushSubscription.find({ owner: ownerId(userId) }).sort({ updatedAt: -1 }).select('label updatedAt lastSentAt').lean()
    : [];
  return {
    available: config.PUSH.enabled,
    publicKey: config.PUSH.enabled ? config.PUSH.publicKey : null,
    devices: devices.map(device => ({ id: String(device._id), label: device.label, addedAt: device.updatedAt, lastSentAt: device.lastSentAt })),
  };
}

export async function subscribeLogic(userId, subscription, userAgent) {
  assertAvailable();
  const owner = ownerId(userId);
  // The endpoint identifies the browser: if another account subscribed it before, it now belongs
  // to whoever is signed in on that browser.
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { $set: { owner, keys: subscription.keys, label: deviceLabel(userAgent) } },
    { upsert: true, runValidators: true }
  );
  const extra = await PushSubscription.find({ owner }).sort({ updatedAt: -1 }).skip(MAX_DEVICES).select('_id').lean();
  if (extra.length) await PushSubscription.deleteMany({ _id: { $in: extra.map(row => row._id) } });
  return getPushStatusLogic(userId);
}

export async function unsubscribeEndpointLogic(userId, endpoint) {
  await PushSubscription.deleteOne({ owner: ownerId(userId), endpoint });
  return getPushStatusLogic(userId);
}

export async function removeDeviceLogic(userId, deviceId) {
  const result = await PushSubscription.deleteOne({ owner: ownerId(userId), _id: deviceId });
  if (result.deletedCount === 0) throw new AppError('Device not found', 404, 'NOT_FOUND');
  return getPushStatusLogic(userId);
}

/**
 * Sends one notification to every device of a user. Gone subscriptions (404/410 from the push
 * service) are deleted. Never throws for a single device; returns counts.
 */
export async function sendToUser(userId, { title, body, url, tag }) {
  if (!config.PUSH.enabled) return { sent: 0, removed: 0, failed: 0 };
  const devices = await PushSubscription.find({ owner: ownerId(userId) }).select('endpoint keys').lean();
  const payload = JSON.stringify({ title, body, url, tag });
  const options = {
    vapidDetails: { subject: config.PUSH.subject, publicKey: config.PUSH.publicKey, privateKey: config.PUSH.privateKey },
    TTL: TTL_SECONDS,
    urgency: 'normal',
    timeout: SEND_TIMEOUT_MS,
  };
  const result = { sent: 0, removed: 0, failed: 0 };
  for (const device of devices) {
    try {
      await webpush.sendNotification({ endpoint: device.endpoint, keys: device.keys }, payload, options);
      await PushSubscription.updateOne({ _id: device._id }, { $set: { lastSentAt: new Date() } });
      result.sent += 1;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: device._id });
        result.removed += 1;
      } else {
        result.failed += 1;
        // The status only: never the endpoint, which is a capability URL.
        process.stderr.write(`Push send failed (${Number.isInteger(error?.statusCode) ? error.statusCode : 'network'})\n`);
      }
    }
  }
  return result;
}

export async function sendTestLogic(userId) {
  assertAvailable();
  const count = await PushSubscription.countDocuments({ owner: ownerId(userId) });
  if (count === 0) throw new AppError('Turn on notifications on this device first', 409, 'NO_DEVICES');
  const result = await sendToUser(userId, { title: 'DevTrack', body: 'Notifications are working on this device.', url: '/app/settings#reminders', tag: 'devtrack-test' });
  if (result.sent === 0) throw new AppError('The notification could not be delivered. Turn notifications off and on again.', 502, 'PUSH_FAILED');
  return { sent: result.sent };
}
