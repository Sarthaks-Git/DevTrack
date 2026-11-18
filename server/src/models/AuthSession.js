import mongoose from 'mongoose';

const authSessionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  familyId: { type: String, required: true },
  tokenHash: { type: String, required: true, select: false },
  usedTokenHashes: { type: [String], default: [], select: false },
  rotatedAt: { type: Date, default: null },
  // Coarse "Browser on OS" label only; raw user agents and IPs are not stored.
  userAgent: { type: String, maxlength: 60, default: null },
  // How this session signed in; createdAt is the sign-in time (refresh rotates in place).
  method: { type: String, enum: ['password', 'google', 'github', 'linkedin'], default: 'password' },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revokeReason: { type: String, enum: ['logout', 'logout_all', 'password_change', 'password_reset', 'email_change', 'email_change_undone', 'reuse_detected', 'expired', 'account_inactive', null], default: null },
}, { timestamps: true });

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({ owner: 1, revokedAt: 1 });
authSessionSchema.index({ familyId: 1, revokedAt: 1 });

const AuthSession = mongoose.models.AuthSession || mongoose.model('AuthSession', authSessionSchema);
export default AuthSession;
