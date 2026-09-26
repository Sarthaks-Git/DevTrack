import Goal from '../models/Goal.js';
import AppError from '../utils/AppError.js';

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
        owner: userId
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

    return goal;
}