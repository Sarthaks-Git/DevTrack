import { useState } from "react";
import { setSecurityReviewStatus, updateSecurityItem } from "../../services/aiService";

const STATE_LABELS = { handled: "Handled", not_applicable: "Not applicable" };

function ChecklistItem({ item, disabled, onAnswer }) {
  const [showWhy, setShowWhy] = useState(false);
  const answered = item.state !== "unchecked";
  return (
    <li className="border-b border-[var(--dt-border)] py-3 last:border-b-0">
      <p className={`break-words text-sm ${answered ? "text-[var(--dt-text-muted)] line-through decoration-[var(--dt-border-strong)]" : "text-[var(--dt-text-primary)]"}`}>
        {item.text}
      </p>
      {showWhy && item.why ? <p className="mt-1 text-xs leading-5 text-[var(--dt-text-secondary)]">{item.why}</p> : null}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {answered ? (
          <>
            <span className="text-emerald-300">{STATE_LABELS[item.state]}</span>
            <button type="button" disabled={disabled} onClick={() => onAnswer(item.key, "unchecked")} className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">Undo</button>
          </>
        ) : (
          <>
            <button type="button" disabled={disabled} onClick={() => onAnswer(item.key, "handled")} className="text-[var(--dt-text-secondary)] hover:text-emerald-300">Handled</button>
            <button type="button" disabled={disabled} onClick={() => onAnswer(item.key, "not_applicable")} className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)]">Not applicable</button>
          </>
        )}
        {item.why ? (
          <button type="button" onClick={() => setShowWhy(value => !value)} aria-expanded={showWhy} className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">
            {showWhy ? "Hide why" : "Why it matters"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function ReviewCard({ review, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = review.status === "open";
  const answered = review.items.filter(item => item.state !== "unchecked").length;
  const latest = review.triggers[0];

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      onChange(await action());
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-[var(--dt-border)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--dt-text-primary)]">{review.area}</p>
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">
          {open ? `${answered}/${review.items.length}` : review.status === "done" ? "Done" : "Dismissed"}
        </span>
      </div>
      {latest ? (
        <p className="mt-1 break-words text-xs text-[var(--dt-text-muted)]">
          After{" "}
          <a href={latest.url} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-[var(--dt-accent-soft)]">{latest.shortSha}</a>{" "}
          {latest.message}
        </p>
      ) : null}
      {open ? (
        <ul className="mt-2">
          {review.items.map(item => (
            <ChecklistItem key={item.key} item={item} disabled={busy} onAnswer={(key, state) => run(() => updateSecurityItem(review.id, key, state))} />
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px]">
        <span className="dt-badge">AI-suggested</span>
        <a href="https://cheatsheetseries.owasp.org/" target="_blank" rel="noopener noreferrer" className="text-[var(--dt-text-muted)] hover:text-[var(--dt-accent-soft)]">OWASP cheat sheets ↗</a>
        {open ? (
          <button type="button" disabled={busy} onClick={() => run(() => setSecurityReviewStatus(review.id, "dismissed"))} className="ml-auto text-[var(--dt-text-muted)] hover:text-red-300">Dismiss</button>
        ) : (
          <button type="button" disabled={busy} onClick={() => run(() => setSecurityReviewStatus(review.id, "open"))} className="ml-auto text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">Reopen</button>
        )}
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

// AI-suggested security checks for one project, triggered by its linked repository's commits.
function ProjectSecurityChecks({ reviews, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  if (!reviews.length) return null;

  const openReviews = reviews.filter(review => review.status === "open");
  const closed = reviews.filter(review => review.status !== "open");

  return (
    <div className="mt-4 text-xs">
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="flex items-center gap-2 text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)]">
        <span>Security checks</span>
        {openReviews.length ? <span className="dt-badge border-amber-400/50 text-amber-300">{openReviews.length} open</span> : <span className="text-[var(--dt-text-muted)]">all done</span>}
      </button>
      {expanded ? (
        <div className="mt-3 space-y-3">
          {openReviews.map(review => <ReviewCard key={review.id} review={review} onChange={onChange} />)}
          {closed.length ? (
            <button type="button" onClick={() => setShowClosed(value => !value)} aria-expanded={showClosed} className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">
              {showClosed ? "Hide closed checks" : `Show ${closed.length} closed`}
            </button>
          ) : null}
          {showClosed ? closed.map(review => <ReviewCard key={review.id} review={review} onChange={onChange} />) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ProjectSecurityChecks;
