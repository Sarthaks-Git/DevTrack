import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRecentAcceptedSubmissions, fetchQuestionMeta } from '../src/services/leetcodeSubmissions.service.js';
import { derivePattern } from '../src/utils/leetcodePatterns.js';

// Provider parsing with fetch stubbed: no network.
const respond = (body, status = 200) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));
const ts = seconds => String(seconds);
const NOW = Math.floor(Date.now() / 1000);

afterEach(() => vi.unstubAllGlobals());

describe('fetchRecentAcceptedSubmissions', () => {
  it('parses accepted submissions and joins the language', async () => {
    respond({ data: {
      recentAcSubmissionList: [{ id: '123', title: 'Two Sum', titleSlug: 'two-sum', timestamp: ts(NOW - 60) }],
      recentSubmissionList: [{ titleSlug: 'two-sum', timestamp: ts(NOW - 60), statusDisplay: 'Accepted', lang: 'java' }],
    } });
    const [row] = await fetchRecentAcceptedSubmissions('someone');
    expect(row).toMatchObject({ submissionId: '123', titleSlug: 'two-sum', title: 'Two Sum', lang: 'java' });
    expect(row.submittedAt.getTime()).toBe((NOW - 60) * 1000);
  });

  it('treats an empty list as valid and a missing list as a provider error', async () => {
    respond({ data: { recentAcSubmissionList: [], recentSubmissionList: [] } });
    expect(await fetchRecentAcceptedSubmissions('someone')).toEqual([]);
    respond({ data: { recentAcSubmissionList: null, recentSubmissionList: null } });
    await expect(fetchRecentAcceptedSubmissions('ghost')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('rejects the whole response if any row is malformed', async () => {
    for (const bad of [
      { id: 'abc', title: 'X', titleSlug: 'x', timestamp: ts(NOW) },
      { id: '1', title: '', titleSlug: 'x', timestamp: ts(NOW) },
      { id: '1', title: 'X', titleSlug: 'Bad Slug!', timestamp: ts(NOW) },
      { id: '1', title: 'X', titleSlug: 'x', timestamp: ts(NOW + 86_400) },
      { id: '1', title: 'X', titleSlug: 'x', timestamp: 'soon' },
    ]) {
      respond({ data: { recentAcSubmissionList: [{ id: '2', title: 'Ok', titleSlug: 'ok', timestamp: ts(NOW) }, bad], recentSubmissionList: [] } });
      await expect(fetchRecentAcceptedSubmissions('someone')).rejects.toMatchObject({ statusCode: 502 });
    }
  });

  it('maps HTTP failures, rate limits, GraphQL errors and network errors', async () => {
    respond({}, 500);
    await expect(fetchRecentAcceptedSubmissions('a')).rejects.toMatchObject({ statusCode: 502 });
    respond({}, 429);
    await expect(fetchRecentAcceptedSubmissions('a')).rejects.toMatchObject({ statusCode: 503 });
    respond({ errors: [{ message: 'nope' }] });
    await expect(fetchRecentAcceptedSubmissions('a')).rejects.toMatchObject({ statusCode: 502 });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await expect(fetchRecentAcceptedSubmissions('a')).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('fetchQuestionMeta', () => {
  it('parses details and drops malformed tags', async () => {
    respond({ data: { question: { questionFrontendId: '1', title: 'Two Sum', difficulty: 'Easy', topicTags: [{ name: 'Array', slug: 'array' }, { name: 'Bad', slug: 'BAD SLUG' }] } } });
    expect(await fetchQuestionMeta('two-sum')).toEqual({ titleSlug: 'two-sum', frontendId: '1', title: 'Two Sum', difficulty: 'Easy', topics: [{ name: 'Array', slug: 'array' }] });
  });

  it('rejects unknown difficulty, missing question and bad slugs', async () => {
    respond({ data: { question: { questionFrontendId: '1', title: 'X', difficulty: 'Impossible', topicTags: [] } } });
    await expect(fetchQuestionMeta('x')).rejects.toMatchObject({ statusCode: 502 });
    respond({ data: { question: null } });
    await expect(fetchQuestionMeta('x')).rejects.toMatchObject({ statusCode: 502 });
    await expect(fetchQuestionMeta('../etc')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('derivePattern', () => {
  const tags = (...slugs) => slugs.map(slug => ({ name: slug, slug }));
  it('prefers techniques over data structures over generic categories', () => {
    expect(derivePattern(tags('array', 'hash-table'))).toBe('HashMap');
    expect(derivePattern(tags('string', 'dynamic-programming', 'recursion'))).toBe('Dynamic Programming');
    expect(derivePattern(tags('linked-list', 'divide-and-conquer', 'heap-priority-queue', 'merge-sort'))).toBe('Heap');
    expect(derivePattern(tags('array', 'two-pointers', 'sorting'))).toBe('Two Pointers');
    expect(derivePattern(tags('array'))).toBe('Array');
  });
  it('falls back to the first tag, or null with no tags', () => {
    expect(derivePattern([{ name: 'Brainteaser', slug: 'brainteaser' }])).toBe('Brainteaser');
    expect(derivePattern([])).toBeNull();
  });
});
