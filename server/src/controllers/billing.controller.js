import { createOrderLogic, getBillingLogic, handleWebhookLogic, verifyCheckoutLogic } from '../services/billing.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export async function getBilling(req, res, next) {
  try {
    return ok(res, await getBillingLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}

export async function createBillingOrder(req, res, next) {
  try {
    return ok(res, await createOrderLogic(req.auth.userId, req.validatedPass), 201);
  } catch (error) {
    return next(error);
  }
}

export async function verifyBillingPayment(req, res, next) {
  try {
    return ok(res, await verifyCheckoutLogic(req.auth.userId, req.validatedPayment));
  } catch (error) {
    return next(error);
  }
}

// Called by Razorpay, not the browser. req.body is the raw Buffer (signature covers the exact bytes).
export async function razorpayWebhook(req, res, next) {
  try {
    const result = await handleWebhookLogic(req.body, req.get('x-razorpay-signature'));
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
}
