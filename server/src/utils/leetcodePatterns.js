// Picks the single most telling "pattern" from a problem's LeetCode topic tags.
// Order matters: specific techniques first, supporting data structures next, generic
// categories (Array, String, Math...) last, because those say little about the approach.
// See docs/LEETCODE_TRACKING_LOG.md (D4).
const PATTERN_PRIORITY = [
  ['sliding-window', 'Sliding Window'],
  ['two-pointers', 'Two Pointers'],
  ['binary-search', 'Binary Search'],
  ['monotonic-stack', 'Monotonic Stack'],
  ['monotonic-queue', 'Monotonic Queue'],
  ['backtracking', 'Backtracking'],
  ['dynamic-programming', 'Dynamic Programming'],
  ['memoization', 'Dynamic Programming'],
  ['heap-priority-queue', 'Heap'],
  ['union-find', 'Union Find'],
  ['topological-sort', 'Topological Sort'],
  ['shortest-path', 'Shortest Path'],
  ['minimum-spanning-tree', 'Minimum Spanning Tree'],
  ['breadth-first-search', 'BFS'],
  ['depth-first-search', 'DFS'],
  ['trie', 'Trie'],
  ['segment-tree', 'Segment Tree'],
  ['binary-indexed-tree', 'Fenwick Tree'],
  ['prefix-sum', 'Prefix Sum'],
  ['line-sweep', 'Line Sweep'],
  ['bit-manipulation', 'Bit Manipulation'],
  ['divide-and-conquer', 'Divide and Conquer'],
  ['greedy', 'Greedy'],
  ['hash-table', 'HashMap'],
  ['counting', 'Counting'],
  ['stack', 'Stack'],
  ['queue', 'Queue'],
  ['linked-list', 'Linked List'],
  ['binary-search-tree', 'BST'],
  ['binary-tree', 'Binary Tree'],
  ['tree', 'Tree'],
  ['graph', 'Graph'],
  ['recursion', 'Recursion'],
  ['design', 'Design'],
  ['simulation', 'Simulation'],
  ['sorting', 'Sorting'],
  ['matrix', 'Matrix'],
  ['math', 'Math'],
  ['string', 'String'],
  ['array', 'Array'],
];

const RANK = new Map(PATTERN_PRIORITY.map(([slug, label], index) => [slug, { label, index }]));

// Returns the pattern label and the slug of the tag it came from (so the UI can avoid
// showing "Heap" next to "Heap (Priority Queue)").
export function derivePatternWithTopic(topics = []) {
  let best = null;
  for (const topic of topics) {
    const match = RANK.get(topic?.slug);
    if (match && (!best || match.index < best.index)) best = { ...match, slug: topic.slug };
  }
  if (best) return { pattern: best.label, topic: best.slug };
  // Unknown tags only: fall back to the first tag LeetCode lists.
  return typeof topics[0]?.name === 'string' ? { pattern: topics[0].name, topic: topics[0].slug ?? null } : { pattern: null, topic: null };
}

export function derivePattern(topics = []) {
  return derivePatternWithTopic(topics).pattern;
}
