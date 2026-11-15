import { TARGET_PATTERNS } from "../../utils/goalTargetUtils";

const fieldClass =
  "w-full border border-[var(--dt-border)] bg-[var(--dt-surface)] px-4 py-3 text-sm text-[var(--dt-text-primary)] outline-none transition-colors duration-200 focus:border-[var(--dt-accent)]";
const labelClass = "mb-3 block text-xs font-medium uppercase tracking-[0.2em] text-[var(--dt-text-muted)]";

// Optional verified target: progress comes from synced LeetCode solves, not from checkboxes.
function GoalTargetFields({ value, onChange }) {
  const set = (field) => (event) =>
    onChange({ ...value, [field]: field === "enabled" ? event.target.checked : event.target.value });

  return (
    <fieldset className="border border-[var(--dt-border)] p-5">
      <legend className="px-2 text-xs font-medium uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
        Verified target
      </legend>

      <label className="flex items-start gap-3 text-sm text-[var(--dt-text-secondary)]">
        <input type="checkbox" checked={value.enabled} onChange={set("enabled")} className="mt-1" />
        <span>
          Track this goal with LeetCode. Progress counts problems you solve from now on, verified by DevTrack.
        </span>
      </label>

      {value.enabled ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="target-count" className={labelClass}>Problems</label>
            <input
              id="target-count"
              type="number"
              min={1}
              max={1000}
              step={1}
              required
              value={value.count}
              onChange={set("count")}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="target-pattern" className={labelClass}>Pattern</label>
            <select id="target-pattern" value={value.pattern} onChange={set("pattern")} className={fieldClass}>
              <option value="">Any pattern</option>
              {TARGET_PATTERNS.map((pattern) => (
                <option key={pattern} value={pattern}>{pattern}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="target-difficulty" className={labelClass}>Difficulty</label>
            <select id="target-difficulty" value={value.difficulty} onChange={set("difficulty")} className={fieldClass}>
              <option value="">Any difficulty</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

export default GoalTargetFields;
