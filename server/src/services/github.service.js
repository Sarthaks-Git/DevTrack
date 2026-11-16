import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../config/config.js';
import GitHubConnection from '../models/GitHubConnection.js';
import GitHubCommit from '../models/GitHubCommit.js';
import OAuthState from '../models/OAuthState.js';
import Project from '../models/Project.js';
import AppError from '../utils/AppError.js';
import { decryptSecret, encryptSecret, randomToken, sha256 } from '../utils/tokenCrypto.js';
import * as github from './githubApi.service.js';
import { recordActivity } from './activity.service.js';

export const GITHUB_RULES = {
  stateTtlMs: 10 * 60 * 1000,
  // Automatic sync (on app open) runs at most every 10 minutes; "Sync now" at most once a minute.
  autoSyncIntervalMs: 10 * 60 * 1000,
  manualSyncIntervalMs: 60 * 1000,
  backfillDays: 30,
  maxLinkedProjects: 20,
  // File paths cost one extra request per commit, so only the newest few per repo get them.
  maxFileLookups: 20,
  refreshMarginMs: 5 * 60 * 1000,
};

const DAY_MS = 24 * 60 * 60 * 1000;
// Associated data for token encryption: a ciphertext only decrypts for this owner and field.
const tokenContext = (owner, field) => `github:${field}:${owner}`;

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

function assertEnabled() {
  if (!config.GITHUB.enabled) throw new AppError('GitHub connection is not set up on this server', 503, 'GITHUB_NOT_CONFIGURED');
}

const reauthError = () => new AppError('GitHub access expired or was revoked. Reconnect GitHub in Settings.', 409, 'GITHUB_REAUTH_REQUIRED');

function providerError(error) {
  if (error?.name !== 'GitHubApiError') return error;
  if (error.kind === 'rate_limited') return new AppError('GitHub rate limit reached. Try again later.', 429, 'GITHUB_RATE_LIMITED');
  return new AppError('GitHub could not be reached. Try again later.', 502, 'GITHUB_UNAVAILABLE');
}

function logFailure(what, error) {
  if (process.env.NODE_ENV !== 'test') process.stderr.write(`GitHub ${what} failed: ${error?.kind || error?.name || 'Error'}\n`);
}

const installUrl = () => (config.GITHUB.enabled ? `https://github.com/apps/${config.GITHUB.appSlug}/installations/new` : null);

function publicConnection(connection) {
  if (!connection) return null;
  return {
    login: connection.login,
    profileUrl: `https://github.com/${connection.login}`,
    status: connection.status,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt,
  };
}

function publicRepository(repository) {
  if (!repository) return null;
  const { githubId, fullName, url, linkedAt, syncedAt, lastCommitAt } = repository;
  return { githubId, fullName, url, private: Boolean(repository.private), linkedAt, syncedAt, lastCommitAt };
}

// First line only, control characters removed: commit messages are untrusted text.
function cleanMessage(message) {
  // eslint-disable-next-line no-control-regex
  const line = String(message).split(/\r?\n/)[0].replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return (line || '(no message)').slice(0, 200);
}

function tokenSet(owner, tokens, now = Date.now()) {
  const at = seconds => (seconds ? new Date(now + seconds * 1000) : null);
  return {
    accessToken: encryptSecret(tokens.accessToken, tokenContext(owner, 'access')),
    accessTokenExpiresAt: at(tokens.expiresIn),
    refreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken, tokenContext(owner, 'refresh')) : null,
    refreshTokenExpiresAt: at(tokens.refreshTokenExpiresIn),
  };
}

async function markReauthRequired(owner) {
  await GitHubConnection.updateOne({ owner }, { $set: { status: 'reauth_required' } });
}

// Returns a valid access token, refreshing it when it is about to expire. GitHub App user
// tokens last 8 hours; refresh tokens rotate on every use.
async function usableToken(owner) {
  const connection = await GitHubConnection.findOne({ owner }).select('+accessToken +refreshToken');
  if (!connection) throw new AppError('Connect GitHub in Settings first', 404, 'GITHUB_NOT_CONNECTED');
  if (connection.status !== 'connected') throw reauthError();

  const expiresAt = connection.accessTokenExpiresAt?.getTime();
  if (!expiresAt || expiresAt - Date.now() > GITHUB_RULES.refreshMarginMs) {
    return { connection, token: decryptSecret(connection.accessToken, tokenContext(owner, 'access')) };
  }

  if (!connection.refreshToken || (connection.refreshTokenExpiresAt && connection.refreshTokenExpiresAt <= new Date())) {
    await markReauthRequired(owner);
    throw reauthError();
  }

  let tokens;
  try {
    tokens = await github.refreshAccessToken(decryptSecret(connection.refreshToken, tokenContext(owner, 'refresh')));
  } catch (error) {
    // A parallel request may have rotated the refresh token first; use its result if so.
    const latest = await GitHubConnection.findOne({ owner }).select('+accessToken');
    if (latest && latest.accessToken !== connection.accessToken && latest.status === 'connected') {
      return { connection: latest, token: decryptSecret(latest.accessToken, tokenContext(owner, 'access')) };
    }
    if (error?.kind === 'unauthorized' || error?.kind === 'rejected') {
      await markReauthRequired(owner);
      throw reauthError();
    }
    throw providerError(error);
  }

  Object.assign(connection, tokenSet(owner, tokens));
  await connection.save();
  return { connection, token: tokens.accessToken };
}

async function withGitHub(owner, task) {
  const { connection, token } = await usableToken(owner);
  try {
    return await task(token, connection);
  } catch (error) {
    if (error?.kind === 'unauthorized') {
      await markReauthRequired(owner);
      throw reauthError();
    }
    throw providerError(error);
  }
}

async function findOwnedProject(owner, projectId) {
  if (!mongoose.isValidObjectId(projectId)) throw new AppError('Invalid resource ID', 400);
  const project = await Project.findOne({ _id: projectId, owner });
  if (!project) throw new AppError('Project not found', 404);
  return project;
}

// Clears every repository link and synced commit, e.g. when a different GitHub account connects.
async function forgetRepositories(owner) {
  await Promise.all([
    GitHubCommit.deleteMany({ owner }),
    Project.updateMany({ owner, repository: { $ne: null } }, { $set: { repository: null } }, { timestamps: false }),
  ]);
}

export async function getGitHubStatusLogic(userId) {
  assertUserId(userId);
  const connection = await GitHubConnection.findOne({ owner: userId }).lean();
  return { available: config.GITHUB.enabled, installUrl: installUrl(), connection: publicConnection(connection) };
}

// Step 1 of OAuth: a random state (stored hashed) plus a PKCE verifier (stored encrypted).
// The raw state goes back to the controller, which also pins it to this browser in a cookie.
export async function startGitHubConnectLogic(userId) {
  assertUserId(userId);
  assertEnabled();

  const state = randomToken(32);
  const verifier = randomToken(48);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  await OAuthState.deleteMany({ owner: userId, provider: 'github' });
  await OAuthState.create({
    owner: userId,
    provider: 'github',
    stateHash: sha256(state),
    codeVerifier: encryptSecret(verifier, tokenContext(userId, 'pkce')),
    expiresAt: new Date(Date.now() + GITHUB_RULES.stateTtlMs),
  });

  const params = new URLSearchParams({
    client_id: config.GITHUB.clientId,
    redirect_uri: config.GITHUB.callbackUrl,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return { state, authorizeUrl: `https://github.com/login/oauth/authorize?${params}` };
}

function sameState(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Step 2 of OAuth. Returns an outcome word for the redirect; never throws to the browser.
// The DevTrack account is the one that started the handshake (from the state record),
// not whoever happens to be signed in when the callback arrives.
export async function completeGitHubConnectLogic({ code, state, error, browserState }) {
  if (!config.GITHUB.enabled) return 'failed';
  if (!state || !sameState(state, browserState)) return 'expired';

  const record = await OAuthState.findOneAndDelete({ stateHash: sha256(state), provider: 'github', expiresAt: { $gt: new Date() } });
  if (!record) return 'expired';
  if (error) return 'denied';
  if (!code) return 'failed';

  const owner = record.owner;
  try {
    const tokens = await github.exchangeCode({ code, codeVerifier: decryptSecret(record.codeVerifier, tokenContext(owner, 'pkce')) });
    const user = await github.getAuthenticatedUser(tokens.accessToken);

    const claimed = await GitHubConnection.findOne({ githubId: user.id }).lean();
    if (claimed && String(claimed.owner) !== String(owner)) return 'in_use';

    // A different GitHub account must not inherit the previous account's repositories or commits.
    const previous = await GitHubConnection.findOne({ owner }).lean();
    if (previous && previous.githubId !== user.id) await forgetRepositories(owner);

    await GitHubConnection.findOneAndUpdate(
      { owner },
      { $set: { githubId: user.id, login: user.login, status: 'connected', connectedAt: new Date(), ...tokenSet(owner, tokens) } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    await recordActivity(owner, {
      type: 'github_connected',
      subjectType: 'github',
      title: `GitHub account ${user.login} connected`,
      source: 'verified',
    });
    return 'connected';
  } catch (failure) {
    if (failure?.code === 11000) return 'in_use';
    logFailure('connect', failure);
    return 'failed';
  }
}

export async function listGitHubReposLogic(userId) {
  assertUserId(userId);
  assertEnabled();
  const repos = await withGitHub(userId, token => github.listInstallationRepos(token));
  const linked = await Project.find({ owner: userId, repository: { $ne: null } }).select('title repository.githubId').lean();
  const projectByRepo = new Map(linked.map(project => [project.repository.githubId, { id: String(project._id), title: project.title }]));
  return { installUrl: installUrl(), repos: repos.map(repo => ({ ...repo, linkedProject: projectByRepo.get(repo.id) || null })) };
}

export async function linkRepositoryLogic(userId, projectId, repoId) {
  assertUserId(userId);
  assertEnabled();
  const project = await findOwnedProject(userId, projectId);

  // The repo must be one the user's installation can see right now; client-sent names are never trusted.
  const repos = await withGitHub(userId, token => github.listInstallationRepos(token));
  const repo = repos.find(item => item.id === repoId);
  if (!repo) throw new AppError('DevTrack has no access to that repository. Choose repositories on GitHub first.', 404, 'REPO_NOT_ACCESSIBLE');

  const other = await Project.findOne({ owner: userId, 'repository.githubId': repoId, _id: { $ne: project._id } }).select('title').lean();
  if (other) throw new AppError(`That repository is already linked to "${other.title}"`, 409, 'REPO_ALREADY_LINKED');

  if (!project.repository) {
    const linkedCount = await Project.countDocuments({ owner: userId, repository: { $ne: null } });
    if (linkedCount >= GITHUB_RULES.maxLinkedProjects) {
      throw new AppError(`You can link up to ${GITHUB_RULES.maxLinkedProjects} repositories`, 409, 'RECORD_LIMIT');
    }
  } else if (project.repository.githubId !== repoId) {
    await GitHubCommit.deleteMany({ owner: userId, project: project._id });
  }

  if (project.repository?.githubId !== repoId) {
    project.repository = { githubId: repo.id, fullName: repo.fullName, url: repo.url, private: repo.private, linkedAt: new Date() };
    await project.save();
  }
  return publicRepository(project.repository);
}

export async function unlinkRepositoryLogic(userId, projectId) {
  assertUserId(userId);
  const project = await findOwnedProject(userId, projectId);
  if (!project.repository) throw new AppError('This project has no linked repository', 404);
  project.repository = null;
  await project.save();
  await GitHubCommit.deleteMany({ owner: userId, project: project._id });
}

async function syncProject(owner, project, connection, token) {
  const { repository } = project;
  // Re-read an hour of overlap so commits pushed with an older author date are not missed.
  const since = repository.syncedAt
    ? new Date(repository.syncedAt.getTime() - 60 * 60 * 1000)
    : new Date(Date.now() - GITHUB_RULES.backfillDays * DAY_MS);

  const listed = await github.listCommits(token, repository.fullName, { author: connection.login, since });
  // Only commits GitHub attributes to this exact account count as verified work.
  const authored = listed.filter(commit => commit.authorId === connection.githubId);
  const known = new Set((await GitHubCommit.find({ owner, repoId: repository.githubId, sha: { $in: authored.map(c => c.sha) } }).select('sha').lean()).map(c => c.sha));
  const fresh = authored.filter(commit => !known.has(commit.sha)).sort((a, b) => b.committedAt - a.committedAt);

  let added = 0;
  let newest = repository.lastCommitAt?.getTime() || 0;
  for (const [index, commit] of fresh.entries()) {
    const files = index < GITHUB_RULES.maxFileLookups ? await github.getCommitFiles(token, repository.fullName, commit.sha) : [];
    const message = cleanMessage(commit.message);
    try {
      await GitHubCommit.create({
        owner,
        project: project._id,
        repoId: repository.githubId,
        repoFullName: repository.fullName,
        sha: commit.sha,
        message,
        url: `${repository.url}/commit/${commit.sha}`,
        committedAt: commit.committedAt,
        files,
      });
    } catch (error) {
      if (error?.code === 11000) continue; // a parallel sync stored it first
      throw error;
    }
    added += 1;
    newest = Math.max(newest, commit.committedAt.getTime());
    await recordActivity(owner, {
      type: 'commit_pushed',
      subjectType: 'project',
      subjectId: project._id,
      title: message,
      detail: repository.fullName,
      source: 'verified',
      occurredAt: commit.committedAt,
    });
  }

  // Sync bookkeeping is not a user edit, so it must not bump the project's updatedAt.
  await Project.updateOne(
    { _id: project._id, owner, 'repository.githubId': repository.githubId },
    { $set: { 'repository.syncedAt': new Date(), 'repository.lastCommitAt': newest ? new Date(newest) : null } },
    { timestamps: false }
  );
  return added;
}

// manual: "Sync now" (short throttle). Otherwise an automatic sync on app open (long throttle).
export async function syncGitHubLogic(userId, { manual = false } = {}) {
  assertUserId(userId);
  if (!config.GITHUB.enabled) return { status: 'not_configured' };

  const now = new Date();
  const interval = manual ? GITHUB_RULES.manualSyncIntervalMs : GITHUB_RULES.autoSyncIntervalMs;
  // Atomic claim: only one sync per user runs inside the interval, however many tabs ask.
  const claimed = await GitHubConnection.findOneAndUpdate(
    { owner: userId, status: 'connected', $or: [{ lastSyncAt: null }, { lastSyncAt: { $lte: new Date(now - interval) } }] },
    { $set: { lastSyncAt: now } }
  ).lean();

  if (!claimed) {
    const connection = await GitHubConnection.findOne({ owner: userId }).lean();
    if (!connection) return { status: 'not_connected' };
    if (connection.status !== 'connected') return { status: 'reauth_required' };
    return { status: 'skipped', lastSyncAt: connection.lastSyncAt };
  }

  const projects = await Project.find({ owner: userId, repository: { $ne: null } }).limit(GITHUB_RULES.maxLinkedProjects);
  if (!projects.length) return { status: 'synced', newCommits: 0, unavailable: [], lastSyncAt: now };

  return withGitHub(userId, async (token, connection) => {
    let newCommits = 0;
    const unavailable = [];
    for (const project of projects) {
      try {
        newCommits += await syncProject(userId, project, connection, token);
      } catch (error) {
        // Access to one repo removed: report it and keep syncing the rest.
        if (error?.kind === 'not_found' || error?.kind === 'forbidden') {
          unavailable.push({ projectId: String(project._id), fullName: project.repository.fullName });
          continue;
        }
        throw error;
      }
    }
    return { status: 'synced', newCommits, unavailable, lastSyncAt: now };
  });
}

export async function listProjectCommitsLogic(userId, projectId) {
  assertUserId(userId);
  const project = await findOwnedProject(userId, projectId);
  const commits = await GitHubCommit.find({ owner: userId, project: project._id })
    .sort({ committedAt: -1 })
    .limit(20)
    .select('sha message url committedAt files')
    .lean();
  return {
    repository: publicRepository(project.repository),
    commits: commits.map(commit => ({
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      message: commit.message,
      url: commit.url,
      committedAt: commit.committedAt,
      fileCount: commit.files.length,
    })),
  };
}

// Best effort: GitHub being down must not block a disconnect or account deletion.
export async function revokeGitHubAccess(userId) {
  const connection = await GitHubConnection.findOne({ owner: userId }).select('+accessToken').lean();
  if (!connection || !config.GITHUB.enabled) return;
  try {
    await github.revokeGrant(decryptSecret(connection.accessToken, tokenContext(userId, 'access')));
  } catch (error) {
    logFailure('revoke', error);
  }
}

export async function disconnectGitHubLogic(userId) {
  assertUserId(userId);
  const connection = await GitHubConnection.findOne({ owner: userId }).lean();
  if (!connection) throw new AppError('GitHub is not connected', 404, 'GITHUB_NOT_CONNECTED');

  await revokeGitHubAccess(userId);
  await Promise.all([
    GitHubConnection.deleteOne({ owner: userId }),
    OAuthState.deleteMany({ owner: userId }),
    forgetRepositories(userId),
  ]);

  await recordActivity(userId, {
    type: 'github_disconnected',
    subjectType: 'github',
    title: `GitHub account ${connection.login} disconnected`,
    source: 'system',
  });
}

export async function deleteProjectCommits(owner, projectId) {
  await GitHubCommit.deleteMany({ owner, project: projectId });
}
