import mongoose from 'mongoose';
import Activity, { ACTIVITY_TYPES } from '../models/Activity.js';
import AppError from '../utils/AppError.js';

const MAX_PAGE = 50;

function parseCursor(value) {
  const match = typeof value === 'string' ? /^(\d{1,15})\.([0-9a-f]{24})$/.exec(value) : null;
  if (!match) return null;
  const at = new Date(Number(match[1]));
  return Number.isNaN(at.getTime()) ? null : { at, id: new mongoose.Types.ObjectId(match[2]) };
}

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

  // Newest event first. Cursor is "<occurredAt ms>.<_id>" of the last row seen; _id breaks ties,
  // so pages never skip or repeat rows even when synced items arrive with older dates.
  if (before !== undefined) {
    const cursor = parseCursor(before);
    if (!cursor) throw new AppError('Invalid pagination cursor', 400, 'VALIDATION_ERROR');
    filter.$or = [{ occurredAt: { $lt: cursor.at } }, { occurredAt: cursor.at, _id: { $lt: cursor.id } }];
  }
  if (type !== undefined) {
    if (!ACTIVITY_TYPES.includes(type)) throw new AppError('Invalid activity type', 400, 'VALIDATION_ERROR');
    filter.type = type;
  }

  // Fetch one extra row to know whether another page exists.
  const rows = await Activity.find(filter)
    .sort({ occurredAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .select('-owner -__v')
    .lean();

  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  return {
    items,
    nextCursor: hasMore ? `${new Date(items[items.length - 1].occurredAt).getTime()}.${items[items.length - 1]._id}` : null,
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
