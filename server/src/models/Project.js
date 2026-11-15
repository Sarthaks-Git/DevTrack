
import mongoose from 'mongoose';
import { milestonesField } from './milestone.schema.js';

const projectSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Project title is required'],
            trim: true,
            minlength: 3,
            maxlength: 120,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: '',
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        status: {
            type: String,
            enum: ['planning', 'in_progress', 'completed', 'archived'],
            default: 'planning',
        },

        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },

        technologies: {
            type: [
                {
                    type: String,
                    trim: true,
                    maxlength: 50,
                },
            ],
            default: [],
        },

        githubUrl: {
            type: String,
            trim: true,
            maxlength: 2048,
            default: '',
        },

        liveUrl: {
            type: String,
            trim: true,
            maxlength: 2048,
            default: '',
        },

        startDate: {
            type: Date,
            default: null,
        },

        endDate: {
            type: Date,
            default: null,
        },

        // Optional goal this project works toward; must belong to the same owner.
        goal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Goal',
            default: null,
        },

        // Managed only through the milestone endpoints, never through project create/update.
        milestones: milestonesField,
    },
    {
        timestamps: true,
    }
);

projectSchema.index({ owner: 1, createdAt: -1 });
projectSchema.index({ owner: 1, goal: 1 });

const Project = mongoose.model('Project', projectSchema);

export default Project;
