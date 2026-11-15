
import { Router } from 'express';

import {
    upsertCodingProfile,
    getUserCodingProfiles,
    deleteCodingProfile,
    refreshLeetCodeStats,
    startCodingVerification,
    verifyCodingProfile,
} from '../controllers/codingProfile.controller.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireCsrf } from '../middlewares/csrf.middleware.js';
import { verificationRateLimit, statsRefreshRateLimit, codingSyncRateLimit } from '../middlewares/rateLimit.middleware.js';
import { syncLeetCode, listSolvedProblems, listProblemDays } from '../controllers/problemTracking.controller.js';
import { validateSyncRequest, validateProblemListQuery, validateProblemDaysQuery } from '../validators/problemTracking.validator.js';
import { validateCodingProfile } from '../validators/codingProfile.validator.js';

import { validateTodayQuery } from '../validators/viewerDay.validator.js';
import { getSkills } from '../controllers/skills.controller.js';

const codingProfileRouter = Router();

codingProfileRouter.use(authMiddleware);

codingProfileRouter.get('/', getUserCodingProfiles);

codingProfileRouter.post(
    '/verification/start',
    verificationRateLimit,
    requireCsrf,
    startCodingVerification
);

codingProfileRouter.post(
    '/verification/verify',
    verificationRateLimit,
    requireCsrf,
    verifyCodingProfile
);

codingProfileRouter.post(
    '/leetcode/stats/refresh',
    statsRefreshRateLimit,
    requireCsrf,
    refreshLeetCodeStats
);

// Problem tracking (docs/LEETCODE_TRACKING_LOG.md).
codingProfileRouter.post(
    '/leetcode/sync',
    codingSyncRateLimit,
    requireCsrf,
    validateSyncRequest,
    syncLeetCode
);

codingProfileRouter.get('/leetcode/problems', validateProblemListQuery, listSolvedProblems);

codingProfileRouter.get('/leetcode/days', validateProblemDaysQuery, listProblemDays);

// Read-only skill signals derived from the stored problem log (no provider call).
codingProfileRouter.get('/leetcode/skills', validateTodayQuery, getSkills);

codingProfileRouter.put(
    '/leetcode',
    requireCsrf,
    validateCodingProfile,
    upsertCodingProfile
);

codingProfileRouter.delete(
    '/:platform',
    requireCsrf,
    deleteCodingProfile
);

export default codingProfileRouter;
