import mongoose from 'mongoose';

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
        }
    },
    {
        timestamps: true
    }
);

goalSchema.index({ owner: 1, createdAt: -1 });

const Goal = mongoose.model('Goal', goalSchema);

export default Goal;