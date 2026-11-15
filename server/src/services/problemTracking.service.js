import mongoose from 'mongoose';
import CodingProfile from '../models/CodingProfile.js';
import CodingSubmission from '../models/CodingSubmission.js';
import SolvedProblem from '../models/SolvedProblem.js';
import LeetCodeQuestion from '../models/LeetCodeQuestion.js';
import AppError from '../utils/AppError.js';
import { derivePatternWithTopic } from '../utils/leetcodePatterns.js';
import { fetchRecentAcceptedSubmissions, fetchQuestionMeta } from './leetcodeSubmissions.service.js';
import { refreshLeetCodeStatsLogic } from './codingProfile.service.js';
import { recordActivity } from './activity.service.js';

// Decisions behind these numbers are recorded in docs/LEETCODE_TRACKING_LOG.md.
const PLATFORM = 'leetcode';
const SYNC_INTERVAL_MS = 10 * 60_000; // automatic syncs at most every 10 minutes
const FORCE_GUARD_MS = 15_000; // a manual refresh still cannot run twice within 15 s
const MAX_META_FETCHES = 10; // per sync; the rest are fetched on later syncs
const DAY_MS = 86_400_000;

function assertUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
}

// LeetCode's own calendar buckets by UTC day, so tracking does too.
const utcDay = date => new Date(date).toISOString().slice(0, 10);

// Question metadata: cache first, then LeetCode for the misses. One failed lookup never
// fails the sync; the problem keeps null details and is retried next time.
async function loadQuestionMeta(slugs) {
  const unique = [...new Set(slugs)];
  const cached = await LeetCodeQuestion.find({ _id: { $in: unique } }).lean();
  const bySlug = new Map(cached.map(question => [question._id, question]));

  for (const slug of unique.filter(item => !bySlug.has(item)).slice(0, MAX_META_FETCHES)) {
    try {
      const meta = await fetchQuestionMeta(slug);
      const { pattern, topic } = derivePatternWithTopic(meta.topics);
      const doc = { frontendId: meta.frontendId, title: meta.title, difficulty: meta.difficulty, topics: meta.topics, pattern, patternTopic: topic, fetchedAt: new Date() };
      await LeetCodeQuestion.updateOne({ _id: slug }, { $set: doc }, { upsert: true });
      bySlug.set(slug, { _id: slug, ...doc });
    } catch {
      // Leave it for a later sync.
    }
  }
  return bySlug;
}

const metaFields = meta => (meta
  ? { frontendId: meta.frontendId, difficulty: meta.difficulty, topics: meta.topics, pattern: meta.pattern, patternTopic: meta.patternTopic ?? null }
  : {});

function eventTitle(meta, title, firstTime) {
  const name = meta?.frontendId ? `${meta.frontendId}. ${meta.title}` : title;
  return `${firstTime ? 'Solved' : 'Solved again'}: ${name}`;
}

async function importAcceptedSubmissions(userId, profile, { firstSync }) {
  const fetched = await fetchRecentAcceptedSubmissions(profile.username);
  if (fetched.length === 0) return { newSubmissions: 0, newSolves: 0 };

  // Oldest first, so timeline events are written in the order the problems were solved.
  const submissions = [...fetched].sort((a, b) => a.submittedAt - b.submittedAt);
  const owner = new mongoose.Types.ObjectId(userId);

  // Insert-only upserts: rows already stored are untouched, so re-syncing is idempotent.
  const result = await CodingSubmission.bulkWrite(
    submissions.map(item => ({
      updateOne: {
        filter: { owner, platform: PLATFORM, submissionId: item.submissionId },
        update: { $setOnInsert: { owner, platform: PLATFORM, ...item, status: 'accepted', createdAt: new Date() } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
  const insertedIndexes = new Set(Object.keys(result.upsertedIds || {}).map(Number));
  const fresh = submissions.filter((_, index) => insertedIndexes.has(index));

  // Problems stored earlier without details get another chance at metadata.
  const missingDetails = await SolvedProblem.find({ owner, platform: PLATFORM, difficulty: null }).select('titleSlug').limit(MAX_META_FETCHES).lean();
  const meta = await loadQuestionMeta([...fresh.map(item => item.titleSlug), ...missingDetails.map(item => item.titleSlug)]);
  for (const { titleSlug } of missingDetails) {
    if (meta.has(titleSlug)) await SolvedProblem.updateOne({ owner, platform: PLATFORM, titleSlug }, { $set: metaFields(meta.get(titleSlug)) });
  }

  const bySlug = new Map();
  for (const item of fresh) bySlug.set(item.titleSlug, [...(bySlug.get(item.titleSlug) || []), item]);

  let newSolves = 0;
  for (const [titleSlug, group] of bySlug) {
    const previous = await SolvedProblem.findOne({ owner, platform: PLATFORM, titleSlug }).select('lastAcceptedAt').lean();
    const info = meta.get(titleSlug);

    const problem = await SolvedProblem.findOneAndUpdate(
      { owner, platform: PLATFORM, titleSlug },
      {
        $set: { title: info?.title || group[group.length - 1].title, ...metaFields(info) },
        $min: { firstAcceptedAt: group[0].submittedAt },
        $max: { lastAcceptedAt: group[group.length - 1].submittedAt },
        $inc: { acceptedCount: group.length },
        $addToSet: { languages: { $each: [...new Set(group.map(item => item.lang).filter(Boolean))] } },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();

    // The first sync only backfills: those solves happened before tracking, and announcing
    // twenty of them at once would flood the timeline.
    if (firstSync) continue;

    // One timeline event per problem per day, so five quick ACs of one problem stay one event.
    const seenDays = new Set(previous ? [utcDay(previous.lastAcceptedAt)] : []);
    for (const item of group) {
      const day = utcDay(item.submittedAt);
      if (seenDays.has(day)) continue;
      seenDays.add(day);
      await recordActivity(userId, {
        type: 'problem_solved',
        subjectType: 'problem',
        subjectId: problem._id,
        title: eventTitle(info, item.title, !previous && seenDays.size === 1),
        detail: [info?.difficulty, info?.pattern].filter(Boolean).join(' · '),
        source: 'verified',
        occurredAt: item.submittedAt,
      });
      newSolves += 1;
    }
  }

  return { newSubmissions: fresh.length, newSolves };
}

// Syncs counts, calendar and recent accepted submissions. Automatic calls are throttled per
// user; `force` (the Refresh button) skips the throttle but is still rate limited.
export async function syncLeetCodeLogic(userId, { force = false } = {}) {
  assertUserId(userId);
  const now = new Date();
  const claimBefore = new Date(now.getTime() - (force ? FORCE_GUARD_MS : SYNC_INTERVAL_MS));

  // Claiming the sync atomically means two tabs or a double click never import twice.
  const profile = await CodingProfile.findOneAndUpdate(
    {
      owner: userId,
      platform: PLATFORM,
      connectionStatus: 'verified',
      $or: [{ submissionsSyncedAt: null }, { submissionsSyncedAt: { $lt: claimBefore } }],
    },
    { $set: { submissionsSyncedAt: now } },
    { returnDocument: 'before' }
  ).lean();

  if (!profile) {
    const verified = await CodingProfile.exists({ owner: userId, platform: PLATFORM, connectionStatus: 'verified' });
    return { status: verified ? 'fresh' : 'not_connected', newSolves: 0 };
  }

  const firstSync = !profile.submissionsSyncedAt;
  const outcome = { status: 'synced', stats: 'ok', submissions: 'ok', newSubmissions: 0, newSolves: 0 };

  try {
    await refreshLeetCodeStatsLogic(userId);
  } catch {
    outcome.stats = 'failed';
  }

  try {
    Object.assign(outcome, await importAcceptedSubmissions(userId, profile, { firstSync }));
    if (firstSync) await CodingProfile.updateOne({ _id: profile._id }, { $set: { trackingSince: now } });
  } catch {
    outcome.submissions = 'failed';
    // Release the claim so the next visit retries instead of waiting out the interval.
    await CodingProfile.updateOne({ _id: profile._id, submissionsSyncedAt: now }, { $set: { submissionsSyncedAt: profile.submissionsSyncedAt } });
  }

  if (outcome.stats === 'failed' && outcome.submissions === 'failed') {
    throw new AppError('LeetCode is unavailable right now. Your saved data is unchanged.', 503, 'PROVIDER_UNAVAILABLE');
  }
  return outcome;
}

export async function listSolvedProblemsLogic(userId, { page, limit }) {
  assertUserId(userId);
  const owner = new mongoose.Types.ObjectId(userId);
  const filter = { owner, platform: PLATFORM };

  const [items, total, patterns, profile] = await Promise.all([
    SolvedProblem.find(filter).sort({ lastAcceptedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).select('-owner -__v').lean(),
    SolvedProblem.countDocuments(filter),
    SolvedProblem.aggregate([
      { $match: { ...filter, pattern: { $ne: null } } },
      { $group: { _id: '$pattern', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 5 },
    ]),
    CodingProfile.findOne({ owner, platform: PLATFORM }).select('trackingSince submissionsSyncedAt').lean(),
  ]);

  return {
    items,
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
    topPatterns: patterns.map(row => ({ pattern: row._id, count: row.count })),
    trackingSince: profile?.trackingSince ?? null,
    lastSyncedAt: profile?.submissionsSyncedAt ?? null,
  };
}

// Accepted problems per UTC day in [from, to], for the heatmap popup.
export async function listProblemDaysLogic(userId, { from, to }) {
  assertUserId(userId);
  const owner = new mongoose.Types.ObjectId(userId);
  const rows = await CodingSubmission.find({ owner, platform: PLATFORM, submittedAt: { $gte: from, $lt: new Date(to.getTime() + DAY_MS) } })
    .sort({ submittedAt: 1 })
    .limit(5000)
    .select('titleSlug title submittedAt')
    .lean();

  const days = {};
  for (const row of rows) {
    const key = utcDay(row.submittedAt);
    const list = (days[key] ||= []);
    const existing = list.find(item => item.titleSlug === row.titleSlug);
    if (existing) existing.count += 1;
    else list.push({ titleSlug: row.titleSlug, title: row.title, status: 'accepted', count: 1 });
  }

  const profile = await CodingProfile.findOne({ owner, platform: PLATFORM }).select('trackingSince').lean();
  return { days, trackingSince: profile?.trackingSince ?? null };
}
