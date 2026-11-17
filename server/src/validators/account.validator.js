import AppError from '../utils/AppError.js';

export const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;
export const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// bcrypt only uses the first 72 bytes, so longer passwords would silently lose entropy.
export const PASSWORD_MAX_BYTES = 72;

export function passwordProblem(password, { username, email } = {}) {
  if (typeof password !== 'string') return 'Password must be a string';
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return 'Password must be at most 72 bytes';
  if (password !== password.trim()) return 'Password must not start or end with whitespace';
  const lower = password.toLowerCase();
  if (username && lower.includes(username.toLowerCase())) return 'Password must not contain your username';
  if (email && lower.includes(email.split('@')[0].toLowerCase())) return 'Password must not contain your email name';
  return null;
}

function validationError(errors) {
  const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  error.errors = errors;
  return error;
}

// Optional at the boundary: accounts created through Google, GitHub or LinkedIn have no password and
// confirm by a recent sign-in instead. The account service requires it whenever the account has one.
const optionalPassword = value => value === undefined || (typeof value === 'string' && value.length >= 1 && value.length <= 128);

function onlyFields(body, allowed) {
  return Object.keys(body).every(key => allowed.includes(key));
}

export function validateProfileUpdate(req, res, next) {
  const body = req.body ?? {};
  const { username, email, currentPassword } = body;
  const errors = {};

  if (!onlyFields(body, ['username', 'email', 'currentPassword'])) errors.fields = 'Request contains invalid fields';
  if (username === undefined && email === undefined) errors.body = 'Provide a username or email to update';
  if (username !== undefined && (typeof username !== 'string' || username.length < 3 || username.length > 30 || !USERNAME_PATTERN.test(username))) {
    errors.username = 'Username must be 3-30 characters, start with a letter, and use only letters, numbers, or underscores';
  }
  if (email !== undefined && (typeof email !== 'string' || email.length > 254 || !EMAIL_PATTERN.test(email))) {
    errors.email = 'Please provide a valid email address';
  }
  if (!optionalPassword(currentPassword)) errors.currentPassword = 'Current password is invalid';

  if (Object.keys(errors).length) return next(validationError(errors));
  if (typeof username === 'string') req.body.username = username.toLowerCase();
  if (typeof email === 'string') req.body.email = email.toLowerCase();
  return next();
}

export function validatePasswordChange(req, res, next) {
  const body = req.body ?? {};
  const { currentPassword, newPassword } = body;
  const errors = {};

  if (!onlyFields(body, ['currentPassword', 'newPassword'])) errors.fields = 'Request contains invalid fields';
  if (!optionalPassword(currentPassword)) errors.currentPassword = 'Current password is invalid';
  const problem = passwordProblem(newPassword);
  if (problem) errors.newPassword = problem;
  else if (newPassword === currentPassword) errors.newPassword = 'New password must be different from the current password';

  if (Object.keys(errors).length) return next(validationError(errors));
  return next();
}

export function validateAccountDeletion(req, res, next) {
  const body = req.body ?? {};
  const { currentPassword, confirmation } = body;
  const errors = {};

  if (!onlyFields(body, ['currentPassword', 'confirmation'])) errors.fields = 'Request contains invalid fields';
  if (!optionalPassword(currentPassword)) errors.currentPassword = 'Current password is invalid';
  if (confirmation !== 'DELETE') errors.confirmation = 'Type DELETE to confirm';

  if (Object.keys(errors).length) return next(validationError(errors));
  return next();
}
