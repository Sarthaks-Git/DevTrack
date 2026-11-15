
import crypto from 'crypto';

import {
  loginLogic,
  registerLogic,
  getMeLogic,
  refreshLoginSession,
  revokeAllSessions,
  revokeSession,
  revokeSessionFromRefreshToken,
} from '../services/auth.service.js';

import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
  setCsrfCookie,
} from '../utils/cookies.js';

export async function csrf(req, res) {
  setCsrfCookie(
    res,
    crypto.randomBytes(32).toString('base64url')
  );

  return res.status(204).send();
}

export async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;

    const result = await registerLogic(
      username,
      email,
      password,
      { userAgent: req.get('user-agent') }
    );

    setAuthCookies(res, result);

    return res.status(201).json({
      message: 'Registration successful',
      user: result.user,
    });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await loginLogic(email, password, { userAgent: req.get('user-agent') });

    setAuthCookies(res, result);

    return res.status(200).json({
      message: 'Login Successful',
      user: result.user,
    });
  } catch (error) {
    return next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const result = await refreshLoginSession(
      req.cookies?.[REFRESH_COOKIE]
    );

    setAuthCookies(res, result);

    return res.status(200).json({
      message: 'Session refreshed',
      user: result.user,
    });
  } catch (error) {
    // Clear cookies only when the session is genuinely invalid.
    const status = error.statusCode || error.status;

    if (status === 401) {
      clearAuthCookies(res);
    }

    return next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await getMeLogic(req.user.id);

    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
}

export async function logout(req, res, next) {
  try {
    if (req.auth?.sessionId) {
      await revokeSession(req.auth.sessionId);
    } else {
      await revokeSessionFromRefreshToken(
        req.cookies?.[REFRESH_COOKIE]
      );
    }

    clearAuthCookies(res);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function logoutAll(req, res, next) {
  try {
    await revokeAllSessions(req.auth.userId);

    clearAuthCookies(res);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
