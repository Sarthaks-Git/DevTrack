import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { AI_PLAN_IDS } from '../config/config.js';

const USERNAME = /^[a-z][a-z0-9_]{2,29}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isActivePro = (plan, now) => plan?.tier === 'pro' && (!plan.until || plan.until > now);
export const hasNoEnd = (plan, now) => isActivePro(plan, now) && !plan.until;


/**
 * Sets a user's plan. Server-side only: there is no HTTP route for this. The owner runs it through
 * `npm run plan:set` now; paid passes go through addProDays / removeProDays below.
 */
export async function setUserPlanLogic({ username, tier, until = null, source = 'admin', now = new Date() }) {
  const name = String(username || '').toLowerCase();
  if (!USERNAME.test(name)) throw new AppError('Invalid username', 400, 'VALIDATION_ERROR');
  if (!AI_PLAN_IDS.includes(tier)) throw new AppError(`Plan must be one of ${AI_PLAN_IDS.join(', ')}`, 400, 'VALIDATION_ERROR');
  if (!['admin', 'payment'].includes(source)) throw new AppError('Invalid plan source', 400, 'VALIDATION_ERROR');
  if (until !== null && (!(until instanceof Date) || Number.isNaN(until.getTime()) || until <= now)) {
    throw new AppError('The end date must be in the future', 400, 'VALIDATION_ERROR');
  }

  const plan = tier === 'pro' ? { tier, source, since: now, until } : { tier: 'free', source: null, since: null, until: null };
  const user = await User.findOneAndUpdate({ username: name }, { $set: { plan } }, { returnDocument: 'after', projection: { username: 1, plan: 1 } }).lean();
  if (!user) throw new AppError('User not found', 404);
  return { username: user.username, plan: user.plan };
}

// Paid passes (services/billing.service.js). Returns the days actually added.
// Adds days to the user's Pro end date. Optimistic: retried if the plan changed underneath.
export async function addProDays(owner, days, now) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const user = await User.findById(owner).select('plan').lean();
    if (!user) return 0;
    const plan = user.plan || {};
    if (hasNoEnd(plan, now)) return 0;
    const active = isActivePro(plan, now);
    const until = new Date((active ? plan.until.getTime() : now.getTime()) + days * DAY_MS);
    const result = await User.updateOne(
      // null also matches an older account that has no plan stored yet.
      { _id: owner, 'plan.tier': plan.tier ?? null, 'plan.until': plan.until ?? null },
      { $set: { plan: { tier: 'pro', source: 'payment', since: active ? plan.since : now, until } } }
    );
    if (result.matchedCount) return days;
  }
  throw new Error('Plan kept changing while applying a payment');
}

// Takes a refunded pass's days back off the end date; Free once nothing is left.
export async function removeProDays(owner, days, now) {
  if (!days) return;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const user = await User.findById(owner).select('plan').lean();
    const plan = user?.plan;
    if (!plan || plan.tier !== 'pro' || !plan.until) return;
    const until = new Date(plan.until.getTime() - days * DAY_MS);
    const next = until > now ? { ...plan, until } : { tier: 'free', source: null, since: null, until: null };
    const result = await User.updateOne({ _id: owner, 'plan.tier': 'pro', 'plan.until': plan.until }, { $set: { plan: next } });
    if (result.matchedCount) return;
  }
  throw new Error('Plan kept changing while applying a refund');
}
