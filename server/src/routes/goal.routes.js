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
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { validateObjectId } from '../middlewares/validateObjectId.middleware.js';
import { validateCreateMilestone, validateUpdateMilestone } from '../validators/milestone.validator.js';
import { milestoneControllers } from '../controllers/milestone.controller.js';

const goalRouter = Router();

goalRouter.post(
    '/',
    authMiddleware,
    requireCsrf,
    validateCreateGoal,
    createGoal
);

goalRouter.get(
    '/',
    authMiddleware,
    getUserGoals
);

goalRouter.get(
    '/:id',
    authMiddleware,
    validateObjectId('id'),
    getSingleGoal
);

goalRouter.patch(
    '/:id',
    authMiddleware,
    requireCsrf,
    validateObjectId('id'),
    validateUpdateGoal,
    updateGoal
);

goalRouter.delete(
    '/:id',
    authMiddleware,
    requireCsrf,
    validateObjectId('id'),
    deleteGoal
);

const milestones = milestoneControllers('goal');

goalRouter.post(
    '/:id/milestones',
    authMiddleware,
    requireCsrf,
    validateObjectId('id'),
    validateCreateMilestone,
    milestones.add
);

goalRouter.patch(
    '/:id/milestones/:milestoneId',
    authMiddleware,
    requireCsrf,
    validateObjectId('id'),
    validateObjectId('milestoneId'),
    validateUpdateMilestone,
    milestones.update
);

goalRouter.delete(
    '/:id/milestones/:milestoneId',
    authMiddleware,
    requireCsrf,
    validateObjectId('id'),
    validateObjectId('milestoneId'),
    milestones.remove
);

export default goalRouter;