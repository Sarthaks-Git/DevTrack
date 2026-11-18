import mongoose from 'mongoose';

// The "this wasn't me" link sent to the old address after an email change. Only a hash of the
// token is stored. One per user: while a link is valid, later changes keep the first restore
// address, so a takeover that changes the email twice cannot point the undo at the attacker.
// Single use, removed on use or by TTL.
export const UNDO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const emailChangeUndoSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    restoreEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    tokenHash: { type: String, required: true, unique: true, match: /^[a-f0-9]{64}$/ },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' }
);

emailChangeUndoSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const EmailChangeUndo = mongoose.models.EmailChangeUndo || mongoose.model('EmailChangeUndo', emailChangeUndoSchema);
export default EmailChangeUndo;
