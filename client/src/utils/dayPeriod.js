// Time-of-day periods drive the dashboard greeting and its background tint.
const PERIODS = [
  { key: "night", from: 0, greeting: "Working late." },
  { key: "morning", from: 5, greeting: "Good morning." },
  { key: "afternoon", from: 12, greeting: "Good afternoon." },
  { key: "evening", from: 17, greeting: "Good evening." },
  { key: "night", from: 22, greeting: "Working late." },
];

export function getDayPeriod(date = new Date()) {
  const hour = date.getHours();
  return [...PERIODS].reverse().find((period) => hour >= period.from);
}

// Small, practical, lesser-known things worth knowing. `backticks` render as code.
export const TECH_TIPS = [
  { topic: "Git", text: "`git switch -` jumps back to the branch you were just on, like `cd -` in the shell." },
  { topic: "Git", text: "`git bisect` binary-searches your history to find the exact commit that introduced a bug." },
  { topic: "Git", text: "`git reflog` records everywhere HEAD has been, so commits \"lost\" after a bad reset are usually recoverable." },
  { topic: "Git", text: "`git commit --fixup <sha>` followed by `git rebase -i --autosquash` folds a fix into the commit it belongs to." },
  { topic: "JavaScript", text: "`structuredClone()` deep-copies Maps, Sets, Dates and cyclic objects. A JSON round-trip silently loses them." },
  { topic: "JavaScript", text: "`arr.at(-1)` reads the last element without writing `arr[arr.length - 1]`." },
  { topic: "JavaScript", text: "`Promise.all` rejects on the first failure; `Promise.allSettled` waits for every promise and reports each outcome." },
  { topic: "JavaScript", text: "Pass an `AbortController` signal to `fetch` and abort it in an effect's cleanup to drop stale responses." },
  { topic: "JavaScript", text: "`Intl.RelativeTimeFormat` with `numeric: \"auto\"` turns -1 day into \"yesterday\" in any locale, no library needed." },
  { topic: "JavaScript", text: "Debounce waits until input stops before running; throttle runs at most once per interval while input continues." },
  { topic: "React", text: "Changing a component's `key` remounts it, which is the cleanest way to reset all of its state." },
  { topic: "React", text: "Since React 18, state updates are batched everywhere, including inside promises and timeouts, not only event handlers." },
  { topic: "React", text: "An effect's cleanup runs before the next effect and on unmount: the place to clear timers and subscriptions." },
  { topic: "CSS", text: "`clamp(min, preferred, max)` gives fluid font sizes without a single media query." },
  { topic: "CSS", text: "`:focus-visible` shows focus rings to keyboard users without flashing them on every mouse click." },
  { topic: "MongoDB", text: "A compound index on `{ a, b }` also serves queries on `a` alone, but not on `b` alone: the prefix rule." },
  { topic: "MongoDB", text: "Order compound index fields by the ESR rule: Equality first, then Sort, then Range." },
  { topic: "MongoDB", text: "`explain(\"executionStats\")` shows whether a query used an index (IXSCAN) or scanned the whole collection (COLLSCAN)." },
  { topic: "Databases", text: "The N+1 problem: one query for a list, then one per item. Batch with `$in` or a join instead." },
  { topic: "Databases", text: "ObjectIds and UUIDv7 start with a timestamp, so they index far better than random UUIDv4 keys." },
  { topic: "Security", text: "bcrypt only uses the first 72 bytes of a password; anything longer is silently ignored." },
  { topic: "Security", text: "`httpOnly` cookies are invisible to JavaScript, so an XSS bug cannot read the session token directly." },
  { topic: "Security", text: "`SameSite=Lax` cookies are not sent on cross-site POSTs, which already stops most CSRF attacks." },
  { topic: "HTTP", text: "401 means \"who are you?\" (not authenticated); 403 means \"I know who you are, and no\" (not allowed)." },
  { topic: "HTTP", text: "PUT and DELETE should be idempotent: sending the same request twice leaves the server as sending it once." },
  { topic: "Systems", text: "Retry with exponential backoff plus random jitter, or every client retries in lockstep and re-floods the server." },
  { topic: "Node.js", text: "Express 5 forwards rejected promises from async handlers to the error middleware; no try/catch wrapper needed." },
  { topic: "Algorithms", text: "Binary search works on any monotonic yes/no question, not just sorted arrays, e.g. the smallest capacity that ships in D days." },
  { topic: "Algorithms", text: "Prefix sums answer any range-sum query in O(1) after a single O(n) pass." },
  { topic: "Algorithms", text: "A monotonic stack solves \"next greater element\" style problems in O(n) instead of O(n²)." },
  { topic: "Algorithms", text: "Floyd's tortoise and hare detects a cycle in a linked list using O(1) extra memory." },
  { topic: "Algorithms", text: "Big-O hides constants: for small inputs, a linear scan over an array often beats a hash map." },
];

// Same tip all day; a new one each calendar day.
export function getDailyTipIndex(date = new Date()) {
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return dayNumber % TECH_TIPS.length;
}
