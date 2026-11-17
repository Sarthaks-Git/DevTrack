import { requestPasswordResetLogic, resetPasswordLogic } from '../services/passwordReset.service.js';

export async function forgotPassword(req, res, next) {
  try {
    await requestPasswordResetLogic(req.body.email);
    return res.status(200).json({ success: true, data: { sent: true }, message: 'If an account uses that email, a code is on its way.' });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    await resetPasswordLogic(req.body);
    return res.status(200).json({ success: true, data: { reset: true }, message: 'Password changed. Sign in with your new password.' });
  } catch (error) {
    return next(error);
  }
}
