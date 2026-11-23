import { formatMilestoneDue } from "../../utils/milestoneUtils";

// Read-only copy of MilestoneList in its open state (same classes, no add form or handlers).
export default function MilestonesOpen({ milestones }) {
  const done = milestones.filter(item => item.done).length;
  const percent = Math.round((done / milestones.length) * 100);
  return (
    <div className="mt-5">
      <div className="flex w-full items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">
        <span>▾</span>
        <span>Milestones</span>
        <span className="text-[var(--dt-text-secondary)]">{done}/{milestones.length}</span>
        <span className="ml-1 h-px flex-1 bg-[var(--dt-border)]">
          <span className="block h-px bg-[var(--dt-accent-soft)]" style={{ width: `${percent}%` }} />
        </span>
      </div>
      <ul className="mt-4 space-y-1">
        {milestones.map(item => (
          <li key={item._id} className="flex items-center gap-3 py-1">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[11px] ${item.done ? "border-[var(--dt-accent)] bg-[var(--dt-accent)] text-white" : "border-[var(--dt-border-strong)]"}`}>
              {item.done ? "✓" : ""}
            </span>
            <span className={`min-w-0 flex-1 break-words text-sm ${item.done ? "text-[var(--dt-text-muted)] line-through" : "text-[var(--dt-text-secondary)]"}`}>
              {item.title}
            </span>
            {item.dueDate ? (
              <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-[var(--dt-text-muted)]">{formatMilestoneDue(item.dueDate)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
