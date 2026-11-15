
import crypto from 'node:crypto';
import mongoose from 'mongoose';

import CodingProfile from '../models/CodingProfile.js';
import VerificationChallenge from '../models/VerificationChallenge.js';
import AppError from '../utils/AppError.js';
import { fetchLeetCodeOwnershipProfile } from './leetcodeOwnership.service.js';
import { recordActivity } from './activity.service.js';

const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SUPPORTED_PLATFORMS = new Set(['leetcode']);

function normalizePlatform(value) {
    if (typeof value !== 'string') {
        throw new AppError('Unsupported coding platform', 400);
    }

    const platform = value.trim().toLowerCase();

    if (!SUPPORTED_PLATFORMS.has(platform)) {
        throw new AppError(
            'Ownership verification is not supported for this platform yet',
            400
        );
    }

    return platform;
}

function normalizeUsername(value) {
    if (typeof value !== 'string') {
        throw new AppError('A valid username is required', 400);
    }

    const username = value.trim();

    if (!username || username.length > 100) {
        throw new AppError('A valid username is required', 400);
    }

    return username;
}

function validateUserId(userId) {
    if (!mongoose.isObjectIdOrHexString(userId)) {
        throw new AppError('Unauthorized', 401);
    }
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function tokenHashesMatch(firstHash, secondHash) {
    const first = Buffer.from(firstHash, 'hex');
    const second = Buffer.from(secondHash, 'hex');

    return (
        first.length === second.length &&
        crypto.timingSafeEqual(first, second)
    );
}

function createToken() {
    return `devtrack-verify-${crypto.randomBytes(24).toString('hex')}`;
}

export async function startCodingVerificationLogic(
    userId,
    platformInput,
    usernameInput
) {
    validateUserId(userId);

    const platform = normalizePlatform(platformInput);
    const username = normalizeUsername(usernameInput);
    const normalizedUsername = username.toLowerCase();

    const existingProfile = await CodingProfile.findOne({
        owner: userId,
        platform,
    }).lean();

    if (
        existingProfile?.connectionStatus === 'verified' &&
        existingProfile.normalizedUsername === normalizedUsername
    ) {
        throw new AppError('This profile is already verified', 409);
    }

    const alreadyClaimed = await CodingProfile.findOne({
        platform,
        normalizedUsername,
        connectionStatus: 'verified',
        owner: { $ne: userId },
    }).lean();

    if (alreadyClaimed) {
        throw new AppError(
            'This coding account is already linked to another DevTrack user',
            409
        );
    }

    const token = createToken();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    await VerificationChallenge.findOneAndUpdate(
        { owner: userId, platform },
        {
            $set: {
                username,
                normalizedUsername,
                tokenHash: hashToken(token),
                expiresAt,
                attemptCount: 0,
            },
            $setOnInsert: {
                owner: userId,
                platform,
            },
        },
        {
            upsert: true,
            returnDocument: 'after',
            runValidators: true,
            setDefaultsOnInsert: true,
        }
    );

    return {
        platform,
        username,
        token,
        expiresAt,
        instructions:
            'Add this token to your LeetCode About Me section, save your profile, then return to DevTrack and verify.',
    };
}

export async function verifyCodingProfileLogic(
    userId,
    platformInput,
    submittedToken
) {
    validateUserId(userId);

    const platform = normalizePlatform(platformInput);

    if (
        typeof submittedToken !== 'string' ||
        !/^devtrack-verify-[a-f0-9]{48}$/.test(submittedToken)
    ) {
        throw new AppError('A valid verification token is required', 400);
    }

    // Atomically reserve an attempt before making the external request.
    // This prevents parallel requests from freely bypassing the attempt limit.
    const challenge = await VerificationChallenge.findOneAndUpdate(
        {
            owner: userId,
            platform,
            expiresAt: { $gt: new Date() },
            attemptCount: { $lt: MAX_ATTEMPTS },
        },
        {
            $inc: { attemptCount: 1 },
        },
        {
            returnDocument: 'after',
        }
    ).select('+tokenHash');

    if (!challenge) {
        const expiredChallenge = await VerificationChallenge.findOne({
            owner: userId,
            platform,
        }).lean();

        if (expiredChallenge) {
            await VerificationChallenge.deleteOne({
                _id: expiredChallenge._id,
                expiresAt: { $lte: new Date() },
            });
        }

        throw new AppError(
            'No usable verification challenge remains. Please start again.',
            400
        );
    }

    if (!tokenHashesMatch(hashToken(submittedToken), challenge.tokenHash)) {
        if (challenge.attemptCount >= MAX_ATTEMPTS) {
            await VerificationChallenge.deleteOne({
                _id: challenge._id,
                owner: userId,
            });
        }

        throw new AppError('Verification token is incorrect', 400);
    }

    // Always query the provider selected by the platform identifier.
    // Never accept profile text or stats supplied by the frontend.
    // A provider outage is not the user's fault: give the reserved attempt back.
    let publicProfile;

    try {
        publicProfile = await fetchLeetCodeOwnershipProfile(
            challenge.username
        );

        if (
            publicProfile.username.toLowerCase() !==
            challenge.normalizedUsername
        ) {
            throw new AppError(
                'The returned profile does not match the requested account',
                502,
                'PROVIDER_MISMATCH'
            );
        }
    } catch (error) {
        await VerificationChallenge.updateOne(
            { _id: challenge._id, attemptCount: { $gt: 0 } },
            { $inc: { attemptCount: -1 } }
        );

        throw error;
    }

    if (!publicProfile.aboutMe.includes(submittedToken)) {
        if (challenge.attemptCount >= MAX_ATTEMPTS) {
            await VerificationChallenge.deleteOne({
                _id: challenge._id,
                owner: userId,
            });
        }

        throw new AppError(
            'Verification token was not found in the profile About Me section',
            400
        );
    }

    // Re-check ownership immediately before writing, in case another
    // account claimed this external profile while verification was running.
    const claimedByAnotherUser = await CodingProfile.findOne({
        platform,
        normalizedUsername: challenge.normalizedUsername,
        connectionStatus: 'verified',
        owner: { $ne: userId },
    }).lean();

    if (claimedByAnotherUser) {
        throw new AppError(
            'This coding account is already linked to another DevTrack user',
            409
        );
    }

    const verifiedAt = new Date();

    let profile;

    try {
        profile = await CodingProfile.findOneAndUpdate(
            {
                owner: userId,
                platform,
            },
            {
                $set: {
                    username: publicProfile.username,
                    normalizedUsername: challenge.normalizedUsername,
                    connectionStatus: 'verified',
                    verifiedAt,
                },
                $setOnInsert: {
                    owner: userId,
                    platform,
                },
            },
            {
                upsert: true,
                returnDocument: 'after',
                runValidators: true,
                setDefaultsOnInsert: true,
            }
        );
    } catch (error) {
        if (error.code === 11000) {
            throw new AppError(
                'This coding account is already linked to another DevTrack user',
                409
            );
        }

        throw error;
    }

    // Delete only the challenge that was successfully verified.
    await VerificationChallenge.deleteOne({
        _id: challenge._id,
        owner: userId,
        platform,
        tokenHash: challenge.tokenHash,
    });

    await recordActivity(userId, {
        type: 'platform_verified',
        subjectType: 'coding_profile',
        subjectId: profile._id,
        title: `LeetCode account ${profile.username} verified`,
        source: 'verified',
    });

    return profile;
}
