// Sample values for the landing page visuals. Shown with a "Sample data" caption; never real users.

export const sampleGoal = {
  title: "Get interview-ready in data structures",
  target: { label: "Medium problems solved on LeetCode", goal: 60, verified: 34, manual: 6 },
  steps: [
    { title: "Arrays and hashing", due: "Nov 28", state: "verified" },
    { title: "Two pointers and sliding window", due: "Dec 5", state: "verified" },
    { title: "Trees and recursion notes", due: "Dec 12", state: "manual" },
    { title: "Graphs: BFS and DFS", due: "Dec 19", state: "open" },
  ],
};

export const sampleDashboard = {
  focus: "Finish the graphs step before Dec 19",
  attention: [
    { label: "Portfolio site", detail: "No commits in 9 days" },
    { label: "System design notes", detail: "Step overdue by 2 days" },
  ],
  // Last seven days, oldest first: active or not.
  week: [
    { day: "M", active: true },
    { day: "T", active: true },
    { day: "W", active: false },
    { day: "T", active: true },
    { day: "F", active: true },
    { day: "S", active: false },
    { day: "S", active: true },
  ],
  recent: [
    { kind: "verified", text: "Solved “Course Schedule” on LeetCode" },
    { kind: "verified", text: "3 commits to portfolio-site" },
    { kind: "manual", text: "Marked “Trees notes” done" },
  ],
};

export const sampleJournal = {
  entry: {
    date: "Thu, Nov 20",
    title: "Topological sort finally clicked",
    body: "Kahn’s algorithm made more sense once I drew the in-degree table by hand.",
  },
  timeline: [
    { date: "Nov 21", kind: "verified", text: "Solved “Course Schedule II”" },
    { date: "Nov 20", kind: "note", text: "Journal: Topological sort finally clicked" },
    { date: "Nov 19", kind: "verified", text: "Pushed 2 commits to graph-visualizer" },
  ],
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
