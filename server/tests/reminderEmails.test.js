import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

vi.mock('../src/services/email.transport.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, sendEmail: vi.fn() };
});

import config from '../src/config/config.js';
import Goal from '../src/models/Goal.js';
import User from '../src/models/User.js';
import Notification from '../src/models/Notification.js';
import { sendEmail, EmailTransportError } from '../src/services/email.transport.js';
import { runReminderEmails, indiaDay, SEND_HOUR_IST } from '../src/services/reminderEmail.service.js';
import { createSession } from './helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// 09:30 in India (04:00 UTC) on the real current day, so reminder rules see real dates.
const morning = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0));
};
const dayKey = offset => new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);
const digestsTo = email => sendEmail.mock.calls.filter(([mail]) => mail.to === email && /reminder/i.test(mail.subject));

describe('Daily reminder emails', () => {
  const originalEmail = config.EMAIL;
  let ann;

  beforeAll(async () => {
    config.EMAIL = { ...originalEmail, enabled: true };
    ann = await createSession('re_ann');
  });

  afterAll(() => {
    config.EMAIL = originalEmail;
  });

  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue(undefined);
  });

  // Only the accounts a test names are processed, so other test files' users are never touched.
  const run = (ids, now = morning()) => runReminderEmails({ now, onlyUserIds: ids });
  const reset = id => User.updateOne({ _id: id }, { $set: { reminderDigestDay: null, remindersCheckedAt: null } });

  it('emails one digest with new reminders, marks them sent, and sends nothing more that day', async () => {
    await ann.post('/api/goals').send({ title: 'Ship <portfolio> & blog', deadline: dayKey(-2) });

    const first = await run([ann.userId]);
    expect(first.sent).toBe(1);
    const mails = digestsTo(ann.user.email);
    expect(mails).toHaveLength(1);
    const [mail] = mails[0];
    expect(mail.text).toContain('Goal overdue: Ship <portfolio> & blog');
    expect(mail.html).toContain('Ship &lt;portfolio&gt; &amp; blog');
    expect(mail.html).not.toContain('<portfolio>');
    expect(mail.text).toContain(`${config.CLIENT_ORIGIN}/app/notifications`);
    expect(mail.text).toContain(`${config.CLIENT_ORIGIN}/app/settings#reminders`);
    expect(await Notification.countDocuments({ owner: ann.userId, emailedAt: null, type: 'goal_overdue' })).toBe(0);

    const again = await run([ann.userId]);
    expect(again.sent).toBe(0);
    expect(digestsTo(ann.user.email)).toHaveLength(1);
  });

  it('does not email the same reminder again the next day', async () => {
    await reset(ann.userId);
    const result = await run([ann.userId], new Date(morning().getTime() + DAY_MS));
    expect(result.sent).toBe(0);
    expect(digestsTo(ann.user.email)).toHaveLength(0);
  });

  it('waits until the morning send hour in India', async () => {
    const bob = await createSession('re_bob');
    await bob.post('/api/goals').send({ title: 'Early bird', deadline: dayKey(-1) });
    // 07:00 in India, an hour before the send hour.
    const beforeHour = new Date(morning().getTime() - (9.5 - (SEND_HOUR_IST - 1)) * 60 * 60_000);
    expect(Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(beforeHour))).toBeLessThan(SEND_HOUR_IST);

    const early = await run([bob.userId], beforeHour);
    expect(early.skipped).toBe('before_send_hour');
    expect(digestsTo(bob.user.email)).toHaveLength(0);

    expect((await run([bob.userId])).sent).toBe(1);
  });

  it('respects the email switch, reminders being off, and unverified accounts', async () => {
    const off = await createSession('re_off');
    const paused = await createSession('re_paused');
    const unverified = await createSession('re_unverified', { verified: false });
    for (const session of [off, paused]) await session.post('/api/goals').send({ title: 'Late', deadline: dayKey(-3) });
    await Goal.create({ owner: unverified.userId, title: 'Late too', deadline: new Date(Date.now() - 3 * DAY_MS) });

    expect((await off.patch('/api/notifications/settings').send({ email: false })).status).toBe(200);
    expect((await paused.patch('/api/notifications/settings').send({ enabled: false })).status).toBe(200);

    const result = await run([off.userId, paused.userId, unverified.userId]);
    expect(result.sent).toBe(0);
    for (const session of [off, paused, unverified]) expect(digestsTo(session.user.email)).toHaveLength(0);
  });

  it('sends nothing when there is nothing new', async () => {
    const quiet = await createSession('re_quiet');
    expect((await run([quiet.userId])).sent).toBe(0);
    expect(digestsTo(quiet.user.email)).toHaveLength(0);
  });

  it('keeps reminders unsent when the email fails, so the next day can include them', async () => {
    const flaky = await createSession('re_flaky');
    await flaky.post('/api/goals').send({ title: 'Retry me', deadline: dayKey(-1) });
    sendEmail.mockRejectedValue(new EmailTransportError('unavailable'));

    const result = await run([flaky.userId]);
    expect(result.failed).toBe(1);
    expect(await Notification.countDocuments({ owner: flaky.userId, emailedAt: null, type: 'goal_overdue' })).toBe(1);
  });

  it('does nothing when email is not configured', async () => {
    config.EMAIL = { ...originalEmail, enabled: false };
    try {
      expect((await run([ann.userId])).skipped).toBe('email_disabled');
    } finally {
      config.EMAIL = { ...originalEmail, enabled: true };
    }
  });

  it('accepts only a true/false email setting', async () => {
    expect((await ann.patch('/api/notifications/settings').send({ email: 'yes' })).status).toBe(400);
    const ok = await ann.patch('/api/notifications/settings').send({ email: true });
    expect(ok.status).toBe(200);
    expect(ok.body.data.email).toBe(true);
  });

  it('works out the calendar day in India', () => {
    expect(indiaDay(new Date('2026-11-19T19:00:00Z'))).toBe('2026-11-20');
    expect(indiaDay(new Date('2026-11-19T18:00:00Z'))).toBe('2026-11-19');
  });
});
