
import api, { ensureCsrfToken } from './api';

export async function login(credentials) {
  await ensureCsrfToken();

  const { data } = await api.post('/auth/login', credentials);

  return data;
}

export async function register(details) {
  await ensureCsrfToken();

  const { data } = await api.post('/auth/register', details);

  return data;
}

export async function getCurrentUser() {
  await ensureCsrfToken();

  try {
    const { data } = await api.get('/auth/me');

    return data.user;
  } catch (error) {
    if (error.response?.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function logout() {
  await ensureCsrfToken();

  await api.post('/auth/logout');
}

export async function updateProfile(details) {
  const { data } = await api.patch('/auth/profile', details);
  return data;
}

export async function changePassword(details) {
  const { data } = await api.patch('/auth/password', details);
  return data;
}

export async function getSessions() {
  const { data } = await api.get('/auth/sessions');
  return data.sessions;
}

export async function revokeSession(sessionId) {
  await api.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
}

export async function logoutEverywhere() {
  await api.post('/auth/logout-all');
}

export async function deleteAccount(details) {
  await api.delete('/auth/account', { data: details });
}
