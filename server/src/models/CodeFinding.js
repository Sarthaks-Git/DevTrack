import mongoose from 'mongoose';

export const CODE_FINDING_STATUSES = ['open', 'fixed', 'ignored'];
export const CODE_FINDING_SEVERITIES = ['high', 'medium', 'low'];

// One AI-suggested security issue in a commit's changed lines (opt-in code review).
// Only the AI's words and a file/line reference are kept; the reviewed code is never stored.
const codeFindingSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    sha: { type: String, required: true, match: /^[0-9a-f]{40}$/ },
    commitMessage: { type: String, required: true, maxlength: 200 },
    commitUrl: { type: String, required: true, maxlength: 300 },
    file: { type: String, required: true, maxlength: 300 },
    line: { type: Number, default: null, min: 1 },
    lineUrl: { type: String, required: true, maxlength: 700 },
    severity: { type: String, enum: CODE_FINDING_SEVERITIES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    detail: { type: String, required: true, maxlength: 400 },
    fix: { type: String, default: '', maxlength: 300 },
    status: { type: String, enum: CODE_FINDING_STATUSES, default: 'open' },
    model: { type: String, required: true, maxlength: 60 },
    committedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' }
);

codeFindingSchema.index({ owner: 1, project: 1, status: 1, committedAt: -1 });
codeFindingSchema.index({ owner: 1, status: 1, committedAt: -1 });

const CodeFinding = mongoose.models.CodeFinding || mongoose.model('CodeFinding', codeFindingSchema);
export default CodeFinding;
