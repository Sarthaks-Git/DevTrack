import { Link } from "react-router-dom";
import { formatMilestoneDue, isMilestoneOverdue } from "../../utils/milestoneUtils";

// "What's next?": the soonest open milestones across active goals and projects.
function UpcomingMilestones({ milestones, total }) {
  return (
    <section className="mb-8">
      <div className="mb-5 flex items-end justify-between border-b border-[var(--dt-border)] pb-4">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">Next milestones</p>
        <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
          {total} open
        </span>
      </div>

      {milestones.length === 0 ? (
        <div className="border-b border-[var(--dt-border)] py-8">
          <p className="text-sm text-[var(--dt-text-secondary)]">
            No open milestones. Break a goal or project into steps to see what's next here.
          </p>
          <Link
            to="/app/goals"
            className="mt-4 inline-block text-xs font-medium uppercase tracking-[0.2em] text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)]"
          >
            + Add milestones
          </Link>
        </div>
      ) : (
        <ul>
          {milestones.map((milestone) => {
            const overdue = isMilestoneOverdue(milestone);
            return (
              <li
                key={milestone._id}
                className="grid gap-2 border-b border-[var(--dt-border)] py-4 md:grid-cols-[1fr_auto] md:items-center md:gap-6"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-[var(--dt-text-primary)]">{milestone.title}</p>
                  <Link
                    to={milestone.to}
                    className="mt-1 inline-block text-[11px] text-[var(--dt-text-muted)] transition-colors hover:text-[var(--dt-accent-soft)]"
                  >
                    {milestone.parentKind === "goal" ? "Goal" : "Project"} · {milestone.parentTitle}
                  </Link>
                </div>
                <span
                  className={`text-[11px] uppercase tracking-[0.16em] ${
                    overdue ? "text-red-300" : "text-[var(--dt-text-muted)]"
                  }`}
                >
                  {milestone.dueDate ? `${overdue ? "Overdue · " : "Due "}${formatMilestoneDue(milestone.dueDate)}` : "No date"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default UpcomingMilestones;
