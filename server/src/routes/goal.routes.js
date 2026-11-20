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
import { limitWrites, mentorRateLimit } from '../middlewares/rateLimit.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { validateObjectId } from '../middlewares/validateObjectId.middleware.js';
import { validateBulkMilestones, validateCreateMilestone, validateUpdateMilestone } from '../validators/milestone.validator.js';
import { createQuiz, getQuiz, submitQuizAttempt, suggestRoadmap } from '../controllers/goalRoadmap.controller.js';
import { validateQuizAttempt } from '../validators/goalQuiz.validator.js';
import { suggestProjectIdeas } from '../controllers/mentor.controller.js';
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

// AI mentor: a suggested plan for the goal (nothing saved; see goalRoadmap.service.js).
goalRouter.post('/:id/roadmap', mentorRateLimit, requireCsrf, validateObjectId('id'), suggestRoadmap);
// AI mentor: a self-check quiz per goal with spaced reviews (see goalQuiz.service.js).
goalRouter.get('/:id/quiz', validateObjectId('id'), getQuiz);
goalRouter.post('/:id/quiz', mentorRateLimit, requireCsrf, validateObjectId('id'), createQuiz);
goalRouter.post('/:id/quiz/attempts', requireCsrf, validateObjectId('id'), validateQuizAttempt, submitQuizAttempt);
// AI mentor: practice project ideas (nothing saved; picking one creates a normal project).
goalRouter.post('/:id/project-ideas', mentorRateLimit, requireCsrf, validateObjectId('id'), suggestProjectIdeas);
goalRouter.post('/:id/milestones/bulk', requireCsrf, validateObjectId('id'), validateBulkMilestones, milestones.addMany);

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