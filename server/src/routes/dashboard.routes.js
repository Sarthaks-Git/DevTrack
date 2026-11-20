import { Router } from 'express';
import { getAttention, getWeeklyReview } from '../controllers/dashboard.controller.js';
import { validateTodayQuery } from '../validators/viewerDay.validator.js';
import { validateWeeklyReviewQuery } from '../validators/weeklyReview.validator.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { limitWrites, mentorRateLimit, reviewRateLimit } from '../middlewares/rateLimit.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { getWeeklyReviewNote, writeWeeklyReviewNote } from '../controllers/mentor.controller.js';

// Read-only views derived from the caller's own goals, projects and journal.
const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);
dashboardRouter.get('/attention', validateTodayQuery, getAttention);
dashboardRouter.get('/weekly', reviewRateLimit, validateWeeklyReviewQuery, getWeeklyReview);
// AI-written note on a weekly review (kept per week; writing again replaces it).
dashboardRouter.get('/weekly/ai', reviewRateLimit, validateWeeklyReviewQuery, getWeeklyReviewNote);
dashboardRouter.post('/weekly/ai', limitWrites, mentorRateLimit, requireCsrf, validateWeeklyReviewQuery, writeWeeklyReviewNote);
export default dashboardRouter;
