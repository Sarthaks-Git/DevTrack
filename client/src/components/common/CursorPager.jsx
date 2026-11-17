const BUTTON = "border border-[var(--dt-border)] px-3 py-1 text-xs text-[var(--dt-text-secondary)] transition-colors hover:border-[var(--dt-accent)] hover:text-[var(--dt-text-primary)] disabled:cursor-not-allowed disabled:opacity-40";

// Newer / older pages for feeds the server pages with a cursor (no total count, so no page numbers).
function CursorPager({ pageIndex, hasOlder, busy, onNewer, onOlder, label = "Pages" }) {
  if (pageIndex === 0 && !hasOlder) return null;
  return (
    <nav aria-label={label} className="mt-5 flex items-center justify-between gap-3">
      <button type="button" className={BUTTON} onClick={onNewer} disabled={busy || pageIndex === 0}>‹ Newer</button>
      <span className="text-xs text-[var(--dt-text-muted)]">Page {pageIndex + 1}</span>
      <button type="button" className={BUTTON} onClick={onOlder} disabled={busy || !hasOlder}>Older ›</button>
    </nav>
  );
}

export default CursorPager;
