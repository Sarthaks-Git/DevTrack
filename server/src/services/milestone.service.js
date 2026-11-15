import mongoose from 'mongoose';
import Goal from '../models/Goal.js';
import Project from '../models/Project.js';
import { MAX_MILESTONES } from '../models/milestone.schema.js';
import AppError from '../utils/AppError.js';
import { recordActivity } from './activity.service.js';

// Milestones live inside their goal or project; every query is scoped by parent id AND owner.
const PARENTS = {
  goal: { Model: Goal, label: 'Goal' },
  project: { Model: Project, label: 'Project' },
};

function parentFor(kind, userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
  const parent = PARENTS[kind];
  if (!parent) throw new AppError('Unknown milestone parent', 500);
  return parent;
}

const notFound = label => new AppError(`${label} not found`, 404, 'NOT_FOUND');
const milestoneNotFound = () => new AppError('Milestone not found', 404, 'NOT_FOUND');

export async function addMilestoneLogic(kind, userId, parentId, { title, dueDate = null }) {
  const { Model, label } = parentFor(kind, userId);

  // The size guard is part of the filter, so concurrent adds can never exceed the cap.
  const doc = await Model.findOneAndUpdate(
    { _id: parentId, owner: userId, [`milestones.${MAX_MILESTONES - 1}`]: { $exists: false } },
    { $push: { milestones: { title, dueDate } } },
    { returnDocument: 'after', runValidators: true }
  );
  if (doc) return doc;

  if (!(await Model.exists({ _id: parentId, owner: userId }))) throw notFound(label);
  throw new AppError(`A ${label.toLowerCase()} can have at most ${MAX_MILESTONES} milestones`, 409, 'MILESTONE_LIMIT');
}

export async function updateMilestoneLogic(kind, userId, parentId, milestoneId, changes) {
  const { Model, label } = parentFor(kind, userId);

  const parent = await Model.findOne({ _id: parentId, owner: userId }).select('title milestones').lean();
  if (!parent) throw notFound(label);
  const current = parent.milestones.find(item => item._id.equals(milestoneId));
  if (!current) throw milestoneNotFound();

  const set = {};
  if (changes.title !== undefined) set['milestones.$.title'] = changes.title;
  if (changes.dueDate !== undefined) set['milestones.$.dueDate'] = changes.dueDate;

  const toggling = changes.done !== undefined && changes.done !== current.done;
  if (toggling) {
    set['milestones.$.done'] = changes.done;
    set['milestones.$.completedAt'] = changes.done ? new Date() : null;
  }

  if (Object.keys(set).length === 0) return Model.findOne({ _id: parentId, owner: userId });

  // When toggling, also match the old state: of two concurrent completions only one applies
  // and records an activity event.
  const match = toggling ? { _id: milestoneId, done: current.done } : { _id: milestoneId };
  const doc = await Model.findOneAndUpdate(
    { _id: parentId, owner: userId, milestones: { $elemMatch: match } },
    { $set: set },
    { returnDocument: 'after', runValidators: true }
  );

  if (!doc) {
    const latest = await Model.findOne({ _id: parentId, owner: userId });
    if (!latest) throw notFound(label);
    if (!latest.milestones.id(milestoneId)) throw milestoneNotFound();
    return latest;
  }

  if (toggling && changes.done) {
    await recordActivity(userId, {
      type: 'milestone_completed',
      subjectType: kind,
      subjectId: doc._id,
      title: changes.title ?? current.title,
      detail: `${label}: ${doc.title}`,
    });
  }

  return doc;
}

export async function deleteMilestoneLogic(kind, userId, parentId, milestoneId) {
  const { Model, label } = parentFor(kind, userId);

  const doc = await Model.findOneAndUpdate(
    { _id: parentId, owner: userId, 'milestones._id': milestoneId },
    { $pull: { milestones: { _id: milestoneId } } },
    { returnDocument: 'after' }
  );
  if (doc) return doc;

  if (!(await Model.exists({ _id: parentId, owner: userId }))) throw notFound(label);
  throw milestoneNotFound();
}
