import mongoose from 'mongoose';

// Shared cache of free LeetCode problems per topic tag and difficulty, easiest first (by acceptance
// rate). Not user data: fetched at most once a week for everyone, used to build practice ladders.
const questionSchema = new mongoose.Schema(
  {
    titleSlug: { type: String, required: true, maxlength: 150 },
    title: { type: String, required: true, maxlength: 200 },
    frontendId: { type: String, required: true, maxlength: 10 },
    acRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const leetCodeTagListSchema = new mongoose.Schema(
  {
    // "<tag slug>:<Easy|Medium|Hard>"
    _id: { type: String, maxlength: 200 },
    questions: { type: [questionSchema], default: [] },
    fetchedAt: { type: Date, required: true },
  },
  { versionKey: false, strict: 'throw' }
);

const LeetCodeTagList = mongoose.models.LeetCodeTagList || mongoose.model('LeetCodeTagList', leetCodeTagListSchema, 'leetcodetaglists');
export default LeetCodeTagList;
