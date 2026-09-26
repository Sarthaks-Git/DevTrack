import {
    createGoalLogic,
    getUserGoalsLogic,
    getSingleGoalLogic,
    updateGoalLogic,
    deleteGoalLogic
} from '../services/goal.service.js';
export async function createGoal(req, res, next) {
    try {
        const userId = req.user.id;

        const goal = await createGoalLogic(
            userId,
            req.body
        );

        return res.status(201).json({
            message: 'Goal created successfully',
            goal
        });
    } catch (error) {
        next(error);
    }
}

export async function getUserGoals(req, res, next) {
    try {
        const userId = req.user.id;
        const goals = await getUserGoalsLogic(userId);

        return res.status(200).json({ goals });
    } catch (error) {
        next(error);
    }
}

export async function getSingleGoal(req, res, next) {
    try {
        const userId = req.user.id;
        const { id: goalId } = req.params;

        const goal = await getSingleGoalLogic(
            userId,
            goalId
        );

        return res.status(200).json({
            goal
        });
    } catch (error) {
        next(error);
    }
}

export async function updateGoal(req, res, next) {
    try {
        const userId = req.user.id;
        const { id: goalId } = req.params;

        const goal = await updateGoalLogic(
            userId,
            goalId,
            req.body
        );

        return res.status(200).json({
            message: 'Goal updated successfully',
            goal
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteGoal(req, res, next) {
    try {
        const userId = req.user.id;
        const { id: goalId } = req.params;

        await deleteGoalLogic(userId, goalId);

        return res.status(200).json({
            message: 'Goal deleted successfully'
        });
    } catch (error) {
        next(error);
    }
}