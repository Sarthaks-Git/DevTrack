import AppError from '../utils/AppError.js';
import { PASS_IDS } from '../models/Payment.js';

const fail = errors => Object.assign(new AppError('Validation failed', 400, 'VALIDATION_ERROR'), { errors });
const plainObject = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);
const onlyKeys = (object, allowed) => Object.keys(object).every(key => allowed.includes(key));

// Only the pass is accepted: the price, currency and length come from the server.
export function validateCreateOrder(req, res, next) {
  const body = plainObject(req.body);
  if (!body || !onlyKeys(body, ['pass']) || !PASS_IDS.includes(body.pass)) {
    return next(fail({ pass: `pass must be one of ${PASS_IDS.join(', ')}` }));
  }
  req.validatedPass = body.pass;
  return next();
}

// What Razorpay Checkout hands the browser after a payment.
export function validateVerifyPayment(req, res, next) {
  const body = plainObject(req.body);
  const errors = {};
  if (!body || !onlyKeys(body, ['orderId', 'paymentId', 'signature'])) errors.fields = 'Body contains invalid fields';
  if (!/^order_[A-Za-z0-9]{6,30}$/.test(typeof body?.orderId === 'string' ? body.orderId : '')) errors.orderId = 'Invalid order id';
  if (!/^pay_[A-Za-z0-9]{6,30}$/.test(typeof body?.paymentId === 'string' ? body.paymentId : '')) errors.paymentId = 'Invalid payment id';
  if (!/^[a-f0-9]{64}$/.test(typeof body?.signature === 'string' ? body.signature : '')) errors.signature = 'Invalid signature';
  if (Object.keys(errors).length) return next(fail(errors));
  req.validatedPayment = { orderId: body.orderId, paymentId: body.paymentId, signature: body.signature };
  return next();
}
