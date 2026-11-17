import { WEEKDAYS } from "../../utils/weeklyReviewUtils";

// Monday-to-Sunday strip: filled = active, solid = no activity, dashed = still to come.
function DayStrip({ days }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="Active days">
      {WEEKDAYS.map((label, index) => {
        const elapsed = index < days.length;
        const active = days[index];
        return (
          <li key={label} className="text-center">
            <span
              className={`block h-2 ${active ? "bg-[var(--dt-accent)]" : elapsed ? "bg-[var(--dt-border)]" : "border border-dashed border-[var(--dt-border)]"}`}
              aria-label={`${label}: ${active ? "active" : elapsed ? "no activity" : "upcoming"}`}
            />
            <span className="mt-1.5 block text-[11px] uppercase tracking-[0.12em] text-[var(--dt-text-muted)]">{label.slice(0, 2)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default DayStrip;
