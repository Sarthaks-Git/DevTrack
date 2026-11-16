// Default machine-readable codes by status, so a 4xx without an explicit code never claims to be INTERNAL_ERROR.
const DEFAULT_CODES = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  502: 'PROVIDER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

class AppError extends Error {
  constructor(message, statusCode = 500, code = DEFAULT_CODES[statusCode] || 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}
export default AppError;
