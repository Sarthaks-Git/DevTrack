import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAttention } from "../../services/dashboardService";
import { describeNextStep, describeReason, subjectPath } from "../../utils/attentionUtils";

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
      <div className="mb-2 flex items-end justify-between border-b border-[var(--dt-border)] pb-2">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">Needs attention</p>
        {state.status === "ready" ? (
          <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
            {total} {total === 1 ? "item" : "items"}
          </span>
        ) : null}
      </div>

      {state.status === "loading" ? <p className="py-6 text-sm text-[var(--dt-text-muted)]">Checking deadlines and progress...</p> : null}

      {state.status === "error" ? (
        <p role="alert" className="py-6 text-sm text-red-300">Couldn't check what needs attention right now.</p>
      ) : null}

      {state.status === "ready" && items.length === 0 ? (
        <div className="border-b border-[var(--dt-border)] py-6">
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
              className="grid gap-2 border-b border-[var(--dt-border)] py-3 md:grid-cols-[32px_1fr_auto] md:items-start md:gap-5"
            >
              <span className="font-mono text-[11px] tracking-[0.15em] text-[var(--dt-text-muted)]">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0">
                <Link
                  to={subjectPath(item.kind)}
                  className="inline-block break-words text-base font-medium tracking-tight text-[var(--dt-text-primary)] transition-colors duration-200 hover:text-[var(--dt-accent-soft)]"
                >
                  {item.title}
                </Link>

                <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                  {item.reasons.map((reason) => {
                    const described = describeReason(reason);
                    if (!described) return null;
                    return (
                      <span
                        key={reason.code}
                        className={`text-[11px] uppercase tracking-[0.16em] ${described.urgent ? "text-red-300" : "text-[var(--dt-text-secondary)]"}`}
                      >
                        {described.text}
                      </span>
                    );
                  })}
                </div>

                <p className="mt-1.5 text-sm text-[var(--dt-text-secondary)]">{describeNextStep(item.nextStep)}</p>
              </div>

              <span className="text-left text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-muted)] md:text-right">
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
