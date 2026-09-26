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
import { validateObjectId } from '../middlewares/validateObjectId.middleware.js';

const goalRouter = Router();

goalRouter.post(
    '/',
    authMiddleware,
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
    validateObjectId('id'),
    validateUpdateGoal,
    updateGoal
);

goalRouter.delete(
    '/:id',
    authMiddleware,
    validateObjectId('id'),
    deleteGoal
);

export default goalRouter;