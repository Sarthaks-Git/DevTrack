import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';
import { JOURNAL_ENTRY_TYPES, JOURNAL_LIMITS } from '../models/JournalEntry.js';

const FIELDS = ['title', 'content', 'type', 'tags', 'goal', 'project', 'pinned', 'entryDate'];
const TAG_PATTERN = /^[a-z0-9][a-z0-9 _-]*$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidDateOnly(value) {
  const match = typeof value === 'string' && DATE_ONLY.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function fail(errors) {
  const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  error.errors = errors;
  return error;
}

function validateEntry(body, { partial }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: { body: 'Request body must be an object' } };

  const errors = {};
  const keys = Object.keys(body);
  if (keys.some(key => !FIELDS.includes(key))) errors.fields = 'Request contains invalid fields';
  if (partial && keys.length === 0) errors.body = 'At least one field is required';

  const clean = {};

  if (body.title !== undefined || !partial) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > JOURNAL_LIMITS.titleMax) {
      errors.title = `Title must be 1-${JOURNAL_LIMITS.titleMax} characters`;
    } else clean.title = body.title.trim();
  }
  if (body.content !== undefined) {
    if (typeof body.content !== 'string' || body.content.length > JOURNAL_LIMITS.contentMax) {
      errors.content = `Content cannot exceed ${JOURNAL_LIMITS.contentMax} characters`;
    } else clean.content = body.content.trim();
  }
  if (body.type !== undefined) {
    if (!JOURNAL_ENTRY_TYPES.includes(body.type)) errors.type = 'Invalid entry type';
    else clean.type = body.type;
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.length > JOURNAL_LIMITS.tagsMax) {
      errors.tags = `Use at most ${JOURNAL_LIMITS.tagsMax} tags`;
    } else {
      const tags = [...new Set(body.tags.map(tag => (typeof tag === 'string' ? tag.trim().toLowerCase() : '')))];
      if (tags.some(tag => !tag || tag.length > JOURNAL_LIMITS.tagMax || !TAG_PATTERN.test(tag))) {
        errors.tags = `Tags must be 1-${JOURNAL_LIMITS.tagMax} characters of letters, numbers, spaces, - or _`;
      } else clean.tags = tags;
    }
  }
  for (const field of ['goal', 'project']) {
    if (body[field] !== undefined) {
      if (body[field] !== null && !mongoose.isValidObjectId(body[field])) errors[field] = `Invalid ${field} reference`;
      else clean[field] = body[field];
    }
  }
  if (body.pinned !== undefined) {
    if (typeof body.pinned !== 'boolean') errors.pinned = 'Pinned must be true or false';
    else clean.pinned = body.pinned;
  }
  if (body.entryDate !== undefined) {
    if (!isValidDateOnly(body.entryDate)) errors.entryDate = 'Entry date must be YYYY-MM-DD';
    else clean.entryDate = new Date(`${body.entryDate}T00:00:00.000Z`);
  }

  return { errors, clean };
}

export function validateCreateJournalEntry(req, res, next) {
  const { errors, clean } = validateEntry(req.body, { partial: false });
  if (Object.keys(errors).length) return next(fail(errors));
  req.validated = clean;
  return next();
}

export function validateUpdateJournalEntry(req, res, next) {
  const { errors, clean } = validateEntry(req.body, { partial: true });
  if (Object.keys(errors).length) return next(fail(errors));
  req.validated = clean;
  return next();
}

export function validateJournalQuery(req, res, next) {
  const { q, tag, type, goal, project, page, limit } = req.query;
  const errors = {};
  const clean = {};

  if (q !== undefined) {
    if (typeof q !== 'string' || q.length > 100) errors.q = 'Search must be at most 100 characters';
    else if (q.trim()) clean.q = q.trim();
  }
  if (tag !== undefined) {
    if (typeof tag !== 'string' || tag.length > JOURNAL_LIMITS.tagMax) errors.tag = 'Invalid tag';
    else clean.tag = tag.trim().toLowerCase();
  }
  if (type !== undefined) {
    if (!JOURNAL_ENTRY_TYPES.includes(type)) errors.type = 'Invalid entry type';
    else clean.type = type;
  }
  for (const [field, value] of [['goal', goal], ['project', project]]) {
    if (value !== undefined) {
      if (!mongoose.isValidObjectId(value)) errors[field] = `Invalid ${field} reference`;
      else clean[field] = value;
    }
  }
  clean.page = Math.min(Math.max(Number.parseInt(page, 10) || 1, 1), 1000);
  clean.limit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);

  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedQuery = clean;
  return next();
}
