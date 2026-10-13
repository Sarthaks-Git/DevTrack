
import { Router } from 'express';

import {
    createProject,
    getUserProjects,
    getSingleProject,
    updateProject,
    deleteProject,
} from '../controllers/project.controller.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateObjectId } from '../middlewares/validateObjectId.middleware.js';

import {
    validateCreateProject,
    validateUpdateProject,
} from '../validators/project.validator.js';

const projectRouter = Router();

projectRouter.use(authMiddleware);

projectRouter.post(
    '/',
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
    validateObjectId('id'),
    validateUpdateProject,
    updateProject
);

projectRouter.delete(
    '/:id',
    validateObjectId('id'),
    deleteProject
);

export default projectRouter;
