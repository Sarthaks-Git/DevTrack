import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import config, { PROXY_HEADER } from '../config/config.js';

// Reached without the proxy on purpose: uptime pings, and the Razorpay webhook (HMAC-signed).
const OPEN_PATHS = new Set(['/', '/api/health', '/api/billing/webhook']);

const digest = value => createHash('sha256').update(value).digest();

export function cameThroughProxy(req) {
  const sent = req.get(PROXY_HEADER);
  return Boolean(sent && config.PROXY.secret) && timingSafeEqual(digest(sent), digest(config.PROXY.secret));
}

// Set by the Vercel middleware from the connection. Behind the rewrite, X-Forwarded-For ends in
// Vercel's own rotating addresses, so per-IP rate limits key on this instead, but only when the
// request also carries the secret (anyone else could send the header).
export const CLIENT_IP_HEADER = 'x-devtrack-client-ip';

function useProxiedClientIp(req) {
  const ip = (req.get(CLIENT_IP_HEADER) || '').trim();
  if (isIP(ip)) Object.defineProperty(req, 'ip', { value: ip, configurable: true, enumerable: true });
}

export function requireProxy(req, res, next) {
  if (config.PROXY.mode === 'off') return next();
  const proxied = cameThroughProxy(req);
  if (proxied) useProxiedClientIp(req);
  if (config.PROXY.mode !== 'enforce') return next();
  const path = req.path.replace(/\/+$/, '') || '/';
  if (OPEN_PATHS.has(path) || proxied) return next();
  return res.status(403).json({ message: 'Use the DevTrack website to reach this service.', code: 'DIRECT_ACCESS' });
}
