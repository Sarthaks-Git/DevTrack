import mongoose from 'mongoose';
import Goal from '../models/Goal.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';
import SolvedProblem from '../models/SolvedProblem.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { computeAttention } from './attention.service.js';
import { withTargetProgress } from './goalTarget.service.js';

export const REMINDER_REFRESH_MS = 5 * 60 * 1000;
export const NOTIFICATION_PAGE_MAX = 50;
const REMINDER_DEFAULTS = Object.freeze({ enabled: true, stalledAfterDays: 14, deadlineAlerts: true, weeklyReview: true });
const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = value => new Date(value).toISOString().slice(0, 10);
const shortDate = value => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function ownerId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  return new mongoose.Types.ObjectId(String(userId));
}

// Turns one attention item into reminder documents. Keys make each situation notify once.
function remindersFor(item, prefs) {
  const base = { subjectType: item.kind, subjectId: item.id };
  const label = item.kind === 'goal' ? 'Goal' : 'Project';
  const out = [];

  for (const reason of item.reasons) {
    if (reason.code === 'stalled') {
      out.push({
        ...base, type: 'stalled',
        dedupeKey: `stalled:${item.kind}:${item.id}:${dayKey(item.lastActivityAt)}`,
        title: clip(`${label} stalled: ${item.title}`, 200),
        body: `No progress in ${reason.days} days. Pick one small step to restart it.`,
      });
    }
    if (!prefs.deadlineAlerts) continue;
    if (reason.code === 'overdue') {
      out.push({
        ...base, type: item.kind === 'goal' ? 'goal_overdue' : 'project_overdue',
        dedupeKey: `overdue:${item.kind}:${item.id}:${dayKey(reason.date)}`,
        title: clip(`${label} overdue: ${item.title}`, 200),
        body: `It was due ${shortDate(reason.date)}. Finish it or set a realistic new date.`,
      });
    } else if (reason.code === 'due_soon') {
      out.push({
        ...base, type: 'due_soon',
        dedupeKey: `due_soon:${item.kind}:${item.id}:${dayKey(reason.date)}`,
        title: clip(`${label} due soon: ${item.title}`, 200),
        body: `Due ${shortDate(reason.date)}.`,
      });
    } else if (reason.code === 'milestone_overdue') {
      out.push({
        ...base, type: 'milestone_overdue',
        dedupeKey: `milestone_overdue:${item.kind}:${item.id}:${dayKey(reason.date)}`,
        title: clip(`Milestone overdue in ${item.title}`, 200),
        body: `${reason.count} milestone${reason.count === 1 ? ' is' : 's are'} past due.`,
      });
    }
  }
  return out;
}

// "Last week's review is ready", once per week, only if the user did something that week.
// Uses UTC week boundaries; the review page itself uses the viewer's timezone.
// The text names only the dates: no goal titles or numbers, so it leaks nothing if shown elsewhere.
async function weeklyReviewReminder(owner, todayDate) {
  const weekday = (todayDate.getUTCDay() + 6) % 7;
  const start = new Date(todayDate.getTime() - (weekday + 7) * DAY_MS);
  const end = new Date(start.getTime() + 7 * DAY_MS);
  const dedupeKey = `weekly_review:${dayKey(start)}`;
  if (await Notification.exists({ owner, dedupeKey })) return null;

  const range = { $gte: start, $lt: end };
  const [acted, solved] = await Promise.all([
    Activity.exists({ owner, occurredAt: range, type: { $nin: ['stats_synced', 'platform_verified', 'platform_disconnected'] } }),
    SolvedProblem.exists({ owner, firstAcceptedAt: range }),
  ]);
  if (!acted && !solved) return null;

  return {
    type: 'weekly_review', subjectType: 'review', subjectId: null, dedupeKey,
    title: `Your week in review: ${shortDate(start)} – ${shortDate(new Date(end.getTime() - DAY_MS))}`,
    body: 'See what you finished, what slipped and what to focus on next.',
  };
}

// Generates reminders from current data. Throttled per user with an atomic claim so polling,
// several tabs or concurrent requests never duplicate work (and unique keys prevent duplicates anyway).
export async function refreshRemindersLogic(userId, todayDate, { force = false } = {}) {
  const owner = ownerId(userId);
  const now = new Date();
  const claimFilter = force
    ? { _id: owner }
    : { _id: owner, $or: [{ remindersCheckedAt: null }, { remindersCheckedAt: { $lt: new Date(now.getTime() - REMINDER_REFRESH_MS) } }] };

  const user = await User.findOneAndUpdate(claimFilter, { $set: { remindersCheckedAt: now } }, { projection: { reminders: 1 } }).lean();
  if (!user) return { refreshed: false };

  const prefs = { ...REMINDER_DEFAULTS, ...(user.reminders || {}) };
  if (!prefs.enabled) return { refreshed: true, created: 0 };

  const [{ items }, targetedGoals] = await Promise.all([
    computeAttention(owner, todayDate, { stalledDays: prefs.stalledAfterDays }),
    Goal.find({ owner, status: { $in: ['not_started', 'in_progress'] }, target: { $ne: null } }).lean(),
  ]);

  const docs = items.flatMap(item => remindersFor(item, prefs));
  for (const goal of await withTargetProgress(owner, targetedGoals)) {
    if (!goal.targetProgress?.reached) continue;
    docs.push({
      type: 'target_reached', subjectType: 'goal', subjectId: String(goal._id),
      dedupeKey: `target_reached:${goal._id}:${dayKey(goal.target.since)}:${goal.target.count}`,
      title: clip(`Target reached: ${goal.title}`, 200),
      body: `You hit ${goal.target.count} verified solves. Mark the goal complete or raise the bar.`,
    });
  }

  if (prefs.weeklyReview) {
    const review = await weeklyReviewReminder(owner, todayDate);
    if (review) docs.push(review);
  }

  if (docs.length === 0) return { refreshed: true, created: 0 };
  const result = await Notification.bulkWrite(
    docs.map(doc => ({
      updateOne: {
        filter: { owner, dedupeKey: doc.dedupeKey },
        update: { $setOnInsert: { ...doc, owner, subjectId: doc.subjectId ? new mongoose.Types.ObjectId(String(doc.subjectId)) : null, readAt: null } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
  return { refreshed: true, created: result.upsertedCount };
}

export async function listNotificationsLogic(userId, { limit, before, today }) {
  const owner = ownerId(userId);
  await refreshRemindersLogic(owner, today);

  const filter = { owner, ...(before ? { _id: { $lt: new mongoose.Types.ObjectId(before) } } : {}) };
  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ _id: -1 }).limit(limit + 1).select('-owner -dedupeKey -__v').lean(),
    Notification.countDocuments({ owner, readAt: null }),
  ]);
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return { items: page, unread, nextCursor: hasMore ? String(page[page.length - 1]._id) : null };
}

export async function unreadCountLogic(userId, today) {
  const owner = ownerId(userId);
  await refreshRemindersLogic(owner, today);
  return { unread: await Notification.countDocuments({ owner, readAt: null }) };
}

export async function markReadLogic(userId, notificationId) {
  const owner = ownerId(userId);
  const projection = { owner: 0, dedupeKey: 0, __v: 0 };
  // Keep the first read time: only unread notifications are updated; read ones are returned as-is.
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, owner, readAt: null },
    { $set: { readAt: new Date() } },
    { returnDocument: 'after', projection }
  ).lean();
  const notification = updated || await Notification.findOne({ _id: notificationId, owner }, projection).lean();
  if (!notification) throw new AppError('Notification not found', 404, 'NOT_FOUND');
  return notification;
}

export async function markAllReadLogic(userId) {
  const owner = ownerId(userId);
  const result = await Notification.updateMany({ owner, readAt: null }, { $set: { readAt: new Date() } });
  return { updated: result.modifiedCount };
}

export async function getReminderSettingsLogic(userId) {
  const user = await User.findById(ownerId(userId)).select('reminders').lean();
  if (!user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  return { ...REMINDER_DEFAULTS, ...(user.reminders || {}) };
}

export async function updateReminderSettingsLogic(userId, changes) {
  const set = Object.fromEntries(Object.entries(changes).map(([key, value]) => [`reminders.${key}`, value]));
  // Re-check immediately with the new rules on the next read.
  const user = await User.findByIdAndUpdate(ownerId(userId), { $set: { ...set, remindersCheckedAt: null } }, { returnDocument: 'after', runValidators: true, projection: { reminders: 1 } }).lean();
  if (!user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  return { ...REMINDER_DEFAULTS, ...(user.reminders || {}) };
}

// Called when a goal or project is deleted so reminders never point at missing work.
export async function deleteNotificationsForSubject(owner, subjectId) {
  await Notification.deleteMany({ owner, subjectId });
}
