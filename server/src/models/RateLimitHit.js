import mongoose from 'mongoose';

// One counter per rate-limit key, shared by every server instance. MongoDB's TTL monitor
// removes expired windows; the store also treats an expired window as reset.
const rateLimitHitSchema = new mongoose.Schema(
  {
    _id: { type: String },
    hits: { type: Number, default: 0 },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false, strict: 'throw' }
);

rateLimitHitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

const RateLimitHit = mongoose.models.RateLimitHit || mongoose.model('RateLimitHit', rateLimitHitSchema, 'ratelimits');
export default RateLimitHit;
