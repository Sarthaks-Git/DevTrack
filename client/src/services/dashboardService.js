import api from './api';
import { localDayKey } from '../utils/localDay';

export async function getAttention() {
  const { data } = await api.get('/dashboard/attention', { params: { today: localDayKey() } });
  return data.data;
}

// week: "current" or "last". tz is minutes east of UTC so weeks run Monday-Sunday locally.
export async function getWeeklyReview(week = 'current') {
  const { data } = await api.get('/dashboard/weekly', {
    params: { today: localDayKey(), tz: -new Date().getTimezoneOffset(), week },
  });
  return data.data;
}
