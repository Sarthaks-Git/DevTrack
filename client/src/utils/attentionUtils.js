import { formatMilestoneDue } from "./milestoneUtils";

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Plain-language text for one server attention reason.
export function describeReason(reason) {
  switch (reason.code) {
    case "overdue":
      return { text: `Overdue since ${formatMilestoneDue(reason.date)}`, urgent: true };
    case "due_soon":
      return { text: `Due ${formatMilestoneDue(reason.date)}`, urgent: false };
    case "milestone_overdue":
      return { text: `${plural(reason.count, "milestone")} overdue`, urgent: true };
    case "milestone_due_soon":
      return { text: `${plural(reason.count, "milestone")} due this week`, urgent: false };
    case "stalled":
      return { text: `No progress in ${reason.days} days`, urgent: false };
    default:
      return null;
  }
}

export function describeNextStep(step) {
  if (step.code === "milestone") {
    return `Next: ${step.title}${step.dueDate ? ` (${formatMilestoneDue(step.dueDate)})` : ""}`;
  }
  if (step.code === "add_milestones") return "Next: break it into milestones";
  return "Next: all milestones are done, review its status";
}

export const subjectPath = (kind) => (kind === "goal" ? "/app/goals" : "/app/projects");
