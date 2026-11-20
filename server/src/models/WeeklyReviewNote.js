import mongoose from 'mongoose';

// The AI-written note for one weekly review, kept so reopening the review costs nothing. Written
// from the rule-based review's numbers and titles; labelled as AI in the app.
const weeklyReviewNoteSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // First day of the reviewed week in the viewer's time zone (YYYY-MM-DD).
    weekStart: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    headline: { type: String, default: '', maxlength: 200 },
    wins: { type: [{ type: String, maxlength: 200 }], default: [] },
    watch: { type: [{ type: String, maxlength: 200 }], default: [] },
    nextSteps: { type: [{ type: String, maxlength: 200 }], default: [] },
    model: { type: String, default: '', maxlength: 60 },
  },
  { timestamps: true, strict: 'throw' }
);

weeklyReviewNoteSchema.index({ owner: 1, weekStart: 1 }, { unique: true });
// Old notes are not needed: a year of weekly notes is plenty.
weeklyReviewNoteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 });

const WeeklyReviewNote = mongoose.models.WeeklyReviewNote || mongoose.model('WeeklyReviewNote', weeklyReviewNoteSchema);
export default WeeklyReviewNote;
