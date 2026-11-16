import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { AI_PLAN_IDS } from '../config/config.js';

const USERNAME = /^[a-z][a-z0-9_]{2,29}$/;

/**
 * Sets a user's plan. Server-side only: there is no HTTP route for this. The owner runs it through
 * `npm run plan:set` now; a verified payment webhook will call it later with source 'payment'.
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
