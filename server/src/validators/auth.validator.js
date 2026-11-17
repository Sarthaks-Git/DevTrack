import AppError from '../utils/AppError.js';
import { passwordProblem } from './account.validator.js';

export function validateRegister(req, res, next) {
    const { username, email, password } = req.body ?? {};

    const errors = {};

    // Validate username
    if (typeof username !== 'string') {
        errors.username = 'Username must be a string';
    } else if (
        username.length < 3 ||
        username.length > 30
    ) {
        errors.username = 'Username must be 3–30 characters';
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username)) {
        errors.username =
            'Username must start with a letter and contain only letters, numbers, or underscores';
    }

    // Validate email
    if (typeof email !== 'string') {
        errors.email = 'Email must be a string';
    } else if (
        email !== email.trim() ||
        /\s/.test(email)
    ) {
        errors.email = 'Email must not contain whitespace';
    } else if (
        !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
    ) {
        errors.email = 'Please provide a valid email address';
    }

    // Validate password (shared rules: length, 72-byte bcrypt limit, no username/email)
    const problem = passwordProblem(password, {
        username: typeof username === 'string' ? username : undefined,
        email: typeof email === 'string' ? email : undefined,
    });

    if (problem) {
        errors.password = problem;
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        });
    }

    // Normalize email after successful validation
    req.body.email = email.toLowerCase();

    next();
}

export function validateLogin(req, res, next) {
    const { email, password } = req.body ?? {};

    const errors = {};

    if (typeof email !== 'string' ||
        email !== email.trim() ||
        /\s/.test(email) ||
        !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        errors.email = 'Please provide a valid email address';
    }

    if (typeof password !== 'string' ||
        password.length < 1 ||
        password.length > 128) {
        errors.password = 'Invalid password';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors
        });
    }

    req.body.email = email.toLowerCase();

    next();
}
// The 6-digit code from the verification email.
export function validateEmailCode(req, res, next) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  if (Object.keys(body).some(key => key !== 'code') || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) {
    return next(Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors: { code: 'The code has 6 digits' } }));
  }
  return next();
}

const EMAIL_SHAPE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const plainBody = body => (body && typeof body === 'object' && !Array.isArray(body) ? body : {});
const validEmail = email => typeof email === 'string' && email.length <= 254 && email === email.trim() && EMAIL_SHAPE.test(email);
const validationFailed = errors => Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });

// Forgot password: { email } only.
export function validatePasswordForgot(req, res, next) {
  const body = plainBody(req.body);
  if (Object.keys(body).some(key => key !== 'email') || !validEmail(body.email)) {
    return next(validationFailed({ email: 'Please provide a valid email address' }));
  }
  req.body = { email: body.email.toLowerCase() };
  return next();
}

// Reset password: { email, code, newPassword }. Username/email rules are checked once the code is right.
export function validatePasswordReset(req, res, next) {
  const body = plainBody(req.body);
  const errors = {};
  if (Object.keys(body).some(key => !['email', 'code', 'newPassword'].includes(key))) errors.fields = 'Request contains invalid fields';
  if (!validEmail(body.email)) errors.email = 'Please provide a valid email address';
  if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) errors.code = 'The code has 6 digits';
  const problem = passwordProblem(body.newPassword);
  if (problem) errors.newPassword = problem;
  if (Object.keys(errors).length) return next(validationFailed(errors));
  req.body = { email: body.email.toLowerCase(), code: body.code, newPassword: body.newPassword };
  return next();
}
