import mongoose from 'mongoose';
import config from '../config/config.js';
import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js';
import User from '../models/User.js';
import { refreshRemindersLogic } from './notification.service.js';
import { sendToUser } from './push.service.js';
import { DIGEST_TYPES, FRESH_MS, SEND_HOUR_IST, indiaDay, indiaHour } from './reminderEmail.service.js';

// Daily phone/browser notification with the number of new reminders, at the same time as the
// email summary. It has its own per-user day claim and per-reminder marker, so email and push
// never depend on each other.

export async function runReminderPushes({ now = new Date(), onlyUserIds } = {}) {
  if (!config.PUSH.enabled) return { skipped: 'push_disabled' };
  if (indiaHour(now) < SEND_HOUR_IST) return { skipped: 'before_send_hour' };

  const today = indiaDay(now);
  let owners = await PushSubscription.distinct('owner');
  if (onlyUserIds) {
    const only = new Set(onlyUserIds.map(String));
    owners = owners.filter(id => only.has(String(id)));
  }
  const due = {
    _id: { $in: owners.map(id => new mongoose.Types.ObjectId(String(id))) },
    emailVerifiedAt: { $ne: null },
    accountStatus: 'active',
    'reminders.enabled': { $ne: false },
    pushDigestDay: { $ne: today },
  };

  const result = { sent: 0, failed: 0, checked: 0 };
  for (;;) {
    const user = await User.findOneAndUpdate(due, { $set: { pushDigestDay: today } }, { projection: { _id: 1 } }).lean();
    if (!user) break;
    result.checked += 1;
    try {
      await refreshRemindersLogic(user._id, new Date(`${today}T00:00:00Z`), { force: true });
      const pending = await Notification.find({
        owner: user._id,
        type: { $in: DIGEST_TYPES },
        readAt: null,
        pushedAt: null,
        createdAt: { $gte: new Date(now.getTime() - FRESH_MS) },
      }).select('_id').lean();
      if (pending.length === 0) continue;
      const count = pending.length;
      const delivered = await sendToUser(user._id, {
        title: count === 1 ? '1 new reminder' : `${count} new reminders`,
        body: 'Open DevTrack to see what needs your attention today.',
        url: '/app/notifications',
        tag: 'devtrack-reminders',
      });
      if (delivered.sent === 0) {
        if (delivered.failed) result.failed += 1;
        continue;
      }
      await Notification.updateMany({ _id: { $in: pending.map(item => item._id) } }, { $set: { pushedAt: now } });
      result.sent += 1;
    } catch {
      result.failed += 1;
      process.stderr.write('Reminder push failed\n');
    }
  }
  return result;
}
