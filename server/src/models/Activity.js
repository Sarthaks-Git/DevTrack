import mongoose from 'mongoose';

// Append-only record of meaningful events; powers the Timeline and dashboard feed.
export const ACTIVITY_TYPES = [
  'goal_created', 'goal_completed', 'goal_reopened',
  'project_created', 'project_status_changed', 'project_completed',
  'journal_created',
  'milestone_completed',
  'problem_solved',
  'platform_verified', 'platform_disconnected', 'stats_synced',
  'github_connected', 'github_disconnected', 'commit_pushed',
];
export const ACTIVITY_SUBJECTS = ['goal', 'project', 'journal', 'coding_profile', 'problem', 'github'];
// Evidence principle: "verified" comes from a provider; "manual" is user-recorded.
export const ACTIVITY_SOURCES = ['manual', 'verified', 'system'];

const activitySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    subjectType: { type: String, enum: ACTIVITY_SUBJECTS, required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, default: null },
    title: { type: String, trim: true, maxlength: 200, required: true },
    detail: { type: String, trim: true, maxlength: 300, default: '' },
    source: { type: String, enum: ACTIVITY_SOURCES, default: 'manual' },
    occurredAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' }
);

activitySchema.index({ owner: 1, _id: -1 });
activitySchema.index({ owner: 1, occurredAt: -1 });
// Timeline type filter pages by _id, so the type index must end in _id too.
activitySchema.index({ owner: 1, type: 1, _id: -1 });

const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
export default Activity;
