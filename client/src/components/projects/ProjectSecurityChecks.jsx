import { useState } from "react";
import { createPortal } from "react-dom";
import ConfirmModal from "../common/ConfirmModal";
import OverlayDialog from "../common/OverlayDialog";
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

function ReviewCard({ review, busy, error, onAnswer, onReopen, onDismissRequest }) {
  const open = review.status === "open";
  const answered = review.items.filter(item => item.state !== "unchecked").length;
  const latest = review.triggers[0];

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
            <ChecklistItem key={item.key} item={item} disabled={busy} onAnswer={onAnswer} />
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px]">
        <span className="dt-badge">AI-suggested</span>
        <a href="https://cheatsheetseries.owasp.org/" target="_blank" rel="noopener noreferrer" className="text-[var(--dt-text-muted)] hover:text-[var(--dt-accent-soft)]">OWASP cheat sheets ↗</a>
        {open ? (
          <button type="button" disabled={busy} onClick={onDismissRequest} className="ml-auto text-[var(--dt-text-muted)] hover:text-red-300">Dismiss</button>
        ) : (
          <button type="button" disabled={busy} onClick={onReopen} className="ml-auto text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">Reopen</button>
        )}
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

// Overlay with the project's checks; it scrolls on its own so the project grid stays put.
function ChecksDialog({ projectTitle, reviews, onChange, onClose }) {
  const [busyId, setBusyId] = useState("");
  const [errors, setErrors] = useState({});
  const [showClosed, setShowClosed] = useState(false);
  const [dismissing, setDismissing] = useState(null);

  const openReviews = reviews.filter(review => review.status === "open");
  const closed = reviews.filter(review => review.status !== "open");

  async function run(reviewId, action) {
    setBusyId(reviewId);
    setErrors(current => ({ ...current, [reviewId]: "" }));
    try {
      onChange(await action());
    } catch (failure) {
      setErrors(current => ({ ...current, [reviewId]: failure.message }));
    } finally {
      setBusyId("");
    }
  }

  const card = review => (
    <ReviewCard
      key={review.id}
      review={review}
      busy={busyId === review.id}
      error={errors[review.id]}
      onAnswer={(key, state) => run(review.id, () => updateSecurityItem(review.id, key, state))}
      onReopen={() => run(review.id, () => setSecurityReviewStatus(review.id, "open"))}
      onDismissRequest={() => setDismissing(review)}
    />
  );

  return (
    <>
      <OverlayDialog
        eyebrow="Security checks"
        title={projectTitle}
        subtitle={`${openReviews.length ? `${openReviews.length} open` : "All done"}${closed.length ? ` · ${closed.length} closed` : ""}`}
        locked={Boolean(dismissing || busyId)}
        onClose={onClose}
      >
        {openReviews.length ? openReviews.map(card) : (
          <p className="text-sm text-[var(--dt-text-secondary)]">No open checks. New ones appear after commits that touch security-relevant code.</p>
        )}
        {closed.length ? (
          <button type="button" onClick={() => setShowClosed(value => !value)} aria-expanded={showClosed} className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">
            {showClosed ? "Hide closed checks" : `Show ${closed.length} closed`}
          </button>
        ) : null}
        {showClosed ? closed.map(card) : null}
      </OverlayDialog>

      {createPortal(
        <ConfirmModal
          open={Boolean(dismissing)}
          title={dismissing ? `Dismiss "${dismissing.area}"?` : ""}
          confirmLabel="Dismiss"
          busyLabel="Dismissing..."
          destructive
          busy={Boolean(busyId)}
          onConfirm={async () => {
            const target = dismissing;
            await run(target.id, () => setSecurityReviewStatus(target.id, "dismissed"));
            setDismissing(null);
          }}
          onCancel={() => setDismissing(null)}
        >
          The whole check closes, including unanswered items. You can reopen it later from the closed checks.
        </ConfirmModal>,
        document.body,
      )}
    </>
  );
}

// AI-suggested security checks for one project: a small button on the card that opens an overlay.
function ProjectSecurityChecks({ projectTitle, reviews, onChange }) {
  const [open, setOpen] = useState(false);
  if (!reviews.length) return null;

  const openCount = reviews.filter(review => review.status === "open").length;

  return (
    <div className="mt-4 text-xs">
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex items-center gap-2 text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)]">
        <span>Security checks</span>
        {openCount ? <span className="dt-badge border-amber-400/50 text-amber-300">{openCount} open</span> : <span className="text-[var(--dt-text-muted)]">{reviews.length} closed</span>}
      </button>
      {open ? <ChecksDialog projectTitle={projectTitle} reviews={reviews} onChange={onChange} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

export default ProjectSecurityChecks;
