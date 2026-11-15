import { Link } from "react-router-dom";

const TONES = {
  loading: "text-[var(--dt-text-secondary)]",
  empty: "text-[var(--dt-text-secondary)]",
  error: "text-red-300",
};

// One component for every loading, empty, and error state, so they look and behave alike.
function StateMessage({ tone = "empty", title, message, action, onRetry }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className="border border-dashed border-[var(--dt-border)] px-6 py-12 text-center"
    >
      {tone === "loading" ? (
        <span className="mx-auto mb-4 block h-5 w-5 animate-spin rounded-full border-2 border-[var(--dt-border-strong)] border-t-[var(--dt-accent-soft)]" />
      ) : null}
      {title ? <p className={`text-sm font-medium ${TONES[tone]}`}>{title}</p> : null}
      {message ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--dt-text-muted)]">{message}</p> : null}
      <div className="mt-5 flex justify-center gap-4">
        {onRetry ? (
          <button type="button" onClick={onRetry} className="dt-link-button">
            Try again
          </button>
        ) : null}
        {action ? (
          <Link to={action.to} className="dt-link-button">
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default StateMessage;
