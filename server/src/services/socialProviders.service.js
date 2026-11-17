import config from '../config/config.js';

// Every network call for social sign-in goes through this module; tests mock it.
// Provider tokens are used once to read the profile and then dropped: never stored or logged.
const TIMEOUT_MS = 10000;

// kind: rejected (bad code, denied) | unavailable (network, 5xx, malformed answer)
export class SocialProviderError extends Error {
  constructor(kind, detail) {
    super(`Sign-in provider request failed (${kind})`);
    this.name = 'SocialProviderError';
    this.kind = kind;
    // A fixed error word from the provider (e.g. invalid_grant), safe to log.
    if (typeof detail === 'string' && /^[a-z_]{1,64}$/.test(detail)) this.detail = detail;
  }
}

async function send(url, { method = 'GET', token, form, json, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DevTrack',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(json ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: form ? new URLSearchParams(form).toString() : json ? JSON.stringify(json) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new SocialProviderError('unavailable');
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) throw new SocialProviderError(response.status >= 500 ? 'unavailable' : 'rejected', data?.error);
  return data;
}

function accessTokenFrom(data) {
  if (typeof data?.access_token !== 'string' || !data.access_token) throw new SocialProviderError('rejected', data?.error);
  return data.access_token;
}

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Normalised profile: the provider's stable id, the email and whether the provider verified it.
function profile({ id, email, emailVerified, name, login }) {
  const providerUserId = typeof id === 'number' ? String(id) : text(id, 128);
  if (!providerUserId) throw new SocialProviderError('unavailable');
  return {
    providerUserId,
    email: text(email, 254).toLowerCase(),
    emailVerified: emailVerified === true,
    name: text(name, 100),
    login: text(login, 39),
  };
}

const PROVIDERS = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
    pkce: true,
    extraParams: { prompt: 'select_account' },
    async fetchProfile({ code, codeVerifier }) {
      const { clientId, clientSecret, callbackUrl } = config.SOCIAL.google;
      const token = accessTokenFrom(await send('https://oauth2.googleapis.com/token', {
        method: 'POST',
        form: { code, client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl, grant_type: 'authorization_code', code_verifier: codeVerifier },
      }));
      const info = await send('https://openidconnect.googleapis.com/v1/userinfo', { token });
      return profile({ id: info?.sub, email: info?.email, emailVerified: info?.email_verified, name: info?.name });
    },
  },
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    scope: 'read:user user:email',
    pkce: true,
    extraParams: {},
    async fetchProfile({ code, codeVerifier }) {
      const { clientId, clientSecret, callbackUrl } = config.SOCIAL.github;
      // GitHub answers 200 with an `error` field for a bad code, so the body decides.
      const token = accessTokenFrom(await send('https://github.com/login/oauth/access_token', {
        method: 'POST',
        json: { client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl, code_verifier: codeVerifier },
      }));
      const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
      const user = await send('https://api.github.com/user', { token, headers });
      const emails = await send('https://api.github.com/user/emails', { token, headers });
      const primary = (Array.isArray(emails) ? emails : []).find(entry => entry?.primary && entry?.verified);
      // Withdraw the token straight away: DevTrack only needed the profile.
      revokeGitHubToken(token);
      return profile({ id: Number.isInteger(user?.id) ? user.id : null, email: primary?.email, emailVerified: Boolean(primary), name: user?.name || user?.login, login: user?.login });
    },
  },
  linkedin: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scope: 'openid profile email',
    // LinkedIn's web flow authenticates with the client secret; state still binds the browser.
    pkce: false,
    extraParams: {},
    async fetchProfile({ code }) {
      const { clientId, clientSecret, callbackUrl } = config.SOCIAL.linkedin;
      const token = accessTokenFrom(await send('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        form: { grant_type: 'authorization_code', code, redirect_uri: callbackUrl, client_id: clientId, client_secret: clientSecret },
      }));
      const info = await send('https://api.linkedin.com/v2/userinfo', { token });
      return profile({ id: info?.sub, email: info?.email, emailVerified: info?.email_verified, name: info?.name });
    },
  },
};

async function revokeGitHubToken(token) {
  const { clientId, clientSecret } = config.SOCIAL.github;
  try {
    await send(`https://api.github.com/applications/${encodeURIComponent(clientId)}/token`, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
      json: { access_token: token },
    });
  } catch {
    // Best effort: the token also stops working when the user revokes the app on GitHub.
  }
}

export function buildAuthorizeUrl(provider, { state, codeChallenge }) {
  const settings = PROVIDERS[provider];
  const { clientId, callbackUrl } = config.SOCIAL[provider];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: settings.scope,
    state,
    ...(settings.pkce ? { code_challenge: codeChallenge, code_challenge_method: 'S256' } : {}),
    ...settings.extraParams,
  });
  return `${settings.authorizeUrl}?${params}`;
}

export const usesPkce = provider => PROVIDERS[provider].pkce;

export function fetchSocialProfile(provider, { code, codeVerifier }) {
  return PROVIDERS[provider].fetchProfile({ code, codeVerifier });
}
