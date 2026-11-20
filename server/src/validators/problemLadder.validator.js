import AppError from '../utils/AppError.js';
import { PATTERN_TAG } from '../utils/leetcodePatterns.js';

// { pattern: "<a DevTrack pattern label that maps to a LeetCode tag>" }
export function validateCreateLadder(req, res, next) {
  const body = req.body;
  const pattern = body && typeof body === 'object' && !Array.isArray(body) ? body.pattern : undefined;
  if (Object.keys(body || {}).some(key => key !== 'pattern') || typeof pattern !== 'string' || !Object.hasOwn(PATTERN_TAG, pattern)) {
    const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    error.errors = { pattern: 'pattern must be one of the tracked patterns' };
    return next(error);
  }
  req.validatedPattern = pattern;
  return next();
}
