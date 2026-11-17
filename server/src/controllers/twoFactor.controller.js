import {
  completeLoginChallengeLogic,
  disableTwoFactorLogic,
  enableTwoFactorLogic,
  getTwoFactorStatusLogic,
  regenerateRecoveryCodesLogic,
  startTwoFactorSetupLogic,
} from '../services/twoFactor.service.js';
import { TWO_FACTOR_COOKIE, clearTwoFactorCookie, setAuthCookies } from '../utils/cookies.js';

const ok = (res, data) => res.status(200).json({ success: true, data });

export async function getTwoFactorStatus(req, res, next) {
  try {
    return ok(res, await getTwoFactorStatusLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}

export async function startTwoFactorSetup(req, res, next) {
  try {
    return ok(res, await startTwoFactorSetupLogic(req.auth.userId, req.auth.sessionId, req.body?.currentPassword));
  } catch (error) {
    return next(error);
  }
}

export async function enableTwoFactor(req, res, next) {
  try {
    return ok(res, await enableTwoFactorLogic(req.auth.userId, req.body.code));
  } catch (error) {
    return next(error);
  }
}

export async function disableTwoFactor(req, res, next) {
  try {
    return ok(res, await disableTwoFactorLogic(req.auth.userId, req.auth.sessionId, req.body));
  } catch (error) {
    return next(error);
  }
}

export async function regenerateRecoveryCodes(req, res, next) {
  try {
    return ok(res, await regenerateRecoveryCodesLogic(req.auth.userId, req.body.code));
  } catch (error) {
    return next(error);
  }
}

// Second step of signing in: the challenge token comes from an HttpOnly cookie, never the body.
export async function verifyTwoFactorLogin(req, res, next) {
  try {
    const { session, returnTo } = await completeLoginChallengeLogic({
      token: req.cookies?.[TWO_FACTOR_COOKIE],
      code: req.body.code,
      recoveryCode: req.body.recoveryCode,
    });
    clearTwoFactorCookie(res);
    setAuthCookies(res, session);
    return res.status(200).json({ message: 'Login Successful', user: session.user, returnTo });
  } catch (error) {
    if (error?.code === 'TWO_FACTOR_CHALLENGE_EXPIRED') clearTwoFactorCookie(res);
    return next(error);
  }
}
