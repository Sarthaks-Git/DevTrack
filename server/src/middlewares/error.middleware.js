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
  if (process.env.NODE_ENV !== 'test') process.stderr.write('Unhandled application error\n');
  return res.status(500).json({ message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' });
}
