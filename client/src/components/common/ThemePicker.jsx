import { useTheme } from "../../theme/theme";

const LABELS = { system: "System", light: "Light", dark: "Dark" };

// System / Light / Dark switch. `compact` is the small version in the sidebar.
function ThemePicker({ compact = false }) {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <div role="radiogroup" aria-label="Theme" className="inline-flex border border-[var(--dt-border)]">
        {Object.entries(LABELS).map(([value, label]) => {
          const selected = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPreference(value)}
              className={`${compact ? "px-2 py-1 text-[11px]" : "px-4 py-2 text-sm"} transition-colors ${selected ? "bg-[var(--dt-accent)] text-white" : "text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)]"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {!compact && preference === "system" ? (
        <p className="mt-2 text-xs text-[var(--dt-text-muted)]">Following your device: {resolved} right now.</p>
      ) : null}
    </div>
  );
}

export default ThemePicker;
