import { useState } from "react";
import { TECH_TIPS, getDailyTipIndex } from "../../utils/dayPeriod";

// Renders `backtick` spans as inline code.
function TipText({ text }) {
  return text.split("`").map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className="rounded-sm bg-[var(--dt-surface-elevated)] px-1 py-0.5 font-mono text-[0.85em] text-[var(--dt-text-primary)]">
        {part}
      </code>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function TechTip() {
  const [index, setIndex] = useState(getDailyTipIndex);
  const tip = TECH_TIPS[index];

  return (
    <aside aria-label="Tech tip" className="mt-8 max-w-2xl border-l border-[var(--dt-border-strong)] pl-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--dt-accent-soft)]">
          Tip · {tip.topic}
        </p>
        <button
          type="button"
          onClick={() => setIndex((current) => (current + 1) % TECH_TIPS.length)}
          className="text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)] transition-colors hover:text-[var(--dt-text-primary)]"
        >
          Another →
        </button>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--dt-text-secondary)]" aria-live="polite">
        <TipText text={tip.text} />
      </p>
    </aside>
  );
}

export default TechTip;
