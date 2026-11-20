import AppError from '../utils/AppError.js';

// { answers: [0-3 | null, ...] }: one entry per question (null = skipped, counts as wrong).
export function validateQuizAttempt(req, res, next) {
  const body = req.body;
  const answers = body && typeof body === 'object' && !Array.isArray(body) ? body.answers : undefined;
  const valid = Object.keys(body || {}).every(key => key === 'answers')
    && Array.isArray(answers) && answers.length >= 3 && answers.length <= 8
    && answers.every(answer => answer === null || (Number.isInteger(answer) && answer >= 0 && answer <= 3));
  if (!valid) {
    const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    error.errors = { answers: 'answers must list 0-3 or null for each question' };
    return next(error);
  }
  req.validatedAnswers = answers;
  return next();
}
