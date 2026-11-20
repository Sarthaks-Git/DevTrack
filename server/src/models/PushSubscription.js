import mongoose from 'mongoose';

// A browser's Web Push subscription. The endpoint is a capability URL at the browser vendor's push
// service; with the keys it lets this server send that browser encrypted notifications. Never
// returned to clients after it is saved.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true, maxlength: 1000 },
    keys: {
      p256dh: { type: String, required: true, maxlength: 200 },
      auth: { type: String, required: true, maxlength: 100 },
    },
    // A short device label for Settings ("Chrome on Android"), derived server-side.
    label: { type: String, default: '', maxlength: 60 },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' }
);

// One row per browser: subscribing again from the same browser (even as another user) replaces it.
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });
pushSubscriptionSchema.index({ owner: 1, createdAt: -1 });

const PushSubscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', pushSubscriptionSchema);
export default PushSubscription;
