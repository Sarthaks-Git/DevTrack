import mongoose from 'mongoose';

// One row per problem a user has solved (accepted) since tracking began. Powers the problem log.
const topicSchema = new mongoose.Schema({ name: String, slug: String }, { _id: false });

const solvedProblemSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['leetcode'], required: true },
    titleSlug: { type: String, required: true, maxlength: 150 },
    title: { type: String, required: true, maxlength: 200 },
    // Filled from the shared question cache; null until LeetCode returns the details.
    frontendId: { type: String, default: null, maxlength: 10 },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', null], default: null },
    topics: { type: [topicSchema], default: [] },
    pattern: { type: String, default: null, maxlength: 60 },
    patternTopic: { type: String, default: null, maxlength: 150 },
    patternSource: { type: String, enum: ['auto'], default: 'auto' },
    firstAcceptedAt: { type: Date, required: true },
    lastAcceptedAt: { type: Date, required: true },
    acceptedCount: { type: Number, default: 0, min: 0 },
    languages: { type: [String], default: [] },
  },
  { timestamps: true, strict: 'throw' }
);

solvedProblemSchema.index({ owner: 1, platform: 1, titleSlug: 1 }, { unique: true });
solvedProblemSchema.index({ owner: 1, platform: 1, lastAcceptedAt: -1, _id: -1 });

const SolvedProblem = mongoose.models.SolvedProblem || mongoose.model('SolvedProblem', solvedProblemSchema);
export default SolvedProblem;
