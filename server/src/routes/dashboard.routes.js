import { Router } from 'express';
import { getAttention, getWeeklyReview } from '../controllers/dashboard.controller.js';
import { validateTodayQuery } from '../validators/viewerDay.validator.js';
import { validateWeeklyReviewQuery } from '../validators/weeklyReview.validator.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { reviewRateLimit } from '../middlewares/rateLimit.middleware.js';

// Read-only views derived from the caller's own goals, projects and journal.
const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);
dashboardRouter.get('/attention', validateTodayQuery, getAttention);
dashboardRouter.get('/weekly', reviewRateLimit, validateWeeklyReviewQuery, getWeeklyReview);
export default dashboardRouter;
