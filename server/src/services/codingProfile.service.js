
import mongoose from 'mongoose';
import CodingProfile from '../models/CodingProfile.js';
import AppError from '../utils/AppError.js';
import { fetchLeetCodeStats } from './leetcode.service.js';
import { recordActivity } from './activity.service.js';
import CodingSubmission from '../models/CodingSubmission.js';
import SolvedProblem from '../models/SolvedProblem.js';

function validateUserId(userId) {
    if (!mongoose.isObjectIdOrHexString(userId)) {
        throw new AppError('Unauthorized', 401);
    }
}

function normalizePlatform(platform) {
    if (typeof platform !== 'string') {
        throw new AppError('Unsupported coding platform', 400);
    }

    const normalized = platform.trim().toLowerCase();

    if (normalized !== 'leetcode') {
        throw new AppError('Unsupported coding platform', 400);
    }

    return normalized;
}

// Legacy username-only linking is disabled.
// All new profile connections must use the ownership-verification flow.
export async function upsertCodingProfileLogic(userId, profileData) {
    validateUserId(userId);

    normalizePlatform(profileData?.platform);

    throw new AppError(
        'Username-only linking is disabled. Use the coding profile verification flow.',
        410
    );
}

export async function getUserCodingProfilesLogic(userId) {
    validateUserId(userId);

    return CodingProfile.find({ owner: userId })
        .sort({ updatedAt: -1 })
        .lean();
}

export async function deleteCodingProfileLogic(userId, platformInput) {
    validateUserId(userId);

    const platform = normalizePlatform(platformInput);

    const profile = await CodingProfile.findOneAndDelete({
        owner: userId,
        platform,
    });

    if (!profile) {
        throw new AppError('Coding profile not found', 404);
    }

    // Tracked problems belong to that external account. If a different account is connected
    // later, it must not inherit this history (docs/LEETCODE_TRACKING_LOG.md, D9).
    await Promise.all([
        CodingSubmission.deleteMany({ owner: userId, platform }),
        SolvedProblem.deleteMany({ owner: userId, platform }),
    ]);

    await recordActivity(userId, {
        type: 'platform_disconnected',
        subjectType: 'coding_profile',
        subjectId: profile._id,
        title: `LeetCode account ${profile.username} disconnected`,
        source: 'system',
    });

    return profile;
}

export async function refreshLeetCodeStatsLogic(userId) {
    validateUserId(userId);

    const profile = await CodingProfile.findOne({
        owner: userId,
        platform: 'leetcode',
        connectionStatus: 'verified',
        normalizedUsername: { $type: 'string' },
    });

    if (!profile) {
        throw new AppError(
            'Connect and verify your LeetCode profile before refreshing statistics',
            403
        );
    }

    // Fetch first. If LeetCode fails or returns an invalid response,
    // do not overwrite previously saved statistics.
    const fetchedStats = await fetchLeetCodeStats(profile.username);

    // Reject incomplete or malformed responses rather than replacing
    // valid saved statistics with missing or invalid values.
    const requiredCounts = [
        'totalSolved',
        'easySolved',
        'mediumSolved',
        'hardSolved',
        'totalAvailable',
        'easyAvailable',
        'mediumAvailable',
        'hardAvailable',
    ];

    for (const key of requiredCounts) {
        const value = fetchedStats?.[key];

        if (
            typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < 0
        ) {
            throw new AppError(
                'LeetCode returned incomplete statistics. Existing statistics were preserved.',
                502
            );
        }
    }

    if (
        fetchedStats.easySolved +
            fetchedStats.mediumSolved +
            fetchedStats.hardSolved !==
        fetchedStats.totalSolved
    ) {
        throw new AppError(
            'LeetCode returned inconsistent statistics. Existing statistics were preserved.',
            502
        );
    }

    const contestRating = fetchedStats.contestRating;

    if (
        contestRating !== null &&
        contestRating !== undefined &&
        (typeof contestRating !== 'number' ||
            !Number.isFinite(contestRating) ||
            contestRating < 0)
    ) {
        throw new AppError(
            'LeetCode returned an invalid contest rating. Existing statistics were preserved.',
            502
        );
    }

    profile.stats = {
        totalSolved: fetchedStats.totalSolved,
        easySolved: fetchedStats.easySolved,
        mediumSolved: fetchedStats.mediumSolved,
        hardSolved: fetchedStats.hardSolved,
        totalAvailable: fetchedStats.totalAvailable,
        easyAvailable: fetchedStats.easyAvailable,
        mediumAvailable: fetchedStats.mediumAvailable,
        hardAvailable: fetchedStats.hardAvailable,
        contestRating: contestRating ?? null,
        submissionCalendar: fetchedStats.submissionCalendar ?? {},
        lastFetchedAt: fetchedStats.fetchedAt,
    };

    // Verification status is deliberately not changed by a stats refresh.
    // No timeline event here: the timeline records accepted problems instead
    // (problemTracking.service.js; docs/LEETCODE_TRACKING_LOG.md, D6).
    await profile.save();

    return profile;
}
