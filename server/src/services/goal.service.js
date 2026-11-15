import Goal from '../models/Goal.js';
import JournalEntry from '../models/JournalEntry.js';
import Project from '../models/Project.js';
import AppError from '../utils/AppError.js';
import { recordActivity } from './activity.service.js';

export async function createGoalLogic(userId, goalData) {
    const {
        title,
        description,
        status,
        priority,
        deadline
    } = goalData;

    const goal = await Goal.create({
        title,
        description,
        status,
        priority,
        deadline,
        completedAt: status === 'completed' ? new Date() : null,
        owner: userId
    });

    await recordActivity(userId, {
        type: goal.status === 'completed' ? 'goal_completed' : 'goal_created',
        subjectType: 'goal',
        subjectId: goal._id,
        title: goal.title,
    });

    return goal;
}

export async function getUserGoalsLogic(userId) {
    const goals = await Goal.find({
        owner: userId
    }).sort({
        createdAt: -1
    });

    return goals;
}

export async function getSingleGoalLogic(userId, goalId) {
    const goal = await Goal.findOne({
        _id: goalId,
        owner: userId
    });

    if (!goal) {
        throw new AppError('Goal not found', 404);
    }

    return goal;
}

export async function updateGoalLogic(
    userId,
    goalId,
    updateData
) {
    const allowedFields = [
        'title',
        'description',
        'status',
        'priority',
        'deadline'
    ];

    const safeUpdates = {};

    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            safeUpdates[field] = updateData[field];
        }
    }

    const existing = await Goal.findOne({
        _id: goalId,
        owner: userId
    }).lean();

    if (!existing) {
        throw new AppError('Goal not found', 404);
    }

    const completing = safeUpdates.status === 'completed' && existing.status !== 'completed';
    const reopening = safeUpdates.status !== undefined && safeUpdates.status !== 'completed' && existing.status === 'completed';

    if (completing) safeUpdates.completedAt = new Date();
    if (reopening) safeUpdates.completedAt = null;

    const goal = await Goal.findOneAndUpdate(
        {
            _id: goalId,
            owner: userId
        },
        safeUpdates,
        {
            returnDocument: 'after',
            runValidators: true
        }
    );

    if (!goal) {
        throw new AppError('Goal not found', 404);
    }

    if (completing || reopening) {
        await recordActivity(userId, {
            type: completing ? 'goal_completed' : 'goal_reopened',
            subjectType: 'goal',
            subjectId: goal._id,
            title: goal.title,
        });
    }

    return goal;
}

export async function deleteGoalLogic(userId, goalId) {
    const goal = await Goal.findOneAndDelete({
        _id: goalId,
        owner: userId
    });

    if (!goal) {
        throw new AppError('Goal not found', 404);
    }

    // Keep journal entries and projects but drop their link to the deleted goal.
    await Promise.all([
        JournalEntry.updateMany({ owner: userId, goal: goal._id }, { $set: { goal: null } }),
        Project.updateMany({ owner: userId, goal: goal._id }, { $set: { goal: null } }),
    ]);

    return goal;
}