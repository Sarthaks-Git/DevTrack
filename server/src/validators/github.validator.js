import AppError from '../utils/AppError.js';

const fail = errors => Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });
const TOKENISH = /^[A-Za-z0-9_-]{1,128}$/;
// GitHub may append these when the app asks for authorization during installation; they are ignored.
// `iss` is the RFC 9207 issuer GitHub adds to the redirect; when present it must be GitHub's.
const CALLBACK_FIELDS = ['code', 'state', 'error', 'error_description', 'error_uri', 'installation_id', 'setup_action', 'iss'];
const GITHUB_ISSUER = 'https://github.com/login/oauth';

// The callback is a browser navigation, so bad input becomes a "failed" redirect, never a JSON error.
export function validateGitHubCallback(req, res, next) {
  const { code, state, error, iss } = req.query;
  const valid =
    Object.keys(req.query).every(key => CALLBACK_FIELDS.includes(key)) &&
    Object.values(req.query).every(value => typeof value === 'string' && value.length <= 512) &&
    (code === undefined || TOKENISH.test(code)) &&
    (state === undefined || TOKENISH.test(state)) &&
    (error === undefined || /^[a-z_]{1,64}$/.test(error)) &&
    (iss === undefined || iss === GITHUB_ISSUER);

  req.githubCallback = valid ? { code, state, error } : null;
  return next();
}

export function validateLinkRepository(req, res, next) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
  const errors = {};
  if (!body || Object.keys(body).some(key => key !== 'repoId')) errors.fields = 'Only repoId is allowed';
  if (!Number.isSafeInteger(body?.repoId) || body.repoId < 1) errors.repoId = 'repoId must be a positive integer';
  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedRepoId = body.repoId;
  return next();
}

export function validateSyncRequest(req, res, next) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const errors = {};
  if (Object.keys(body).some(key => key !== 'manual')) errors.fields = 'Only manual is allowed';
  if (body.manual !== undefined && typeof body.manual !== 'boolean') errors.manual = 'manual must be true or false';
  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedSync = { manual: body.manual === true };
  return next();
}
