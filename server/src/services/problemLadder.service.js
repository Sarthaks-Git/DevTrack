import mongoose from 'mongoose';
import CodingProfile from '../models/CodingProfile.js';
import LeetCodeTagList from '../models/LeetCodeTagList.js';
import ProblemLadder, { LADDER_DIFFICULTIES, MAX_ACTIVE_LADDERS } from '../models/ProblemLadder.js';
import SolvedProblem from '../models/SolvedProblem.js';
import AppError from '../utils/AppError.js';
import { PATTERN_TAG } from '../utils/leetcodePatterns.js';
import { postGraphQL } from './leetcodeSubmissions.service.js';
import { CORE_PATTERNS, getSkillsLogic } from './skills.service.js';

// AI-free mentor feature: a 6-step ladder of real LeetCode problems for a weak pattern, starting at
// the user's level, easiest first. Steps tick off from verified solves only.

export const LADDER_RULES = { steps: 6, cacheDays: 7, fetchLimit: 100, keepPerList: 40 };
const DAY_MS = 24 * 60 * 60 * 1000;
const SLUG = /^[a-z0-9-]{1,150}$/;

const QUESTION_LIST_QUERY = `
  query ladderQuestions($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
      data { acRate difficulty questionFrontendId isPaidOnly title titleSlug }
    }
  }
`;

// How many problems of each difficulty, by the level the skills engine recommends.
const MIX = {
  Easy: { Easy: 3, Medium: 3, Hard: 0 },
  Medium: { Easy: 1, Medium: 3, Hard: 2 },
  Hard: { Easy: 0, Medium: 2, Hard: 4 },
};

function ownerId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
  return new mongoose.Types.ObjectId(String(userId));
}

/** Free problems for one tag and difficulty, easiest first. Validates everything LeetCode returns. */
export function parseQuestionList(data, difficulty) {
  const rows = Array.isArray(data?.questionList?.data) ? data.questionList.data : [];
  return rows
    .filter(row => row && row.isPaidOnly === false && row.difficulty === difficulty && SLUG.test(row.titleSlug ?? '')
      && typeof row.title === 'string' && row.title.trim() && row.title.length <= 200
      && typeof row.questionFrontendId === 'string' && /^\d{1,6}$/.test(row.questionFrontendId))
    .map(row => ({ titleSlug: row.titleSlug, title: row.title.trim(), frontendId: row.questionFrontendId, acRate: Number.isFinite(row.acRate) ? row.acRate : 0 }))
    .sort((a, b) => b.acRate - a.acRate)
    .slice(0, LADDER_RULES.keepPerList);
}

/** Cached for a week and shared by everyone; a stale copy is used if LeetCode is down. */
export async function questionsFor(tag, difficulty, now = new Date()) {
  const key = `${tag}:${difficulty}`;
  const cached = await LeetCodeTagList.findById(key).lean();
  if (cached && now - cached.fetchedAt < LADDER_RULES.cacheDays * DAY_MS) return cached.questions;
  try {
    const data = await postGraphQL(QUESTION_LIST_QUERY, {
      categorySlug: '',
      limit: LADDER_RULES.fetchLimit,
      skip: 0,
      filters: { tags: [tag], difficulty: difficulty.toUpperCase() },
    });
    const questions = parseQuestionList(data, difficulty);
    // Never replace a good list with an empty one from a bad response.
    if (questions.length || !cached) {
      await LeetCodeTagList.updateOne({ _id: key }, { $set: { questions, fetchedAt: now } }, { upsert: true });
    }
    return questions.length ? questions : cached?.questions || [];
  } catch (error) {
    if (cached) return cached.questions;
    throw error;
  }
}

async function requireVerifiedLeetCode(owner) {
  const profile = await CodingProfile.exists({ owner, platform: 'leetcode', connectionStatus: 'verified' });
  if (!profile) throw new AppError('Connect and verify LeetCode in Settings first', 409, 'LEETCODE_NOT_VERIFIED');
}

/** Picks the steps: the user's level decides the mix; solved problems are skipped. */
export function buildSteps(lists, recommended, solvedSlugs) {
  const mix = MIX[recommended] || MIX.Easy;
  const steps = [];
  for (const difficulty of LADDER_DIFFICULTIES) {
    const wanted = mix[difficulty];
    const available = (lists[difficulty] || []).filter(question => !solvedSlugs.has(question.titleSlug));
    steps.push(...available.slice(0, wanted).map(question => ({ ...question, difficulty })));
  }
  // Short on one difficulty (a small tag): fill from the others, still easiest first.
  if (steps.length < LADDER_RULES.steps) {
    const used = new Set(steps.map(step => step.titleSlug));
    for (const difficulty of LADDER_DIFFICULTIES) {
      for (const question of lists[difficulty] || []) {
        if (steps.length >= LADDER_RULES.steps) break;
        if (used.has(question.titleSlug) || solvedSlugs.has(question.titleSlug)) continue;
        used.add(question.titleSlug);
        steps.push({ ...question, difficulty });
      }
    }
  }
  const order = { Easy: 0, Medium: 1, Hard: 2 };
  return steps
    .sort((a, b) => order[a.difficulty] - order[b.difficulty] || b.acRate - a.acRate)
    .slice(0, LADDER_RULES.steps)
    .map(({ titleSlug, title, frontendId, difficulty }) => ({ titleSlug, title, frontendId, difficulty, solvedAt: null }));
}

// Marks steps solved from verified solves, and completes the ladder when every step is done.
async function withProgress(owner, ladders) {
  const slugs = [...new Set(ladders.flatMap(ladder => ladder.steps.map(step => step.titleSlug)))];
  const solved = slugs.length
    ? new Map((await SolvedProblem.find({ owner, platform: 'leetcode', titleSlug: { $in: slugs } }).select('titleSlug firstAcceptedAt').lean())
      .map(row => [row.titleSlug, row.firstAcceptedAt]))
    : new Map();
  const out = [];
  for (const ladder of ladders) {
    let changed = false;
    const steps = ladder.steps.map(step => {
      if (!step.solvedAt && solved.has(step.titleSlug)) {
        changed = true;
        return { ...step, solvedAt: solved.get(step.titleSlug) };
      }
      return step;
    });
    const done = steps.every(step => step.solvedAt);
    const completedAt = ladder.completedAt || (done ? new Date() : null);
    if (changed || completedAt !== ladder.completedAt) {
      await ProblemLadder.updateOne({ _id: ladder._id, owner }, { $set: { steps, completedAt } });
    }
    out.push({ ...ladder, steps, completedAt });
  }
  return out;
}

const publicLadder = ladder => ({
  id: String(ladder._id),
  pattern: ladder.pattern,
  reason: ladder.reason,
  steps: ladder.steps.map(step => ({ titleSlug: step.titleSlug, title: step.title, frontendId: step.frontendId, difficulty: step.difficulty, solvedAt: step.solvedAt })),
  solved: ladder.steps.filter(step => step.solvedAt).length,
  total: ladder.steps.length,
  // The first unsolved step: what to do next.
  next: ladder.steps.find(step => !step.solvedAt)?.titleSlug || null,
  completedAt: ladder.completedAt,
  createdAt: ladder.createdAt,
});

/** The user's ladders with live progress, plus weak patterns worth a ladder. */
export async function listLaddersLogic(userId, todayDate) {
  const owner = ownerId(userId);
  const [skills, ladders] = await Promise.all([
    getSkillsLogic(owner, todayDate),
    ProblemLadder.find({ owner }).sort({ completedAt: 1, createdAt: -1 }).lean(),
  ]);
  if (!skills.connected) return { connected: false, ladders: [], suggestions: [] };

  const have = new Set(ladders.map(ladder => ladder.pattern));
  const suggestions = [];
  for (const item of skills.patterns) {
    if (!PATTERN_TAG[item.pattern] || have.has(item.pattern)) continue;
    const signal = item.signals.find(entry => entry.code === 'stuck_on_easy') || item.signals.find(entry => entry.code === 'fading');
    if (signal) suggestions.push({ pattern: item.pattern, reason: signal.code, level: item.recommendedDifficulty });
  }
  for (const pattern of skills.untouchedCore) {
    if (PATTERN_TAG[pattern] && !have.has(pattern)) suggestions.push({ pattern, reason: 'not_started', level: 'Easy' });
  }
  return {
    connected: true,
    ladders: (await withProgress(owner, ladders)).map(publicLadder),
    suggestions: suggestions.slice(0, 6),
    maxActive: MAX_ACTIVE_LADDERS,
  };
}

export async function createLadderLogic(userId, pattern, todayDate) {
  const owner = ownerId(userId);
  const tag = PATTERN_TAG[pattern];
  if (!tag) throw new AppError('Unknown pattern', 400, 'VALIDATION_ERROR');
  await requireVerifiedLeetCode(owner);

  const active = await ProblemLadder.countDocuments({ owner, completedAt: null });
  if (active >= MAX_ACTIVE_LADDERS) throw new AppError(`Finish or remove a ladder first (at most ${MAX_ACTIVE_LADDERS} at a time)`, 409, 'LADDER_LIMIT');
  if (await ProblemLadder.exists({ owner, pattern })) throw new AppError('You already have a ladder for this pattern', 409, 'LADDER_EXISTS');

  const skills = await getSkillsLogic(owner, todayDate);
  const item = skills.patterns.find(entry => entry.pattern === pattern);
  const recommended = LADDER_DIFFICULTIES.includes(item?.recommendedDifficulty) ? item.recommendedDifficulty : 'Easy';
  const signal = item?.signals.find(entry => entry.code === 'stuck_on_easy') || item?.signals.find(entry => entry.code === 'fading');
  const reason = signal?.code || (CORE_PATTERNS.includes(pattern) && !item ? 'not_started' : 'chosen');

  // Only the difficulties this level's mix uses (at most two LeetCode requests, usually cached).
  const lists = {};
  for (const difficulty of LADDER_DIFFICULTIES) {
    lists[difficulty] = MIX[recommended][difficulty] > 0 ? await questionsFor(tag, difficulty) : [];
  }

  const solvedSlugs = new Set((await SolvedProblem.find({ owner, platform: 'leetcode' }).select('titleSlug').limit(5000).lean()).map(row => row.titleSlug));
  const steps = buildSteps(lists, recommended, solvedSlugs);
  if (!steps.length) throw new AppError('LeetCode has no free problems left for this pattern that you have not solved.', 409, 'LADDER_EMPTY');

  try {
    const ladder = await ProblemLadder.create({ owner, pattern, tag, reason, steps });
    return { ladder: publicLadder(ladder.toObject()) };
  } catch (error) {
    if (error?.code === 11000) throw new AppError('You already have a ladder for this pattern', 409, 'LADDER_EXISTS');
    throw error;
  }
}

export async function deleteLadderLogic(userId, ladderId) {
  const owner = ownerId(userId);
  const result = await ProblemLadder.deleteOne({ _id: ladderId, owner });
  if (!result.deletedCount) throw new AppError('Ladder not found', 404, 'NOT_FOUND');
}
