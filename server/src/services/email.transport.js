import config from '../config/config.js';

// The only module that sends email (Brevo transactional API). Tests mock it.
// Never logs recipients, subjects or bodies; errors carry a kind word only.
const API_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10000;

export class EmailTransportError extends Error {
  constructor(kind) {
    super(`Email could not be sent (${kind})`);
    this.name = 'EmailTransportError';
    // misconfigured (bad key or sender) | rejected (bad address) | rate_limited | unavailable
    this.kind = kind;
  }
}

function kindFor(status) {
  if (status === 401 || status === 403) return 'misconfigured';
  if (status === 429) return 'rate_limited';
  if (status >= 400 && status < 500) return 'rejected';
  return 'unavailable';
}

export async function sendEmail({ to, subject, text, html }) {
  if (config.NODE_ENV === 'test') throw new EmailTransportError('unavailable');
  const { apiKey, fromEmail, fromName } = config.EMAIL;
  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { email: fromEmail, name: fromName }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new EmailTransportError('unavailable');
  }
  if (!response.ok) throw new EmailTransportError(kindFor(response.status));
}
