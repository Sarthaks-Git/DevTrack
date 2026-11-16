import mongoose from 'mongoose';

export const AI_USAGE_STATUSES = ['ok', 'refused', 'truncated', 'invalid', 'error'];
const RETENTION_DAYS = 400;

// One row per AI call that reached the provider. Never stores the text sent or received.
const aiUsageSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    feature: { type: String, required: true, maxlength: 40 },
    model: { type: String, required: true, maxlength: 60 },
    inputTokens: { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },
    // Millionths of a US dollar, so sums stay exact integers.
    costMicroUsd: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: AI_USAGE_STATUSES, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' }
);

aiUsageSchema.index({ owner: 1, createdAt: -1 });
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

const AiUsage = mongoose.models.AiUsage || mongoose.model('AiUsage', aiUsageSchema);
export default AiUsage;
