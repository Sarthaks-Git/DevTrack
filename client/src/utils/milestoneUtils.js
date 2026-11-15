// Milestone due dates are stored as UTC midnight of a calendar day; compare and format in UTC
// so the day never shifts with the viewer's timezone.
const todayKey = () => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

export function isMilestoneOverdue(milestone) {
  return Boolean(milestone?.dueDate && !milestone.done && new Date(milestone.dueDate).getTime() < todayKey());
}

export function formatMilestoneDue(value) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

// Open milestones from active goals and projects, soonest due first; undated ones last.
export function getOpenMilestones(goals = [], projects = []) {
  const activeGoals = goals.filter((goal) => !["completed", "archived"].includes(goal.status));
  const activeProjects = projects.filter((project) => !["completed", "archived"].includes(project.status));

  const rows = [
    ...activeGoals.flatMap((goal) =>
      (goal.milestones || []).filter((m) => !m.done).map((m) => ({ ...m, parentKind: "goal", parentTitle: goal.title, to: "/app/goals" })),
    ),
    ...activeProjects.flatMap((project) =>
      (project.milestones || []).filter((m) => !m.done).map((m) => ({ ...m, parentKind: "project", parentTitle: project.title, to: "/app/projects" })),
    ),
  ];

  const dueValue = (m) => (m.dueDate ? new Date(m.dueDate).getTime() : Number.POSITIVE_INFINITY);
  return rows.sort((a, b) => dueValue(a) - dueValue(b) || new Date(a.createdAt) - new Date(b.createdAt));
}
