import AppError from '../utils/AppError.js';

const fail = errors => Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });
const plainObject = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);
const onlyKeys = (object, allowed) => Object.keys(object).every(key => allowed.includes(key));

// The server only ever sends to the big browser push services. This stops a subscription from
// pointing the server at an internal or attacker-chosen address (SSRF).
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/, /^[a-z0-9.-]+\.push\.apple\.com$/];

export function isAllowedPushEndpoint(value) {
  if (typeof value !== 'string' || value.length > 1000) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && !url.port && !url.username && !url.password && PUSH_HOSTS.some(host => host.test(url.hostname));
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

// The JSON form of a browser PushSubscription: { endpoint, expirationTime, keys: { p256dh, auth } }.
export function validatePushSubscription(req, res, next) {
  const body = plainObject(req.body);
  const keys = plainObject(body?.keys);
  const errors = {};
  if (!body || !onlyKeys(body, ['endpoint', 'expirationTime', 'keys'])) errors.fields = 'Body contains invalid fields';
  if (!isAllowedPushEndpoint(body?.endpoint)) errors.endpoint = 'Unsupported push service';
  if (body?.expirationTime !== undefined && body.expirationTime !== null && !Number.isFinite(body.expirationTime)) errors.expirationTime = 'Invalid expiration time';
  // p256dh: an uncompressed P-256 point (65 bytes, 87 base64url chars); auth: 16 bytes (22 chars).
  if (!keys || !onlyKeys(keys, ['p256dh', 'auth'])
    || typeof keys.p256dh !== 'string' || !BASE64URL.test(keys.p256dh) || keys.p256dh.replace(/=+$/, '').length !== 87
    || typeof keys.auth !== 'string' || !BASE64URL.test(keys.auth) || keys.auth.replace(/=+$/, '').length !== 22) {
    errors.keys = 'Invalid subscription keys';
  }
  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedSubscription = { endpoint: body.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
  return next();
}

export function validatePushEndpoint(req, res, next) {
  const body = plainObject(req.body);
  if (!body || !onlyKeys(body, ['endpoint']) || typeof body.endpoint !== 'string' || body.endpoint.length > 1000) {
    return next(fail({ endpoint: 'Invalid endpoint' }));
  }
  req.validatedEndpoint = body.endpoint;
  return next();
}
