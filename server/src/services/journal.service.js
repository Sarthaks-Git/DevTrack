import mongoose from 'mongoose';
import JournalEntry from '../models/JournalEntry.js';
import Goal from '../models/Goal.js';
import Project from '../models/Project.js';
import AppError from '../utils/AppError.js';
import { recordActivity } from './activity.service.js';

const PUBLIC_FIELDS = '-owner -__v';
const LINK_FIELDS = [
  { field: 'goal', model: Goal, select: 'title status' },
  { field: 'project', model: Project, select: 'title status' },
];

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A linked goal/project must belong to the same user, or entries could reference someone else's data.
async function assertOwnedLinks(userId, data) {
  // Both checks run in parallel: one round trip instead of two.
  const checks = LINK_FIELDS.filter(({ field }) => data[field]);
  const found = await Promise.all(checks.map(({ field, model }) => model.exists({ _id: data[field], owner: userId })));
  const missing = checks.find((_, index) => !found[index]);
  if (missing) throw new AppError(`Linked ${missing.field} was not found`, 400, 'INVALID_LINK');
}

function populateLinks(query) {
  return LINK_FIELDS.reduce((q, { field, select }) => q.populate(field, select), query);
}

export async function createJournalEntryLogic(userId, data) {
  assertUserId(userId);
  await assertOwnedLinks(userId, data);
  const entry = await JournalEntry.create({ ...data, owner: userId });

  await recordActivity(userId, {
    type: 'journal_created',
    subjectType: 'journal',
    subjectId: entry._id,
    title: entry.title,
    detail: entry.type,
  });

  return populateLinks(JournalEntry.findById(entry._id).select(PUBLIC_FIELDS)).lean();
}

export async function listJournalEntriesLogic(userId, { q, tag, type, goal, project, page, limit }) {
  assertUserId(userId);
  const filter = { owner: userId };
  if (tag) filter.tags = tag;
  if (type) filter.type = type;
  if (goal) filter.goal = goal;
  if (project) filter.project = project;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: pattern }, { content: pattern }, { tags: pattern }];
  }

  const [items, total, tags] = await Promise.all([
    populateLinks(
      JournalEntry.find(filter).sort({ pinned: -1, entryDate: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).select(PUBLIC_FIELDS)
    ).lean(),
    JournalEntry.countDocuments(filter),
    JournalEntry.distinct('tags', { owner: userId }),
  ]);

  return { items, total, page, pages: Math.max(Math.ceil(total / limit), 1), tags: tags.sort() };
}

export async function getJournalEntryLogic(userId, entryId) {
  assertUserId(userId);
  const entry = await populateLinks(JournalEntry.findOne({ _id: entryId, owner: userId }).select(PUBLIC_FIELDS)).lean();
  if (!entry) throw new AppError('Journal entry not found', 404, 'NOT_FOUND');
  return entry;
}

export async function updateJournalEntryLogic(userId, entryId, data) {
  assertUserId(userId);
  await assertOwnedLinks(userId, data);
  const entry = await JournalEntry.findOneAndUpdate(
    { _id: entryId, owner: userId },
    { $set: data },
    { returnDocument: 'after', runValidators: true }
  );
  if (!entry) throw new AppError('Journal entry not found', 404, 'NOT_FOUND');
  return populateLinks(JournalEntry.findById(entry._id).select(PUBLIC_FIELDS)).lean();
}

export async function deleteJournalEntryLogic(userId, entryId) {
  assertUserId(userId);
  const entry = await JournalEntry.findOneAndDelete({ _id: entryId, owner: userId });
  if (!entry) throw new AppError('Journal entry not found', 404, 'NOT_FOUND');
}
