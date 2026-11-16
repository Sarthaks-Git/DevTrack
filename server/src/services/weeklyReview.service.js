import mongoose from 'mongoose';
import Activity from '../models/Activity.js';
import CodingProfile from '../models/CodingProfile.js';
import Goal from '../models/Goal.js';
import JournalEntry from '../models/JournalEntry.js';
import Project from '../models/Project.js';
import SolvedProblem from '../models/SolvedProblem.js';
import AppError from '../utils/AppError.js';
import { computeAttention } from './attention.service.js';
import { getSkillsLogic } from './skills.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const REVIEW_RULES = Object.freeze({ maxFocus: 3, maxListed: 10, topPatterns: 3 });

// Events the system writes on its own; they are not effort, so they never count as an active day.
const PASSIVE_ACTIVITY = ['stats_synced', 'platform_verified', 'platform_disconnected'];
const OPEN_GOAL = ['not_started', 'in_progress'];
const OPEN_PROJECT = ['planning', 'in_progress'];

const dayKey = ms => new Date(ms).toISOString().slice(0, 10);

function ownerId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  return new mongoose.Types.ObjectId(String(userId));
}

// Monday-to-Sunday week in the viewer's timezone.
// `today` is the viewer's local date at UTC midnight; `tzOffset` is minutes east of UTC.
// Local dates are handled as UTC-midnight values; real instants are local minus the offset.
// `weeksBack` 0 is the current week, 1 the one before, and so on.
export function weekWindow(today, tzOffset, weeksBack = 0) {
  const weekday = (today.getUTCDay() + 6) % 7; // Monday = 0
  const localStart = today.getTime() - weekday * DAY_MS - weeksBack * 7 * DAY_MS;
  const shift = tzOffset * 60 * 1000;
  return {
    localStart,
    start: new Date(localStart - shift),
    end: new Date(localStart + 7 * DAY_MS - shift),
    shift,
    daysElapsed: weeksBack > 0 ? 7 : weekday + 1,
    todayLocal: today.getTime(),
  };
}

const dayIndex = (instant, window) => Math.floor((new Date(instant).getTime() + window.shift - window.localStart) / DAY_MS);

function finishedMilestones(docs, kind, window) {
  return docs.flatMap(doc => (doc.milestones || [])
    .filter(m => m.done && m.completedAt && m.completedAt >= window.start && m.completedAt < window.end)
    .map(m => ({ title: m.title, parentTitle: doc.title, kind, parentId: String(doc._id), completedAt: m.completedAt })));
}

// Raw facts for one week. Every query is scoped to the owner.
async function collectWeek(owner, window) {
  const range = { $gte: window.start, $lt: window.end };
  const milestoneMatch = { milestones: { $elemMatch: { done: true, completedAt: range } } };

  const [goals, projectEvents, goalMilestones, projectMilestones, solves, journals, activity] = await Promise.all([
    Goal.find({ owner, status: 'completed', completedAt: range }).select('title completedAt').sort({ completedAt: -1 }).lean(),
    Activity.find({ owner, type: 'project_completed', occurredAt: range }).select('subjectId').lean(),
    Goal.find({ owner, ...milestoneMatch }).select('title milestones').lean(),
    Project.find({ owner, ...milestoneMatch }).select('title milestones').lean(),
    SolvedProblem.find({ owner, firstAcceptedAt: range }).select('difficulty pattern firstAcceptedAt').lean(),
    JournalEntry.find({ owner, createdAt: range }).select('createdAt').lean(),
    Activity.find({ owner, occurredAt: range, type: { $nin: PASSIVE_ACTIVITY } }).select('occurredAt').limit(5000).lean(),
  ]);

  // Only projects that are still completed: a project reopened later is not "shipped".
  const projectIds = [...new Set(projectEvents.map(event => String(event.subjectId)).filter(Boolean))];
  const projects = projectIds.length
    ? await Project.find({ owner, _id: { $in: projectIds }, status: 'completed' }).select('title').lean()
    : [];

  const milestones = [...finishedMilestones(goalMilestones, 'goal', window), ...finishedMilestones(projectMilestones, 'project', window)]
    .sort((a, b) => b.completedAt - a.completedAt);

  const days = Array.from({ length: 7 }, () => false);
  for (const instant of [...activity.map(a => a.occurredAt), ...solves.map(s => s.firstAcceptedAt), ...journals.map(j => j.createdAt)]) {
    const index = dayIndex(instant, window);
    if (index >= 0 && index < 7) days[index] = true;
  }

  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  const byPattern = new Map();
  for (const solve of solves) {
    const key = solve.difficulty?.toLowerCase();
    if (key in byDifficulty) byDifficulty[key] += 1;
    if (solve.pattern) byPattern.set(solve.pattern, (byPattern.get(solve.pattern) || 0) + 1);
  }

  return {
    goals, projects, milestones, days,
    solved: solves.length,
    byDifficulty,
    topPatterns: [...byPattern.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, REVIEW_RULES.topPatterns)
      .map(([pattern, count]) => ({ pattern, count })),
    journalEntries: journals.length,
  };
}

// Open goals/projects whose deadline fell inside this week and has already passed.
async function slippedDeadlines(owner, window) {
  const lastPassedDay = Math.min(window.localStart + 7 * DAY_MS, window.todayLocal);
  const range = { $gte: new Date(window.localStart), $lt: new Date(lastPassedDay) };
  const [goals, projects] = await Promise.all([
    Goal.find({ owner, status: { $in: OPEN_GOAL }, deadline: range }).select('title deadline').lean(),
    Project.find({ owner, status: { $in: OPEN_PROJECT }, endDate: range }).select('title endDate').lean(),
  ]);
  return [
    ...goals.map(goal => ({ kind: 'goal', id: String(goal._id), title: goal.title, date: goal.deadline })),
    ...projects.map(project => ({ kind: 'project', id: String(project._id), title: project.title, date: project.endDate })),
  ].sort((a, b) => a.date - b.date);
}

const counts = week => ({
  solved: week.solved,
  finished: week.goals.length + week.projects.length + week.milestones.length,
  activeDays: week.days.filter(Boolean).length,
  journalEntries: week.journalEntries,
});

// Up to three concrete next steps, all chosen by rules from verified or recorded data.
function pickFocus(attentionItems, skillFocus) {
  const compact = item => ({ type: 'attention', kind: item.kind, id: item.id, title: item.title, reasons: item.reasons, nextStep: item.nextStep });
  const focus = [];
  if (attentionItems[0]) focus.push(compact(attentionItems[0]));
  if (skillFocus) focus.push({ type: 'skill', ...skillFocus });
  for (const item of attentionItems.slice(1)) {
    if (focus.length >= REVIEW_RULES.maxFocus) break;
    focus.push(compact(item));
  }
  return focus.slice(0, REVIEW_RULES.maxFocus);
}

export async function getWeeklyReviewLogic(userId, { today, tzOffset = 0, week = 'current' }) {
  const owner = ownerId(userId);
  const weeksBack = week === 'last' ? 1 : 0;
  const window = weekWindow(today, tzOffset, weeksBack);
  const previous = weekWindow(today, tzOffset, weeksBack + 1);

  const [current, before, slipped, attention, skills, profile] = await Promise.all([
    collectWeek(owner, window),
    collectWeek(owner, previous),
    slippedDeadlines(owner, window),
    computeAttention(owner, today),
    getSkillsLogic(owner, today),
    CodingProfile.exists({ owner, platform: 'leetcode', connectionStatus: 'verified' }),
  ]);

  const stalled = week === 'current'
    ? attention.items.filter(item => item.reasons.some(reason => reason.code === 'stalled')).map(item => ({ kind: item.kind, id: item.id, title: item.title }))
    : [];

  const list = items => items.slice(0, REVIEW_RULES.maxListed);
  return {
    week: {
      which: week,
      start: dayKey(window.localStart),
      end: dayKey(window.localStart + 6 * DAY_MS),
      daysElapsed: window.daysElapsed,
      complete: week === 'last',
    },
    finished: {
      goals: list(current.goals.map(goal => ({ id: String(goal._id), title: goal.title }))),
      projects: list(current.projects.map(project => ({ id: String(project._id), title: project.title }))),
      milestones: list(current.milestones.map(({ completedAt, ...milestone }) => milestone)),
    },
    verified: {
      connected: Boolean(profile),
      solved: current.solved,
      ...current.byDifficulty,
      topPatterns: current.topPatterns,
    },
    consistency: {
      days: current.days.slice(0, window.daysElapsed),
      activeDays: counts(current).activeDays,
      journalEntries: current.journalEntries,
    },
    slipped: { overdue: list(slipped), stalled: list(stalled) },
    totals: counts(current),
    previous: counts(before),
    // Next steps always look forward from today, whichever week is being reviewed.
    focus: pickFocus(attention.items, skills.focus),
  };
}
