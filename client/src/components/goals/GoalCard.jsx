import { Link } from "react-router-dom";
import MilestoneList from "../milestones/MilestoneList";
import GoalTargetProgress from "./GoalTargetProgress";

function GoalCard({ goal, number, linkedProjects = [], milestoneHandlers, onEdit, onDelete, onPlan, onQuiz, onIdeas }) {
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
                py-4
                transition-colors
                duration-300
                hover:border-[var(--dt-border-strong)]
            "
        >
            <div className="grid gap-3 md:grid-cols-[32px_1fr_auto] md:gap-5">

                {/* Number */}
                <div
                    className="
                        font-mono
                        text-[11px]
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
                            text-lg
                            font-medium
                            tracking-tight
                            text-[var(--dt-text-primary)]
                            transition-transform
                            duration-300
                            group-hover:translate-x-1
                        "
                    >
                        {goal.title}
                    </h3>

                    {/* Description */}
                    {goal.description && (
                        <p
                            className="
                                mt-1.5
                                max-w-3xl
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
                            mt-3
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
                                text-[11px]
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
                                    text-[11px]
                                    uppercase
                                    tracking-[0.15em]
                                    text-[var(--dt-text-muted)]
                                "
                            >
                                Due {formattedDeadline}
                            </span>
                        )}
                    </div>

                    <GoalTargetProgress target={goal.target} progress={goal.targetProgress} />

                    {/* Linked projects */}
                    {linkedProjects.length > 0 && (
                        <p className="mt-4 text-xs text-[var(--dt-text-muted)]">
                            Projects:{" "}
                            {linkedProjects.map((project, index) => (
                                <span key={project._id}>
                                    {index > 0 && ", "}
                                    <Link
                                        to="/app/projects"
                                        className="text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)]"
                                    >
                                        {project.title}
                                    </Link>
                                </span>
                            ))}
                        </p>
                    )}

                    {milestoneHandlers && (
                        <MilestoneList
                            milestones={goal.milestones}
                            onAdd={(milestone) => milestoneHandlers.add(goal._id, milestone)}
                            onUpdate={(milestoneId, changes) => milestoneHandlers.update(goal._id, milestoneId, changes)}
                            onRemove={(milestoneId) => milestoneHandlers.remove(goal._id, milestoneId)}
                        />
                    )}

                    {/* Actions */}
                    <div
                        className="
                            mt-6
                            flex
                            flex-wrap
                            items-center
                            gap-x-5
                            gap-y-2
                            opacity-100
                            transition-opacity
                            duration-200
                            md:opacity-0
                            md:group-hover:opacity-100
                            md:group-focus-within:opacity-100
                        "
                    >
                        {onPlan && goal.status !== "completed" && goal.status !== "archived" ? (
                        <button
                            type="button"
                            onClick={() => onPlan(goal)}
                            className="
                                text-[11px]
                                font-medium
                                uppercase
                                tracking-[0.18em]
                                text-[var(--dt-accent-soft)]
                                transition-colors
                                duration-200
                                hover:text-[var(--dt-text-primary)]
                            "
                        >
                            Plan with AI
                        </button>
                        ) : null}

                        {onIdeas && goal.status !== "archived" ? (
                        <button
                            type="button"
                            onClick={() => onIdeas(goal)}
                            className="
                                text-[11px]
                                font-medium
                                uppercase
                                tracking-[0.18em]
                                text-[var(--dt-accent-soft)]
                                transition-colors
                                duration-200
                                hover:text-[var(--dt-text-primary)]
                            "
                        >
                            Project ideas
                        </button>
                        ) : null}

                        {onQuiz && goal.status !== "archived" ? (
                        <button
                            type="button"
                            onClick={() => onQuiz(goal)}
                            className="
                                text-[11px]
                                font-medium
                                uppercase
                                tracking-[0.18em]
                                text-[var(--dt-accent-soft)]
                                transition-colors
                                duration-200
                                hover:text-[var(--dt-text-primary)]
                            "
                        >
                            Quiz me
                        </button>
                        ) : null}

                        <button
                            type="button"
                            onClick={() => onEdit(goal)}
                            className="
                                text-[11px]
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
                                text-[11px]
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
                        text-[11px]
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