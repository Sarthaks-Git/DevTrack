import { describe, it, expect, afterEach, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  GitHubApiError,
  exchangeCode,
  getCommitFiles,
  listCommits,
  listInstallationRepos,
} from '../src/services/githubApi.service.js';

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const stub = (...responses) => {
  const fn = vi.fn();
  for (const response of responses) fn.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fn);
  return fn;
};
const kindOf = async promise => promise.then(() => 'ok', error => (error instanceof GitHubApiError ? error.kind : error.name));
const token = () => `fake-${randomBytes(8).toString('hex')}`;

afterEach(() => vi.unstubAllGlobals());

describe('GitHub API client', () => {
  it('treats an error body on the token endpoint as a rejection', async () => {
    stub(json({ error: 'bad_verification_code' }));
    expect(await kindOf(exchangeCode({ code: 'abc', codeVerifier: 'v' }))).toBe('rejected');
  });

  it('sends the PKCE verifier and never follows redirects', async () => {
    const accessToken = token();
    const fetchMock = stub(json({ access_token: accessToken, expires_in: 28800, refresh_token: token(), refresh_token_expires_in: 100 }));
    const result = await exchangeCode({ code: 'abc', codeVerifier: 'verifier-value' });
    expect(result).toMatchObject({ accessToken, expiresIn: 28800 });
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({ code: 'abc', code_verifier: 'verifier-value' });
    expect(options.redirect).toBe('error');
  });

  it('maps HTTP failures to error kinds without leaking the token', async () => {
    const secret = token();
    stub(json({}, 401));
    const error = await listInstallationRepos(secret).catch(e => e);
    expect(error.kind).toBe('unauthorized');
    expect(`${error.message} ${error.stack}`).not.toContain(secret);

    stub(json({}, 403, { 'x-ratelimit-remaining': '0' }));
    expect(await kindOf(listInstallationRepos(token()))).toBe('rate_limited');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    expect(await kindOf(listInstallationRepos(token()))).toBe('unavailable');
  });

  it('returns no commits for an empty repository and refuses odd repository names', async () => {
    stub(json({ message: 'Git Repository is empty.' }, 409));
    expect(await listCommits(token(), 'octo/empty', { author: 'octo', since: new Date() })).toEqual([]);

    const fetchMock = stub();
    expect(await kindOf(listCommits(token(), '../../user', { author: 'octo' }))).toBe('not_found');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps only file paths from a commit, never patches', async () => {
    stub(json({ files: [{ filename: 'src/a.js', patch: '+const secret = 1;' }, { filename: 'README.md' }] }));
    const files = await getCommitFiles(token(), 'octo/repo', 'a'.repeat(40));
    expect(files).toEqual(['src/a.js', 'README.md']);
  });

  it('collects repositories across installations and drops malformed rows', async () => {
    stub(
      json({ installations: [{ id: 1 }] }),
      json({ repositories: [{ id: 7, full_name: 'octo/b', private: true }, { id: 8, full_name: 'bad name' }, { id: 6, full_name: 'octo/a' }] })
    );
    const repos = await listInstallationRepos(token());
    expect(repos).toEqual([
      { id: 6, fullName: 'octo/a', private: false, url: 'https://github.com/octo/a' },
      { id: 7, fullName: 'octo/b', private: true, url: 'https://github.com/octo/b' },
    ]);
  });
});
