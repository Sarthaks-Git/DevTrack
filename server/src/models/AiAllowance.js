import mongoose from 'mongoose';

// Atomic monthly counters. scope "user": one row per user and month (actions used).
// scope "global": one row per month with no owner (spend across all users, for the budget cap).
const aiAllowanceSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ['user', 'global'], required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    actions: { type: Number, default: 0, min: 0 },
    costMicroUsd: { type: Number, default: 0 },
  },
  { timestamps: false, strict: 'throw' }
);

aiAllowanceSchema.index({ scope: 1, owner: 1, month: 1 }, { unique: true });

const AiAllowance = mongoose.models.AiAllowance || mongoose.model('AiAllowance', aiAllowanceSchema);
export default AiAllowance;
