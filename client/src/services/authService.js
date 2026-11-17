
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

// Social sign-in. The server returns the provider URL; the browser goes there and comes back to /api.
export async function listSocialProviders() {
  const { data } = await api.get('/auth/oauth/providers');
  return data.data.providers.filter(provider => provider.enabled);
}

export async function startSocialSignIn(provider, returnTo = 'app') {
  await ensureCsrfToken();
  const { data } = await api.post(`/auth/oauth/${encodeURIComponent(provider)}/login`, { returnTo });
  window.location.assign(data.data.authorizeUrl);
}

export async function startSocialLink(provider) {
  const { data } = await api.post(`/auth/oauth/${encodeURIComponent(provider)}/link`, {});
  window.location.assign(data.data.authorizeUrl);
}

export async function listIdentities() {
  const { data } = await api.get('/auth/identities');
  return data.data.identities;
}

export async function unlinkIdentity(provider, currentPassword) {
  await api.delete(`/auth/identities/${encodeURIComponent(provider)}`, { data: currentPassword ? { currentPassword } : {} });
}

// Two-factor authentication. The pending sign-in lives in an HttpOnly cookie set by the server.
export async function verifyTwoFactor(details) {
  await ensureCsrfToken();
  const { data } = await api.post('/auth/2fa/verify', details);
  return data;
}

export async function getTwoFactorStatus() {
  const { data } = await api.get('/auth/2fa');
  return data.data;
}

export async function startTwoFactorSetup(currentPassword) {
  const { data } = await api.post('/auth/2fa/setup', currentPassword ? { currentPassword } : {});
  return data.data;
}

export async function enableTwoFactor(code) {
  const { data } = await api.post('/auth/2fa/enable', { code });
  return data.data;
}

export async function disableTwoFactor(details) {
  const { data } = await api.post('/auth/2fa/disable', details);
  return data.data;
}

export async function regenerateRecoveryCodes(code) {
  const { data } = await api.post('/auth/2fa/recovery-codes', { code });
  return data.data;
}

// Email verification: a 6-digit code goes to the account's email.
export async function sendVerificationEmail() {
  const { data } = await api.post('/auth/email/send', {});
  return data.data;
}

export async function verifyEmail(code) {
  const { data } = await api.post('/auth/email/verify', { code });
  return data.data;
}
