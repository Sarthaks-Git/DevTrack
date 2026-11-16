export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const fromKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// "16 – 22 Nov" or "28 Oct – 3 Nov".
export function formatWeekRange(week) {
  const start = fromKey(week.start);
  const end = fromKey(week.end);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = start.toLocaleDateString("en-IN", sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  const endText = end.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${startText} – ${endText}`;
}

// Honest comparison with the week before: no streaks, no scores.
// A week still in progress is not compared as a difference, only shown next to the full previous week.
export function compareText(current, previous, { partial, label = "last week" } = {}) {
  if (partial) return `${label}: ${previous}`;
  if (current === previous) return `same as ${label}`;
  const diff = current - previous;
  return `${diff > 0 ? "+" : "−"}${Math.abs(diff)} vs ${label}`;
}

export const finishedCount = (finished) => finished.goals.length + finished.projects.length + finished.milestones.length;
