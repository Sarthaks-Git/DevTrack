import { Router } from 'express';
import { csrf, register, login, getMe, logout, logoutAll, refresh } from '../controllers/auth.controllers.js';
import { updateProfile, changePassword, listSessions, revokeSessionById, deleteAccount } from '../controllers/account.controller.js';
import { authAllowUnverified, authMiddleware } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { authRateLimit, loginAccountRateLimit, sensitiveAuthRateLimit, passwordCheckRateLimit, registerRateLimit, socialCallbackRateLimit, socialStartRateLimit, twoFactorVerifyRateLimit, emailSendRateLimit, writeRateLimit } from '../middlewares/rateLimit.middleware.js';
import { validateRegister, validateLogin, validateEmailCode } from '../validators/auth.validator.js';
import { sendVerificationCode, verifyEmailCode } from '../controllers/emailVerification.controller.js';
import { validateProfileUpdate, validatePasswordChange, validateAccountDeletion } from '../validators/account.validator.js';
import { listIdentities, listProviders, socialCallback, startSocialLink, startSocialLogin, unlinkIdentity } from '../controllers/social.controller.js';
import { validateProvider, validateSocialCallback, validateSocialStart, validateUnlinkIdentity } from '../validators/social.validator.js';
import { disableTwoFactor, enableTwoFactor, getTwoFactorStatus, regenerateRecoveryCodes, startTwoFactorSetup, verifyTwoFactorLogin } from '../controllers/twoFactor.controller.js';
import { validateTwoFactorDisable, validateTwoFactorEnable, validateTwoFactorRegenerate, validateTwoFactorSetup, validateTwoFactorVerify } from '../validators/twoFactor.validator.js';

const authRouter = Router();
authRouter.get('/csrf', csrf);
authRouter.get('/me', authAllowUnverified, getMe);
authRouter.post('/register', registerRateLimit, authRateLimit, requireCsrf, validateRegister, register);
authRouter.post('/login', authRateLimit, requireCsrf, validateLogin, loginAccountRateLimit, login);
authRouter.post('/refresh', sensitiveAuthRateLimit, requireCsrf, refresh);
authRouter.post('/logout', requireCsrf, logout);
authRouter.post('/logout-all', authAllowUnverified, writeRateLimit, requireCsrf, logoutAll);

// Account management (Settings). Every password-confirmed action is throttled per user.
authRouter.patch('/profile', authAllowUnverified, requireCsrf, passwordCheckRateLimit, validateProfileUpdate, updateProfile);
authRouter.patch('/password', authMiddleware, requireCsrf, passwordCheckRateLimit, validatePasswordChange, changePassword);
authRouter.get('/sessions', authAllowUnverified, listSessions);
authRouter.delete('/sessions/:id', authAllowUnverified, writeRateLimit, requireCsrf, revokeSessionById);
authRouter.delete('/account', authAllowUnverified, requireCsrf, passwordCheckRateLimit, validateAccountDeletion, deleteAccount);

// Sign in with Google, GitHub or LinkedIn (docs/API.md, Social sign-in).
authRouter.get('/oauth/providers', listProviders);
authRouter.post('/oauth/:provider/login', socialStartRateLimit, requireCsrf, validateProvider, validateSocialStart, startSocialLogin);
authRouter.post('/oauth/:provider/link', authMiddleware, socialStartRateLimit, requireCsrf, validateProvider, validateSocialStart, startSocialLink);
// Unauthenticated on purpose: the provider redirects the browser here; the state binds the handshake.
authRouter.get('/oauth/:provider/callback', socialCallbackRateLimit, validateProvider, validateSocialCallback, socialCallback);
authRouter.get('/identities', authMiddleware, listIdentities);
authRouter.delete('/identities/:provider', authMiddleware, requireCsrf, passwordCheckRateLimit, validateProvider, validateUnlinkIdentity, unlinkIdentity);
// Email verification (docs/API.md, Email verification). Open to signed-in, unverified accounts.
authRouter.post('/email/send', authAllowUnverified, emailSendRateLimit, requireCsrf, sendVerificationCode);
authRouter.post('/email/verify', authAllowUnverified, passwordCheckRateLimit, requireCsrf, validateEmailCode, verifyEmailCode);

// Two-factor authentication (docs/API.md, Two-factor authentication).
authRouter.post('/2fa/verify', twoFactorVerifyRateLimit, requireCsrf, validateTwoFactorVerify, verifyTwoFactorLogin);
authRouter.get('/2fa', authMiddleware, getTwoFactorStatus);
authRouter.post('/2fa/setup', authMiddleware, requireCsrf, passwordCheckRateLimit, validateTwoFactorSetup, startTwoFactorSetup);
authRouter.post('/2fa/enable', authMiddleware, requireCsrf, passwordCheckRateLimit, validateTwoFactorEnable, enableTwoFactor);
authRouter.post('/2fa/disable', authMiddleware, requireCsrf, passwordCheckRateLimit, validateTwoFactorDisable, disableTwoFactor);
authRouter.post('/2fa/recovery-codes', authMiddleware, requireCsrf, passwordCheckRateLimit, validateTwoFactorRegenerate, regenerateRecoveryCodes);
export default authRouter;
