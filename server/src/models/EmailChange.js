import mongoose from 'mongoose';

// A pending email change for a verified account. The account keeps `fromEmail` until the code sent
// to `email` (the new address) is entered. One per user; removed on confirm, cancel, or by TTL.
const emailChangeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    fromEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    codeHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, required: true },
    windowStartedAt: { type: Date, required: true },
    sendsInWindow: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: 'throw' }
);

emailChangeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const EmailChange = mongoose.models.EmailChange || mongoose.model('EmailChange', emailChangeSchema);
export default EmailChange;
