import { Router } from 'express';
import { getAttention } from '../controllers/dashboard.controller.js';
import { validateTodayQuery } from '../validators/viewerDay.validator.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

// Read-only views derived from the caller's own goals, projects and journal.
const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);
dashboardRouter.get('/attention', validateTodayQuery, getAttention);
export default dashboardRouter;
