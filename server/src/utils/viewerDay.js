const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const utcDay = date => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

// The viewer's local calendar day (YYYY-MM-DD), so day-based rules match what they see.
// Only one day either side of the server's UTC day is accepted: every real timezone fits,
// and nobody can ask the server to evaluate a far-off date.
// Returns a Date at UTC midnight, or null when the value is invalid.
export function parseViewerDay(value, now = new Date()) {
  const serverDay = utcDay(now);
  if (value === undefined) return new Date(serverDay);

  const match = typeof value === 'string' && DATE_ONLY.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const candidate = Date.UTC(year, month - 1, day);
  const parsed = new Date(candidate);
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  if (Math.abs(candidate - serverDay) > DAY_MS) return null;
  return parsed;
}
