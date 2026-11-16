import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

// Large overlay panel that scrolls on its own, for content too long for a card.
// Escape, the backdrop and Close dismiss it unless `locked` (e.g. while saving or while a confirm is open).
function OverlayDialog({ eyebrow, title, subtitle, locked = false, onClose, children, toolbar }) {
  const titleId = useId();
  const closeRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !locked) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [locked, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !locked) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-2xl flex-col border border-[var(--dt-border-strong)] bg-[var(--dt-surface)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--dt-border)] p-5 md:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">{eyebrow}</p>
            <h2 id={titleId} className="mt-2 break-words font-[family-name:var(--dt-font-display)] text-2xl leading-tight text-[var(--dt-text-primary)]">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-xs text-[var(--dt-text-secondary)]">{subtitle}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label={`Close ${eyebrow}`}
            className="px-2 py-1 text-xs uppercase tracking-[0.18em] text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)] disabled:opacity-40"
          >
            Close
          </button>
        </div>
        {toolbar ? <div className="border-b border-[var(--dt-border)] px-5 py-4 md:px-6">{toolbar}</div> : null}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 text-xs md:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export default OverlayDialog;
