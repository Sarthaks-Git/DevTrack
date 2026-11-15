import mongoose from 'mongoose';

export const JOURNAL_ENTRY_TYPES = ['note', 'learning', 'debugging', 'decision', 'reflection'];
export const JOURNAL_LIMITS = { titleMax: 150, contentMax: 20000, tagsMax: 10, tagMax: 30 };

const journalEntrySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: JOURNAL_LIMITS.titleMax },
    content: { type: String, trim: true, maxlength: JOURNAL_LIMITS.contentMax, default: '' },
    type: { type: String, enum: JOURNAL_ENTRY_TYPES, default: 'note' },
    tags: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: JOURNAL_LIMITS.tagMax }],
      default: [],
      validate: { validator: tags => tags.length <= JOURNAL_LIMITS.tagsMax, message: 'Too many tags' },
    },
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    pinned: { type: Boolean, default: false },
    entryDate: { type: Date, default: () => new Date() },
  },
  { timestamps: true, strict: 'throw' }
);

// Matches the list sort exactly (including the _id tie-breaker) so pages come straight off the index.
journalEntrySchema.index({ owner: 1, pinned: -1, entryDate: -1, _id: -1 });
journalEntrySchema.index({ owner: 1, tags: 1 });
journalEntrySchema.index({ owner: 1, goal: 1 });
journalEntrySchema.index({ owner: 1, project: 1 });

const JournalEntry = mongoose.models.JournalEntry || mongoose.model('JournalEntry', journalEntrySchema);
export default JournalEntry;
