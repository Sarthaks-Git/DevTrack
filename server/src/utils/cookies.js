
import config from '../config/config.js';

const ACCESS_COOKIE = 'devtrack_access';
const REFRESH_COOKIE = 'devtrack_refresh';
const CSRF_COOKIE = 'devtrack_csrf';

function sharedOptions() {
  return {
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
  };
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  const shared = sharedOptions();

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...shared,
    httpOnly: true,
    maxAge: config.ACCESS_TOKEN_TTL_MINUTES * 60_000,
    path: '/api',
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...shared,
    httpOnly: true,
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    path: '/api/auth',
  });
}

export function setCsrfCookie(res, token) {
  const shared = sharedOptions();

  res.cookie(CSRF_COOKIE, token, {
    ...shared,
    httpOnly: false,
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    path: '/',
  });
}

export function clearAuthCookies(res) {
  const shared = sharedOptions();

  res.clearCookie(ACCESS_COOKIE, {
    ...shared,
    httpOnly: true,
    path: '/api',
  });

  res.clearCookie(REFRESH_COOKIE, {
    ...shared,
    httpOnly: true,
    path: '/api/auth',
  });

  res.clearCookie(CSRF_COOKIE, {
    ...shared,
    httpOnly: false,
    path: '/',
  });
}

export {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
};

// Pins a GitHub OAuth handshake to the browser that started it. Always SameSite=Lax: the callback
// is a top-level navigation from github.com, which a Strict cookie would not accompany.
export const GITHUB_STATE_COOKIE = 'devtrack_github_state';
const GITHUB_STATE_PATH = '/api/integrations/github';

export function setGitHubStateCookie(res, state, maxAgeMs) {
  res.cookie(GITHUB_STATE_COOKIE, state, { secure: config.COOKIE_SECURE, sameSite: 'lax', httpOnly: true, maxAge: maxAgeMs, path: GITHUB_STATE_PATH });
}

export function clearGitHubStateCookie(res) {
  res.clearCookie(GITHUB_STATE_COOKIE, { secure: config.COOKIE_SECURE, sameSite: 'lax', httpOnly: true, path: GITHUB_STATE_PATH });
}

// The pending 2FA sign-in (password or provider already accepted). Lax so it survives the
// provider redirect; the code is still posted only with the CSRF header from our own pages.
export const TWO_FACTOR_COOKIE = 'devtrack_2fa';
const TWO_FACTOR_PATH = '/api/auth/2fa';

export function setTwoFactorCookie(res, token, maxAgeMs) {
  res.cookie(TWO_FACTOR_COOKIE, token, { secure: config.COOKIE_SECURE, sameSite: 'lax', httpOnly: true, maxAge: maxAgeMs, path: TWO_FACTOR_PATH });
}

export function clearTwoFactorCookie(res) {
  res.clearCookie(TWO_FACTOR_COOKIE, { secure: config.COOKIE_SECURE, sameSite: 'lax', httpOnly: true, path: TWO_FACTOR_PATH });
}

// Pins a social sign-in handshake to the browser that started it (SameSite=Lax for the same
// reason as above: the callback is a top-level navigation from the provider).
export const SOCIAL_STATE_COOKIE = 'devtrack_oauth_state';
const SOCIAL_STATE_PATH = '/api/auth/oauth';

export function setSocialStateCookie(res, state, maxAgeMs) {
  res.cookie(SOCIAL_STATE_COOKIE, state, { secure: config.COOKIE_SECURE, sameSite: 'lax', httpOnly: true, maxAge: maxAgeMs, path: SOCIAL_STATE_PATH });
}

export function clearSocialStateCookie(res) {
  res.clearCookie(SOCIAL_STATE_COOKIE, { secure: config.COOKIE_SECURE, sameSite: 'lax', httpOnly: true, path: SOCIAL_STATE_PATH });
}

// Random per-browser id used only to tell familiar browsers from new ones (new-sign-in alerts).
// Not a credential: it signs nobody in. Lax so it reaches the social sign-in callback; the path
// covers every sign-in route. Kept across sign-out so a returning browser is still recognized.
export const DEVICE_COOKIE = 'devtrack_device';
const DEVICE_MAX_AGE_MS = 400 * 86_400_000;

export function setDeviceCookie(res, token) {
  if (!token) return;
  res.cookie(DEVICE_COOKIE, token, { secure: config.COOKIE_SECURE, sameSite: 'lax', httpOnly: true, maxAge: DEVICE_MAX_AGE_MS, path: '/api/auth' });
}
