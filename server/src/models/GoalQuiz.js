import mongoose from 'mongoose';

// Days until the next review after each passed attempt (spaced repetition). After the last one
// the quiz counts as mastered and needs no more reviews.
export const REVIEW_INTERVALS_DAYS = [3, 7, 30];
export const PASS_RATIO = 0.8;
export const MAX_ATTEMPTS_KEPT = 10;

const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, maxlength: 300 },
    options: {
      type: [{ type: String, maxlength: 160 }],
      validate: { validator: list => list.length === 4, message: 'A question has exactly 4 options' },
    },
    // Index of the correct option. Never sent to the browser before an attempt.
    answer: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, default: '', maxlength: 300 },
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

// AI-written self-check for a goal. A self-test, never verified progress. One per goal: asking for
// new questions replaces them and starts the review schedule again.
const goalQuizSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true },
    questions: {
      type: [questionSchema],
      validate: { validator: list => list.length >= 3 && list.length <= 8, message: 'A quiz has 3 to 8 questions' },
    },
    attempts: {
      type: [attemptSchema],
      default: [],
      validate: { validator: list => list.length <= MAX_ATTEMPTS_KEPT, message: 'Too many attempts kept' },
    },
    // Passes so far: after pass n the next review is REVIEW_INTERVALS_DAYS[n - 1] days out; one more
    // pass than there are intervals means mastered.
    stage: { type: Number, default: 0, min: 0, max: REVIEW_INTERVALS_DAYS.length + 1 },
    nextReviewAt: { type: Date, default: null },
    model: { type: String, default: '', maxlength: 60 },
  },
  { timestamps: true, strict: 'throw' }
);

goalQuizSchema.index({ owner: 1, goal: 1 }, { unique: true });
goalQuizSchema.index({ owner: 1, nextReviewAt: 1 });

const GoalQuiz = mongoose.models.GoalQuiz || mongoose.model('GoalQuiz', goalQuizSchema);
export default GoalQuiz;
