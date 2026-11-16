import mongoose from 'mongoose';

export const SECURITY_REVIEW_STATUSES = ['open', 'done', 'dismissed'];
export const SECURITY_ITEM_STATES = ['unchecked', 'handled', 'not_applicable'];

// An AI-suggested security checklist for one area of one project, triggered by the user's commits.
// AI text is stored as plain text and shown as text; it is advice, never verified progress.
const itemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, match: /^[a-f0-9]{8}$/ },
    text: { type: String, required: true, maxlength: 160 },
    why: { type: String, default: '', maxlength: 240 },
    state: { type: String, enum: SECURITY_ITEM_STATES, default: 'unchecked' },
    answeredAt: { type: Date, default: null },
  },
  { _id: false, strict: 'throw' }
);

const triggerSchema = new mongoose.Schema(
  {
    sha: { type: String, required: true, match: /^[0-9a-f]{40}$/ },
    message: { type: String, required: true, maxlength: 200 },
    url: { type: String, required: true, maxlength: 300 },
    committedAt: { type: Date, required: true },
  },
  { _id: false, strict: 'throw' }
);

const securityReviewSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    areaKey: { type: String, required: true, match: /^[a-z0-9]+(-[a-z0-9]+){0,5}$/, maxlength: 40 },
    area: { type: String, required: true, maxlength: 60 },
    status: { type: String, enum: SECURITY_REVIEW_STATUSES, default: 'open' },
    items: { type: [itemSchema], default: [] },
    triggers: { type: [triggerSchema], default: [] },
    model: { type: String, required: true, maxlength: 60 },
    openedAt: { type: Date, required: true },
    lastTriggeredAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' }
);

securityReviewSchema.index({ owner: 1, project: 1, areaKey: 1 }, { unique: true });
securityReviewSchema.index({ owner: 1, status: 1, lastTriggeredAt: -1 });

const SecurityReview = mongoose.models.SecurityReview || mongoose.model('SecurityReview', securityReviewSchema);
export default SecurityReview;
