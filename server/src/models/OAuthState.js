import mongoose from 'mongoose';

// Pending OAuth handshake. Only a hash of the state is stored and the PKCE verifier is encrypted.
// Single use (deleted on callback) and removed by a TTL index once expired.
// purpose: connect = GitHub repository access; login = social sign-in (no owner yet);
// link = add a sign-in method to the signed-in account (owner set).
const oauthStateSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    provider: { type: String, enum: ['github', 'google', 'linkedin'], required: true },
    purpose: { type: String, enum: ['connect', 'login', 'link'], default: 'connect' },
    // Where a sign-in returns to: the app, or Settings after re-confirming identity.
    returnTo: { type: String, enum: ['app', 'settings'], default: 'app' },
    stateHash: { type: String, required: true, unique: true },
    codeVerifier: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' }
);

oauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OAuthState = mongoose.models.OAuthState || mongoose.model('OAuthState', oauthStateSchema);
export default OAuthState;
