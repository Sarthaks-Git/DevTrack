
import { Router } from 'express';

import {
    createProject,
    getUserProjects,
    getSingleProject,
    updateProject,
    deleteProject,
} from '../controllers/project.controller.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { limitWrites } from '../middlewares/rateLimit.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { validateObjectId } from '../middlewares/validateObjectId.middleware.js';
import { validateCreateMilestone, validateUpdateMilestone } from '../validators/milestone.validator.js';
import { milestoneControllers } from '../controllers/milestone.controller.js';

import {
    validateCreateProject,
    validateUpdateProject,
} from '../validators/project.validator.js';

const projectRouter = Router();

projectRouter.use(authMiddleware, limitWrites);

projectRouter.post(
    '/',
    requireCsrf,
    validateCreateProject,
    createProject
);

projectRouter.get(
    '/',
    getUserProjects
);

projectRouter.get(
    '/:id',
    validateObjectId('id'),
    getSingleProject
);

projectRouter.patch(
    '/:id',
    requireCsrf,
    validateObjectId('id'),
    validateUpdateProject,
    updateProject
);

projectRouter.delete(
    '/:id',
    requireCsrf,
    validateObjectId('id'),
    deleteProject
);

const milestones = milestoneControllers('project');

projectRouter.post(
    '/:id/milestones',
    requireCsrf,
    validateObjectId('id'),
    validateCreateMilestone,
    milestones.add
);

projectRouter.patch(
    '/:id/milestones/:milestoneId',
    requireCsrf,
    validateObjectId('id'),
    validateObjectId('milestoneId'),
    validateUpdateMilestone,
    milestones.update
);

projectRouter.delete(
    '/:id/milestones/:milestoneId',
    requireCsrf,
    validateObjectId('id'),
    validateObjectId('milestoneId'),
    milestones.remove
);

export default projectRouter;
