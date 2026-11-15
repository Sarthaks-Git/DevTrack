// Display metadata for timeline events. Keys mirror server ACTIVITY_TYPES.
export const ACTIVITY_META = {
  goal_created: { label: "Goal set", marker: "◇" },
  goal_completed: { label: "Goal completed", marker: "◆" },
  goal_reopened: { label: "Goal reopened", marker: "◇" },
  project_created: { label: "Project started", marker: "□" },
  project_status_changed: { label: "Project update", marker: "□" },
  project_completed: { label: "Project shipped", marker: "■" },
  journal_created: { label: "Journal entry", marker: "✎" },
  platform_verified: { label: "Account verified", marker: "✓" },
  platform_disconnected: { label: "Account disconnected", marker: "×" },
  // Older events from before problem tracking; kept so history still renders.
  stats_synced: { label: "Coding progress", marker: "↑" },
  problem_solved: { label: "Problem solved", marker: "✓" },
};

export const ACTIVITY_FILTERS = [
  { value: "", label: "All activity" },
  { value: "goal_completed", label: "Completed goals" },
  { value: "project_completed", label: "Shipped projects" },
  { value: "journal_created", label: "Journal entries" },
  { value: "problem_solved", label: "Problems solved" },
];

export function activityLabel(type) {
  return ACTIVITY_META[type]?.label || "Activity";
}

export function relativeTime(value, now = Date.now()) {
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const units = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of units) {
    if (seconds >= size) return formatter.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
}
