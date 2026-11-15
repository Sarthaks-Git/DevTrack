import { useEffect, useId, useRef } from "react";

// In-app replacement for window.confirm. Focus moves into the dialog and Escape cancels.
function ConfirmModal({
  open,
  eyebrow = "Please confirm",
  title,
  children,
  confirmLabel = "Confirm",
  busyLabel = "Working...",
  destructive = false,
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onCancel();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-md border border-[var(--dt-border-strong)] bg-[var(--dt-surface)] p-7 shadow-2xl animate-[dt-modal-in_180ms_ease-out] md:p-8">
        <p className={`text-[10px] font-medium uppercase tracking-[0.3em] ${destructive ? "text-red-400/80" : "text-[var(--dt-text-muted)]"}`}>
          {eyebrow}
        </p>
        <h2 id={titleId} className="mt-4 font-[family-name:var(--dt-font-display)] text-3xl leading-tight text-[var(--dt-text-primary)]">
          {title}
        </h2>
        <div className="mt-4 text-sm leading-6 text-[var(--dt-text-secondary)]">{children}</div>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-secondary)] transition-colors duration-200 hover:text-[var(--dt-text-primary)] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            className={
              destructive
                ? "border border-red-500/60 bg-red-500/10 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-red-300 transition-all duration-200 hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                : "dt-primary-button"
            }
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
