import {
  updateProfileLogic,
  changePasswordLogic,
  listSessionsLogic,
  revokeSessionByIdLogic,
  deleteAccountLogic,
} from '../services/account.service.js';
import { clearAuthCookies } from '../utils/cookies.js';

export async function updateProfile(req, res, next) {
  try {
    const { user, changed } = await updateProfileLogic(req.auth.userId, req.auth.sessionId, req.body);
    return res.status(200).json({ message: changed ? 'Account details updated' : 'No changes to save', user });
  } catch (error) {
    return next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    await changePasswordLogic(req.auth.userId, req.auth.sessionId, req.body);
    return res.status(200).json({ message: 'Password updated. Other devices have been signed out.' });
  } catch (error) {
    return next(error);
  }
}

export async function listSessions(req, res, next) {
  try {
    const sessions = await listSessionsLogic(req.auth.userId, req.auth.sessionId);
    return res.status(200).json({ sessions });
  } catch (error) {
    return next(error);
  }
}

export async function revokeSessionById(req, res, next) {
  try {
    await revokeSessionByIdLogic(req.auth.userId, req.params.id);
    if (req.params.id === req.auth.sessionId) clearAuthCookies(res);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function deleteAccount(req, res, next) {
  try {
    await deleteAccountLogic(req.auth.userId, req.auth.sessionId, req.body);
    clearAuthCookies(res);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
