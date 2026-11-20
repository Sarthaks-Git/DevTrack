import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';

vi.mock('../src/services/razorpayApi.service.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, createOrder: vi.fn(), fetchPayment: vi.fn(), capturePayment: vi.fn() };
});

import app from '../src/app.js';
import config, { PRO_PASSES } from '../src/config/config.js';
import * as razorpay from '../src/services/razorpayApi.service.js';
import Payment from '../src/models/Payment.js';
import User from '../src/models/User.js';
import { createSession } from './helpers.js';

const BASE = '/api/billing';
const DAY = 24 * 60 * 60 * 1000;
const rid = prefix => `${prefix}_${crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, 'x')}`;
const sign = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');

// Razorpay creates an order for whatever it is asked; the mock echoes it back with a fresh id.
function mockOrder() {
  razorpay.createOrder.mockImplementation(async ({ amount, currency }) => ({ id: rid('order'), amount, currency, status: 'created' }));
}

async function buy(session, pass = 'month') {
  const order = await session.post(`${BASE}/orders`).send({ pass });
  expect(order.status).toBe(201);
  const { orderId, amount, currency } = order.body.data;
  const paymentId = rid('pay');
  return { orderId, amount, currency, paymentId, signature: sign(config.PAYMENTS.keySecret, `${orderId}|${paymentId}`) };
}

const captured = ({ orderId, amount, currency, paymentId }, overrides = {}) => ({ id: paymentId, order_id: orderId, amount, currency, status: 'captured', ...overrides });
const verify = (session, { orderId, paymentId, signature }) => session.post(`${BASE}/verify`).send({ orderId, paymentId, signature });

function webhook(event, secret = config.PAYMENTS.webhookSecret) {
  const body = JSON.stringify(event);
  return request(app).post(`${BASE}/webhook`).set('Content-Type', 'application/json').set('X-Razorpay-Signature', sign(secret, body)).send(body);
}

const planOf = async userId => (await User.findById(userId).select('plan').lean()).plan;
const daysLeft = until => Math.round((new Date(until).getTime() - Date.now()) / DAY);

beforeEach(() => {
  vi.clearAllMocks();
  mockOrder();
});

describe('Billing: plan and orders', () => {
  it('requires sign-in and CSRF, and shows prices without any secret', async () => {
    expect((await request(app).get(BASE)).status).toBe(401);
    const s = await createSession('bill_view');
    const res = await s.get(BASE);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ available: true, mode: 'test', keyId: config.PAYMENTS.keyId, canBuy: true, plan: { tier: 'free' }, refundWindowDays: 7, payments: [] });
    expect(res.body.data.passes.map(p => [p.id, p.amount, p.days])).toEqual([['month', 29900, 30], ['year', 299900, 365]]);
    expect(JSON.stringify(res.body)).not.toContain(config.PAYMENTS.keySecret);
    expect(JSON.stringify(res.body)).not.toContain(config.PAYMENTS.webhookSecret);

    const noCsrf = await request(app).post(`${BASE}/orders`).set('Cookie', s.cookie()).send({ pass: 'month' });
    expect(noCsrf.status).toBe(403);
    expect(razorpay.createOrder).not.toHaveBeenCalled();
  });

  it('charges the server price only and never sends who the user is', async () => {
    const s = await createSession('bill_price');
    expect((await s.post(`${BASE}/orders`).send({ pass: 'month', amount: 100 })).status).toBe(400);
    expect((await s.post(`${BASE}/orders`).send({ pass: 'lifetime' })).status).toBe(400);
    expect(razorpay.createOrder).not.toHaveBeenCalled();

    const res = await s.post(`${BASE}/orders`).send({ pass: 'year' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ amount: 299900, currency: 'INR', pass: 'year', keyId: config.PAYMENTS.keyId });
    const sent = razorpay.createOrder.mock.calls[0][0];
    expect(sent).toMatchObject({ amount: 299900, currency: 'INR' });
    expect(JSON.stringify(sent)).not.toMatch(new RegExp(`${s.userId}|${s.user.email}|${s.user.username}`));

    // Clicking again reuses the open order instead of creating another.
    const again = await s.post(`${BASE}/orders`).send({ pass: 'year' });
    expect(again.body.data.orderId).toBe(res.body.data.orderId);
    expect(razorpay.createOrder).toHaveBeenCalledTimes(1);
  });

  it('reports Razorpay being down without creating an order row', async () => {
    const s = await createSession('bill_down');
    razorpay.createOrder.mockRejectedValueOnce(new razorpay.RazorpayApiError('unavailable'));
    const res = await s.post(`${BASE}/orders`).send({ pass: 'month' });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
    // An answer that does not match the request is treated the same way.
    razorpay.createOrder.mockResolvedValueOnce({ id: rid('order'), amount: 100, currency: 'INR' });
    expect((await s.post(`${BASE}/orders`).send({ pass: 'month' })).status).toBe(502);
    expect(await Payment.countDocuments({ owner: s.userId })).toBe(0);
  });

  it('refuses to sell to a Pro plan with no end date', async () => {
    const s = await createSession('bill_lifetime');
    await User.updateOne({ _id: s.userId }, { $set: { plan: { tier: 'pro', source: 'admin', since: new Date(), until: null } } });
    expect((await s.get(BASE)).body.data.canBuy).toBe(false);
    const res = await s.post(`${BASE}/orders`).send({ pass: 'month' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PLAN_HAS_NO_END');
  });

  it('answers 503 when payments are not set up', async () => {
    const s = await createSession('bill_off');
    const saved = config.PAYMENTS;
    config.PAYMENTS = { enabled: false };
    try {
      expect((await s.get(BASE)).body.data).toMatchObject({ available: false, keyId: null, canBuy: false });
      expect((await s.post(`${BASE}/orders`).send({ pass: 'month' })).status).toBe(503);
    } finally {
      config.PAYMENTS = saved;
    }
  });
});

describe('Billing: confirming a payment', () => {
  it('grants 30 days once, after Razorpay confirms the captured amount', async () => {
    const s = await createSession('bill_pay');
    const paid = await buy(s);
    razorpay.fetchPayment.mockResolvedValue(captured(paid));

    const res = await verify(s, paid);
    expect(res.status).toBe(200);
    expect(res.body.data.plan).toMatchObject({ tier: 'pro', source: 'payment' });
    expect(daysLeft(res.body.data.plan.until)).toBe(30);
    expect(res.body.data.payments).toMatchObject([{ pass: 'month', amount: 29900, status: 'paid' }]);
    expect(razorpay.fetchPayment).toHaveBeenCalledWith(paid.paymentId);

    // Replaying the same confirmation, or the webhook arriving after it, adds nothing.
    expect((await verify(s, paid)).status).toBe(200);
    expect((await webhook({ event: 'payment.captured', payload: { payment: { entity: captured(paid) } } })).status).toBe(200);
    expect(daysLeft((await planOf(s.userId)).until)).toBe(30);
  });

  it('stacks passes on top of the current end date', async () => {
    const s = await createSession('bill_stack');
    for (const pass of ['month', 'year']) {
      const paid = await buy(s, pass);
      razorpay.fetchPayment.mockResolvedValueOnce(captured(paid));
      expect((await verify(s, paid)).status).toBe(200);
    }
    expect(daysLeft((await planOf(s.userId)).until)).toBe(395);
  });

  it('rejects a forged signature, a mismatched payment and an unfinished one, granting nothing', async () => {
    const s = await createSession('bill_forged');
    const paid = await buy(s);

    const forged = await verify(s, { ...paid, signature: sign('attacker-guess', `${paid.orderId}|${paid.paymentId}`) });
    expect(forged.status).toBe(400);
    expect(forged.body.code).toBe('PAYMENT_SIGNATURE_INVALID');
    expect(razorpay.fetchPayment).not.toHaveBeenCalled();

    razorpay.fetchPayment.mockResolvedValueOnce(captured(paid, { amount: 100 }));
    expect((await verify(s, paid)).body.code).toBe('PAYMENT_MISMATCH');
    razorpay.fetchPayment.mockResolvedValueOnce(captured(paid, { order_id: rid('order') }));
    expect((await verify(s, paid)).body.code).toBe('PAYMENT_MISMATCH');
    razorpay.fetchPayment.mockResolvedValueOnce(captured(paid, { status: 'failed' }));
    const failed = await verify(s, paid);
    expect(failed.status).toBe(402);
    expect(failed.body.code).toBe('PAYMENT_NOT_COMPLETED');

    expect((await planOf(s.userId)).tier).toBe('free');
    expect(await Payment.countDocuments({ owner: s.userId, status: 'paid' })).toBe(0);
  });

  it('captures an authorized payment before granting', async () => {
    const s = await createSession('bill_capture');
    const paid = await buy(s);
    razorpay.fetchPayment.mockResolvedValueOnce(captured(paid, { status: 'authorized' }));
    razorpay.capturePayment.mockResolvedValueOnce(captured(paid));
    expect((await verify(s, paid)).status).toBe(200);
    expect(razorpay.capturePayment).toHaveBeenCalledWith(paid.paymentId, { amount: 29900, currency: 'INR' });
    expect((await planOf(s.userId)).tier).toBe('pro');
  });

  it("cannot confirm another user's order", async () => {
    const owner = await createSession('bill_owner');
    const other = await createSession('bill_other');
    const paid = await buy(owner);
    razorpay.fetchPayment.mockResolvedValue(captured(paid));
    const res = await verify(other, paid);
    expect(res.status).toBe(404);
    expect((await planOf(other.userId)).tier).toBe('free');
    expect((await planOf(owner.userId)).tier).toBe('free');
  });

  it('applies a payment exactly once when checkout and webhook race', async () => {
    const s = await createSession('bill_race');
    const paid = await buy(s);
    razorpay.fetchPayment.mockResolvedValue(captured(paid));
    const event = { event: 'order.paid', payload: { payment: { entity: captured(paid) } } };
    const results = await Promise.all([verify(s, paid), webhook(event), webhook(event), verify(s, paid)]);
    expect(results.map(r => r.status)).toEqual([200, 200, 200, 200]);
    expect(daysLeft((await planOf(s.userId)).until)).toBe(30);
  });
});

describe('Billing: webhook', () => {
  it('rejects unsigned or wrongly signed events', async () => {
    const s = await createSession('bill_hook_bad');
    const paid = await buy(s);
    const event = { event: 'payment.captured', payload: { payment: { entity: captured(paid) } } };
    expect((await webhook(event, 'wrong-secret-value-123')).status).toBe(400);
    const unsigned = await request(app).post(`${BASE}/webhook`).set('Content-Type', 'application/json').send(JSON.stringify(event));
    expect(unsigned.status).toBe(400);
    // The signature covers the exact bytes: re-serialised JSON with different spacing does not match.
    const body = JSON.stringify(event);
    const tampered = await request(app).post(`${BASE}/webhook`).set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sign(config.PAYMENTS.webhookSecret, body)).send(JSON.stringify(event, null, 1));
    expect(tampered.status).toBe(400);
    expect((await planOf(s.userId)).tier).toBe('free');
  });

  it('grants Pro when the browser never came back, and ignores events that are not ours', async () => {
    const s = await createSession('bill_hook');
    const paid = await buy(s, 'year');
    const res = await webhook({ event: 'payment.captured', payload: { payment: { entity: captured(paid) } } });
    expect(res.status).toBe(200);
    expect(res.body.data.handled).toBe(true);
    expect(daysLeft((await planOf(s.userId)).until)).toBe(365);
    expect(razorpay.fetchPayment).not.toHaveBeenCalled();

    const unknownOrder = await webhook({ event: 'payment.captured', payload: { payment: { entity: captured({ ...paid, orderId: rid('order'), paymentId: rid('pay') }) } } });
    expect(unknownOrder.body.data.handled).toBe(false);
    expect((await webhook({ event: 'payment.failed', payload: {} })).body.data.handled).toBe(false);
    const wrongAmount = await buy(await createSession('bill_hook_amt'));
    expect((await webhook({ event: 'payment.captured', payload: { payment: { entity: captured(wrongAmount, { amount: 1 }) } } })).body.data.handled).toBe(false);
  });

  it('takes refunded days back, ending Pro when none are left', async () => {
    const s = await createSession('bill_refund');
    const month = await buy(s, 'month');
    razorpay.fetchPayment.mockResolvedValueOnce(captured(month));
    await verify(s, month);
    const year = await buy(s, 'year');
    razorpay.fetchPayment.mockResolvedValueOnce(captured(year));
    await verify(s, year);
    expect(daysLeft((await planOf(s.userId)).until)).toBe(395);

    const refund = paymentId => ({ event: 'refund.processed', payload: { refund: { entity: { id: rid('rfnd'), payment_id: paymentId, amount: 1 } } } });
    expect((await webhook(refund(year.paymentId))).body.data.handled).toBe(true);
    expect(daysLeft((await planOf(s.userId)).until)).toBe(30);
    // A repeated refund event changes nothing.
    expect((await webhook(refund(year.paymentId))).body.data.handled).toBe(false);
    expect(daysLeft((await planOf(s.userId)).until)).toBe(30);

    await webhook(refund(month.paymentId));
    expect(await planOf(s.userId)).toMatchObject({ tier: 'free', until: null });
    const billing = (await s.get(BASE)).body.data;
    expect(billing.payments.map(p => p.status)).toEqual(['refunded', 'refunded']);
  });
});

describe('Billing: data', () => {
  it('deletes payment rows with the account', async () => {
    const s = await createSession('bill_delete');
    const paid = await buy(s);
    razorpay.fetchPayment.mockResolvedValueOnce(captured(paid));
    await verify(s, paid);
    expect(await Payment.countDocuments({ owner: s.userId })).toBe(1);
    const res = await s.del('/api/auth/account').send({ currentPassword: s.user.password, confirmation: 'DELETE' });
    expect(res.status).toBe(204);
    expect(await Payment.countDocuments({ owner: s.userId })).toBe(0);
  });

  it('keeps prices in one server-side list', () => {
    expect(PRO_PASSES.month).toMatchObject({ amount: 29900, currency: 'INR', days: 30 });
    expect(PRO_PASSES.year).toMatchObject({ amount: 299900, currency: 'INR', days: 365 });
  });
});
