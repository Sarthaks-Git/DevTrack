import AppError from '../utils/AppError.js';

const fail = errors => Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });
const body = req => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
const onlyKeys = (object, allowed) => Object.keys(object).every(key => allowed.includes(key));
const isCode = value => typeof value === 'string' && /^\d{6}$/.test(value);
const isRecovery = value => typeof value === 'string' && /^[A-Za-z0-9 -]{10,14}$/.test(value);
const optionalPassword = value => value === undefined || (typeof value === 'string' && value.length >= 1 && value.length <= 128);

// Exactly one of: a 6-digit authenticator code, or a backup code.
function secondFactor(data, errors) {
  const hasCode = data.code !== undefined;
  const hasRecovery = data.recoveryCode !== undefined;
  if (hasCode === hasRecovery) errors.code = 'Enter the 6-digit code or a backup code';
  else if (hasCode && !isCode(data.code)) errors.code = 'The code has 6 digits';
  else if (hasRecovery && !isRecovery(data.recoveryCode)) errors.recoveryCode = 'Backup codes look like abcde-fghjk';
}

export function validateTwoFactorSetup(req, res, next) {
  const data = body(req);
  if (!onlyKeys(data, ['currentPassword']) || !optionalPassword(data.currentPassword)) return next(fail({ currentPassword: 'Current password is invalid' }));
  return next();
}

export function validateTwoFactorEnable(req, res, next) {
  const data = body(req);
  if (!onlyKeys(data, ['code']) || !isCode(data.code)) return next(fail({ code: 'The code has 6 digits' }));
  return next();
}

export function validateTwoFactorRegenerate(req, res, next) {
  return validateTwoFactorEnable(req, res, next);
}

export function validateTwoFactorDisable(req, res, next) {
  const data = body(req);
  const errors = {};
  if (!onlyKeys(data, ['currentPassword', 'code', 'recoveryCode'])) errors.fields = 'Request contains invalid fields';
  if (!optionalPassword(data.currentPassword)) errors.currentPassword = 'Current password is invalid';
  secondFactor(data, errors);
  if (Object.keys(errors).length) return next(fail(errors));
  return next();
}

export function validateTwoFactorVerify(req, res, next) {
  const data = body(req);
  const errors = {};
  if (!onlyKeys(data, ['code', 'recoveryCode'])) errors.fields = 'Request contains invalid fields';
  secondFactor(data, errors);
  if (Object.keys(errors).length) return next(fail(errors));
  return next();
}
