import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLeetCodeSkills } from "../../services/codingService";
import { describeSkillSignal } from "../../utils/skillUtils";

// The single most useful practice signal from verified LeetCode data; hidden when there is none.
function LearningSignal({ version }) {
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    let active = true;
    getLeetCodeSkills()
      .then((data) => active && setFocus(data.focus))
      .catch(() => active && setFocus(null));
    return () => {
      active = false;
    };
  }, [version]);

  const text = focus ? describeSkillSignal(focus.signal, focus) : null;
  if (!text) return null;

  return (
    <div className="dt-card mt-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">Learning signal</p>
      <p className="mt-3 text-sm font-medium text-[var(--dt-text-primary)]">{text.title}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--dt-text-secondary)]">{text.detail}</p>
      <Link to="/app/coding" className="dt-link-button mt-4 inline-block">See all skills →</Link>
    </div>
  );
}

export default LearningSignal;
