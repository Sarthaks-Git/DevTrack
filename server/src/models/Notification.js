import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = ['goal_overdue', 'project_overdue', 'due_soon', 'milestone_overdue', 'stalled', 'target_reached', 'weekly_review', 'security_review', 'code_review', 'new_sign_in'];
const RETENTION_DAYS = 60;

// In-app reminders. Written only by the server; the client can only read and mark them read.
const notificationSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    subjectType: { type: String, enum: ['goal', 'project', 'review', 'account'], required: true },
    // Weekly reviews (a week) and account alerts (the account itself) carry no subject id.
    subjectId: { type: mongoose.Schema.Types.ObjectId, default: null, required() { return this.subjectType === 'goal' || this.subjectType === 'project'; } },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 300 },
    // One reminder per situation: e.g. a stall is re-announced only after new activity and a new stall.
    dedupeKey: { type: String, required: true, maxlength: 200 },
    readAt: { type: Date, default: null },
    // Set once the reminder went out in a daily email, so it is never emailed twice.
    emailedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' }
);

notificationSchema.index({ owner: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ owner: 1, _id: -1 });
notificationSchema.index({ owner: 1, readAt: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
