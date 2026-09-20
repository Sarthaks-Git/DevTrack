import { Router } from 'express'
import { register, login, getMe, logout } from '../controllers/auth.controllers.js'
import { authMiddleware } from '../middlewares/auth.middleware.js';

const authRouter = Router();

authRouter.get('/me', authMiddleware, getMe);

authRouter.post('/register', register);

authRouter.post('/login', login);

authRouter.post('/logout', logout);

export default authRouter;