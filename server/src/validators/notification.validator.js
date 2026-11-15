import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';
import { parseViewerDay } from '../utils/viewerDay.js';
import { NOTIFICATION_PAGE_MAX } from '../services/notification.service.js';

const fail = errors => Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });
const onlyKeys = (object, allowed) => Object.keys(object).every(key => allowed.includes(key));

export function validateNotificationList(req, res, next) {
  const { limit, before, today } = req.query;
  const errors = {};
  if (!onlyKeys(req.query, ['limit', 'before', 'today'])) errors.fields = 'Query contains invalid fields';

  const size = limit === undefined ? 20 : Number(limit);
  if (!Number.isInteger(size) || size < 1 || size > NOTIFICATION_PAGE_MAX) errors.limit = `limit must be 1-${NOTIFICATION_PAGE_MAX}`;
  if (before !== undefined && (typeof before !== 'string' || !mongoose.isValidObjectId(before))) errors.before = 'Invalid cursor';
  const day = parseViewerDay(today);
  if (!day) errors.today = 'today must be the current date as YYYY-MM-DD';

  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedQuery = { limit: size, before, today: day };
  return next();
}

export function validateTodayOnly(req, res, next) {
  if (!onlyKeys(req.query, ['today'])) return next(fail({ fields: 'Query contains invalid fields' }));
  const day = parseViewerDay(req.query.today);
  if (!day) return next(fail({ today: 'today must be the current date as YYYY-MM-DD' }));
  req.validatedQuery = { today: day };
  return next();
}

export function validateReminderSettings(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return next(fail({ body: 'Request body must be an object' }));
  const errors = {};
  const keys = Object.keys(body);
  if (keys.length === 0) errors.body = 'At least one field is required';
  if (!onlyKeys(body, ['enabled', 'stalledAfterDays', 'deadlineAlerts'])) errors.fields = 'Request contains invalid fields';
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') errors.enabled = 'enabled must be true or false';
  if (body.deadlineAlerts !== undefined && typeof body.deadlineAlerts !== 'boolean') errors.deadlineAlerts = 'deadlineAlerts must be true or false';
  if (body.stalledAfterDays !== undefined && (!Number.isInteger(body.stalledAfterDays) || body.stalledAfterDays < 3 || body.stalledAfterDays > 60)) {
    errors.stalledAfterDays = 'stalledAfterDays must be a whole number from 3 to 60';
  }
  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedBody = Object.fromEntries(keys.map(key => [key, body[key]]));
  return next();
}
