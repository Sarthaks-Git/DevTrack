// Mirrors PATTERN_LABELS in server/src/utils/leetcodePatterns.js (the server re-validates).
export const TARGET_PATTERNS = [
  "Sliding Window", "Two Pointers", "Binary Search", "Monotonic Stack", "Monotonic Queue", "Backtracking",
  "Dynamic Programming", "Heap", "Union Find", "Topological Sort", "Shortest Path", "Minimum Spanning Tree",
  "BFS", "DFS", "Trie", "Segment Tree", "Fenwick Tree", "Prefix Sum", "Line Sweep", "Bit Manipulation",
  "Divide and Conquer", "Greedy", "HashMap", "Counting", "Stack", "Queue", "Linked List", "BST",
  "Binary Tree", "Tree", "Graph", "Recursion", "Design", "Simulation", "Sorting", "Matrix", "Math",
  "String", "Array",
];

export function describeTarget(target) {
  if (!target) return "";
  const parts = [target.difficulty, target.pattern].filter(Boolean).join(" ");
  return `Solve ${target.count} ${parts ? `${parts} ` : ""}LeetCode problem${target.count === 1 ? "" : "s"}`;
}
