import { relativeTime } from "../activity/activityMeta";

const DIFFICULTY_CLASS = {
  Easy: "text-emerald-300",
  Medium: "text-amber-300",
  Hard: "text-red-300",
};

const formatDay = (value) =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function ProblemRow({ problem }) {
  const name = problem.frontendId ? `${problem.frontendId}. ${problem.title}` : problem.title;
  // The pattern already names its source tag, so leave that tag out of the list beside it.
  const otherTopics = (problem.topics || [])
    .filter((topic) => topic.slug !== problem.patternTopic && topic.name !== problem.pattern)
    .map((topic) => topic.name);

  return (
    <li className="border-b border-[var(--dt-border)] py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <a
          href={`https://leetcode.com/problems/${problem.titleSlug}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 break-words text-sm font-medium text-[var(--dt-text-primary)] transition-colors hover:text-[var(--dt-accent-soft)]"
        >
          {name}
        </a>
        {problem.difficulty ? (
          <span className={`shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] ${DIFFICULTY_CLASS[problem.difficulty]}`}>
            {problem.difficulty}
          </span>
        ) : null}
      </div>

      {problem.pattern ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="border border-[var(--dt-accent)]/50 px-1.5 py-0.5 text-[var(--dt-accent-soft)]" title="Pattern, picked from the problem's LeetCode topics">
            {problem.pattern}
          </span>
          {otherTopics.length ? <span className="text-[var(--dt-text-muted)]">{otherTopics.slice(0, 3).join(" · ")}</span> : null}
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--dt-text-muted)]">Topics load on the next sync.</p>
      )}

      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--dt-text-muted)]">
        <span className="text-emerald-300">✓ Accepted</span>
        {problem.acceptedCount > 1 ? <span>· {problem.acceptedCount}×</span> : null}
        {problem.languages?.length ? <span>· {problem.languages.join(", ")}</span> : null}
        <span>· {relativeTime(problem.lastAcceptedAt)}</span>
      </p>
    </li>
  );
}

// Right-hand column on the Coding page: problems accepted since tracking began, newest first.
function ProblemLog({ data, loading, error, loadingMore, onLoadMore }) {
  const items = data?.items || [];

  return (
    <aside aria-labelledby="problem-log-title" className="min-[1340px]:sticky min-[1340px]:top-6 min-[1340px]:max-h-[calc(100vh-3rem)] min-[1340px]:overflow-y-auto min-[1340px]:pr-1">
      <div className="mb-4 flex items-end justify-between border-b border-[var(--dt-border)] pb-3">
        <p id="problem-log-title" className="text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
          Problem log
        </p>
        {data ? (
          <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--dt-text-muted)]">{data.total} solved</span>
        ) : null}
      </div>

      {data?.topPatterns?.length ? (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">Most used patterns</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.topPatterns.map((row) => (
              <span key={row.pattern} className="border border-[var(--dt-border)] px-2 py-0.5 text-[11px] text-[var(--dt-text-secondary)]">
                {row.pattern} <span className="text-[var(--dt-text-muted)]">{row.count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? <p className="py-4 text-sm text-[var(--dt-text-muted)]">Loading problems...</p> : null}
      {error ? <p role="alert" className="py-4 text-sm text-red-300">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="py-4 text-sm leading-6 text-[var(--dt-text-secondary)]">
          Problems you get accepted on LeetCode show up here. DevTrack checks for new ones each time you open it (at most every 10 minutes), or when you press Refresh.
        </p>
      ) : null}

      {items.length ? (
        <ol>
          {items.map((problem) => (
            <ProblemRow key={problem._id} problem={problem} />
          ))}
        </ol>
      ) : null}

      {data && data.page < data.pages ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)] disabled:opacity-40"
        >
          {loadingMore ? "Loading…" : "Show more"}
        </button>
      ) : null}

      {data?.trackingSince ? (
        <p className="mt-4 text-[10px] leading-4 text-[var(--dt-text-muted)]">
          Tracking since {formatDay(data.trackingSince)}. Verified from LeetCode&apos;s public data; it shows accepted submissions only, and patterns come from each problem&apos;s topic tags.
        </p>
      ) : null}
    </aside>
  );
}

export default ProblemLog;
