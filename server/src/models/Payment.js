import mongoose from 'mongoose';

export const PAYMENT_STATUSES = ['created', 'paid', 'refunded'];
export const PASS_IDS = ['month', 'year'];

// One row per Razorpay order for a Pro pass. Amounts are in paise and come from the server's price
// list, never from a request. Razorpay's dashboard stays the accounting record; this row decides
// what the user was granted, so a payment can be applied (and reversed) exactly once.
const paymentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pass: { type: String, enum: PASS_IDS, required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, maxlength: 3 },
    days: { type: Number, required: true, min: 1 },
    orderId: { type: String, required: true, maxlength: 40 },
    paymentId: { type: String, default: null, maxlength: 40 },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'created' },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    // Pro days this payment actually added (0 when the user already had Pro without an end date).
    grantedDays: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, strict: 'throw' }
);

paymentSchema.index({ orderId: 1 }, { unique: true });
paymentSchema.index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: 'string' } } });
paymentSchema.index({ owner: 1, createdAt: -1 });

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export default Payment;
