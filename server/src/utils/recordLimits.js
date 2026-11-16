import AppError from './AppError.js';

// Per-user storage caps so a single account cannot fill the database. Far above real use.
// Concurrent creates can overshoot by a few records; that is acceptable for an abuse cap.
export const RECORD_LIMITS = { goals: 500, projects: 200, journalEntries: 5000 };

const LABELS = { goals: 'goals', projects: 'projects', journalEntries: 'journal entries' };

export async function assertBelowRecordLimit(Model, owner, key) {
  const limit = RECORD_LIMITS[key];
  const count = await Model.countDocuments({ owner });
  if (count >= limit) {
    throw new AppError(`You can keep at most ${limit} ${LABELS[key]}. Delete some to add more.`, 409, 'RECORD_LIMIT');
  }
}
