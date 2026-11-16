import { Router } from 'express';

import {
    createGoal,
    getUserGoals,
    getSingleGoal,
    updateGoal,
    deleteGoal
} from '../controllers/goal.controller.js';

import {
    validateCreateGoal,
    validateUpdateGoal
} from '../validators/goal.validator.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { limitWrites } from '../middlewares/rateLimit.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { validateObjectId } from '../middlewares/validateObjectId.middleware.js';
import { validateCreateMilestone, validateUpdateMilestone } from '../validators/milestone.validator.js';
import { milestoneControllers } from '../controllers/milestone.controller.js';

const goalRouter = Router();
goalRouter.use(authMiddleware, limitWrites);

goalRouter.post(
    '/',
    requireCsrf,
    validateCreateGoal,
    createGoal
);

goalRouter.get(
    '/',
    getUserGoals
);

goalRouter.get(
    '/:id',
    validateObjectId('id'),
    getSingleGoal
);

goalRouter.patch(
    '/:id',
    requireCsrf,
    validateObjectId('id'),
    validateUpdateGoal,
    updateGoal
);

goalRouter.delete(
    '/:id',
    requireCsrf,
    validateObjectId('id'),
    deleteGoal
);

const milestones = milestoneControllers('goal');

goalRouter.post(
    '/:id/milestones',
    requireCsrf,
    validateObjectId('id'),
    validateCreateMilestone,
    milestones.add
);

goalRouter.patch(
    '/:id/milestones/:milestoneId',
    requireCsrf,
    validateObjectId('id'),
    validateObjectId('milestoneId'),
    validateUpdateMilestone,
    milestones.update
);

goalRouter.delete(
    '/:id/milestones/:milestoneId',
    requireCsrf,
    validateObjectId('id'),
    validateObjectId('milestoneId'),
    milestones.remove
);

export default goalRouter;