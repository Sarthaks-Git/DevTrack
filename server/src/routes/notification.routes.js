import { Router } from 'express';
import {
  listNotifications, unreadCount, markRead, markAllRead, getReminderSettings, updateReminderSettings,
} from '../controllers/notification.controller.js';
import { validateNotificationList, validateTodayOnly, validateReminderSettings } from '../validators/notification.validator.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { validateObjectId } from '../middlewares/validateObjectId.middleware.js';
import { notificationRateLimit } from '../middlewares/rateLimit.middleware.js';

// Notifications are created only by the server; clients can read them and mark them read.
const notificationRouter = Router();
notificationRouter.use(authMiddleware, notificationRateLimit);
notificationRouter.get('/', validateNotificationList, listNotifications);
notificationRouter.get('/unread-count', validateTodayOnly, unreadCount);
notificationRouter.post('/read-all', requireCsrf, markAllRead);
notificationRouter.get('/settings', getReminderSettings);
notificationRouter.patch('/settings', requireCsrf, validateReminderSettings, updateReminderSettings);
notificationRouter.patch('/:id/read', requireCsrf, validateObjectId('id'), markRead);
export default notificationRouter;
