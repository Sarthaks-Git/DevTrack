import AppError from '../utils/AppError.js';

// Public LeetCode GraphQL (unofficial): treat as a fragile dependency. Validate everything,
// and throw instead of returning partial data so callers never persist half a response.
const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const TIMEOUT_MS = 10_000;
// LeetCode caps both recent-submission lists at 20 regardless of the requested limit.
export const RECENT_LIMIT = 20;

const RECENT_SUBMISSIONS_QUERY = `
  query recentSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) { id title titleSlug timestamp }
    recentSubmissionList(username: $username, limit: $limit) { titleSlug timestamp statusDisplay lang }
  }
`;

const QUESTION_QUERY = `
  query questionMeta($titleSlug: String!) {
    question(titleSlug: $titleSlug) { questionFrontendId title difficulty topicTags { name slug } }
  }
`;

const SLUG_PATTERN = /^[a-z0-9-]{1,150}$/;
const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);

// Shared with the practice-ladder catalogue (leetcodeCatalogue.service.js).
export async function postGraphQL(query, variables) {
  let response;
  try {
    response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'DevTrack/1.0' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw new AppError(timedOut ? 'LeetCode request timed out.' : 'Unable to reach LeetCode.', 503, 'PROVIDER_UNAVAILABLE');
  }
  if (response.status === 429) throw new AppError('LeetCode rate limit reached. Try again later.', 503, 'PROVIDER_RATE_LIMITED');
  if (!response.ok) throw new AppError('LeetCode request failed.', 502, 'PROVIDER_ERROR');

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AppError('LeetCode returned an invalid response.', 502, 'PROVIDER_ERROR');
  }
  if (payload?.errors?.length || !payload?.data) throw new AppError('LeetCode could not provide this data.', 502, 'PROVIDER_ERROR');
  return payload.data;
}

const cleanTitle = value => (typeof value === 'string' && value.trim() && value.length <= 200 ? value.trim() : null);

function toDate(timestamp) {
  const seconds = Number(timestamp);
  // Reject anything before LeetCode existed or in the future (allowing small clock skew).
  if (!Number.isInteger(seconds) || seconds < 1_262_304_000 || seconds * 1000 > Date.now() + 5 * 60_000) return null;
  return new Date(seconds * 1000);
}

// Recent accepted submissions, newest first, with the language joined in where LeetCode provides it.
export async function fetchRecentAcceptedSubmissions(username) {
  if (typeof username !== 'string' || !username.trim()) throw new AppError('A valid LeetCode username is required', 400);
  const data = await postGraphQL(RECENT_SUBMISSIONS_QUERY, { username: username.trim(), limit: RECENT_LIMIT });

  const accepted = data.recentAcSubmissionList;
  const recent = Array.isArray(data.recentSubmissionList) ? data.recentSubmissionList : [];
  // null means LeetCode could not resolve the user; an empty array is a valid "no submissions".
  if (!Array.isArray(accepted)) throw new AppError('LeetCode returned no submission list for this profile.', 502, 'PROVIDER_ERROR');

  const langByKey = new Map(
    recent
      .filter(row => row?.statusDisplay === 'Accepted' && typeof row.lang === 'string')
      .map(row => [`${row.titleSlug}:${row.timestamp}`, row.lang.slice(0, 30)])
  );

  return accepted.map(row => {
    const submissionId = typeof row?.id === 'string' || typeof row?.id === 'number' ? String(row.id) : '';
    const title = cleanTitle(row?.title);
    const submittedAt = toDate(row?.timestamp);
    if (!/^\d{1,20}$/.test(submissionId) || !title || !SLUG_PATTERN.test(row?.titleSlug ?? '') || !submittedAt) {
      throw new AppError('LeetCode returned a malformed submission.', 502, 'PROVIDER_ERROR');
    }
    return {
      submissionId,
      titleSlug: row.titleSlug,
      title,
      submittedAt,
      lang: langByKey.get(`${row.titleSlug}:${row.timestamp}`) ?? null,
    };
  });
}

// Question number, difficulty and topic tags for one problem.
export async function fetchQuestionMeta(titleSlug) {
  if (!SLUG_PATTERN.test(titleSlug ?? '')) throw new AppError('Invalid problem identifier', 400);
  const data = await postGraphQL(QUESTION_QUERY, { titleSlug });
  const question = data.question;
  const title = cleanTitle(question?.title);
  const frontendId = typeof question?.questionFrontendId === 'string' ? question.questionFrontendId.slice(0, 10) : null;
  if (!question || !title || !frontendId || !DIFFICULTIES.has(question.difficulty) || !Array.isArray(question.topicTags)) {
    throw new AppError('LeetCode returned incomplete problem details.', 502, 'PROVIDER_ERROR');
  }
  const topics = question.topicTags
    .filter(tag => typeof tag?.name === 'string' && SLUG_PATTERN.test(tag?.slug ?? ''))
    .slice(0, 20)
    .map(tag => ({ name: tag.name.slice(0, 60), slug: tag.slug }));
  return { titleSlug, frontendId, title, difficulty: question.difficulty, topics };
}
