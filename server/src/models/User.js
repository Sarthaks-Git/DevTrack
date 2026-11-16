import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 3, maxlength: 30, lowercase: true },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
  accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active', required: true },
  passwordChangedAt: { type: Date, default: null },
  // In-app reminder preferences. Defaults keep the dashboard's 14-day stall rule.
  reminders: {
    enabled: { type: Boolean, default: true },
    stalledAfterDays: { type: Number, default: 14, min: 3, max: 60 },
    deadlineAlerts: { type: Boolean, default: true },
    weeklyReview: { type: Boolean, default: true },
  },
  // AI features are off until the user turns them on (they send commit text to the AI provider).
  ai: {
    enabled: { type: Boolean, default: false },
    changedAt: { type: Date, default: null },
    // Why the last background AI run did not finish (a code word, never provider text). Cleared on success.
    lastIssue: {
      code: { type: String, default: null, maxlength: 40 },
      reason: { type: String, default: null, maxlength: 40 },
      at: { type: Date, default: null },
    },
  },
  // Subscription plan. Only the server sets it: an owner script now, the payment webhook later.
  // Pro with a past `until` counts as Free.
  plan: {
    tier: { type: String, enum: ['free', 'pro'], default: 'free' },
    source: { type: String, enum: ['admin', 'payment', null], default: null },
    since: { type: Date, default: null },
    until: { type: Date, default: null },
  },
  // Last time reminders were generated; used to throttle regeneration per user.
  remindersCheckedAt: { type: Date, default: null },
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
