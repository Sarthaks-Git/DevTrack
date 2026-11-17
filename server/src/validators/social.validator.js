import AppError from '../utils/AppError.js';
import { SOCIAL_PROVIDERS } from '../config/config.js';

const fail = errors => Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });
const TOKENISH = /^[A-Za-z0-9_\-./~]{1,512}$/;
// Providers may add these to the redirect; only code, state and error are used.
const CALLBACK_FIELDS = ['code', 'state', 'error', 'error_description', 'error_uri', 'scope', 'authuser', 'prompt', 'hd', 'iss'];

export function validateProvider(req, res, next) {
  if (!SOCIAL_PROVIDERS.includes(req.params.provider)) return next(new AppError('Unknown sign-in provider', 404, 'PROVIDER_NOT_FOUND'));
  return next();
}

export function validateSocialStart(req, res, next) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  if (Object.keys(body).some(key => key !== 'returnTo')) return next(fail({ fields: 'Only returnTo is allowed' }));
  if (body.returnTo !== undefined && !['app', 'settings'].includes(body.returnTo)) return next(fail({ returnTo: 'returnTo must be app or settings' }));
  req.validatedReturnTo = body.returnTo || 'app';
  return next();
}

// The callback is a browser navigation, so bad input becomes a "failed" redirect, never a JSON error.
export function validateSocialCallback(req, res, next) {
  const { code, state, error } = req.query;
  const valid =
    Object.keys(req.query).every(key => CALLBACK_FIELDS.includes(key)) &&
    Object.values(req.query).every(value => typeof value === 'string' && value.length <= 2048) &&
    (code === undefined || TOKENISH.test(code)) &&
    (state === undefined || /^[A-Za-z0-9_-]{1,128}$/.test(state)) &&
    (error === undefined || /^[a-z_]{1,64}$/.test(error));
  req.socialCallback = valid ? { code, state, error } : null;
  return next();
}

export function validateUnlinkIdentity(req, res, next) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { currentPassword } = body;
  if (Object.keys(body).some(key => key !== 'currentPassword')) return next(fail({ fields: 'Only currentPassword is allowed' }));
  if (currentPassword !== undefined && (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 128)) {
    return next(fail({ currentPassword: 'Current password is invalid' }));
  }
  return next();
}
