import { Router } from 'express';
import { createBillingOrder, getBilling, verifyBillingPayment } from '../controllers/billing.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { billingRateLimit, limitWrites } from '../middlewares/rateLimit.middleware.js';
import { validateCreateOrder, validateVerifyPayment } from '../validators/billing.validator.js';

// The Razorpay webhook is mounted separately in app.js: it needs the raw body and no session.
const billingRouter = Router();
billingRouter.use(authMiddleware, limitWrites);
billingRouter.get('/', getBilling);
billingRouter.post('/orders', billingRateLimit, requireCsrf, validateCreateOrder, createBillingOrder);
billingRouter.post('/verify', billingRateLimit, requireCsrf, validateVerifyPayment, verifyBillingPayment);

export default billingRouter;
