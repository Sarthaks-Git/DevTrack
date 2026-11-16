import { Router } from 'express';
import {
  disconnectGitHub,
  getGitHubStatus,
  githubCallback,
  listGitHubRepos,
  startGitHubConnect,
  syncGitHub,
} from '../controllers/github.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import {
  githubCallbackRateLimit,
  githubConnectRateLimit,
  githubReadRateLimit,
  githubSyncRateLimit,
  limitWrites,
} from '../middlewares/rateLimit.middleware.js';
import { validateGitHubCallback, validateSyncRequest } from '../validators/github.validator.js';

const githubRouter = Router();

// Unauthenticated on purpose: the short-lived access cookie may have expired while the user was on
// GitHub. The handshake is bound to its account by the single-use state and to this browser by a cookie.
githubRouter.get('/callback', githubCallbackRateLimit, validateGitHubCallback, githubCallback);

githubRouter.use(authMiddleware, limitWrites);
githubRouter.get('/', getGitHubStatus);
githubRouter.post('/connect', githubConnectRateLimit, requireCsrf, startGitHubConnect);
githubRouter.get('/repos', githubReadRateLimit, listGitHubRepos);
githubRouter.post('/sync', githubSyncRateLimit, requireCsrf, validateSyncRequest, syncGitHub);
githubRouter.delete('/', requireCsrf, disconnectGitHub);

export default githubRouter;
