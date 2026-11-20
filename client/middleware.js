// Vercel Routing Middleware (runs before vercel.json rewrites, no package needed).
// Sends /api requests to the API with a shared secret header, so the API can refuse callers that
// skip this proxy: they could otherwise fake X-Forwarded-For and dodge the per-IP rate limits.
// Without PROXY_SECRET it does nothing and the vercel.json rewrite handles /api as before.
export const config = { matcher: '/api/:path*' };

const API_ORIGIN = 'https://devtrack-api-l46g.onrender.com';
const PROXY_HEADER = 'x-devtrack-proxy';
// Set by the platform for the upstream hop; never copied from the browser's request.
const SKIP = new Set(['host', 'connection', 'content-length', 'transfer-encoding', PROXY_HEADER]);

export default function middleware(request) {
  const secret = process.env.PROXY_SECRET;
  if (!secret) return undefined;

  const url = new URL(request.url);
  const out = new Headers({ 'x-middleware-rewrite': `${API_ORIGIN}${url.pathname}${url.search}` });
  const forwarded = [PROXY_HEADER];
  out.set(`x-middleware-request-${PROXY_HEADER}`, secret);
  for (const [key, value] of request.headers) {
    if (SKIP.has(key) || key.startsWith('x-middleware-')) continue;
    out.set(`x-middleware-request-${key}`, value);
    forwarded.push(key);
  }
  out.set('x-middleware-override-headers', forwarded.join(','));
  return new Response(null, { headers: out });
}
