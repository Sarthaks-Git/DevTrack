import AppError from '../utils/AppError.js';
import { parseViewerDay } from '../utils/viewerDay.js';

function fail(errors) {
  return Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });
}

// Shared by read-only views that only accept the viewer's `today`.
export function validateTodayQuery(req, res, next) {
  if (Object.keys(req.query).some(key => key !== 'today')) return next(fail({ fields: 'Query contains invalid fields' }));
  const today = parseViewerDay(req.query.today);
  if (!today) return next(fail({ today: 'today must be the current date as YYYY-MM-DD' }));
  req.validatedQuery = { today };
  return next();
}
