import { sendVerificationCodeLogic, verifyEmailCodeLogic } from '../services/emailVerification.service.js';

const ok = (res, data) => res.status(200).json({ success: true, data });

export async function sendVerificationCode(req, res, next) {
  try {
    return ok(res, await sendVerificationCodeLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}

export async function verifyEmailCode(req, res, next) {
  try {
    return ok(res, await verifyEmailCodeLogic(req.auth.userId, req.body.code));
  } catch (error) {
    return next(error);
  }
}
