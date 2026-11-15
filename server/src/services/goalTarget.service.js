import mongoose from 'mongoose';
import CodingProfile from '../models/CodingProfile.js';
import SolvedProblem from '../models/SolvedProblem.js';

const PLATFORM = 'leetcode';

// Adds `targetProgress` to goals that have a verified target. Progress is counted from synced,
// server-fetched solves only; the client can set the target but never the progress.
export async function withTargetProgress(userId, goals) {
  const list = goals.map(goal => (typeof goal.toObject === 'function' ? goal.toObject() : goal));
  const targeted = list.filter(goal => goal.target);
  if (targeted.length === 0) return list;

  const owner = new mongoose.Types.ObjectId(String(userId));
  const connected = Boolean(await CodingProfile.exists({ owner, platform: PLATFORM, connectionStatus: 'verified' }));

  const counts = connected
    ? await Promise.all(targeted.map(({ target }) => SolvedProblem.countDocuments({
      owner,
      platform: PLATFORM,
      firstAcceptedAt: { $gte: target.since },
      ...(target.pattern ? { pattern: target.pattern } : {}),
      ...(target.difficulty ? { difficulty: target.difficulty } : {}),
    })))
    : targeted.map(() => 0);

  targeted.forEach((goal, index) => {
    const current = Math.min(counts[index], goal.target.count);
    goal.targetProgress = { connected, current, count: goal.target.count, reached: connected && counts[index] >= goal.target.count, source: 'verified' };
  });
  return list;
}

export async function withTargetProgressOne(userId, goal) {
  const [result] = await withTargetProgress(userId, [goal]);
  return result;
}
