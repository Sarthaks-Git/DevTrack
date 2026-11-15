import { Link } from "react-router-dom";
import { describeTarget } from "../../utils/goalTargetUtils";

// Verified progress bar for a goal target. Never editable: it comes from synced solves.
function GoalTargetProgress({ target, progress }) {
  if (!target || !progress) return null;
  const percent = Math.round((progress.current / progress.count) * 100);

  return (
    <div className="mt-5 max-w-md">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-[var(--dt-text-secondary)]">{describeTarget(target)}</p>
        <span className="dt-badge dt-badge-verified shrink-0">Verified</span>
      </div>
      {progress.connected ? (
        <>
          <div
            className="mt-3 h-1.5 w-full bg-[var(--dt-border)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.count}
            aria-valuenow={progress.current}
            aria-label="Verified target progress"
          >
            <div className="h-full bg-[var(--dt-accent-soft)] transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">
            {progress.current}/{progress.count} solved{progress.reached ? " · Target reached" : ""}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-[var(--dt-text-muted)]">
          Connect and verify LeetCode in{" "}
          <Link to="/app/settings" className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]">
            Settings
          </Link>{" "}
          to track this target.
        </p>
      )}
    </div>
  );
}

export default GoalTargetProgress;
