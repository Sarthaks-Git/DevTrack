import { listActivityLogic, activitySummaryLogic } from '../services/activity.service.js';

export async function listActivity(req, res, next) {
  try {
    const { limit, before, type } = req.query;
    const result = await listActivityLogic(req.auth.userId, { limit, before, type });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function activitySummary(req, res, next) {
  try {
    const summary = await activitySummaryLogic(req.auth.userId);
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    return next(error);
  }
}
