import AppError from '../utils/AppError.js';
import { parseViewerDay } from '../utils/viewerDay.js';

const fail = errors => Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });
const ALLOWED = ['today', 'tz', 'week'];
// Real UTC offsets run from -12:00 to +14:00.
const TZ_MIN = -720;
const TZ_MAX = 840;

export function validateWeeklyReviewQuery(req, res, next) {
  const { today, tz, week = 'current' } = req.query;
  const errors = {};
  if (Object.keys(req.query).some(key => !ALLOWED.includes(key))) errors.fields = 'Query contains invalid fields';

  const day = parseViewerDay(today);
  if (!day) errors.today = 'today must be the current date as YYYY-MM-DD';

  let tzOffset = 0;
  if (tz !== undefined) {
    tzOffset = typeof tz === 'string' && /^-?\d{1,3}$/.test(tz) ? Number(tz) : NaN;
    if (!Number.isInteger(tzOffset) || tzOffset < TZ_MIN || tzOffset > TZ_MAX) errors.tz = `tz must be minutes east of UTC (${TZ_MIN} to ${TZ_MAX})`;
  }

  if (!['current', 'last'].includes(week)) errors.week = 'week must be current or last';

  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedQuery = { today: day, tzOffset, week };
  return next();
}
