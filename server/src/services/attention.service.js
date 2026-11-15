import mongoose from 'mongoose';
import Goal from '../models/Goal.js';
import Project from '../models/Project.js';
import JournalEntry from '../models/JournalEntry.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const ATTENTION_RULES = Object.freeze({
  dueSoonDays: 7,
  stalledDays: 14,
  maxItems: 5,
});

const SEVERITY = { overdue: 3, milestone_overdue: 3, due_soon: 2, milestone_due_soon: 2, stalled: 2 };
const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

const time = value => (value ? new Date(value).getTime() : null);

// Latest journal entry written for each linked goal or project, in two indexed lookups.
async function latestJournalBy(owner, field, ids) {
  if (ids.length === 0) return new Map();
  const rows = await JournalEntry.aggregate([
    { $match: { owner, [field]: { $in: ids } } },
    { $group: { _id: `$${field}`, last: { $max: '$createdAt' } } },
  ]);
  return new Map(rows.map(row => [String(row._id), row.last]));
}

function openMilestones(item) {
  return (item.milestones || [])
    .filter(milestone => !milestone.done)
    .sort((a, b) => (time(a.dueDate) ?? Infinity) - (time(b.dueDate) ?? Infinity) || time(a.createdAt) - time(b.createdAt));
}

function evaluate(item, { kind, deadline, active, lastActivityAt }, today) {
  const dueSoonLimit = today + ATTENTION_RULES.dueSoonDays * DAY_MS;
  const reasons = [];
  const deadlineTime = time(deadline);

  if (deadlineTime !== null && deadlineTime < today) reasons.push({ code: 'overdue', date: deadline });
  else if (deadlineTime !== null && deadlineTime <= dueSoonLimit) reasons.push({ code: 'due_soon', date: deadline });

  const milestones = openMilestones(item);
  const overdue = milestones.filter(m => m.dueDate && time(m.dueDate) < today);
  const dueSoon = milestones.filter(m => m.dueDate && time(m.dueDate) >= today && time(m.dueDate) <= dueSoonLimit);
  if (overdue.length) reasons.push({ code: 'milestone_overdue', count: overdue.length, date: overdue[0].dueDate });
  else if (dueSoon.length) reasons.push({ code: 'milestone_due_soon', count: dueSoon.length, date: dueSoon[0].dueDate });

  const idleDays = Math.floor((today - time(lastActivityAt)) / DAY_MS);
  if (active && idleDays >= ATTENTION_RULES.stalledDays) reasons.push({ code: 'stalled', days: idleDays });

  if (reasons.length === 0) return null;

  // Grounded in the user's own data: their next open milestone, otherwise a concrete way to get moving.
  let nextStep;
  if (milestones.length) nextStep = { code: 'milestone', title: milestones[0].title, dueDate: milestones[0].dueDate };
  else if ((item.milestones || []).length === 0) nextStep = { code: 'add_milestones' };
  else nextStep = { code: 'review_status' };

  const dates = reasons.map(reason => time(reason.date)).filter(value => value !== null);
  return {
    kind,
    id: String(item._id),
    title: item.title,
    status: item.status,
    priority: item.priority,
    deadline: deadline || null,
    lastActivityAt,
    reasons,
    nextStep,
    severity: Math.max(...reasons.map(reason => SEVERITY[reason.code])),
    sortDate: dates.length ? Math.min(...dates) : Infinity,
  };
}

export async function getAttentionLogic(userId, todayDate) {
  const owner = new mongoose.Types.ObjectId(String(userId));
  const today = todayDate.getTime();

  const [goals, projects] = await Promise.all([
    Goal.find({ owner, status: { $in: ['not_started', 'in_progress'] } }).lean(),
    Project.find({ owner, status: { $in: ['planning', 'in_progress'] } }).lean(),
  ]);

  const [goalJournal, projectJournal] = await Promise.all([
    latestJournalBy(owner, 'goal', goals.map(goal => goal._id)),
    latestJournalBy(owner, 'project', projects.map(project => project._id)),
  ]);

  // Work on a linked project counts as progress on its goal.
  const projectTouchByGoal = new Map();
  for (const project of projects) {
    if (!project.goal) continue;
    const key = String(project.goal);
    projectTouchByGoal.set(key, Math.max(projectTouchByGoal.get(key) || 0, time(project.updatedAt)));
  }

  const latest = (...values) => new Date(Math.max(...values.map(time).filter(value => value !== null)));

  const items = [
    ...goals.map(goal => evaluate(goal, {
      kind: 'goal',
      deadline: goal.deadline,
      active: goal.status === 'in_progress',
      lastActivityAt: latest(goal.updatedAt, goalJournal.get(String(goal._id)), projectTouchByGoal.get(String(goal._id))),
    }, today)),
    ...projects.map(project => evaluate(project, {
      kind: 'project',
      deadline: project.endDate,
      active: project.status === 'in_progress',
      lastActivityAt: latest(project.updatedAt, projectJournal.get(String(project._id))),
    }, today)),
  ].filter(Boolean);

  items.sort((a, b) =>
    b.severity - a.severity
    || (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0)
    || a.sortDate - b.sortDate
    || a.title.localeCompare(b.title));

  return {
    today: todayDate.toISOString().slice(0, 10),
    rules: ATTENTION_RULES,
    total: items.length,
    items: items.slice(0, ATTENTION_RULES.maxItems).map(({ severity, sortDate, ...item }) => ({ ...item, severity })),
  };
}
