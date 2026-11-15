import mongoose from 'mongoose';
import CodingProfile from '../models/CodingProfile.js';
import SolvedProblem from '../models/SolvedProblem.js';
import AppError from '../utils/AppError.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const PLATFORM = 'leetcode';
// Whole calendar days (UTC), so "idle 40 days" means 40 dates ago regardless of time of day.
const dayStart = time => time - (((time % DAY_MS) + DAY_MS) % DAY_MS);

// Thresholds are deliberately simple and documented so users can trust (and question) them.
export const SKILL_RULES = Object.freeze({
  stuckMinSolves: 5,
  stuckMinSpanDays: 21,
  stuckMaxHarderShare: 0.2,
  fadingMinSolves: 3,
  fadingIdleDays: 30,
  developingHarder: 2,
  solidHarder: 5,
  maxProblems: 5000,
});

// Interview-core patterns; one with no solves yet is reported as untouched.
export const CORE_PATTERNS = Object.freeze([
  'HashMap', 'Two Pointers', 'Sliding Window', 'Binary Search', 'Stack', 'Linked List',
  'Binary Tree', 'Heap', 'BFS', 'DFS', 'Backtracking', 'Greedy', 'Dynamic Programming',
  'Prefix Sum', 'Monotonic Stack', 'Trie', 'Union Find', 'Topological Sort',
]);

function levelOf(harder, hard) {
  if (harder >= SKILL_RULES.solidHarder && hard >= 1) return 'solid';
  if (harder >= SKILL_RULES.developingHarder) return 'developing';
  return 'starting';
}

function recommendedDifficulty(level, easy, harder) {
  if (level === 'solid') return 'Hard';
  if (level === 'developing') return harder >= SKILL_RULES.solidHarder ? 'Hard' : 'Medium';
  return easy >= 2 || harder > 0 ? 'Medium' : 'Easy';
}

function summarise(pattern, rows, today) {
  const count = difficulty => rows.filter(row => row.difficulty === difficulty).length;
  const easy = count('Easy');
  const medium = count('Medium');
  const hard = count('Hard');
  const known = easy + medium + hard;
  const harder = medium + hard;

  const firsts = rows.map(row => new Date(row.firstAcceptedAt).getTime());
  const lasts = rows.map(row => new Date(row.lastAcceptedAt).getTime());
  const firstSolvedAt = Math.min(...firsts);
  const lastSolvedAt = Math.max(...lasts);
  const spanDays = Math.round((dayStart(lastSolvedAt) - dayStart(firstSolvedAt)) / DAY_MS);
  const idleDays = Math.max(0, Math.round((today - dayStart(lastSolvedAt)) / DAY_MS));
  const activeWeeks = new Set(firsts.map(time => Math.floor(time / WEEK_MS))).size;
  const harderShare = known ? harder / known : null;

  const signals = [];
  if (rows.length >= SKILL_RULES.stuckMinSolves && spanDays >= SKILL_RULES.stuckMinSpanDays
      && harderShare !== null && harderShare < SKILL_RULES.stuckMaxHarderShare) {
    signals.push({ code: 'stuck_on_easy', spanDays, harderShare: Math.round(harderShare * 100) / 100 });
  }
  if (rows.length >= SKILL_RULES.fadingMinSolves && idleDays >= SKILL_RULES.fadingIdleDays) {
    signals.push({ code: 'fading', idleDays });
  }

  const level = levelOf(harder, hard);
  return {
    pattern,
    total: rows.length,
    easy,
    medium,
    hard,
    unknown: rows.length - known,
    harderShare: harderShare === null ? null : Math.round(harderShare * 100) / 100,
    firstSolvedAt: new Date(firstSolvedAt),
    lastSolvedAt: new Date(lastSolvedAt),
    spanDays,
    idleDays,
    activeWeeks,
    level,
    recommendedDifficulty: recommendedDifficulty(level, easy, harder),
    signals,
  };
}

// The one signal most worth acting on: being stuck beats fading; more practice in the topic ranks higher.
function pickFocus(patterns) {
  const rank = { stuck_on_easy: 2, fading: 1 };
  let best = null;
  for (const item of patterns) {
    for (const signal of item.signals) {
      const score = [rank[signal.code], item.total];
      if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1])) {
        best = { score, focus: { pattern: item.pattern, signal, total: item.total, easy: item.easy, medium: item.medium, hard: item.hard, recommendedDifficulty: item.recommendedDifficulty } };
      }
    }
  }
  return best?.focus ?? null;
}

export async function getSkillsLogic(userId, todayDate) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  const owner = new mongoose.Types.ObjectId(String(userId));
  const today = todayDate.getTime();

  const profile = await CodingProfile.findOne({ owner, platform: PLATFORM, connectionStatus: 'verified' })
    .select('trackingSince submissionsSyncedAt').lean();
  if (!profile) {
    return { connected: false, rules: SKILL_RULES, totalSolved: 0, patterns: [], focus: null, untouchedCore: [] };
  }

  const rows = await SolvedProblem.find({ owner, platform: PLATFORM })
    .select('pattern difficulty firstAcceptedAt lastAcceptedAt')
    .sort({ lastAcceptedAt: -1 })
    .limit(SKILL_RULES.maxProblems)
    .lean();

  const byPattern = new Map();
  for (const row of rows) {
    const key = row.pattern || 'Other';
    if (!byPattern.has(key)) byPattern.set(key, []);
    byPattern.get(key).push(row);
  }

  const patterns = [...byPattern.entries()]
    .map(([pattern, list]) => summarise(pattern, list, today))
    .sort((a, b) => b.total - a.total || a.pattern.localeCompare(b.pattern));

  return {
    connected: true,
    trackingSince: profile.trackingSince ?? null,
    lastSyncedAt: profile.submissionsSyncedAt ?? null,
    rules: SKILL_RULES,
    totalSolved: rows.length,
    patterns,
    focus: pickFocus(patterns),
    untouchedCore: CORE_PATTERNS.filter(pattern => !byPattern.has(pattern)),
  };
}
