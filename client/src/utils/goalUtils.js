export const priorityRank = {
    high: 3,
    medium: 2,
    low: 1,
};

export function getGoalPriorityRank(priority) {
    return priorityRank[priority] || 0;
}

export function formatGoalDeadline(deadline) {
    if (!deadline) {
        return null;
    }

    return new Date(deadline).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export function getFocusGoal(goals) {
    const activeGoals = goals.filter(
        (goal) =>
            goal.status === "in_progress" ||
            goal.status === "not_started",
    );

    if (activeGoals.length === 0) {
        return null;
    }

    return [...activeGoals].sort((a, b) => {
        const priorityDifference =
            getGoalPriorityRank(b.priority) -
            getGoalPriorityRank(a.priority);

        if (priorityDifference !== 0) {
            return priorityDifference;
        }

        if (!a.deadline && !b.deadline) {
            return 0;
        }

        if (!a.deadline) {
            return 1;
        }

        if (!b.deadline) {
            return -1;
        }

        return (
            new Date(a.deadline) -
            new Date(b.deadline)
        );
    })[0];
}

export function getAttentionGoals(goals, limit = 4) {
    return [...goals]
        .filter(
            (goal) =>
                goal.status !== "completed" &&
                goal.status !== "archived",
        )
        .sort((a, b) => {
            const priorityDifference =
                getGoalPriorityRank(b.priority) -
                getGoalPriorityRank(a.priority);

            if (priorityDifference !== 0) {
                return priorityDifference;
            }

            if (!a.deadline && !b.deadline) {
                return 0;
            }

            if (!a.deadline) {
                return 1;
            }

            if (!b.deadline) {
                return -1;
            }

            return (
                new Date(a.deadline) -
                new Date(b.deadline)
            );
        })
        .slice(0, limit);
}