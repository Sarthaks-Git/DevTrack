// Helpers for the AI mentor features: user text goes to the model as data, and model text comes
// back as plain, bounded text.

/** Strips control and bidi characters and collapses whitespace. AI output is shown as plain text only. */
export function cleanAiText(value, max) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Wraps user data in a tag as JSON with `<` escaped, so quotes, angle brackets or a closing tag
 * inside user text can never break out of the data block.
 */
export const asDataBlock = (tag, data) => `<${tag}>${JSON.stringify(data).replace(/</g, '\\u003c')}</${tag}>`;

/** Cleaned list of short strings, deduplicated, at most `count` items. */
export function cleanAiList(values, { count, max }) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanAiText(value, max);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length === count) break;
  }
  return out;
}
