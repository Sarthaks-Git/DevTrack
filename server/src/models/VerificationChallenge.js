
import mongoose from 'mongoose';
import {
    CODING_PLATFORM_IDS,
} from '../config/codingPlatforms.js';

const verificationChallengeSchema = new mongoose.Schema(
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
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100,
        },

        normalizedUsername: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100,
        },

        // Never persist the raw verification token.
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            select: false,
        },

        expiresAt: {
            type: Date,
            required: true,
        },

        attemptCount: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
            max: 5,
        },
    },
    {
        timestamps: true,
        strict: 'throw',
    }
);

// Only one active challenge per user/platform at a time.
verificationChallengeSchema.index(
    { owner: 1, platform: 1 },
    { unique: true }
);

// Expiry cleanup is asynchronous; verification must check expiresAt itself.
verificationChallengeSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

const VerificationChallenge = mongoose.model(
    'VerificationChallenge',
    verificationChallengeSchema
);

export default VerificationChallenge;
