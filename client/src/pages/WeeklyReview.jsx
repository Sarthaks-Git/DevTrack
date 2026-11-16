import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/common/PageHeader";
import StateMessage from "../components/common/StateMessage";
import DayStrip from "../components/dashboard/DayStrip";
import { getWeeklyReview } from "../services/dashboardService";
import { describeNextStep, describeReason, subjectPath } from "../utils/attentionUtils";
import { formatMilestoneDue } from "../utils/milestoneUtils";
import { describeSkillSignal } from "../utils/skillUtils";
import { compareText, formatWeekRange } from "../utils/weeklyReviewUtils";

function SectionTitle({ children, note }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-[var(--dt-border)] pb-4">
      <h2 className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">{children}</h2>
      {note ? <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">{note}</span> : null}
    </div>
  );
}

function Figure({ value, label, note }) {
  return (
    <div className="border-l border-[var(--dt-border)] pl-4">
      <p className="font-[family-name:var(--dt-font-display)] text-4xl text-[var(--dt-text-primary)]">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">{label}</p>
      {note ? <p className="mt-1 text-xs text-[var(--dt-text-secondary)]">{note}</p> : null}
    </div>
  );
}

function Empty({ children }) {
  return <p className="py-4 text-sm text-[var(--dt-text-muted)]">{children}</p>;
}

function FinishedList({ finished }) {
  const rows = [
    ...finished.goals.map((goal) => ({ key: `g-${goal.id}`, tag: "Goal", title: goal.title, to: "/app/goals" })),
    ...finished.projects.map((project) => ({ key: `p-${project.id}`, tag: "Project", title: project.title, to: "/app/projects" })),
    ...finished.milestones.map((m, index) => ({ key: `m-${m.parentId}-${index}`, tag: "Milestone", title: m.title, detail: m.parentTitle, to: subjectPath(m.kind) })),
  ];
  if (rows.length === 0) return <Empty>Nothing marked finished this week. Small milestones count too.</Empty>;
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[90px_minmax(0,1fr)] gap-4 border-b border-[var(--dt-border)] py-3">
          <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">{row.tag}</span>
          <Link to={row.to} className="min-w-0 break-words text-sm text-[var(--dt-text-primary)] hover:text-[var(--dt-accent-soft)]">
            {row.title}
            {row.detail ? <span className="block text-xs text-[var(--dt-text-muted)]">in {row.detail}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Practice({ verified, previous, partial }) {
  if (!verified.connected) {
    return (
      <Empty>
        Connect a LeetCode account in <Link to="/app/settings" className="dt-link-button">Settings</Link> to see verified practice here.
      </Empty>
    );
  }
  if (verified.solved === 0) return <Empty>{partial ? `No new problems solved yet this week. Last week: ${previous.solved}.` : "No new problems solved that week."}</Empty>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--dt-text-secondary)]">
        {verified.easy} Easy · {verified.medium} Medium · {verified.hard} Hard
      </p>
      {verified.topPatterns.length ? (
        <ul className="flex flex-wrap gap-2">
          {verified.topPatterns.map((item) => (
            <li key={item.pattern} className="dt-badge">{item.pattern} × {item.count}</li>
          ))}
        </ul>
      ) : null}
      <span className="dt-badge dt-badge-verified">Verified from LeetCode</span>
    </div>
  );
}

function Slipped({ slipped }) {
  const rows = [
    ...slipped.overdue.map((item) => ({ key: `o-${item.kind}-${item.id}`, item, text: `Deadline passed ${formatMilestoneDue(item.date)}`, urgent: true })),
    ...slipped.stalled.map((item) => ({ key: `s-${item.kind}-${item.id}`, item, text: "Stalled", urgent: false })),
  ];
  if (rows.length === 0) return <Empty>Nothing slipped. Deadlines met and nothing stalled.</Empty>;
  return (
    <ul>
      {rows.map(({ key, item, text, urgent }) => (
        <li key={key} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--dt-border)] py-3">
          <Link to={subjectPath(item.kind)} className="min-w-0 break-words text-sm text-[var(--dt-text-primary)] hover:text-[var(--dt-accent-soft)]">{item.title}</Link>
          <span className={`text-[10px] uppercase tracking-[0.16em] ${urgent ? "text-red-300" : "text-[var(--dt-text-secondary)]"}`}>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function FocusItem({ item, index }) {
  let title;
  let detail;
  let to;
  if (item.type === "skill") {
    const text = describeSkillSignal(item.signal, item);
    if (!text) return null;
    ({ title, detail } = text);
    to = "/app/coding";
  } else {
    title = item.title;
    detail = [item.reasons.map((reason) => describeReason(reason)?.text).filter(Boolean).join(" · "), describeNextStep(item.nextStep)].filter(Boolean).join(". ");
    to = subjectPath(item.kind);
  }
  return (
    <li className="grid gap-3 border-b border-[var(--dt-border)] py-5 md:grid-cols-[40px_1fr] md:gap-6">
      <span className="font-mono text-[9px] tracking-[0.15em] text-[var(--dt-text-muted)]">{String(index + 1).padStart(2, "0")}</span>
      <div className="min-w-0">
        <Link to={to} className="break-words text-base font-medium text-[var(--dt-text-primary)] hover:text-[var(--dt-accent-soft)]">{title}</Link>
        <p className="mt-2 text-sm leading-6 text-[var(--dt-text-secondary)]">{detail}</p>
      </div>
    </li>
  );
}

function WeeklyReview() {
  const [params, setParams] = useSearchParams();
  const week = params.get("week") === "last" ? "last" : "current";
  const [state, setState] = useState({ status: "loading", data: null, error: "", week });

  useEffect(() => {
    let active = true;
    getWeeklyReview(week)
      .then((data) => active && setState({ status: "ready", data, error: "", week }))
      .catch((error) => active && setState({ status: "error", data: null, error: error.message, week }));
    return () => {
      active = false;
    };
  }, [week]);

  // Ignore a response for the other tab while the new one loads.
  const data = state.week === week ? state.data : null;
  const loading = state.status === "loading" || state.week !== week;
  const partial = week === "current";

  const tab = (value, label) => (
    <button
      type="button"
      onClick={() => setParams(value === "last" ? { week: "last" } : {}, { replace: true })}
      aria-pressed={week === value}
      className={`border px-4 py-2 text-[10px] uppercase tracking-[0.18em] transition-colors ${week === value ? "border-[var(--dt-accent)] text-[var(--dt-text-primary)]" : "border-[var(--dt-border)] text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]"}`}
    >
      {label}
    </button>
  );

  return (
    <section>
      <PageHeader
        eyebrow="Weekly review"
        title={data ? formatWeekRange(data.week) : "Your week"}
        description="Built from what you actually did: finished work, verified practice and recorded activity. No streaks, no scores."
      >
        <div className="flex gap-2 self-start sm:self-auto">
          {tab("current", "This week")}
          {tab("last", "Last week")}
        </div>
      </PageHeader>

      {loading ? <StateMessage tone="loading" title="Adding up the week..." /> : null}
      {state.status === "error" && !loading ? <StateMessage tone="error" title="Couldn't load the weekly review" message={state.error} /> : null}

      {data && !loading ? (
        <div className="space-y-14">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Figure value={data.totals.finished} label="Finished" note={compareText(data.totals.finished, data.previous.finished, { partial })} />
            <Figure
              value={data.verified.connected ? data.totals.solved : "—"}
              label="Verified solves"
              note={data.verified.connected ? compareText(data.totals.solved, data.previous.solved, { partial }) : null}
            />
            <Figure value={`${data.totals.activeDays}/${data.week.daysElapsed}`} label="Active days" note={compareText(data.totals.activeDays, data.previous.activeDays, { partial })} />
            <Figure value={data.totals.journalEntries} label="Journal entries" note={compareText(data.totals.journalEntries, data.previous.journalEntries, { partial })} />
          </div>

          <div>
            <SectionTitle note={partial ? "so far" : null}>Consistency</SectionTitle>
            <DayStrip days={data.consistency.days} />
          </div>

          <div className="grid gap-14 lg:grid-cols-2">
            <div>
              <SectionTitle>Finished</SectionTitle>
              <FinishedList finished={data.finished} />
            </div>
            <div>
              <SectionTitle>Verified practice</SectionTitle>
              <Practice verified={data.verified} previous={data.previous} partial={partial} />
              {data.code?.connected ? (
                <div className="mt-6 border-t border-[var(--dt-border)] pt-4">
                  <p className="text-sm text-[var(--dt-text-secondary)]">
                    {data.code.commits} {data.code.commits === 1 ? "commit" : "commits"} on linked repositories
                    <span className="ml-2 text-xs text-[var(--dt-text-muted)]">{compareText(data.code.commits, data.code.previousCommits, { partial })}</span>
                  </p>
                  <span className="dt-badge dt-badge-verified mt-3 inline-block">Verified from GitHub</span>
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <SectionTitle>Slipped</SectionTitle>
            <Slipped slipped={data.slipped} />
          </div>

          <div>
            <SectionTitle note="from your data">{partial ? "Focus for the rest of the week" : "Focus for this week"}</SectionTitle>
            {data.focus.length ? (
              <ol>{data.focus.map((item, index) => <FocusItem key={`${item.type}-${item.id || item.pattern}`} item={item} index={index} />)}</ol>
            ) : (
              <Empty>Nothing urgent. Pick one goal and take its next small step.</Empty>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default WeeklyReview;
