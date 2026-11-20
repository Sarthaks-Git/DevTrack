import { createHash, timingSafeEqual } from 'node:crypto';
import config, { PROXY_HEADER } from '../config/config.js';

// Reached without the proxy on purpose: uptime pings, and the Razorpay webhook (HMAC-signed).
const OPEN_PATHS = new Set(['/', '/api/health', '/api/billing/webhook']);

const digest = value => createHash('sha256').update(value).digest();

export function cameThroughProxy(req) {
  const sent = req.get(PROXY_HEADER);
  return Boolean(sent && config.PROXY.secret) && timingSafeEqual(digest(sent), digest(config.PROXY.secret));
}

export function requireProxy(req, res, next) {
  if (config.PROXY.mode !== 'enforce') return next();
  const path = req.path.replace(/\/+$/, '') || '/';
  if (OPEN_PATHS.has(path) || cameThroughProxy(req)) return next();
  return res.status(403).json({ message: 'Use the DevTrack website to reach this service.', code: 'DIRECT_ACCESS' });
}
