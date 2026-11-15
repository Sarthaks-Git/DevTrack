import { Router } from 'express';
import { listActivity, activitySummary } from '../controllers/activity.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

// Read-only: activity is written by the services that own each event, never by clients.
const activityRouter = Router();
activityRouter.use(authMiddleware);
activityRouter.get('/', listActivity);
activityRouter.get('/summary', activitySummary);
export default activityRouter;
