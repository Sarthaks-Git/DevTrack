import api from './api';
import { localDayKey } from '../utils/localDay';

export async function getNotifications({ limit = 20, before } = {}) {
  const params = { limit, today: localDayKey(), ...(before ? { before } : {}) };
  const { data } = await api.get('/notifications', { params });
  return data.data;
}

export async function getUnreadCount() {
  const { data } = await api.get('/notifications/unread-count', { params: { today: localDayKey() } });
  return data.data.unread;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data.data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/read-all');
  return data.data;
}

export async function getReminderSettings() {
  const { data } = await api.get('/notifications/settings');
  return data.data;
}

export async function updateReminderSettings(changes) {
  const { data } = await api.patch('/notifications/settings', changes);
  return data.data;
}
