import crypto from 'crypto';
import AppError from '../utils/AppError.js';
import { CSRF_COOKIE } from '../utils/cookies.js';

export function requireCsrf(req, res, next) {
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken) return next(new AppError('Security token is missing or invalid', 403, 'CSRF_INVALID'));
  const a = Buffer.from(cookieToken); const b = Buffer.from(headerToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return next(new AppError('Security token is missing or invalid', 403, 'CSRF_INVALID'));
  return next();
}
