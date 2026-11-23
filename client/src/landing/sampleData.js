// Sample values for the landing page visuals. Shown with a "Sample data" caption; never real users.

// Shapes match what the API returns, so the app's own components render them unchanged.
export const sampleGoal = {
  _id: "sample-goal",
  title: "Get interview-ready in data structures",
  description: "Two problems a day, one topic a week, notes for anything that took more than an hour.",
  status: "in_progress",
  priority: "high",
  deadline: "2026-12-31T00:00:00.000Z",
  target: { count: 60, difficulty: "Medium", pattern: null },
  targetProgress: { connected: true, current: 34, count: 60, reached: false },
  milestones: [
    { _id: "m1", title: "Arrays and hashing", done: true, dueDate: "2026-11-28T00:00:00.000Z" },
    { _id: "m2", title: "Two pointers and sliding window", done: true, dueDate: "2026-12-05T00:00:00.000Z" },
    { _id: "m3", title: "Trees and recursion", done: false, dueDate: "2026-12-12T00:00:00.000Z" },
    { _id: "m4", title: "Graphs: BFS and DFS", done: false, dueDate: "2026-12-19T00:00:00.000Z" },
  ],
};

// ActivityItem shape. "verified" items come from LeetCode or GitHub; the rest are things you did.
export const sampleActivity = [
  { _id: "a1", type: "problem_solved", source: "verified", title: "Course Schedule", occurredAt: "2026-11-21T18:42:00" },
  { _id: "a2", type: "commit_pushed", source: "verified", title: "graph-visualizer: add BFS step mode", occurredAt: "2026-11-21T16:05:00" },
  { _id: "a3", type: "journal_created", source: "manual", title: "Topological sort finally clicked", occurredAt: "2026-11-20T22:10:00" },
  { _id: "a4", type: "goal_created", source: "manual", title: "Get interview-ready in data structures", occurredAt: "2026-11-18T09:30:00" },
];

export const sampleCoding = { username: "sample_dev", totalSolved: 148, easySolved: 71, mediumSolved: 64, hardSolved: 13 };

export const sampleWeek = { days: [true, true, false, true, true, false], activeDays: 4, daysElapsed: 6, solved: 9, finished: 2, journal: 3 };

export const sampleAttention = [
  { title: "System design notes", reason: "Milestone overdue by 2 days", urgent: true, next: "Finish “Caching basics” or move its date." },
  { title: "Portfolio site", reason: "No progress in 9 days", urgent: false, next: "Push one small change, or pause the project." },
];

export const sampleJournalEntry = {
  _id: "j1",
  entryDate: "2026-11-20T00:00:00.000Z",
  type: "learning",
  pinned: false,
  title: "Topological sort finally clicked",
  content: "Kahn’s algorithm made more sense once I drew the in-degree table by hand. Next: redo Course Schedule II without looking.",
  goal: { title: "Get interview-ready in data structures" },
  project: null,
  tags: ["graphs", "leetcode"],
};

// AI tools that exist today (server/src/config/config.js, AI plans).
export const aiTools = [
  { name: "Goal roadmap", detail: "Suggests ordered steps with due dates. You keep only the ones you want." },
  { name: "Goal quiz", detail: "A short self-check on a goal, with spaced reviews 3, 7 and 30 days later." },
  { name: "Project ideas", detail: "Practice projects for a goal. Picking one creates an ordinary project." },
  { name: "Weekly review", detail: "A short written note on your week, based on what you finished and solved." },
  { name: "Security review", detail: "Checks commits on a tracked GitHub repo and builds a security checklist." },
  { name: "Code review", detail: "Line-by-line findings on your commits.", pro: true },
];

// Pro passes (server/src/config/config.js, PRO_PASSES). Prepaid, no auto-renew.
export const plans = {
  free: {
    name: "Free",
    price: "₹0",
    items: [
      "Goals, projects, journal and timeline",
      "LeetCode stats with ownership verification",
      "GitHub repo tracking",
      "Reminders by email and push",
      "AI tools, 100 actions a month",
    ],
  },
  pro: {
    name: "Pro",
    prices: ["₹299 for 30 days", "₹2,999 for 365 days"],
    items: [
      "Everything in Free",
      "AI code review on your commits",
      "300 AI actions a month",
      "A more capable AI model",
    ],
    note: "Prepaid pass. It never renews on its own.",
  },
  comingSoon: ["Codeforces", "CodeChef", "HackerRank", "LeetCode China"],
};
