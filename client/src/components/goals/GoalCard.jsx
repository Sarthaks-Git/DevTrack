function GoalCard({ goal, number, onEdit, onDelete }) {
    const statusConfig = {
        not_started: {
            symbol: "○",
            label: "NOT STARTED",
        },
        in_progress: {
            symbol: "◐",
            label: "IN PROGRESS",
        },
        completed: {
            symbol: "✓",
            label: "COMPLETED",
        },
        archived: {
            symbol: "—",
            label: "ARCHIVED",
        },
    };

    const status =
        statusConfig[goal.status] || statusConfig.not_started;

    const formattedDeadline = goal.deadline
        ? new Date(goal.deadline).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
          })
        : null;

    return (
        <article
            className="
                dt-goal-enter
                group
                border-t
                border-[var(--dt-border)]
                py-7
                transition-colors
                duration-300
                hover:border-[var(--dt-border-strong)]
                md:py-8
            "
        >
            <div className="grid gap-4 md:grid-cols-[40px_1fr_auto] md:gap-6">

                {/* Number */}
                <div
                    className="
                        font-mono
                        text-[9px]
                        tracking-[0.15em]
                        text-[var(--dt-text-muted)]
                    "
                >
                    {number}
                </div>

                {/* Main content */}
                <div className="min-w-0">

                    {/* Title */}
                    <h3
                        className="
                            text-xl
                            font-medium
                            tracking-tight
                            text-[var(--dt-text-primary)]
                            transition-transform
                            duration-300
                            group-hover:translate-x-1
                            md:text-2xl
                        "
                    >
                        {goal.title}
                    </h3>

                    {/* Description */}
                    {goal.description && (
                        <p
                            className="
                                mt-3
                                max-w-2xl
                                text-sm
                                leading-6
                                text-[var(--dt-text-secondary)]
                            "
                        >
                            {goal.description}
                        </p>
                    )}

                    {/* Metadata */}
                    <div
                        className="
                            mt-5
                            flex
                            flex-wrap
                            items-center
                            gap-x-6
                            gap-y-2
                        "
                    >
                        {/* Status */}
                        <span
                            className="
                                flex
                                items-center
                                gap-2
                                text-[10px]
                                font-medium
                                uppercase
                                tracking-[0.15em]
                                text-[var(--dt-text-secondary)]
                            "
                        >
                            <span className="text-[var(--dt-accent-soft)]">
                                {status.symbol}
                            </span>

                            {status.label}
                        </span>

                        {/* Deadline */}
                        {formattedDeadline && (
                            <span
                                className="
                                    text-[10px]
                                    uppercase
                                    tracking-[0.15em]
                                    text-[var(--dt-text-muted)]
                                "
                            >
                                Due {formattedDeadline}
                            </span>
                        )}
                    </div>

                    {/* Actions */}
                    <div
                        className="
                            mt-6
                            flex
                            items-center
                            gap-5
                            opacity-100
                            transition-opacity
                            duration-200
                            md:opacity-0
                            md:group-hover:opacity-100
                        "
                    >
                        <button
                            type="button"
                            onClick={() => onEdit(goal)}
                            className="
                                text-[10px]
                                font-medium
                                uppercase
                                tracking-[0.18em]
                                text-[var(--dt-text-muted)]
                                transition-colors
                                duration-200
                                hover:text-[var(--dt-text-primary)]
                            "
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            onClick={() => onDelete(goal)}
                            className="
                                text-[10px]
                                font-medium
                                uppercase
                                tracking-[0.18em]
                                text-[var(--dt-text-muted)]
                                transition-colors
                                duration-200
                                hover:text-red-300
                            "
                        >
                            Delete
                        </button>
                    </div>
                </div>

                {/* Priority */}
                <div
                    className="
                        self-start
                        text-left
                        text-[10px]
                        font-medium
                        uppercase
                        tracking-[0.2em]
                        text-[var(--dt-text-muted)]
                        md:text-right
                    "
                >
                    {goal.priority}
                </div>
            </div>
        </article>
    );
}

export default GoalCard;