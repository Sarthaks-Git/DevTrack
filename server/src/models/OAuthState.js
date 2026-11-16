import mongoose from 'mongoose';

// Pending OAuth handshake. Only a hash of the state is stored and the PKCE verifier is encrypted.
// Single use (deleted on callback) and removed by a TTL index once expired.
const oauthStateSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['github'], required: true },
    stateHash: { type: String, required: true, unique: true },
    codeVerifier: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' }
);

oauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OAuthState = mongoose.models.OAuthState || mongoose.model('OAuthState', oauthStateSchema);
export default OAuthState;
