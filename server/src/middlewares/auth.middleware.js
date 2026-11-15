import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { getActiveSession } from '../services/auth.service.js';

const unauthenticated = () => new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
const JWT_ERRORS = new Set(['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError']);

export async function authMiddleware(req, res, next) {
  try {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (typeof token !== 'string' || !token) throw unauthenticated();

    const payload = verifyAccessToken(token);
    const { sub, sid } = payload || {};
    if (!mongoose.isValidObjectId(sub) || !mongoose.isValidObjectId(sid)) throw unauthenticated();

    const active = await getActiveSession(sid, sub);
    if (!active?.owner || active.owner.accountStatus !== 'active') throw unauthenticated();

    const role = active.owner.role || 'user';
    req.user = { id: sub, role };
    req.auth = { userId: sub, sessionId: sid, role };
    return next();
  } catch (error) {
    if (error instanceof AppError || JWT_ERRORS.has(error?.name)) return next(unauthenticated());
    return next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => req.auth && roles.includes(req.auth.role)
    ? next()
    : next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
}
