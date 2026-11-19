import config from '../config/config.js';
import { sendEmail } from './email.transport.js';

// Emails the owner (ALERT_EMAIL) when the server hits an unexpected error. The alert carries only
// what the logs carry: error type, code location and route template, never messages or user data.
// At most one email per window per process; errors in between are counted and reported with the
// next one, so a crash loop cannot flood the inbox or use up the daily email quota.

export const ALERT_WINDOW_MS = 15 * 60 * 1000;

let lastSentAt = 0;
let suppressed = 0;

/** Resets the throttle (tests). */
export function resetErrorAlerts() {
  lastSentAt = 0;
  suppressed = 0;
}

/**
 * Sends an alert if one has not gone out recently. Never throws.
 * kind: short label such as 'request', 'uncaught', 'rejection', 'job'.
 * detail: from describeUnexpectedError (no messages, no personal data).
 */
export async function alertOwner(kind, detail, now = Date.now()) {
  const to = config.EMAIL.alertEmail;
  if (!to || !config.EMAIL.enabled) return 'off';
  if (now - lastSentAt < ALERT_WINDOW_MS) {
    suppressed += 1;
    return 'throttled';
  }
  const since = suppressed;
  lastSentAt = now;
  suppressed = 0;

  const when = new Date(now).toISOString().replace('T', ' ').slice(0, 19);
  const lines = [
    `DevTrack hit an unexpected ${kind} error.`,
    `What: ${detail}`,
    `When: ${when} UTC`,
    since ? `Plus ${since} more error${since === 1 ? '' : 's'} since the last alert.` : '',
    'Check the server logs for details. At most one alert is sent every 15 minutes.',
  ].filter(Boolean);
  try {
    await sendEmail({
      to,
      subject: `DevTrack server error (${kind})`,
      text: lines.join('\n\n'),
      html: lines.map(line => `<p>${line.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))}</p>`).join(''),
    });
    return 'sent';
  } catch {
    return 'failed';
  }
}
