import { Router } from 'express';
import { getPushStatus, removePushDevice, sendTestPush, subscribePush, unsubscribePush } from '../controllers/push.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { validateObjectId } from '../middlewares/validateObjectId.middleware.js';
import { limitWrites, pushRateLimit } from '../middlewares/rateLimit.middleware.js';
import { validatePushEndpoint, validatePushSubscription } from '../validators/push.validator.js';

// Phone and browser notifications (Web Push). Subscriptions are per browser and per account.
const pushRouter = Router();
pushRouter.use(authMiddleware, limitWrites);
pushRouter.get('/', getPushStatus);
pushRouter.post('/subscriptions', pushRateLimit, requireCsrf, validatePushSubscription, subscribePush);
pushRouter.delete('/subscriptions', pushRateLimit, requireCsrf, validatePushEndpoint, unsubscribePush);
pushRouter.delete('/subscriptions/:id', pushRateLimit, requireCsrf, validateObjectId('id'), removePushDevice);
pushRouter.post('/test', pushRateLimit, requireCsrf, sendTestPush);

export default pushRouter;
