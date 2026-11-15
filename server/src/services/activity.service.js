import mongoose from 'mongoose';
import Activity, { ACTIVITY_TYPES } from '../models/Activity.js';
import AppError from '../utils/AppError.js';

const MAX_PAGE = 50;

// Best effort: the user's action already succeeded, so a timeline write failure must not undo it.
export async function recordActivity(owner, { type, subjectType, subjectId = null, title, detail = '', source = 'manual', occurredAt }) {
  try {
    await Activity.create({
      owner,
      type,
      subjectType,
      subjectId,
      title: String(title).slice(0, 200),
      detail: String(detail).slice(0, 300),
      source,
      ...(occurredAt ? { occurredAt } : {}),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') process.stderr.write(`Activity record failed: ${error?.name || 'Error'}\n`);
  }
}

export async function listActivityLogic(userId, { limit, before, type } = {}) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');

  const pageSize = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), MAX_PAGE);
  const filter = { owner: userId };

  // Cursor is the last seen _id: unique and creation-ordered, so pages never skip or repeat rows.
  if (before !== undefined) {
    if (!mongoose.isValidObjectId(before)) throw new AppError('Invalid pagination cursor', 400, 'VALIDATION_ERROR');
    filter._id = { $lt: new mongoose.Types.ObjectId(before) };
  }
  if (type !== undefined) {
    if (!ACTIVITY_TYPES.includes(type)) throw new AppError('Invalid activity type', 400, 'VALIDATION_ERROR');
    filter.type = type;
  }

  // Fetch one extra row to know whether another page exists.
  const rows = await Activity.find(filter)
    .sort({ _id: -1 })
    .limit(pageSize + 1)
    .select('-owner -__v')
    .lean();

  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]._id.toString() : null,
  };
}

export async function activitySummaryLogic(userId, { days = 7 } = {}) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
  const since = new Date(Date.now() - days * 86_400_000);
  const counts = await Activity.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId), occurredAt: { $gte: since } } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);
  return { since, counts: Object.fromEntries(counts.map(row => [row._id, row.count])) };
}
