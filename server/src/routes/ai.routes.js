import { Router } from 'express';
import {
  getAiStatus,
  listCodeFindings,
  setCodeFindingStatus,
  listSecurityReviews,
  setAiConsent,
  setSecurityReviewStatus,
  updateSecurityItem,
} from '../controllers/ai.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { aiSettingsRateLimit, codeFindingRateLimit, limitWrites, securityReviewRateLimit } from '../middlewares/rateLimit.middleware.js';
import {
  validateAiConsent,
  validateCodeFindingList,
  validateCodeFindingStatus,
  validateSecurityItem,
  validateSecurityReviewList,
  validateSecurityReviewStatus,
} from '../validators/ai.validator.js';

export const aiRouter = Router();
aiRouter.use(authMiddleware, limitWrites, aiSettingsRateLimit);
aiRouter.get('/', getAiStatus);
aiRouter.put('/consent', requireCsrf, validateAiConsent, setAiConsent);

export const securityReviewRouter = Router();
securityReviewRouter.use(authMiddleware, limitWrites, securityReviewRateLimit);
securityReviewRouter.get('/', validateSecurityReviewList, listSecurityReviews);
securityReviewRouter.patch('/:id', requireCsrf, validateSecurityReviewStatus, setSecurityReviewStatus);
securityReviewRouter.patch('/:id/items/:itemKey', requireCsrf, validateSecurityItem, updateSecurityItem);

export const codeFindingRouter = Router();
codeFindingRouter.use(authMiddleware, limitWrites, codeFindingRateLimit);
codeFindingRouter.get('/', validateCodeFindingList, listCodeFindings);
codeFindingRouter.patch('/:id', requireCsrf, validateCodeFindingStatus, setCodeFindingStatus);
