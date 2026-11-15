import { PATTERN_LABELS } from './leetcodePatterns.js';
import { GOAL_TARGET_KINDS, GOAL_TARGET_MAX_COUNT } from '../models/Goal.js';

const TARGET_FIELDS = ['kind', 'pattern', 'difficulty', 'count'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

// Validates a client-supplied goal target. `since` is never accepted from the client.
// Returns { target } (an object or null) or { error }.
export function parseGoalTarget(value) {
  if (value === null) return { target: null };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Target must be an object or null' };
  if (Object.keys(value).some(key => !TARGET_FIELDS.includes(key))) return { error: 'Target contains invalid fields' };

  const { kind, pattern = null, difficulty = null, count } = value;
  if (!GOAL_TARGET_KINDS.includes(kind)) return { error: 'Unsupported target kind' };
  if (pattern !== null && !PATTERN_LABELS.includes(pattern)) return { error: 'Unknown pattern' };
  if (difficulty !== null && !DIFFICULTIES.includes(difficulty)) return { error: 'Invalid difficulty' };
  if (!Number.isInteger(count) || count < 1 || count > GOAL_TARGET_MAX_COUNT) {
    return { error: `Target count must be a whole number from 1 to ${GOAL_TARGET_MAX_COUNT}` };
  }
  return { target: { kind, pattern, difficulty, count } };
}

// Same kind, pattern and difficulty: only the count changed, so earlier progress still counts.
export function sameTargetScope(a, b) {
  return Boolean(a && b && a.kind === b.kind && a.pattern === b.pattern && a.difficulty === b.difficulty);
}
