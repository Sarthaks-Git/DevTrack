import mongoose from 'mongoose';

// A sign-in that passed the first factor (password or a provider) and now waits for the
// authenticator code. Only a hash of the token is stored; the token lives in an HttpOnly cookie.
// Single use, a few attempts, removed by a TTL index after it expires.
const loginChallengeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    method: { type: String, enum: ['password', 'google', 'github', 'linkedin'], required: true },
    returnTo: { type: String, enum: ['app', 'settings'], default: 'app' },
    userAgent: { type: String, default: null, maxlength: 400 },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' }
);

loginChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LoginChallenge = mongoose.models.LoginChallenge || mongoose.model('LoginChallenge', loginChallengeSchema);
export default LoginChallenge;
