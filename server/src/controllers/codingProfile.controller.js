
import {
    upsertCodingProfileLogic,
    getUserCodingProfilesLogic,
    deleteCodingProfileLogic,
    refreshLeetCodeStatsLogic,
} from '../services/codingProfile.service.js';

import {
    startCodingVerificationLogic,
    verifyCodingProfileLogic,
} from '../services/codingVerification.service.js';

export async function upsertCodingProfile(req, res, next) {
    try {
        const profile = await upsertCodingProfileLogic(
            req.user.id,
            req.validatedCodingProfile
        );

        return res.status(200).json({
            success: true,
            message: 'Coding profile saved successfully',
            data: { profile },
        });
    } catch (error) {
        next(error);
    }
}

export async function getUserCodingProfiles(req, res, next) {
    try {
        const profiles = await getUserCodingProfilesLogic(req.user.id);

        return res.status(200).json({
            success: true,
            message: 'Coding profiles retrieved successfully',
            data: { profiles },
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteCodingProfile(req, res, next) {
    try {
        await deleteCodingProfileLogic(
            req.user.id,
            req.params.platform
        );

        return res.status(200).json({
            success: true,
            message: 'Coding profile disconnected successfully',
            data: {},
        });
    } catch (error) {
        next(error);
    }
}

export async function refreshLeetCodeStats(req, res, next) {
    try {
        const profile = await refreshLeetCodeStatsLogic(req.user.id);

        return res.status(200).json({
            success: true,
            message: 'LeetCode statistics refreshed successfully',
            data: { profile },
        });
    } catch (error) {
        next(error);
    }
}

export async function startCodingVerification(req, res, next) {
    try {
        const { platform, username } = req.body;

        const challenge = await startCodingVerificationLogic(
            req.user.id,
            platform,
            username
        );

        return res.status(201).json({
            success: true,
            message: 'Verification challenge created successfully',
            data: { challenge },
        });
    } catch (error) {
        next(error);
    }
}

export async function verifyCodingProfile(req, res, next) {
    try {
        const { platform, token } = req.body;

        const profile = await verifyCodingProfileLogic(
            req.user.id,
            platform,
            token
        );

        return res.status(200).json({
            success: true,
            message: 'Coding profile verified successfully',
            data: { profile },
        });
    } catch (error) {
        next(error);
    }
}
