import mongoose from 'mongoose';
import config from '../config/config.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendEmail } from './email.transport.js';
import { refreshRemindersLogic } from './notification.service.js';
import { alertOwner } from './errorAlert.service.js';
import { describeUnexpectedError } from '../middlewares/error.middleware.js';
import { runReminderPushes } from './reminderPush.service.js';

// Daily email summary of new in-app reminders. Runs inside the API process (the free host has no
// cron); an hourly tick sends after SEND_HOUR_IST each India day. Each account is claimed
// atomically per day, so restarts and several instances never send twice.

export const SEND_HOUR_IST = 8;
const TIME_ZONE = 'Asia/Kolkata';
const TICK_MS = 60 * 60 * 1000;
const FIRST_TICK_MS = 60 * 1000;
// Only reminders created this recently go out, so the first run never mails an old backlog.
export const FRESH_MS = 48 * 60 * 60 * 1000;
const MAX_ITEMS = 10;
// Brevo's free plan sends 300 emails a day in total; leave room for codes and security alerts.
const DAILY_CAP = 200;
export const DIGEST_TYPES = ['goal_overdue', 'project_overdue', 'due_soon', 'milestone_overdue', 'stalled', 'target_reached', 'weekly_review', 'quiz_review'];

const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: 'numeric', hourCycle: 'h23' });

/** The calendar day in India as YYYY-MM-DD. */
export const indiaDay = now => dayFormat.format(now);
export const indiaHour = now => Number(hourFormat.format(now));

function digestEmail(items, extra) {
  const alertsUrl = `${config.CLIENT_ORIGIN}/app/notifications`;
  const settingsUrl = `${config.CLIENT_ORIGIN}/app/settings#reminders`;
  const count = items.length + extra;
  const subject = count === 1 ? 'DevTrack: 1 new reminder' : `DevTrack: ${count} new reminders`;
  const more = extra > 0 ? `…and ${extra} more in DevTrack.` : '';

  const text = [
    'Here is what needs your attention today:',
    items.map(item => `- ${item.title}${item.body ? `\n  ${item.body}` : ''}`).join('\n'),
    more,
    `Open your alerts: ${alertsUrl}`,
    `You get this because email reminders are on. Turn them off in Settings → Reminders: ${settingsUrl}`,
  ].filter(Boolean).join('\n\n');

  const html = [
    '<p>Here is what needs your attention today:</p>',
    `<ul>${items.map(item => `<li><strong>${escapeHtml(item.title)}</strong>${item.body ? `<br>${escapeHtml(item.body)}` : ''}</li>`).join('')}</ul>`,
    more ? `<p>${escapeHtml(more)}</p>` : '',
    `<p><a href="${escapeHtml(alertsUrl)}">Open your alerts</a></p>`,
    `<p style="color:#666;font-size:12px">You get this because email reminders are on. <a href="${escapeHtml(settingsUrl)}">Turn them off in Settings → Reminders</a>.</p>`,
  ].join('');

  return { subject, text, html };
}

async function emailOne(user, now, today) {
  // Build today's reminders with the user's own rules, then mail the ones not yet sent.
  await refreshRemindersLogic(user._id, new Date(`${today}T00:00:00Z`), { force: true });

  const pending = await Notification.find({
    owner: user._id,
    type: { $in: DIGEST_TYPES },
    readAt: null,
    emailedAt: null,
    createdAt: { $gte: new Date(now.getTime() - FRESH_MS) },
  }).sort({ _id: -1 }).select('title body').lean();
  if (pending.length === 0) return 'nothing';

  const shown = pending.slice(0, MAX_ITEMS);
  await sendEmail({ to: user.email, ...digestEmail(shown, pending.length - shown.length) });
  // Every pending reminder counts as delivered: the email points to the full list.
  await Notification.updateMany({ _id: { $in: pending.map(item => item._id) } }, { $set: { emailedAt: now } });
  return 'sent';
}

/**
 * One pass over the accounts due today. Never throws; returns counts for logs and tests.
 * onlyUserIds limits the pass to some accounts (tests).
 */
export async function runReminderEmails({ now = new Date(), onlyUserIds } = {}) {
  if (!config.EMAIL.enabled) return { skipped: 'email_disabled' };
  if (indiaHour(now) < SEND_HOUR_IST) return { skipped: 'before_send_hour' };

  const today = indiaDay(now);
  const due = {
    emailVerifiedAt: { $ne: null },
    accountStatus: 'active',
    'reminders.enabled': { $ne: false },
    'reminders.email': { $ne: false },
    reminderDigestDay: { $ne: today },
  };
  if (onlyUserIds) due._id = { $in: onlyUserIds.map(id => new mongoose.Types.ObjectId(String(id))) };

  const result = { sent: 0, failed: 0, checked: 0 };
  let claimedToday = await User.countDocuments({ reminderDigestDay: today });

  while (claimedToday < DAILY_CAP) {
    const user = await User.findOneAndUpdate(due, { $set: { reminderDigestDay: today } }, { projection: { email: 1 } }).lean();
    if (!user) break;
    claimedToday += 1;
    result.checked += 1;
    try {
      if ((await emailOne(user, now, today)) === 'sent') result.sent += 1;
    } catch (error) {
      result.failed += 1;
      // A kind word only: never the address or the content.
      process.stderr.write(`Reminder email failed (${error?.kind || 'error'})\n`);
    }
  }
  return result;
}

/** Starts the hourly tick for reminder emails and pushes. Returns a stop function. Not started in tests. */
export function startReminderEmailSchedule() {
  if (!config.REMINDER_EMAILS && !config.PUSH.enabled) return () => {};
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      if (config.REMINDER_EMAILS) {
        const result = await runReminderEmails();
        if (result.checked) process.stdout.write(`Reminder emails: ${result.sent} sent, ${result.failed} failed, ${result.checked} checked\n`);
      }
      const pushes = await runReminderPushes();
      if (pushes.checked) process.stdout.write(`Reminder pushes: ${pushes.sent} sent, ${pushes.failed} failed, ${pushes.checked} checked\n`);
    } catch (error) {
      const detail = describeUnexpectedError(error);
      process.stderr.write(`Reminder email run failed: ${detail}\n`);
      alertOwner('job', detail);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(tick, FIRST_TICK_MS);
  const timer = setInterval(tick, TICK_MS);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
