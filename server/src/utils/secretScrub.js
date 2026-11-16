// Removes secrets from code before it leaves the server (opt-in AI code review).
// Errs on the side of redacting too much: a false positive only hides a value from the AI.

export const REDACTED = '[REDACTED]';

// Known token formats, matched anywhere in a line.
const TOKEN_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\bsk-ant-[A-Za-z0-9_-]{10,}/g, // Anthropic
  /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}/g, // OpenAI-style
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}/g, // Stripe
  /\brzp_(?:live|test)_[A-Za-z0-9]{10,}/g, // Razorpay
  /\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{20,}/g, // GitHub
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g, // GitLab
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g, // Slack
  /\bAIza[0-9A-Za-z_-]{30,}/g, // Google API key
  /\bya29\.[0-9A-Za-z_-]{20,}/g, // Google OAuth token
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, // AWS access key id
  /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g, // SendGrid
  /\bnpm_[A-Za-z0-9]{30,}/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWT
  /\b[Bb]earer\s+[A-Za-z0-9._~+/=-]{16,}/g,
  /\b[Bb]asic\s+[A-Za-z0-9+/=]{16,}/g,
];

// user:password@ in any connection string (mongodb, postgres, redis, amqp, https...).
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]{1,20}:\/\/)([^\s:/@'"`]+):([^\s@'"`]+)@/gi;

// `secret = "value"`, `apiKey: 'value'`: a quoted literal assigned to a secret-like name. Keep the name,
// hide the value. Unquoted code such as `password = req.body.password` stays readable for the review.
const QUOTED_ASSIGNMENT =
  /([A-Za-z0-9_]*(?:secret|passw(?:or)?d|pwd|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|credential|auth[_-]?key|signing[_-]?key|encryption[_-]?key|salt|webhook[_-]?url|dsn)[A-Za-z0-9_]*["']?\s*[:=]\s*)(["'`])([^"'`\n]{6,})\2/gi;

// Env-file style `API_KEY=value` or `export DB_PASSWORD=value`: upper-case name, unquoted value.
const ENV_ASSIGNMENT =
  /^(\s*(?:export\s+)?[A-Z0-9_]*(?:SECRET|PASSWORD|PASSWD|PWD|TOKEN|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CLIENT_?SECRET|CREDENTIALS?|AUTH_?KEY|SIGNING_?KEY|ENCRYPTION_?KEY|SALT|DSN|URI|URL)[A-Z0-9_]*\s*[=:]\s*)([^\s"'`]{6,})/;

// Long random-looking strings: hex or base64-ish runs with high character variety.
const LONG_RANDOM = /[A-Za-z0-9+/_=-]{32,}/g;

function entropy(value) {
  const counts = new Map();
  for (const char of value) counts.set(char, (counts.get(char) || 0) + 1);
  let bits = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

// Keys mix letters and digits; import paths and CONSTANT_NAMES rarely do, so they stay readable.
function looksRandom(value) {
  if (/^[0-9a-f]{32,}$/i.test(value)) return true;
  const digits = (value.match(/[0-9]/g) || []).length;
  const letters = (value.match(/[A-Za-z]/g) || []).length;
  return digits >= 4 && letters >= 4 && entropy(value) >= 3.5;
}

/**
 * Returns the text with secrets replaced by [REDACTED] and how many replacements were made.
 */
export function scrubSecrets(input) {
  let count = 0;
  let text = String(input);
  const replace = (pattern, replacer) => {
    text = text.replace(pattern, (...args) => {
      const result = replacer(...args);
      if (result !== args[0]) count += 1;
      return result;
    });
  };

  for (const pattern of TOKEN_PATTERNS) replace(pattern, () => REDACTED);
  replace(URL_CREDENTIALS, (match, scheme, user) => `${scheme}${user}:${REDACTED}@`);
  replace(QUOTED_ASSIGNMENT, (match, name, quote, value) => (value.includes(REDACTED) ? match : `${name}${quote}${REDACTED}${quote}`));
  replace(ENV_ASSIGNMENT, (match, name, value) => (value.includes(REDACTED) ? match : `${name}${REDACTED}`));
  replace(LONG_RANDOM, match => (looksRandom(match) ? REDACTED : match));
  return { text, count };
}
