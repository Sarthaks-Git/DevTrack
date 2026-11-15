import mongoose from 'mongoose';

export const MAX_MILESTONES = 50;

// Embedded in Goal and Project: milestones are always read with their parent and capped in size.
const milestoneSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    done: { type: Boolean, default: false },
    dueDate: { type: Date, default: null },
    // Server-set when the milestone is checked off; cleared when it is reopened.
    completedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const milestonesField = {
  type: [milestoneSchema],
  default: [],
  validate: {
    validator: list => list.length <= MAX_MILESTONES,
    message: `At most ${MAX_MILESTONES} milestones are allowed`,
  },
};
