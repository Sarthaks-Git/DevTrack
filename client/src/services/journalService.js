import api from './api';

export async function getJournalEntries(params = {}) {
  const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null));
  const { data } = await api.get('/journal', { params: query });
  return data.data;
}

export async function createJournalEntry(entry) {
  const { data } = await api.post('/journal', entry);
  return data.data.entry;
}

export async function updateJournalEntry(id, entry) {
  const { data } = await api.patch(`/journal/${encodeURIComponent(id)}`, entry);
  return data.data.entry;
}

export async function deleteJournalEntry(id) {
  await api.delete(`/journal/${encodeURIComponent(id)}`);
}
