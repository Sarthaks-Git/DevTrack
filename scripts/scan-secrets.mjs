// Fails (exit 1) if any git-tracked file contains a credential pattern or is a real .env file.
// Run from the repository root: node scripts/scan-secrets.mjs
// Prints only file:line and the rule name, never the matched value.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const RULES = [
  ['MongoDB URI with password', /mongodb(\+srv)?:\/\/[^\s/:@'"`]+:[^\s/@'"`]+@/],
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-style API key', /\bsk-(proj-)?[A-Za-z0-9]{32,}/],
  ['GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe secret key', /\b[sr]k_live_[A-Za-z0-9]{20,}/],
  ['Resend API key', /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/],
  ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Secret assigned in env syntax', /^\s*(JWT_SECRET|[A-Z_]*API_KEY|[A-Z_]*_TOKEN|[A-Z_]*PRIVATE_KEY|[A-Z_]*CLIENT_SECRET|[A-Z_]*WEBHOOK_SECRET)\s*=\s*(?!replace-with|change-me|$)\S{16,}/],
];

const SKIP = [/package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip)$/i];
const MAX_BYTES = 2 * 1024 * 1024;

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = [];

for (const file of files) {
  const base = file.split('/').pop();
  if (/^\.env/.test(base) && base !== '.env.example') {
    findings.push(`${file}: tracked environment file`);
    continue;
  }
  if (SKIP.some((pattern) => pattern.test(file))) continue;

  let text;
  try {
    if (statSync(file).size > MAX_BYTES) continue;
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted in the working tree
  }

  text.split(/\r?\n/).forEach((line, index) => {
    for (const [name, pattern] of RULES) {
      if (pattern.test(line)) findings.push(`${file}:${index + 1}: ${name}`);
    }
  });
}

if (findings.length) {
  process.stderr.write(`Possible secrets found (${findings.length}):\n${findings.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Secret scan clean: ${files.length} tracked files checked.\n`);
