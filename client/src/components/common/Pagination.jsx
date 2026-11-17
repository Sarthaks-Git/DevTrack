// Page numbers with the current one in the middle: 1 … 4 5 6 … 12.
function pageList(page, pageCount) {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter(value => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push(`gap-${value}`);
    result.push(value);
  });
  return result;
}

const BUTTON = "min-w-8 border border-[var(--dt-border)] px-2.5 py-1 text-xs text-[var(--dt-text-secondary)] transition-colors hover:border-[var(--dt-accent)] hover:text-[var(--dt-text-primary)] disabled:cursor-not-allowed disabled:opacity-40";

// Hidden when everything fits on one page. Moves the view to `scrollTargetId` after a page change.
function Pagination({ page, pageCount, onChange, label = "Pages", scrollTargetId, total, pageSize }) {
  if (pageCount <= 1) return null;
  const go = next => {
    if (next < 1 || next > pageCount || next === page) return;
    onChange(next);
    // After React paints the new page, bring the top of the list into view.
    if (scrollTargetId) requestAnimationFrame(() => document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const from = total && pageSize ? (page - 1) * pageSize + 1 : null;
  const to = total && pageSize ? Math.min(page * pageSize, total) : null;

  return (
    <nav aria-label={label} className="mt-5 flex flex-wrap items-center justify-between gap-3">
      {from ? <p className="text-xs text-[var(--dt-text-muted)]">{from}–{to} of {total}</p> : <span />}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={BUTTON} onClick={() => go(page - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
        {pageList(page, pageCount).map(value => typeof value === "string" ? (
          <span key={value} className="px-1 text-xs text-[var(--dt-text-muted)]">…</span>
        ) : (
          <button
            key={value}
            type="button"
            onClick={() => go(value)}
            aria-current={value === page ? "page" : undefined}
            className={`${BUTTON} ${value === page ? "border-[var(--dt-accent)] bg-[var(--dt-accent)]/15 text-[var(--dt-text-primary)]" : ""}`}
          >
            {value}
          </button>
        ))}
        <button type="button" className={BUTTON} onClick={() => go(page + 1)} disabled={page === pageCount} aria-label="Next page">›</button>
      </div>
    </nav>
  );
}

export default Pagination;
