import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/services/email.transport.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, sendEmail: vi.fn() };
});

import express from 'express';
import request from 'supertest';
import config from '../src/config/config.js';
import { sendEmail, EmailTransportError } from '../src/services/email.transport.js';
import { alertOwner, resetErrorAlerts, ALERT_WINDOW_MS } from '../src/services/errorAlert.service.js';
import { errorMiddleware } from '../src/middlewares/error.middleware.js';

const OWNER = 'owner-alerts@devtrack.test';

describe('Error alerts to the owner', () => {
  const originalEmail = config.EMAIL;

  beforeEach(() => {
    config.EMAIL = { ...originalEmail, enabled: true, alertEmail: OWNER };
    resetErrorAlerts();
    sendEmail.mockReset();
    sendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    config.EMAIL = originalEmail;
  });

  it('emails the owner when a request fails unexpectedly, without the error message', async () => {
    const local = express();
    local.get('/boom', () => {
      throw new Error('token abc123 for user bob@example.com');
    });
    local.use(errorMiddleware);

    expect((await request(local).get('/boom')).status).toBe(500);
    await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledTimes(1));
    const [mail] = sendEmail.mock.calls[0];
    expect(mail.to).toBe(OWNER);
    expect(mail.subject).toBe('DevTrack server error (request)');
    expect(mail.text).toMatch(/What: Error at \S+ \(GET \/boom\)/);
    expect(`${mail.text}${mail.html}`).not.toMatch(/abc123|bob@example\.com/);
  });

  it('does not alert for expected errors such as bad input', async () => {
    const local = express();
    local.use(express.json());
    local.post('/in', (req, res) => res.json({ ok: true }));
    local.use(errorMiddleware);
    await request(local).post('/in').set('Content-Type', 'application/json').send('{"broken":');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends at most one alert per window and reports how many were held back', async () => {
    const start = Date.now();
    expect(await alertOwner('request', 'TypeError at src/a.js:1 (GET /x)', start)).toBe('sent');
    expect(await alertOwner('request', 'TypeError at src/a.js:1 (GET /x)', start + 1000)).toBe('throttled');
    expect(await alertOwner('job', 'Error at src/b.js:2 (no request)', start + 2000)).toBe('throttled');
    expect(sendEmail).toHaveBeenCalledTimes(1);

    expect(await alertOwner('request', 'RangeError at src/c.js:3 (GET /y)', start + ALERT_WINDOW_MS + 1)).toBe('sent');
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[1][0].text).toContain('Plus 2 more errors since the last alert.');
  });

  it('is off without ALERT_EMAIL and never throws when sending fails', async () => {
    config.EMAIL = { ...originalEmail, enabled: true, alertEmail: null };
    expect(await alertOwner('request', 'x')).toBe('off');
    expect(sendEmail).not.toHaveBeenCalled();

    config.EMAIL = { ...originalEmail, enabled: true, alertEmail: OWNER };
    sendEmail.mockRejectedValue(new EmailTransportError('unavailable'));
    expect(await alertOwner('request', 'x')).toBe('failed');
  });
});
