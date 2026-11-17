import mongoose from 'mongoose';

// A pending "forgot password": a 6-digit code sent to the account's email, stored only as a hash.
// One per user; replaced on resend; deleted when used; removed by TTL a day after creation.
const passwordResetSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // The address the code went to; the reset only applies while the account still has it.
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    codeHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, required: true },
    windowStartedAt: { type: Date, required: true },
    sendsInWindow: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: 'throw' }
);

passwordResetSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const PasswordReset = mongoose.models.PasswordReset || mongoose.model('PasswordReset', passwordResetSchema);
export default PasswordReset;
