// The viewer's local calendar day as YYYY-MM-DD, sent to day-based server views so
// "overdue" or "idle for 30 days" matches the date the viewer sees.
export function localDayKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
