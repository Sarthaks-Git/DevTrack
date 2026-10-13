
import mongoose from 'mongoose';

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
    },
    {
        timestamps: true,
    }
);

projectSchema.index({ owner: 1, createdAt: -1 });

const Project = mongoose.model('Project', projectSchema);

export default Project;
