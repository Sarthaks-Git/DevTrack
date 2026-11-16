import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWeeklyReview } from "../../services/dashboardService";
import DayStrip from "./DayStrip";
import { compareText, formatWeekRange } from "../../utils/weeklyReviewUtils";

function Stat({ value, label, note }) {
  return (
    <div>
      <p className="font-[family-name:var(--dt-font-display)] text-3xl text-[var(--dt-text-primary)]">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">{label}</p>
      {note ? <p className="mt-1 text-[11px] text-[var(--dt-text-secondary)]">{note}</p> : null}
    </div>
  );
}

// Compact "this week so far" card on the dashboard; the full review lives on its own page.
function WeeklySnapshot() {
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let active = true;
    getWeeklyReview("current")
      .then((data) => active && setState({ status: "ready", data }))
      .catch(() => active && setState({ status: "error", data: null }));
    return () => {
      active = false;
    };
  }, []);

  const data = state.data;

  return (
    <section className="mt-16">
      <div className="mb-5 flex items-end justify-between border-b border-[var(--dt-border)] pb-4">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
          This week{data ? ` · ${formatWeekRange(data.week)}` : ""}
        </p>
        <Link to="/app/review" className="dt-link-button text-[10px]">Full review →</Link>
      </div>

      {state.status === "loading" ? <p className="py-6 text-sm text-[var(--dt-text-muted)]">Adding up your week...</p> : null}
      {state.status === "error" ? <p role="alert" className="py-6 text-sm text-red-300">Couldn't load this week's summary.</p> : null}

      {data ? (
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-start">
          <div>
            <DayStrip days={data.consistency.days} />
            <p className="mt-3 text-xs text-[var(--dt-text-secondary)]">
              Active {data.consistency.activeDays} of {data.week.daysElapsed} {data.week.daysElapsed === 1 ? "day" : "days"} so far
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Stat
              value={data.verified.connected ? data.verified.solved : "—"}
              label="Verified solves"
              note={data.verified.connected ? compareText(data.totals.solved, data.previous.solved, { partial: true }) : "Connect LeetCode"}
            />
            <Stat value={data.totals.finished} label="Finished" note={compareText(data.totals.finished, data.previous.finished, { partial: true })} />
            <Stat value={data.consistency.journalEntries} label="Journal" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default WeeklySnapshot;
