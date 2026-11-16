import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

vi.mock('../src/services/githubApi.service.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, getCommitPatches: vi.fn(), revokeGrant: vi.fn() };
});

vi.mock('../src/services/ai/anthropic.transport.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, createMessage: vi.fn() };
});

import app from '../src/app.js';
import { createMessage } from '../src/services/ai/anthropic.transport.js';
import * as gh from '../src/services/githubApi.service.js';
import { GitHubApiError } from '../src/services/githubApi.service.js';
import {
  CODE_REVIEW_RULES,
  parseCodeFindings,
  prepareCommit,
  prepareFile,
  reviewCodeLogic,
  settleCodeReviews,
} from '../src/services/codeReview.service.js';
import { settleSecurityScans } from '../src/services/securityReview.service.js';
import { REDACTED, scrubSecrets } from '../src/utils/secretScrub.js';
import { encryptSecret } from '../src/utils/tokenCrypto.js';
import CodeFinding from '../src/models/CodeFinding.js';
import GitHubCommit from '../src/models/GitHubCommit.js';
import GitHubConnection from '../src/models/GitHubConnection.js';
import Notification from '../src/models/Notification.js';
import Project from '../src/models/Project.js';
import { createSession } from './helpers.js';

const hex = bytes => randomBytes(bytes).toString('hex');
const sha = () => hex(20);
// Secret-shaped values are assembled per run, so no secret-looking literal lives in the repository.
const fakeSecrets = () => ({
  anthropic: `sk-ant-api03-${hex(20)}`,
  github: `ghp_${hex(18)}`,
  stripe: `sk_live_${hex(12)}`,
  aws: `AKIA${hex(8).toUpperCase()}`,
  jwt: `eyJ${hex(6)}.eyJ${hex(8)}.${hex(10)}`,
  mongoPassword: `p${hex(8)}`,
  assigned: `v${hex(10)}`,
  random: `${hex(12)}AbCdEf${hex(6)}`,
});

// Split so the repository's own secret scanner does not flag these test fixtures.
const MONGO_SCHEME = ['mongodb+srv', '//'].join(':');
const KEY_HEADER = ['-----BEGIN RSA', 'PRIVATE KEY-----'].join(' ');

let nextGitHubId = 9000;
let repoId = 70000;

async function setup({ consent = true, codeReview = true } = {}) {
  const s = await createSession('codereview');
  const created = await s.post('/api/projects').send({ title: 'Reviewed app', description: 'x', status: 'in_progress' });
  const projectId = created.body.project?._id || created.body.data?.project?._id;
  if (consent) await s.put('/api/ai/consent').send({ enabled: true });
  await settleSecurityScans();
  await settleCodeReviews();
  nextGitHubId += 1;
  await GitHubConnection.create({
    owner: s.userId,
    githubId: nextGitHubId,
    login: `octo${nextGitHubId}`,
    accessToken: encryptSecret(`fake-${hex(12)}`, `github:access:${s.userId}`),
  });
  repoId += 1;
  const fullName = `me/app${repoId}`;
  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        repository: {
          githubId: repoId,
          fullName,
          url: `https://github.com/${fullName}`,
          linkedAt: new Date(),
          codeReview: { enabled: codeReview, changedAt: codeReview ? new Date() : null },
        },
      },
    }
  );
  return { s, projectId, fullName, repoId };
}

async function seedCommit(ctx, { message = 'Add login route', files = ['src/routes/auth.js'], committedAt = new Date() } = {}) {
  const commitSha = sha();
  return GitHubCommit.create({
    owner: ctx.s.userId,
    project: ctx.projectId,
    repoId: ctx.repoId,
    repoFullName: ctx.fullName,
    sha: commitSha,
    message,
    url: `https://github.com/${ctx.fullName}/commit/${commitSha}`,
    committedAt,
    files,
    // The message-based scan is not under test here.
    securityScan: { status: 'reviewed', claim: null, at: new Date() },
  });
}

const patch = lines => `@@ -1,2 +10,${lines.length} @@\n${lines.join('\n')}`;

function aiFindings(findings, usage = { input_tokens: 2000, output_tokens: 300 }) {
  return { stop_reason: 'end_turn', usage, content: [{ type: 'text', text: JSON.stringify({ findings }) }] };
}

const sqlFinding = (extra = {}) => ({
  file: 'src/routes/auth.js',
  line: 11,
  severity: 'high',
  title: 'SQL built from request input',
  detail: 'The query concatenates req.body.email, so an attacker can inject SQL.',
  fix: 'Use a parameterised query.',
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  gh.revokeGrant.mockResolvedValue(null);
});

describe('secret scrubbing', () => {
  it('redacts known token formats, credentials in URLs, assigned secrets and random strings', () => {
    const secrets = fakeSecrets();
    const lines = [
      `const key = "${secrets.anthropic}";`,
      `headers.Authorization = 'token ${secrets.github}'`,
      `stripe(${JSON.stringify(secrets.stripe)})`,
      `aws_id: ${secrets.aws}`,
      `const t = '${secrets.jwt}'`,
      `MONGO_URI=${MONGO_SCHEME}admin:${secrets.mongoPassword}@cluster0.example.net/db`,
      `client_secret = '${secrets.assigned}'`,
      `const blob = "${secrets.random}"`,
    ];
    for (const [index, line] of lines.entries()) {
      const { text, count } = scrubSecrets(line);
      expect(count, line).toBeGreaterThan(0);
      expect(text).toContain(REDACTED);
      for (const value of Object.values(secrets)) expect(text, `line ${index}`).not.toContain(value);
    }
  });

  it('keeps ordinary code readable', () => {
    const code = [
      "import ProjectSecurityChecks from '../components/projects/ProjectSecurityChecks';",
      'const MAX_LINKED_PROJECTS_PER_USER = 20;',
      'const password = req.body.password;',
      "if (user.role !== 'admin') throw new AppError('Forbidden', 403);",
    ];
    for (const line of code) expect(scrubSecrets(line)).toEqual({ text: line, count: 0 });
  });
});

describe('preparing a diff', () => {
  it('numbers new-file lines and keeps removed lines unnumbered', () => {
    const file = prepareFile('src/a.js', patch([' const a = 1;', '-const b = 2;', '+const b = 3;']));
    expect(file.diff).toBe('...\n10   const a = 1;\n  - const b = 2;\n11 + const b = 3;');
    expect([...file.lines]).toEqual([10, 11]);
  });

  it('never sends env files, lockfiles, keys, build output, docs or binary files', () => {
    const body = patch(['+x = 1']);
    for (const path of ['.env', 'server/.env.production', '.npmrc', 'package-lock.json', 'certs/server.pem', 'deploy/id_rsa', 'dist/app.js', 'node_modules/x/index.js', 'public/app.min.js', 'README.md', 'docs/setup.txt']) {
      expect(prepareFile(path, body), path).toBeNull();
    }
    expect(prepareFile('logo.png', null)).toBeNull();
    expect(prepareFile('src/keys.js', patch([`+const k = \`${KEY_HEADER}`]))).toBeNull();
  });

  it('skips a file with many secrets and caps lines per file and per commit', () => {
    const secrets = fakeSecrets();
    const leaky = patch([`+a = "${secrets.anthropic}"`, `+b = "${secrets.github}"`, `+c = "${secrets.stripe}"`, `+d = "${secrets.jwt}"`]);
    expect(prepareFile('src/config.js', leaky)).toBeNull();

    const long = patch(Array.from({ length: 400 }, (_, i) => `+line${i}`));
    const capped = prepareFile('src/big.js', long);
    expect(capped.size).toBe(CODE_REVIEW_RULES.linesPerFile);
    expect(capped.diff).toMatch(/rest of this file not shown\)$/);

    const many = Array.from({ length: 12 }, (_, i) => ({ path: `src/f${i}.js`, patch: long }));
    const prepared = prepareCommit(many);
    expect(prepared.reduce((sum, file) => sum + file.size, 0)).toBeLessThanOrEqual(CODE_REVIEW_RULES.linesPerCommit);
  });

  it('accepts only findings for files and lines that were sent', () => {
    const prepared = prepareCommit([{ path: 'src/routes/auth.js', patch: patch([' a', '+b']) }]);
    const findings = parseCodeFindings(
      {
        findings: [
          sqlFinding(),
          sqlFinding(), // duplicate
          sqlFinding({ file: 'src/other.js' }), // not sent
          sqlFinding({ line: 999, title: 'Line not sent' }), // kept, line dropped
          sqlFinding({ severity: 'critical', title: 'Bad severity' }),
          sqlFinding({ severity: 'low', title: 'Only hardening' }),
          sqlFinding({ title: '', detail: 'x' }),
          sqlFinding({ title: 'Has\u0000control‮chars', line: 10 }),
        ],
      },
      prepared
    );
    expect(findings.map(f => [f.title, f.line])).toEqual([
      ['SQL built from request input', 11],
      ['Line not sent', null],
      ['Has control chars', 10],
    ]);
  });
});

describe('code review toggle', () => {
  it('requires auth, a linked repository, AI consent and valid input; never crosses users', async () => {
    const ctx = await setup({ codeReview: false });
    const url = `/api/projects/${ctx.projectId}/repository/code-review`;
    expect((await request(app).put(url).send({ enabled: true })).status).toBe(401);
    expect((await ctx.s.put(url).send({ enabled: 'yes' })).status).toBe(400);
    expect((await ctx.s.put(url).send({ enabled: true, extra: 1 })).status).toBe(400);

    const other = await createSession('codereview_other');
    expect((await other.put(url).send({ enabled: true })).status).toBe(404);

    const plain = await ctx.s.post('/api/projects').send({ title: 'No repo', description: 'x', status: 'planning' });
    const plainId = plain.body.project?._id || plain.body.data?.project?._id;
    expect((await ctx.s.put(`/api/projects/${plainId}/repository/code-review`).send({ enabled: true })).status).toBe(404);

    await ctx.s.put('/api/ai/consent').send({ enabled: false });
    expect((await ctx.s.put(url).send({ enabled: true })).status).toBe(409);
    await ctx.s.put('/api/ai/consent').send({ enabled: true });
    await settleCodeReviews();

    const on = await ctx.s.put(url).send({ enabled: true });
    expect(on.status).toBe(200);
    expect(on.body.data.codeReview).toEqual({ enabled: true });
    await settleCodeReviews();
    const commits = await ctx.s.get(`/api/projects/${ctx.projectId}/commits`);
    expect(commits.body.data.repository.codeReview).toEqual({ enabled: true });

    // Turning it off needs no consent.
    await ctx.s.put('/api/ai/consent').send({ enabled: false });
    expect((await ctx.s.put(url).send({ enabled: false })).status).toBe(200);
  });
});

describe('reviewing code', () => {
  it('sends scrubbed changed lines, stores only findings and never the code', async () => {
    const ctx = await setup();
    const commit = await seedCommit(ctx, { files: ['src/routes/auth.js', '.env', 'package-lock.json'] });
    const secrets = fakeSecrets();
    const marker = `uniqueMarker${hex(6)}`;
    gh.getCommitPatches.mockResolvedValueOnce([
      { path: 'src/routes/auth.js', patch: patch([` const ${marker} = 1;`, `+db.query("SELECT * FROM users WHERE email = '" + req.body.email + "'"); // key ${secrets.anthropic}`]) },
      { path: '.env', patch: patch([`+API_KEY=${secrets.github}`]) },
      { path: 'package-lock.json', patch: patch(['+"lockfileVersion": 3']) },
    ]);
    createMessage.mockResolvedValueOnce(aiFindings([sqlFinding()]));

    expect(await reviewCodeLogic(ctx.s.userId)).toEqual({ reviewed: 1 });
    expect(createMessage).toHaveBeenCalledTimes(1);
    const request_ = createMessage.mock.calls[0][0];
    const sent = request_.messages[0].content;
    expect(sent).toContain(marker);
    expect(sent).toContain(REDACTED);
    expect(sent).not.toContain(secrets.anthropic);
    expect(sent).not.toContain(secrets.github);
    expect(sent).not.toContain('.env');
    expect(sent).not.toContain('lockfileVersion');
    expect(request_.system).toMatch(/untrusted data/);
    // Only real, visible problems: no speculation about unseen code or already-validated input.
    expect(request_.system).toMatch(/exploitable or clearly missing/);
    expect(request_.system).toMatch(/hypothetical future callers/);
    expect(request_.system).toMatch(/already validate/);
    expect(JSON.stringify(request_.output_config.format.schema)).not.toContain('"low"');
    expect(request_.model).toBe('claude-haiku-5-5');

    const stored = await CodeFinding.find({ owner: ctx.s.userId }).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ file: 'src/routes/auth.js', line: 11, severity: 'high', status: 'open', sha: commit.sha });
    expect(stored[0].lineUrl).toBe(`https://github.com/${ctx.fullName}/blob/${commit.sha}/src/routes/auth.js#L11`);
    // The reviewed code is not stored anywhere.
    for (const doc of [...stored, await GitHubCommit.findById(commit._id).lean()]) {
      expect(JSON.stringify(doc)).not.toContain(marker);
      expect(JSON.stringify(doc)).not.toContain('SELECT');
    }
    expect((await GitHubCommit.findById(commit._id).lean()).codeScan.status).toBe('reviewed');
    expect(await Notification.countDocuments({ owner: ctx.s.userId, type: 'code_review' })).toBe(1);

    // Reviewed commits are not sent again.
    expect(await reviewCodeLogic(ctx.s.userId)).toEqual({ reviewed: 0 });
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it('only reviews repositories with code review on, recent commits, and code files', async () => {
    const off = await setup({ codeReview: false });
    await seedCommit(off);
    expect(await reviewCodeLogic(off.s.userId)).toEqual({ reviewed: 0 });

    const ctx = await setup();
    const old = await seedCommit(ctx, { committedAt: new Date(Date.now() - CODE_REVIEW_RULES.lookbackMs - 60_000) });
    const docs = await seedCommit(ctx, { message: 'Update docs', files: ['README.md'] });
    const merge = await seedCommit(ctx, { message: 'Merge branch main' });
    const noCode = await seedCommit(ctx);
    gh.getCommitPatches.mockResolvedValueOnce([{ path: 'assets/logo.png', patch: null }]);
    expect(await reviewCodeLogic(ctx.s.userId)).toEqual({ reviewed: 0 });
    expect(createMessage).not.toHaveBeenCalled();
    expect(gh.getCommitPatches).toHaveBeenCalledTimes(1);
    const status = async doc => (await GitHubCommit.findById(doc._id).lean()).codeScan?.status;
    expect(await status(old)).toBeUndefined();
    expect(await status(docs)).toBe('skipped');
    expect(await status(merge)).toBe('skipped');
    expect(await status(noCode)).toBe('skipped');
  });

  it('keeps commits queued when GitHub or the AI is unavailable, and says why', async () => {
    const ctx = await setup();
    const commit = await seedCommit(ctx);
    gh.getCommitPatches.mockRejectedValueOnce(new GitHubApiError('unavailable'));
    expect(await reviewCodeLogic(ctx.s.userId)).toMatchObject({ reviewed: 0, stopped: 'GITHUB_UNAVAILABLE' });
    expect((await GitHubCommit.findById(commit._id).lean()).codeScan).toBeNull();
    expect((await ctx.s.get('/api/ai')).body.data.lastIssue).toMatchObject({ code: 'GITHUB_UNAVAILABLE' });

    gh.getCommitPatches.mockResolvedValueOnce([{ path: 'src/routes/auth.js', patch: patch(['+x()']) }]);
    createMessage.mockRejectedValueOnce(Object.assign(new Error('x'), { kind: 'rate_limited' }));
    expect(await reviewCodeLogic(ctx.s.userId)).toMatchObject({ stopped: 'AI_UNAVAILABLE' });
    expect((await GitHubCommit.findById(commit._id).lean()).codeScan).toBeNull();

    // A commit deleted on GitHub (force push) is skipped, not retried forever.
    gh.getCommitPatches.mockRejectedValueOnce(new GitHubApiError('not_found'));
    expect(await reviewCodeLogic(ctx.s.userId)).toEqual({ reviewed: 0 });
    expect((await GitHubCommit.findById(commit._id).lean()).codeScan.status).toBe('skipped');
  });

  it('drops findings when code review was turned off while the AI was answering', async () => {
    const ctx = await setup();
    await seedCommit(ctx);
    gh.getCommitPatches.mockResolvedValueOnce([{ path: 'src/routes/auth.js', patch: patch([' a', '+b']) }]);
    createMessage.mockImplementationOnce(async () => {
      await Project.updateOne({ _id: ctx.projectId }, { $set: { 'repository.codeReview.enabled': false } });
      return aiFindings([sqlFinding()]);
    });
    await reviewCodeLogic(ctx.s.userId);
    expect(await CodeFinding.countDocuments({ owner: ctx.s.userId })).toBe(0);
  });
});

describe('code findings API', () => {
  it('lists findings and lets the owner mark them fixed, ignored or open', async () => {
    const ctx = await setup();
    await seedCommit(ctx);
    gh.getCommitPatches.mockResolvedValueOnce([{ path: 'src/routes/auth.js', patch: patch([' a', '+b']) }]);
    createMessage.mockResolvedValueOnce(aiFindings([sqlFinding(), sqlFinding({ title: 'Missing rate limit', severity: 'medium', line: 0 })]));
    await reviewCodeLogic(ctx.s.userId);

    expect((await request(app).get('/api/code-findings')).status).toBe(401);
    expect((await ctx.s.get('/api/code-findings?status=bogus')).status).toBe(400);
    expect((await ctx.s.get('/api/code-findings?other=1')).status).toBe(400);

    const list = await ctx.s.get(`/api/code-findings?project=${ctx.projectId}`);
    expect(list.status).toBe(200);
    const [first, second] = list.body.data.findings;
    expect(first).toMatchObject({ severity: 'high', status: 'open', source: 'ai', shortSha: expect.any(String) });
    expect(second).toMatchObject({ title: 'Missing rate limit', line: null });
    expect(second.lineUrl).not.toContain('#L');

    const other = await createSession('codereview_peek');
    expect((await other.get('/api/code-findings')).body.data.findings).toEqual([]);
    expect((await other.patch(`/api/code-findings/${first.id}`).send({ status: 'fixed' })).status).toBe(404);

    expect((await ctx.s.patch(`/api/code-findings/${first.id}`).send({ status: 'done' })).status).toBe(400);
    const fixed = await ctx.s.patch(`/api/code-findings/${first.id}`).send({ status: 'fixed' });
    expect(fixed.body.data.finding).toMatchObject({ status: 'fixed', resolvedAt: expect.any(String) });
    const reopened = await ctx.s.patch(`/api/code-findings/${first.id}`).send({ status: 'open' });
    expect(reopened.body.data.finding).toMatchObject({ status: 'open', resolvedAt: null });
    expect((await ctx.s.patch(`/api/code-findings/${second.id}`).send({ status: 'ignored' })).status).toBe(200);
  });

  it('removes findings when the repository is unlinked', async () => {
    const ctx = await setup();
    await seedCommit(ctx);
    gh.getCommitPatches.mockResolvedValueOnce([{ path: 'src/routes/auth.js', patch: patch([' a', '+b']) }]);
    createMessage.mockResolvedValueOnce(aiFindings([sqlFinding()]));
    await reviewCodeLogic(ctx.s.userId);
    expect(await CodeFinding.countDocuments({ owner: ctx.s.userId })).toBe(1);
    expect((await ctx.s.del(`/api/projects/${ctx.projectId}/repository`)).status).toBeLessThan(300);
    expect(await CodeFinding.countDocuments({ owner: ctx.s.userId })).toBe(0);
  });
});
