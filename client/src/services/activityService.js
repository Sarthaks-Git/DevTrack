import api from './api';

export async function getActivity({ limit, before, type } = {}) {
  const params = Object.fromEntries(Object.entries({ limit, before, type }).filter(([, value]) => value));
  const { data } = await api.get('/activity', { params });
  return data.data;
}

export async function getActivitySummary() {
  const { data } = await api.get('/activity/summary');
  return data.data;
}
