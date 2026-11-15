import mongoose from 'mongoose';

// Shared cache of LeetCode problem metadata, keyed by titleSlug. Not user data: number,
// difficulty and tags rarely change, so each problem is fetched once for everyone.
const topicSchema = new mongoose.Schema({ name: String, slug: String }, { _id: false });

const leetCodeQuestionSchema = new mongoose.Schema(
  {
    _id: { type: String },
    frontendId: { type: String, required: true, maxlength: 10 },
    title: { type: String, required: true, maxlength: 200 },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    topics: { type: [topicSchema], default: [] },
    pattern: { type: String, default: null, maxlength: 60 },
    // Slug of the tag the pattern was derived from.
    patternTopic: { type: String, default: null, maxlength: 150 },
    fetchedAt: { type: Date, required: true },
  },
  { versionKey: false, strict: 'throw' }
);

const LeetCodeQuestion = mongoose.models.LeetCodeQuestion || mongoose.model('LeetCodeQuestion', leetCodeQuestionSchema, 'leetcodequestions');
export default LeetCodeQuestion;
