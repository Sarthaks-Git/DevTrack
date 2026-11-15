import mongoose from 'mongoose';
import { milestonesField } from './milestone.schema.js';

export const GOAL_TARGET_KINDS = ['leetcode_solved'];
export const GOAL_TARGET_MAX_COUNT = 1000;

const goalTargetSchema = new mongoose.Schema(
    {
        kind: { type: String, enum: GOAL_TARGET_KINDS, required: true },
        pattern: { type: String, default: null, maxlength: 60 },
        difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', null], default: null },
        count: { type: Number, required: true, min: 1, max: GOAL_TARGET_MAX_COUNT },
        // Server-set: only problems first solved on or after this moment count.
        since: { type: Date, required: true }
    },
    { _id: false }
);

const goalSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Goal title is required'],
            trim: true,
            minlength: 3,
            maxlength: 120
        },

        description: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: ''
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        status: {
            type: String,
            enum: ['not_started', 'in_progress', 'completed', 'archived'],
            default: 'not_started'
        },

        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },

        deadline: {
            type: Date,
            default: null
        },

        // Set by the server when status becomes completed; cleared if reopened.
        completedAt: {
            type: Date,
            default: null
        },

        // Managed only through the milestone endpoints, never through goal create/update.
        milestones: milestonesField,

        // Optional verified target: progress is counted from synced LeetCode solves, never from the client.
        target: {
            type: goalTargetSchema,
            default: null
        }
    },
    {
        timestamps: true
    }
);

goalSchema.index({ owner: 1, createdAt: -1 });

const Goal = mongoose.model('Goal', goalSchema);

export default Goal;