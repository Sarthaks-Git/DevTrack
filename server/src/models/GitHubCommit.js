import mongoose from 'mongoose';

// A commit the user authored on a repository linked to one of their projects.
// Only metadata is kept: the first line of the message and changed file paths. Never code or diffs.
const gitHubCommitSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    repoId: { type: Number, required: true },
    repoFullName: { type: String, required: true, maxlength: 140 },
    sha: { type: String, required: true, match: /^[0-9a-f]{40}$/ },
    message: { type: String, required: true, maxlength: 200 },
    url: { type: String, required: true, maxlength: 300 },
    committedAt: { type: Date, required: true },
    files: { type: [{ type: String, maxlength: 300 }], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' }
);

gitHubCommitSchema.index({ owner: 1, repoId: 1, sha: 1 }, { unique: true });
gitHubCommitSchema.index({ owner: 1, project: 1, committedAt: -1 });
gitHubCommitSchema.index({ owner: 1, committedAt: -1 });

const GitHubCommit = mongoose.models.GitHubCommit || mongoose.model('GitHubCommit', gitHubCommitSchema);
export default GitHubCommit;
