
import mongoose from 'mongoose';
import {
    CODING_PLATFORM_IDS,
} from '../config/codingPlatforms.js';

export const CODING_PROFILE_STATUSES = [
    // Legacy states retained during migration.
    'connected',
    'unverified',

    // Ownership-verification states.
    'pending',
    'verified',
    'needs_reverification',

    // Provider is temporarily unavailable.
    'unavailable',
];

const codingProfileSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        platform: {
            type: String,
            required: true,
            enum: [...CODING_PLATFORM_IDS],
            trim: true,
            lowercase: true,
        },

        username: {
            type: String,
            required: [true, 'Coding platform username is required'],
            trim: true,
            minlength: 1,
            maxlength: 100,
        },

        normalizedUsername: {
            type: String,
            trim: true,
            default: null,
            maxlength: 100,
        },

        connectionStatus: {
            type: String,
            enum: CODING_PROFILE_STATUSES,
            default: 'unverified',
            required: true,
        },

        verifiedAt: {
            type: Date,
            default: null,
        },

        stats: {
            totalSolved: {
                type: Number,
                min: 0,
                default: null,
            },
            easySolved: {
                type: Number,
                min: 0,
                default: null,
            },
            mediumSolved: {
                type: Number,
                min: 0,
                default: null,
            },
            hardSolved: {
                type: Number,
                min: 0,
                default: null,
            },
            totalAvailable: {
                type: Number,
                min: 0,
                default: null,
            },
            easyAvailable: {
                type: Number,
                min: 0,
                default: null,
            },
            mediumAvailable: {
                type: Number,
                min: 0,
                default: null,
            },
            hardAvailable: {
                type: Number,
                min: 0,
                default: null,
            },
            contestRating: {
                type: Number,
                min: 0,
                default: null,
            },
            submissionCalendar: {
                type: mongoose.Schema.Types.Mixed,
                default: {},
            },
            lastFetchedAt: {
                type: Date,
                default: null,
            },
        },

        // Problem tracking (see docs/LEETCODE_TRACKING_LOG.md). Last time a submission sync
        // was claimed; doubles as the throttle and the "first sync" marker.
        submissionsSyncedAt: {
            type: Date,
            default: null,
        },

        // When per-problem tracking started; earlier heatmap days only have counts.
        trackingSince: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        strict: 'throw',
    }
);

// One account per platform identity for each DevTrack user.
codingProfileSchema.index(
    { owner: 1, platform: 1 },
    { unique: true }
);

// Prevent duplicate verified account links.
// Pending and legacy profiles are excluded until migrated.
codingProfileSchema.index(
    { platform: 1, normalizedUsername: 1 },
    {
        unique: true,
        partialFilterExpression: {
            connectionStatus: 'verified',
            normalizedUsername: { $type: 'string' },
        },
    }
);

codingProfileSchema.index({ owner: 1, updatedAt: -1 });

const CodingProfile = mongoose.model(
    'CodingProfile',
    codingProfileSchema
);

export default CodingProfile;
