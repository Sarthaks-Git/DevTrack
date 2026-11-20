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

// AI mentor: a written note on a weekly review. GET is free (the saved note or null); POST writes
// one with 1 AI action and replaces the old one.
const weekParams = week => ({ today: localDayKey(), tz: -new Date().getTimezoneOffset(), week });

export async function getWeeklyReviewNote(week = 'current') {
  const { data } = await api.get('/dashboard/weekly/ai', { params: weekParams(week) });
  return data.data.note;
}

export async function writeWeeklyReviewNote(week = 'current') {
  const { data } = await api.post('/dashboard/weekly/ai', undefined, { params: weekParams(week) });
  return data.data.note;
}
