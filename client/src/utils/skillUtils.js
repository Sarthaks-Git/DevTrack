const percent = (share) => `${Math.round((share || 0) * 100)}%`;

// Plain-language explanation of a skill signal, always showing the evidence behind it.
export function describeSkillSignal(signal, item) {
  if (signal.code === "stuck_on_easy") {
    return {
      title: `${item.pattern}: mostly Easy so far`,
      detail: `${item.total} solved over ${signal.spanDays} days, only ${percent(signal.harderShare)} Medium or Hard. Try a ${item.recommendedDifficulty} ${item.pattern} problem next.`,
    };
  }
  if (signal.code === "fading") {
    return {
      title: `${item.pattern}: getting rusty`,
      detail: `No ${item.pattern} problem in ${signal.idleDays} days. One ${item.recommendedDifficulty} problem this week keeps it fresh.`,
    };
  }
  return null;
}

export const LEVEL_LABELS = { starting: "Starting", developing: "Developing", solid: "Solid" };
