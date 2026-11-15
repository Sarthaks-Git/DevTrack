// Compares the indexes each Mongoose model declares with what exists in the configured database.
// Usage: node scripts/check-indexes.js           report only
//        node scripts/check-indexes.js --apply   also build missing indexes (never drops anything)
import mongoose from 'mongoose';
import config from '../src/config/config.js';
import User from '../src/models/User.js';
import AuthSession from '../src/models/AuthSession.js';
import Goal from '../src/models/Goal.js';
import Project from '../src/models/Project.js';
import JournalEntry from '../src/models/JournalEntry.js';
import Activity from '../src/models/Activity.js';
import CodingProfile from '../src/models/CodingProfile.js';
import VerificationChallenge from '../src/models/VerificationChallenge.js';
import RateLimitHit from '../src/models/RateLimitHit.js';
import CodingSubmission from '../src/models/CodingSubmission.js';
import SolvedProblem from '../src/models/SolvedProblem.js';

const MODELS = [User, AuthSession, Goal, Project, JournalEntry, Activity, CodingProfile, VerificationChallenge, RateLimitHit, CodingSubmission, SolvedProblem];
const apply = process.argv.includes('--apply');
const keyOf = key => JSON.stringify(key);

async function existingKeys(Model) {
  try {
    return new Set((await Model.collection.indexes()).map(index => keyOf(index.key)));
  } catch (error) {
    if (error?.codeName === 'NamespaceNotFound') return new Set();
    throw error;
  }
}

async function main() {
  // autoIndex off: this script must observe the database, not silently fix it.
  await mongoose.connect(config.MONGO_URI, { autoIndex: false });
  process.stdout.write(`Database: ${mongoose.connection.db.databaseName}\n`);

  let missingTotal = 0;
  for (const Model of MODELS) {
    const existing = await existingKeys(Model);
    const missing = Model.schema.indexes().filter(([key]) => !existing.has(keyOf(key)));
    missingTotal += missing.length;
    const status = missing.length ? `MISSING ${missing.map(([key]) => keyOf(key)).join(', ')}` : 'ok';
    process.stdout.write(`${Model.collection.name.padEnd(24)} ${status}\n`);
    if (apply && missing.length) {
      await Model.createIndexes();
      process.stdout.write(`${''.padEnd(24)} built\n`);
    }
  }

  await mongoose.disconnect();
  if (missingTotal && !apply) process.exitCode = 1;
}

main().catch(async error => {
  process.stderr.write(`Index check failed: ${error?.message || error}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
