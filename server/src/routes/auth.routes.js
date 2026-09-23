import { Router } from 'express'
import { register, login, getMe, logout } from '../controllers/auth.controllers.js'
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
    validateRegister,
    validateLogin
} from '../validators/auth.validator.js';

const authRouter = Router();

authRouter.get('/me', authMiddleware, getMe);

authRouter.post('/register', validateRegister, register);

authRouter.post('/login', validateLogin ,login);

authRouter.post('/logout', logout);

export default authRouter;