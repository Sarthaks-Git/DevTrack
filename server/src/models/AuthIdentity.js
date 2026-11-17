import mongoose from 'mongoose';

// A sign-in method from another provider (Google, GitHub, LinkedIn) linked to a DevTrack account.
// Only the provider's stable user id and the verified email are kept; provider tokens are never stored.
const authIdentitySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['google', 'github', 'linkedin'], required: true },
    providerUserId: { type: String, required: true, maxlength: 128 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    displayName: { type: String, default: '', maxlength: 100 },
    linkedAt: { type: Date, default: () => new Date() },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' }
);

// One DevTrack account per provider account, and one account of each provider per DevTrack user.
authIdentitySchema.index({ provider: 1, providerUserId: 1 }, { unique: true });
authIdentitySchema.index({ owner: 1, provider: 1 }, { unique: true });

const AuthIdentity = mongoose.models.AuthIdentity || mongoose.model('AuthIdentity', authIdentitySchema);
export default AuthIdentity;
