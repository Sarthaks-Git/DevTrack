import AppError from '../utils/AppError.js';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// `today` is the viewer's local calendar day (YYYY-MM-DD) so "overdue" matches what they see.
// Only one day either side of the server's UTC day is accepted: every real timezone fits in that.
export function validateAttentionQuery(req, res, next) {
  const keys = Object.keys(req.query);
  if (keys.some(key => key !== 'today')) {
    return next(Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors: { fields: 'Query contains invalid fields' } }));
  }

  const serverDay = utcDay(new Date());
  let today = serverDay;

  if (req.query.today !== undefined) {
    const match = typeof req.query.today === 'string' && DATE_ONLY.exec(req.query.today);
    const [year, month, day] = match ? match.slice(1).map(Number) : [];
    const candidate = match ? Date.UTC(year, month - 1, day) : NaN;
    const real = match && new Date(candidate).getUTCDate() === day && new Date(candidate).getUTCMonth() === month - 1;

    if (!real || Math.abs(candidate - serverDay) > DAY_MS) {
      return next(Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors: { today: 'today must be the current date as YYYY-MM-DD' } }));
    }
    today = candidate;
  }

  req.validatedQuery = { today: new Date(today) };
  return next();
}
