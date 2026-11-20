import crypto from 'crypto';
import mongoose from 'mongoose';
import config, { PRO_PASSES } from '../config/config.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { addProDays, hasNoEnd, isActivePro, removeProDays } from './plan.service.js';
import { capturePayment, createOrder, fetchPayment, RazorpayApiError } from './razorpayApi.service.js';

export const REFUND_WINDOW_DAYS = 7;
// An unpaid order is offered again for this long, so repeated clicks don't pile up orders.
const REUSE_ORDER_MS = 30 * 60 * 1000;
const ORDER_ID = /^order_[A-Za-z0-9]{6,30}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{6,30}$/;

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

function assertEnabled() {
  if (!config.PAYMENTS.enabled) throw new AppError('Payments are not set up on this server yet', 503, 'PAYMENTS_NOT_CONFIGURED');
}

const providerDown = () => new AppError('The payment service could not be reached. Try again in a minute.', 502, 'PAYMENT_PROVIDER_UNAVAILABLE');

async function provider(work) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof RazorpayApiError) throw providerDown();
    throw error;
  }
}

// Constant-time comparison of two hex HMACs.
function sameSignature(expected, received) {
  if (typeof received !== 'string' || !/^[a-f0-9]{64}$/.test(received)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

const hmac = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');

function publicPlan(plan, now = new Date()) {
  const active = isActivePro(plan, now);
  return { tier: active ? 'pro' : 'free', source: active ? plan.source : null, until: active ? plan.until : null };
}

function publicPayment(payment) {
  return {
    id: String(payment._id),
    pass: payment.pass,
    label: PRO_PASSES[payment.pass]?.label || payment.pass,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paidAt,
    refundedAt: payment.refundedAt,
  };
}

export async function getBillingLogic(userId, now = new Date()) {
  assertUserId(userId);
  const [user, payments] = await Promise.all([
    User.findById(userId).select('plan').lean(),
    Payment.find({ owner: userId, status: { $ne: 'created' } }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  if (!user) throw new AppError('User not found', 404);
  const { enabled, mode, keyId } = config.PAYMENTS;
  return {
    available: enabled,
    mode: enabled ? mode : null,
    keyId: enabled ? keyId : null,
    passes: Object.values(PRO_PASSES),
    plan: publicPlan(user.plan, now),
    // Pro with no end date was granted by the owner; buying more would add nothing.
    canBuy: enabled && !hasNoEnd(user.plan, now),
    refundWindowDays: REFUND_WINDOW_DAYS,
    payments: payments.map(publicPayment),
  };
}

export async function createOrderLogic(userId, passId, now = new Date()) {
  assertUserId(userId);
  assertEnabled();
  const pass = PRO_PASSES[passId];
  if (!pass) throw new AppError('Unknown pass', 400, 'VALIDATION_ERROR');
  const user = await User.findById(userId).select('plan').lean();
  if (!user) throw new AppError('User not found', 404);
  if (hasNoEnd(user.plan, now)) throw new AppError('Your Pro plan has no end date, so there is nothing to buy', 409, 'PLAN_HAS_NO_END');

  let payment = await Payment.findOne({ owner: userId, pass: pass.id, status: 'created', amount: pass.amount, createdAt: { $gt: new Date(now - REUSE_ORDER_MS) } }).lean();
  if (!payment) {
    const _id = new mongoose.Types.ObjectId();
    // The receipt is our own row id: Razorpay never receives the user's id, name or email.
    const order = await provider(() => createOrder({ amount: pass.amount, currency: pass.currency, receipt: `pass_${_id}`, notes: { pass: pass.id } }));
    if (!ORDER_ID.test(order?.id || '') || order.amount !== pass.amount || order.currency !== pass.currency) throw providerDown();
    payment = await Payment.create({ _id, owner: userId, pass: pass.id, amount: pass.amount, currency: pass.currency, days: pass.days, orderId: order.id });
  }
  return { orderId: payment.orderId, amount: payment.amount, currency: payment.currency, keyId: config.PAYMENTS.keyId, pass: pass.id, label: pass.label };
}

// Marks the order paid and grants its days, exactly once, whichever of checkout or webhook arrives first.
async function applyPayment(payment, paymentId, now) {
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'created' },
    { $set: { status: 'paid', paymentId, paidAt: now } },
    { returnDocument: 'after' }
  );
  if (!claimed) return false;
  try {
    const grantedDays = await addProDays(claimed.owner, claimed.days, now);
    await Payment.updateOne({ _id: claimed._id }, { $set: { grantedDays } });
  } catch (error) {
    // Put the order back so the webhook retry can apply it.
    await Payment.updateOne({ _id: claimed._id, status: 'paid' }, { $set: { status: 'created', paymentId: null, paidAt: null } });
    throw error;
  }
  return true;
}

// Razorpay's own record must match the order before anything is granted.
const matchesOrder = (entity, payment) =>
  entity && entity.order_id === payment.orderId && entity.amount === payment.amount && entity.currency === payment.currency;

export async function verifyCheckoutLogic(userId, { orderId, paymentId, signature }, now = new Date()) {
  assertUserId(userId);
  assertEnabled();
  if (!sameSignature(hmac(config.PAYMENTS.keySecret, `${orderId}|${paymentId}`), signature)) {
    throw new AppError('The payment could not be confirmed', 400, 'PAYMENT_SIGNATURE_INVALID');
  }
  const payment = await Payment.findOne({ orderId, owner: userId }).lean();
  if (!payment) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');

  if (payment.status === 'created') {
    let entity = await provider(() => fetchPayment(paymentId));
    if (!matchesOrder(entity, payment)) throw new AppError('The payment could not be confirmed', 400, 'PAYMENT_MISMATCH');
    if (entity.status === 'authorized') {
      entity = await provider(() => capturePayment(paymentId, { amount: payment.amount, currency: payment.currency }));
    }
    if (entity?.status !== 'captured') throw new AppError('The payment has not gone through. You were not charged for Pro.', 402, 'PAYMENT_NOT_COMPLETED');
    await applyPayment(payment, paymentId, now);
  } else if (payment.paymentId !== paymentId) {
    throw new AppError('The payment could not be confirmed', 400, 'PAYMENT_MISMATCH');
  }
  return getBillingLogic(userId, now);
}

// Signed events from Razorpay. Unknown events and orders that are not ours are acknowledged and ignored.
export async function handleWebhookLogic(rawBody, signature, now = new Date()) {
  assertEnabled();
  if (!Buffer.isBuffer(rawBody) || !sameSignature(hmac(config.PAYMENTS.webhookSecret, rawBody), signature)) {
    throw new AppError('Invalid signature', 400, 'WEBHOOK_SIGNATURE_INVALID');
  }
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new AppError('Invalid body', 400, 'VALIDATION_ERROR');
  }

  if (event?.event === 'payment.captured' || event?.event === 'order.paid') {
    const entity = event.payload?.payment?.entity;
    if (!entity || entity.status !== 'captured' || !PAYMENT_ID.test(entity.id || '') || typeof entity.order_id !== 'string') return { handled: false };
    const payment = await Payment.findOne({ orderId: entity.order_id }).lean();
    if (!payment || !matchesOrder(entity, payment)) return { handled: false };
    await applyPayment(payment, entity.id, now);
    return { handled: true };
  }

  if (event?.event === 'refund.processed') {
    const paymentId = event.payload?.refund?.entity?.payment_id;
    if (typeof paymentId !== 'string' || !PAYMENT_ID.test(paymentId)) return { handled: false };
    const refunded = await Payment.findOneAndUpdate(
      { paymentId, status: 'paid' },
      { $set: { status: 'refunded', refundedAt: now } },
      { returnDocument: 'after' }
    );
    if (!refunded) return { handled: false };
    await removeProDays(refunded.owner, refunded.grantedDays, now);
    return { handled: true };
  }

  return { handled: false };
}
