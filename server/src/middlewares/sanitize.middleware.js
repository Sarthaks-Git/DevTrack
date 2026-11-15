import AppError from '../utils/AppError.js';

const MAX_DEPTH = 10;

// Keys that could become MongoDB operators, dotted paths, or prototype pollution.
function isUnsafeKey(key) {
  return key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype';
}

function findUnsafeKey(value, depth = 0) {
  if (depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) return value.some(item => findUnsafeKey(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.keys(value).some(key => isUnsafeKey(key) || findUnsafeKey(value[key], depth + 1));
  }
  return false;
}

export function rejectUnsafeInput(req, res, next) {
  if (findUnsafeKey(req.body) || findUnsafeKey(req.query) || findUnsafeKey(req.params)) {
    return next(new AppError('Request contains disallowed characters in field names', 400, 'UNSAFE_INPUT'));
  }
  return next();
}
