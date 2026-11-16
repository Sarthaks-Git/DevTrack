import config from '../config/config.js';
import {
  GITHUB_RULES,
  completeGitHubConnectLogic,
  disconnectGitHubLogic,
  getGitHubStatusLogic,
  linkRepositoryLogic,
  listGitHubReposLogic,
  listProjectCommitsLogic,
  startGitHubConnectLogic,
  syncGitHubLogic,
  unlinkRepositoryLogic,
} from '../services/github.service.js';
import { GITHUB_STATE_COOKIE, clearGitHubStateCookie, setGitHubStateCookie } from '../utils/cookies.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export async function getGitHubStatus(req, res, next) {
  try {
    return ok(res, await getGitHubStatusLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}

export async function startGitHubConnect(req, res, next) {
  try {
    const { state, authorizeUrl } = await startGitHubConnectLogic(req.auth.userId);
    setGitHubStateCookie(res, state, GITHUB_RULES.stateTtlMs);
    return ok(res, { authorizeUrl });
  } catch (error) {
    return next(error);
  }
}

// Browser lands here from GitHub. Always redirects back to Settings with an outcome word only;
// no code, state or token ever appears in the client URL.
export async function githubCallback(req, res) {
  let outcome = 'failed';
  try {
    if (req.githubCallback) {
      outcome = await completeGitHubConnectLogic({ ...req.githubCallback, browserState: req.cookies?.[GITHUB_STATE_COOKIE] });
    }
  } catch {
    outcome = 'failed';
  }
  clearGitHubStateCookie(res);
  res.set('Referrer-Policy', 'no-referrer');
  return res.redirect(303, `${config.CLIENT_ORIGIN}/app/settings?github=${outcome}#github`);
}

export async function listGitHubRepos(req, res, next) {
  try {
    return ok(res, await listGitHubReposLogic(req.auth.userId));
  } catch (error) {
    return next(error);
  }
}

export async function syncGitHub(req, res, next) {
  try {
    return ok(res, await syncGitHubLogic(req.auth.userId, req.validatedSync));
  } catch (error) {
    return next(error);
  }
}

export async function disconnectGitHub(req, res, next) {
  try {
    await disconnectGitHubLogic(req.auth.userId);
    return ok(res, { disconnected: true });
  } catch (error) {
    return next(error);
  }
}

export async function linkRepository(req, res, next) {
  try {
    return ok(res, { repository: await linkRepositoryLogic(req.auth.userId, req.params.id, req.validatedRepoId) });
  } catch (error) {
    return next(error);
  }
}

export async function unlinkRepository(req, res, next) {
  try {
    await unlinkRepositoryLogic(req.auth.userId, req.params.id);
    return ok(res, { repository: null });
  } catch (error) {
    return next(error);
  }
}

export async function listProjectCommits(req, res, next) {
  try {
    return ok(res, await listProjectCommitsLogic(req.auth.userId, req.params.id));
  } catch (error) {
    return next(error);
  }
}
