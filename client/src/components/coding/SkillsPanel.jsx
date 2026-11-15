import { useEffect, useState } from "react";
import { getLeetCodeSkills } from "../../services/codingService";
import { describeSkillSignal, LEVEL_LABELS } from "../../utils/skillUtils";

const LEVEL_TONES = {
  starting: "text-[var(--dt-text-muted)]",
  developing: "text-[var(--dt-text-secondary)]",
  solid: "text-[var(--dt-accent-soft)]",
};

function DifficultyBar({ easy, medium, hard }) {
  const known = easy + medium + hard;
  if (!known) return <div className="h-1.5 w-full bg-[var(--dt-border)]" />;
  const width = (count) => `${(count / known) * 100}%`;
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden bg-[var(--dt-border)]"
      role="img"
      aria-label={`${easy} easy, ${medium} medium, ${hard} hard`}
    >
      <span className="bg-emerald-400/70" style={{ width: width(easy) }} />
      <span className="bg-amber-400/80" style={{ width: width(medium) }} />
      <span className="bg-rose-400/80" style={{ width: width(hard) }} />
    </div>
  );
}

// Topic-by-topic view of verified practice, with honest signals about where it is thin.
function SkillsPanel({ version }) {
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let active = true;
    getLeetCodeSkills()
      .then((data) => active && setState({ status: "ready", data }))
      .catch(() => active && setState({ status: "error", data: null }));
    return () => {
      active = false;
    };
  }, [version]);

  const data = state.data;
  const signals = (data?.patterns || []).flatMap((item) =>
    item.signals.map((signal) => ({ item, signal, text: describeSkillSignal(signal, item) })),
  ).filter((entry) => entry.text);

  return (
    <section className="mb-10">
      <div className="mb-4 border-b border-[var(--dt-border)] pb-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">Skills</p>
        <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">
          Patterns from your accepted problems{data?.trackingSince ? ", since tracking began" : ""}
        </p>
      </div>

      {state.status === "loading" ? <p className="py-4 text-sm text-[var(--dt-text-muted)]">Reading your problem log...</p> : null}
      {state.status === "error" ? <p role="alert" className="py-4 text-sm text-red-300">Couldn't load skill signals right now.</p> : null}

      {state.status === "ready" && data.patterns.length === 0 ? (
        <p className="py-4 text-sm text-[var(--dt-text-secondary)]">
          Solve a few problems and refresh. Your patterns and skill signals will appear here.
        </p>
      ) : null}

      {signals.length > 0 ? (
        <ul className="mb-6 grid gap-3 md:grid-cols-2">
          {signals.map(({ item, signal, text }) => (
            <li key={`${item.pattern}-${signal.code}`} className="dt-card">
              <p className="text-sm font-medium text-[var(--dt-text-primary)]">{text.title}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--dt-text-secondary)]">{text.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {data?.patterns.length ? (
        <ul className="divide-y divide-[var(--dt-border)]">
          {data.patterns.map((item) => (
            <li key={item.pattern} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-center sm:gap-6">
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--dt-text-primary)]">{item.pattern}</p>
                <p className="text-[11px] text-[var(--dt-text-muted)]">
                  {item.total} solved · {item.easy}E {item.medium}M {item.hard}H
                </p>
              </div>
              <DifficultyBar easy={item.easy} medium={item.medium} hard={item.hard} />
              <span className={`text-[10px] uppercase tracking-[0.16em] ${LEVEL_TONES[item.level]}`}>
                {LEVEL_LABELS[item.level]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {data?.untouchedCore?.length ? (
        <p className="mt-5 text-xs leading-5 text-[var(--dt-text-muted)]">
          Not started yet: {data.untouchedCore.join(", ")}.
        </p>
      ) : null}
    </section>
  );
}

export default SkillsPanel;
