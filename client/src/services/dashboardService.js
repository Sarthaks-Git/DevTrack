import api from './api';

// The viewer's local calendar day, so "overdue" on the server matches the date they see.
function localDayKey(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function getAttention() {
  const { data } = await api.get('/dashboard/attention', { params: { today: localDayKey() } });
  return data.data;
}
