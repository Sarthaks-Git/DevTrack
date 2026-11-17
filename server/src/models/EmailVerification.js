import mongoose from 'mongoose';

// A pending email confirmation: a 6-digit code sent to the address, stored only as a hash.
// One per user; replaced on resend; removed by TTL after it expires.
const emailVerificationSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    codeHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    attempts: { type: Number, default: 0 },
    // Resend throttling: when the last code went out and how many went out this hour.
    sentAt: { type: Date, required: true },
    windowStartedAt: { type: Date, required: true },
    sendsInWindow: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: 'throw' }
);

// Kept for a day so resend limits survive an expired code; the code itself stops working at expiresAt.
emailVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const EmailVerification = mongoose.models.EmailVerification || mongoose.model('EmailVerification', emailVerificationSchema);
export default EmailVerification;
