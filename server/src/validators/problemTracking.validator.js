import AppError from '../utils/AppError.js';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_RANGE_DAYS = 400;

function fail(errors) {
  const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  error.errors = errors;
  return error;
}

function parseDay(value) {
  const match = typeof value === 'string' && DATE_ONLY.exec(value);
  if (!match) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function validateSyncRequest(req, res, next) {
  const body = req.body ?? {};
  if (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'force')) {
    return next(fail({ fields: 'Only force is allowed' }));
  }
  if (body.force !== undefined && typeof body.force !== 'boolean') return next(fail({ force: 'force must be true or false' }));
  req.body = { force: body.force === true };
  next();
}

export function validateProblemListQuery(req, res, next) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
  const errors = {};
  if (!Number.isInteger(page) || page < 1 || page > 10_000) errors.page = 'page must be a positive integer';
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) errors.limit = 'limit must be 1-50';
  if (Object.keys(errors).length) return next(fail(errors));
  req.problemQuery = { page, limit };
  next();
}

export function validateProblemDaysQuery(req, res, next) {
  const from = parseDay(req.query.from);
  const to = parseDay(req.query.to);
  const errors = {};
  if (!from) errors.from = 'from must be YYYY-MM-DD';
  if (!to) errors.to = 'to must be YYYY-MM-DD';
  if (from && to && (to < from || (to - from) / 86_400_000 > MAX_RANGE_DAYS)) errors.range = `Range must be 0-${MAX_RANGE_DAYS} days`;
  if (Object.keys(errors).length) return next(fail(errors));
  req.dayRange = { from, to };
  next();
}
