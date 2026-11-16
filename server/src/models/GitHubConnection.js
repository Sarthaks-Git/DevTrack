import mongoose from 'mongoose';

// One GitHub account per DevTrack user, and one DevTrack user per GitHub account.
// Tokens are AES-256-GCM ciphertext (utils/tokenCrypto.js), excluded from queries by default,
// and never sent to the client.
const gitHubConnectionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    githubId: { type: Number, required: true, unique: true },
    login: { type: String, required: true, trim: true, maxlength: 39 },
    accessToken: { type: String, required: true, select: false },
    accessTokenExpiresAt: { type: Date, default: null },
    refreshToken: { type: String, default: null, select: false },
    refreshTokenExpiresAt: { type: Date, default: null },
    // reauth_required: GitHub rejected the token (revoked, refresh expired); the user must reconnect.
    status: { type: String, enum: ['connected', 'reauth_required'], default: 'connected' },
    connectedAt: { type: Date, default: () => new Date() },
    lastSyncAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' }
);

const GitHubConnection = mongoose.models.GitHubConnection || mongoose.model('GitHubConnection', gitHubConnectionSchema);
export default GitHubConnection;
