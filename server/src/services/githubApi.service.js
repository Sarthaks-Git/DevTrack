import config from '../config/config.js';

// Every network call to GitHub goes through this module; tests mock it.
// Tokens are passed in per call and never logged or attached to errors.
const API_URL = 'https://api.github.com';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const TIMEOUT_MS = 10000;
const REPO_NAME = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const MAX_INSTALLATIONS = 10;
const MAX_REPOS = 300;
const MAX_FILES = 50;

// kind: unauthorized | rate_limited | forbidden | not_found | empty | rejected | unavailable
export class GitHubApiError extends Error {
  constructor(kind) {
    super(`GitHub request failed (${kind})`);
    this.name = 'GitHubApiError';
    this.kind = kind;
  }
}

function kindForStatus(response) {
  if (response.status === 401) return 'unauthorized';
  if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) return 'rate_limited';
  if (response.status === 403) return 'forbidden';
  if (response.status === 404) return 'not_found';
  // GitHub answers 409 when listing commits of an empty repository.
  if (response.status === 409) return 'empty';
  return 'unavailable';
}

async function send(url, { method = 'GET', token, body, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'DevTrack',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new GitHubApiError('unavailable');
  }
  if (!response.ok) throw new GitHubApiError(kindForStatus(response));
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new GitHubApiError('unavailable');
  }
}

const assertRepoName = fullName => {
  if (typeof fullName !== 'string' || !REPO_NAME.test(fullName)) throw new GitHubApiError('not_found');
  return fullName;
};

function readTokens(data) {
  if (!data || typeof data.access_token !== 'string' || !data.access_token) {
    const failure = new GitHubApiError(data?.error === 'bad_refresh_token' ? 'unauthorized' : 'rejected');
    // GitHub's error word (e.g. incorrect_client_credentials) is a fixed code, safe to log.
    if (typeof data?.error === 'string' && /^[a-z_]{1,64}$/.test(data.error)) failure.detail = data.error;
    throw failure;
  }
  const seconds = value => (Number.isInteger(value) && value > 0 ? value : null);
  return {
    accessToken: data.access_token,
    expiresIn: seconds(data.expires_in),
    refreshToken: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : null,
    refreshTokenExpiresIn: seconds(data.refresh_token_expires_in),
  };
}

// The token endpoint returns 200 with an `error` field for a bad code, so the body decides.
export async function exchangeCode({ code, codeVerifier }) {
  const { clientId, clientSecret, callbackUrl } = config.GITHUB;
  const data = await send(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: { client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl, code_verifier: codeVerifier },
  });
  return readTokens(data);
}

export async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = config.GITHUB;
  const data = await send(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: { client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken },
  });
  return readTokens(data);
}

export async function getAuthenticatedUser(token) {
  const data = await send(`${API_URL}/user`, { token });
  if (!Number.isInteger(data?.id) || typeof data.login !== 'string') throw new GitHubApiError('unavailable');
  return { id: data.id, login: data.login.slice(0, 39) };
}

// Repositories the user has granted this GitHub App access to, across their installations.
export async function listInstallationRepos(token) {
  const installations = await send(`${API_URL}/user/installations?per_page=100`, { token });
  const repos = new Map();
  for (const installation of (installations?.installations || []).slice(0, MAX_INSTALLATIONS)) {
    if (!Number.isInteger(installation?.id)) continue;
    for (let page = 1; page <= 3 && repos.size < MAX_REPOS; page += 1) {
      const data = await send(`${API_URL}/user/installations/${installation.id}/repositories?per_page=100&page=${page}`, { token });
      const list = data?.repositories || [];
      for (const repo of list) {
        if (!Number.isInteger(repo?.id) || !REPO_NAME.test(repo.full_name || '')) continue;
        repos.set(repo.id, {
          id: repo.id,
          fullName: repo.full_name,
          private: Boolean(repo.private),
          url: `https://github.com/${repo.full_name}`,
        });
      }
      if (list.length < 100) break;
    }
  }
  return [...repos.values()].slice(0, MAX_REPOS).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function listCommits(token, fullName, { author, since }) {
  const params = new URLSearchParams({ author, per_page: '100' });
  if (since) params.set('since', since.toISOString());
  let data;
  try {
    data = await send(`${API_URL}/repos/${assertRepoName(fullName)}/commits?${params}`, { token });
  } catch (error) {
    if (error.kind === 'empty') return [];
    throw error;
  }
  return (Array.isArray(data) ? data : []).filter(item => /^[0-9a-f]{40}$/.test(item?.sha || '')).map(item => ({
    sha: item.sha,
    message: String(item.commit?.message || ''),
    committedAt: new Date(item.commit?.author?.date || item.commit?.committer?.date || Date.now()),
    authorId: Number.isInteger(item.author?.id) ? item.author.id : null,
  }));
}

// Only file paths are read from the response; patches are ignored and never stored or forwarded.
export async function getCommitFiles(token, fullName, sha) {
  const data = await send(`${API_URL}/repos/${assertRepoName(fullName)}/commits/${sha}`, { token });
  return (data?.files || []).map(file => String(file?.filename || '')).filter(Boolean).slice(0, MAX_FILES).map(path => path.slice(0, 300));
}

// Revokes the user's authorization of the app (all tokens). Basic auth with the app credentials.
export async function revokeGrant(accessToken) {
  const { clientId, clientSecret } = config.GITHUB;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  await send(`${API_URL}/applications/${encodeURIComponent(clientId)}/grant`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${basic}` },
    body: { access_token: accessToken },
  });
}

export const GITHUB_LIMITS = { MAX_REPOS, MAX_FILES };
