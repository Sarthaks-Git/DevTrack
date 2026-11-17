import { cancelEmailChangeLogic, confirmEmailChangeLogic, getEmailChangeLogic, resendEmailChangeLogic } from '../services/emailChange.service.js';

const ok = (res, data) => res.status(200).json({ success: true, data });

export async function getEmailChange(req, res, next) {
  try {
    return ok(res, await getEmailChangeLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}

export async function resendEmailChange(req, res, next) {
  try {
    return ok(res, await resendEmailChangeLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}

export async function confirmEmailChange(req, res, next) {
  try {
    return ok(res, await confirmEmailChangeLogic(req.auth.userId, req.auth.sessionId, req.body.code));
  } catch (error) {
    return next(error);
  }
}

export async function cancelEmailChange(req, res, next) {
  try {
    await cancelEmailChangeLogic(req.auth.userId);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
