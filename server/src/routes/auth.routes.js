import { Router } from 'express';
import { csrf, register, login, getMe, logout, logoutAll, refresh } from '../controllers/auth.controllers.js';
import { updateProfile, changePassword, listSessions, revokeSessionById, deleteAccount } from '../controllers/account.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { authRateLimit, loginAccountRateLimit, sensitiveAuthRateLimit, passwordCheckRateLimit, registerRateLimit, writeRateLimit } from '../middlewares/rateLimit.middleware.js';
import { validateRegister, validateLogin } from '../validators/auth.validator.js';
import { validateProfileUpdate, validatePasswordChange, validateAccountDeletion } from '../validators/account.validator.js';

const authRouter = Router();
authRouter.get('/csrf', csrf);
authRouter.get('/me', authMiddleware, getMe);
authRouter.post('/register', registerRateLimit, authRateLimit, requireCsrf, validateRegister, register);
authRouter.post('/login', authRateLimit, requireCsrf, validateLogin, loginAccountRateLimit, login);
authRouter.post('/refresh', sensitiveAuthRateLimit, requireCsrf, refresh);
authRouter.post('/logout', requireCsrf, logout);
authRouter.post('/logout-all', authMiddleware, writeRateLimit, requireCsrf, logoutAll);

// Account management (Settings). Every password-confirmed action is throttled per user.
authRouter.patch('/profile', authMiddleware, requireCsrf, passwordCheckRateLimit, validateProfileUpdate, updateProfile);
authRouter.patch('/password', authMiddleware, requireCsrf, passwordCheckRateLimit, validatePasswordChange, changePassword);
authRouter.get('/sessions', authMiddleware, listSessions);
authRouter.delete('/sessions/:id', authMiddleware, writeRateLimit, requireCsrf, revokeSessionById);
authRouter.delete('/account', authMiddleware, requireCsrf, passwordCheckRateLimit, validateAccountDeletion, deleteAccount);
export default authRouter;
