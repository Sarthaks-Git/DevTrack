import { Router } from 'express';
import { getAttention } from '../controllers/dashboard.controller.js';
import { validateAttentionQuery } from '../validators/dashboard.validator.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

// Read-only views derived from the caller's own goals, projects and journal.
const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);
dashboardRouter.get('/attention', validateAttentionQuery, getAttention);
export default dashboardRouter;
