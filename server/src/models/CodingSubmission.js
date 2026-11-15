import mongoose from 'mongoose';

// One accepted submission, as reported by the provider. Insert-only; the unique index makes
// repeated syncs idempotent. Powers the heatmap day popup.
const codingSubmissionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['leetcode'], required: true },
    submissionId: { type: String, required: true, maxlength: 20 },
    titleSlug: { type: String, required: true, maxlength: 150 },
    title: { type: String, required: true, maxlength: 200 },
    status: { type: String, enum: ['accepted'], default: 'accepted' },
    lang: { type: String, default: null, maxlength: 30 },
    submittedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' }
);

codingSubmissionSchema.index({ owner: 1, platform: 1, submissionId: 1 }, { unique: true });
codingSubmissionSchema.index({ owner: 1, platform: 1, submittedAt: -1 });

const CodingSubmission = mongoose.models.CodingSubmission || mongoose.model('CodingSubmission', codingSubmissionSchema);
export default CodingSubmission;
