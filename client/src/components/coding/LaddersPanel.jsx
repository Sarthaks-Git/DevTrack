import { useEffect, useState } from "react";
import { createLadder, deleteLadder, getLadders } from "../../services/codingService";

const REASON = {
  stuck_on_easy: "Stuck on Easy",
  fading: "Getting rusty",
  not_started: "Core topic not started",
  chosen: "Your pick",
};
const DIFFICULTY_TONE = { Easy: "text-emerald-300", Medium: "text-amber-300", Hard: "text-rose-300" };
// Slugs come from LeetCode and are validated on the server; still build the link only from safe ones.
const problemUrl = slug => (/^[a-z0-9-]{1,150}$/.test(slug) ? `https://leetcode.com/problems/${slug}/` : null);

// Practice ladders: real LeetCode problems for weak patterns, easiest first. Steps tick off from
// verified solves after a sync, never by hand.
function LaddersPanel({ version }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getLadders()
      .then(result => {
        if (!active) return;
        setData(result);
        setStatus("ready");
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [version]);

  async function reload() {
    setData(await getLadders());
  }

  async function start(pattern) {
    setBusy(`start-${pattern}`);
    setError("");
    try {
      await createLadder(pattern);
      await reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy("");
    }
  }

  async function remove(id) {
    setBusy(`remove-${id}`);
    setError("");
    try {
      await deleteLadder(id);
      await reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy("");
    }
  }

  if (status === "ready" && !data?.connected) return null;

  return (
    <section className="mb-6">
      <div className="mb-4 border-b border-[var(--dt-border)] pb-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">Practice ladders</p>
        <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">
          Six real LeetCode problems for a weak pattern, easiest first, starting at your level. Steps tick off by themselves once a solve syncs.
        </p>
      </div>

      {status === "loading" ? <p className="py-4 text-sm text-[var(--dt-text-muted)]">Loading ladders...</p> : null}
      {status === "error" ? <p role="alert" className="py-4 text-sm text-red-300">Couldn't load practice ladders right now.</p> : null}

      {status === "ready" ? (
        <div className="space-y-6">
          {data.ladders.map(ladder => (
            <div key={ladder.id} className="border border-[var(--dt-border)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-base text-[var(--dt-text-primary)]">
                  {ladder.pattern}
                  <span className="ml-3 text-xs text-[var(--dt-text-muted)]">{REASON[ladder.reason]}</span>
                </p>
                <p className="text-xs text-[var(--dt-text-secondary)]">
                  {ladder.completedAt ? "Done" : `${ladder.solved} of ${ladder.total} solved`}
                </p>
              </div>
              <div className="mt-2 h-1.5 w-full bg-[var(--dt-border)]" role="img" aria-label={`${ladder.solved} of ${ladder.total} solved`}>
                <span className="block h-full bg-[var(--dt-verified)]" style={{ width: `${(ladder.solved / ladder.total) * 100}%` }} />
              </div>
              <ol className="mt-3 space-y-1.5">
                {ladder.steps.map(step => {
                  const url = problemUrl(step.titleSlug);
                  const isNext = step.titleSlug === ladder.next;
                  return (
                    <li key={step.titleSlug} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                      <span aria-hidden="true" className="w-4 text-[var(--dt-verified)]">{step.solvedAt ? "✓" : isNext ? "→" : ""}</span>
                      <span className={`w-14 text-xs ${DIFFICULTY_TONE[step.difficulty]}`}>{step.difficulty}</span>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className={`min-w-0 break-words underline-offset-2 hover:underline ${step.solvedAt ? "text-[var(--dt-text-muted)] line-through" : "text-[var(--dt-text-primary)]"}`}>
                          {step.frontendId}. {step.title}
                        </a>
                      ) : (
                        <span>{step.title}</span>
                      )}
                      {step.solvedAt ? <span className="dt-badge dt-badge-verified">Verified</span> : null}
                    </li>
                  );
                })}
              </ol>
              <button type="button" onClick={() => remove(ladder.id)} disabled={Boolean(busy)} className="dt-link-button mt-3">
                {busy === `remove-${ladder.id}` ? "Removing..." : ladder.completedAt ? "Clear" : "Remove ladder"}
              </button>
            </div>
          ))}

          {data.suggestions.length ? (
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">Suggested from your problem log</p>
              <ul className="mt-3 space-y-2">
                {data.suggestions.map(item => (
                  <li key={item.pattern} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-[var(--dt-text-secondary)]">
                      {item.pattern}
                      <span className="ml-3 text-xs text-[var(--dt-text-muted)]">{REASON[item.reason]} · start at {item.level}</span>
                    </span>
                    <button type="button" onClick={() => start(item.pattern)} disabled={Boolean(busy)} className="dt-link-button">
                      {busy === `start-${item.pattern}` ? "Building..." : "Start ladder"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : !data.ladders.length ? (
            <p className="text-sm text-[var(--dt-text-secondary)]">No weak patterns found yet. Keep solving and suggestions will appear here.</p>
          ) : null}

          {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export default LaddersPanel;
