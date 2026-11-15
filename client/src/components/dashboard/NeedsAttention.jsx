import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAttention } from "../../services/dashboardService";
import { formatMilestoneDue } from "../../utils/milestoneUtils";

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function describeReason(reason) {
  switch (reason.code) {
    case "overdue":
      return { text: `Overdue since ${formatMilestoneDue(reason.date)}`, urgent: true };
    case "due_soon":
      return { text: `Due ${formatMilestoneDue(reason.date)}`, urgent: false };
    case "milestone_overdue":
      return { text: `${plural(reason.count, "milestone")} overdue`, urgent: true };
    case "milestone_due_soon":
      return { text: `${plural(reason.count, "milestone")} due this week`, urgent: false };
    case "stalled":
      return { text: `No progress in ${reason.days} days`, urgent: false };
    default:
      return null;
  }
}

function describeNextStep(step) {
  if (step.code === "milestone") {
    return `Next: ${step.title}${step.dueDate ? ` (${formatMilestoneDue(step.dueDate)})` : ""}`;
  }
  if (step.code === "add_milestones") return "Next: break it into milestones";
  return "Next: all milestones are done, review its status";
}

// Server-ranked list of goals and projects with a concrete reason to act now.
function NeedsAttention() {
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let active = true;
    getAttention()
      .then((data) => active && setState({ status: "ready", data }))
      .catch(() => active && setState({ status: "error", data: null }));
    return () => {
      active = false;
    };
  }, []);

  const items = state.data?.items || [];
  const total = state.data?.total || 0;

  return (
    <section>
      <div className="mb-5 flex items-end justify-between border-b border-[var(--dt-border)] pb-4">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">Needs attention</p>
        {state.status === "ready" ? (
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
            {total} {total === 1 ? "item" : "items"}
          </span>
        ) : null}
      </div>

      {state.status === "loading" ? <p className="py-6 text-sm text-[var(--dt-text-muted)]">Checking deadlines and progress...</p> : null}

      {state.status === "error" ? (
        <p role="alert" className="py-6 text-sm text-red-300">Couldn't check what needs attention right now.</p>
      ) : null}

      {state.status === "ready" && items.length === 0 ? (
        <div className="border-b border-[var(--dt-border)] py-10">
          <p className="text-sm text-[var(--dt-text-secondary)]">
            Nothing is overdue, due this week, or stalled. Keep going.
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ol>
          {items.map((item, index) => (
            <li
              key={`${item.kind}-${item.id}`}
              className="grid gap-4 border-b border-[var(--dt-border)] py-6 md:grid-cols-[40px_1fr_auto] md:items-start md:gap-6"
            >
              <span className="font-mono text-[9px] tracking-[0.15em] text-[var(--dt-text-muted)]">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0">
                <Link
                  to={item.kind === "goal" ? "/app/goals" : "/app/projects"}
                  className="inline-block break-words text-base font-medium tracking-tight text-[var(--dt-text-primary)] transition-colors duration-200 hover:text-[var(--dt-accent-soft)]"
                >
                  {item.title}
                </Link>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {item.reasons.map((reason) => {
                    const described = describeReason(reason);
                    if (!described) return null;
                    return (
                      <span
                        key={reason.code}
                        className={`text-[10px] uppercase tracking-[0.16em] ${described.urgent ? "text-red-300" : "text-[var(--dt-text-secondary)]"}`}
                      >
                        {described.text}
                      </span>
                    );
                  })}
                </div>

                <p className="mt-3 text-sm text-[var(--dt-text-secondary)]">{describeNextStep(item.nextStep)}</p>
              </div>

              <span className="text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-muted)] md:text-right">
                {item.kind} · {item.priority}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {total > items.length ? (
        <p className="mt-4 text-[11px] text-[var(--dt-text-muted)]">
          Showing the {items.length} most urgent of {total}.
        </p>
      ) : null}
    </section>
  );
}

export default NeedsAttention;
