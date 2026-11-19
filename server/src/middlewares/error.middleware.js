// The only place errors become HTTP responses. Clients only ever see messages written in this
// codebase: AppError messages, or the fixed texts below. Error messages from libraries, the
// database or other services can contain internals or personal data, so they are never sent,
// and they are never logged either.

import { alertOwner } from '../services/errorAlert.service.js';

// Generic texts for client errors raised by Express or body parsing (http-errors with expose).
const CLIENT_ERROR_TEXT = {
  400: 'Bad request',
  404: 'Route not found',
  405: 'Method not allowed',
  411: 'Content length is required',
  413: 'Request body is too large',
  415: 'Unsupported request body encoding',
};

// Where an unexpected error came from, without its message: the error type, a short code and
// the first stack frame inside src/ (file and line only).
export function describeUnexpectedError(err, req) {
  const name = typeof err?.name === 'string' ? err.name.slice(0, 60) : 'Error';
  const code = typeof err?.code === 'string' || typeof err?.code === 'number' ? ` ${String(err.code).slice(0, 40)}` : '';
  const frame = String(err?.stack || '')
    .split('\n')
    .slice(1)
    .map(line => line.match(/[\\/](src[\\/][^:)]+:\d+)/)?.[1])
    .find(Boolean);
  // The route template (e.g. /api/goals/:id), never the URL itself, which can carry ids or tokens.
  const route = req ? `${req.method} ${req.baseUrl || ''}${req.route?.path || ''}` : 'no request';
  return `${name}${code} at ${frame ? frame.replaceAll('\\', '/') : 'unknown'} (${route})`;
}

export function errorMiddleware(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && err?.status === 400)) return res.status(400).json({ message: 'Invalid JSON request body', code: 'INVALID_JSON' });
  if (err?.type === 'entity.too.large' || err?.status === 413) return res.status(413).json({ message: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE' });
  if (err?.name === 'ValidationError') return res.status(400).json({ message: 'Request validation failed', code: 'VALIDATION_ERROR' });
  if (err?.name === 'StrictModeError') return res.status(400).json({ message: 'Request contains invalid fields', code: 'VALIDATION_ERROR' });
  if (err?.name === 'CastError') return res.status(400).json({ message: 'Invalid resource identifier', code: 'INVALID_ID' });
  if (err?.code === 11000) return res.status(409).json({ message: 'A record with these details already exists', code: 'DUPLICATE_RESOURCE' });
  if (err?.isOperational) {
    const body = { message: err.message, code: err.code || 'REQUEST_ERROR' };
    if (err.errors && typeof err.errors === 'object') body.errors = err.errors;
    return res.status(err.statusCode || 500).json(body);
  }
  // Client errors from Express and body parsing (bad encoding, aborted body): their status is
  // meaningful, their message is not ours, so send a fixed text.
  const status = Number(err?.status ?? err?.statusCode);
  if (err?.expose === true && Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ message: CLIENT_ERROR_TEXT[status] || 'Bad request', code: 'BAD_REQUEST' });
  }
  const detail = describeUnexpectedError(err, req);
  if (process.env.NODE_ENV !== 'test') process.stderr.write(`Unhandled application error: ${detail}\n`);
  alertOwner('request', detail);
  return res.status(500).json({ message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' });
}
