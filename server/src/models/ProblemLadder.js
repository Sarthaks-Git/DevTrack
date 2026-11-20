import mongoose from 'mongoose';

export const LADDER_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const MAX_ACTIVE_LADDERS = 5;

const stepSchema = new mongoose.Schema(
  {
    titleSlug: { type: String, required: true, maxlength: 150 },
    title: { type: String, required: true, maxlength: 200 },
    frontendId: { type: String, required: true, maxlength: 10 },
    difficulty: { type: String, enum: LADDER_DIFFICULTIES, required: true },
    // Set from the user's synced, verified LeetCode solves, never from the client.
    solvedAt: { type: Date, default: null },
  },
  { _id: false }
);

// A short practice ladder of real LeetCode problems for one weak pattern, easiest first.
// Steps tick off from verified solves (SolvedProblem), so progress here is evidence, not a checkbox.
const problemLadderSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pattern: { type: String, required: true, maxlength: 60 },
    tag: { type: String, required: true, maxlength: 150 },
    // Why it was suggested: stuck_on_easy, fading, not_started or chosen.
    reason: { type: String, enum: ['stuck_on_easy', 'fading', 'not_started', 'chosen'], default: 'chosen' },
    steps: {
      type: [stepSchema],
      validate: { validator: list => list.length >= 1 && list.length <= 10, message: 'A ladder has 1 to 10 steps' },
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' }
);

problemLadderSchema.index({ owner: 1, pattern: 1 }, { unique: true });

const ProblemLadder = mongoose.models.ProblemLadder || mongoose.model('ProblemLadder', problemLadderSchema);
export default ProblemLadder;
