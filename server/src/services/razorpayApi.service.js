import config from '../config/config.js';

// The only module that talks to Razorpay (tests mock it). Plain fetch with Basic auth; no SDK.
const API = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 10_000;

// kind: unauthorized | rejected | not_found | rate_limited | unavailable
export class RazorpayApiError extends Error {
  constructor(kind) {
    super(`Razorpay request failed (${kind})`);
    this.name = 'RazorpayApiError';
    this.kind = kind;
  }
}

function kindForStatus(status) {
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 400 && status < 500) return 'rejected';
  return 'unavailable';
}

async function call(method, path, body) {
  const { keyId, keySecret } = config.PAYMENTS;
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new RazorpayApiError('unavailable');
  }
  if (!response.ok) throw new RazorpayApiError(kindForStatus(response.status));
  try {
    return await response.json();
  } catch {
    throw new RazorpayApiError('unavailable');
  }
}

// https://razorpay.com/docs/api/orders/create/
export const createOrder = ({ amount, currency, receipt, notes }) => call('POST', '/orders', { amount, currency, receipt, notes });

// https://razorpay.com/docs/api/payments/fetch-with-id/
export const fetchPayment = paymentId => call('GET', `/payments/${encodeURIComponent(paymentId)}`);

// Only needed when the account has automatic capture turned off.
export const capturePayment = (paymentId, { amount, currency }) =>
  call('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency });
