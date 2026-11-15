import {
  listNotificationsLogic, unreadCountLogic, markReadLogic, markAllReadLogic,
  getReminderSettingsLogic, updateReminderSettingsLogic,
} from '../services/notification.service.js';

const handle = fn => async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, data: await fn(req) });
  } catch (error) {
    return next(error);
  }
};

export const listNotifications = handle(req => listNotificationsLogic(req.auth.userId, req.validatedQuery));
export const unreadCount = handle(req => unreadCountLogic(req.auth.userId, req.validatedQuery.today));
export const markRead = handle(req => markReadLogic(req.auth.userId, req.params.id));
export const markAllRead = handle(req => markAllReadLogic(req.auth.userId));
export const getReminderSettings = handle(req => getReminderSettingsLogic(req.auth.userId));
export const updateReminderSettings = handle(req => updateReminderSettingsLogic(req.auth.userId, req.validatedBody));
