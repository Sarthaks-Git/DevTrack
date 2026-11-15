import { getAttentionLogic } from '../services/attention.service.js';

export async function getAttention(req, res, next) {
  try {
    const data = await getAttentionLogic(req.auth.userId, req.validatedQuery.today);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
