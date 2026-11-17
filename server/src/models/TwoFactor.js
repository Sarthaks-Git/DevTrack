import mongoose from 'mongoose';

// Two-factor authentication (authenticator app) for one user. Kept apart from User so secrets are
// never loaded with the profile. Secrets are AES-256-GCM ciphertext bound to the owner; backup
// codes are stored only as hashes.
const recoveryCodeSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    usedAt: { type: Date, default: null },
  },
  { _id: false, strict: 'throw' }
);

const twoFactorSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Set while the user scans the QR code; becomes `secret` once they prove it with a code.
    pendingSecret: { type: String, default: null, select: false },
    pendingExpiresAt: { type: Date, default: null },
    secret: { type: String, default: null, select: false },
    enabledAt: { type: Date, default: null },
    // Highest 30-second step already accepted: a code is never accepted twice.
    lastUsedStep: { type: Number, default: null },
    recoveryCodes: { type: [recoveryCodeSchema], default: [], select: false },
    recoveryGeneratedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' }
);

const TwoFactor = mongoose.models.TwoFactor || mongoose.model('TwoFactor', twoFactorSchema);
export default TwoFactor;
