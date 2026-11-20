import AppError from '../utils/AppError.js';

const FIELDS = ['title', 'done', 'dueDate'];
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidDateOnly(value) {
  const match = typeof value === 'string' && DATE_ONLY.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateMilestone(body, { partial }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: { body: 'Request body must be an object' } };

  const errors = {};
  const keys = Object.keys(body);
  if (keys.some(key => !FIELDS.includes(key))) errors.fields = 'Request contains invalid fields';
  if (partial && keys.length === 0) errors.body = 'At least one field is required';
  // A new milestone always starts open; completion goes through an update so it is recorded.
  if (!partial && body.done !== undefined) errors.done = 'New milestones start open';

  const clean = {};
  if (body.title !== undefined || !partial) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) {
      errors.title = 'Title must be 1-120 characters';
    } else clean.title = body.title.trim();
  }
  if (partial && body.done !== undefined) {
    if (typeof body.done !== 'boolean') errors.done = 'Done must be true or false';
    else clean.done = body.done;
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate !== null && !isValidDateOnly(body.dueDate)) errors.dueDate = 'Due date must be YYYY-MM-DD or null';
    else clean.dueDate = body.dueDate === null ? null : new Date(`${body.dueDate}T00:00:00.000Z`);
  }

  return { errors, clean };
}

export const MAX_BULK_MILESTONES = 15;

// { milestones: [{ title, dueDate? }, ...] }: 1 to 15 new, open milestones.
export function validateBulkMilestones(req, res, next) {
  const body = req.body;
  const list = body && typeof body === 'object' && !Array.isArray(body) ? body.milestones : undefined;
  const errors = {};
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'milestones')) errors.fields = 'Request contains invalid fields';
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_BULK_MILESTONES) errors.milestones = `Send 1 to ${MAX_BULK_MILESTONES} milestones`;
  const clean = [];
  if (!Object.keys(errors).length) {
    list.forEach((item, index) => {
      const result = validateMilestone(item, { partial: false });
      if (Object.keys(result.errors).length) errors[`milestones.${index}`] = Object.values(result.errors).join('; ');
      else clean.push(result.clean);
    });
  }
  if (Object.keys(errors).length) {
    const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    error.errors = errors;
    return next(error);
  }
  req.body = { milestones: clean };
  return next();
}

function middleware(partial) {
  return (req, res, next) => {
    const { errors, clean } = validateMilestone(req.body, { partial });
    if (Object.keys(errors).length > 0) {
      const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      error.errors = errors;
      return next(error);
    }
    req.body = clean;
    next();
  };
}

export const validateCreateMilestone = middleware(false);
export const validateUpdateMilestone = middleware(true);
