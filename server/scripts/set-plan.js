// Owner-only: set a user's plan from the server shell. There is deliberately no web route for this.
// Usage: npm run plan:set -- <username> pro [YYYY-MM-DD]   Pro, optionally until that date (UTC)
//        npm run plan:set -- <username> free               back to Free
import mongoose from 'mongoose';
import config from '../src/config/config.js';
import { connectDB } from '../src/config/db.js';
import { setUserPlanLogic } from '../src/services/plan.service.js';

const [username, tier, untilText] = process.argv.slice(2);

async function main() {
  if (!username || !tier) throw new Error('Usage: npm run plan:set -- <username> <free|pro> [YYYY-MM-DD]');
  if (untilText && !/^\d{4}-\d{2}-\d{2}$/.test(untilText)) throw new Error('The end date must look like 2026-12-31');
  const until = untilText ? new Date(`${untilText}T23:59:59.999Z`) : null;

  await connectDB(config.MONGO_URI);
  const result = await setUserPlanLogic({ username, tier, until });
  const ends = result.plan.until ? ` until ${result.plan.until.toISOString().slice(0, 10)}` : '';
  process.stdout.write(`Plan for ${result.username} is now ${result.plan.tier}${ends}.\n`);
}

main()
  .catch(error => {
    process.stderr.write(`Could not set the plan: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
