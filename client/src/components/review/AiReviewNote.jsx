import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAiStatus } from "../../services/aiService";
import { getWeeklyReviewNote, writeWeeklyReviewNote } from "../../services/dashboardService";

const failureOf = failure => {
  const code = failure.response?.data?.code || failure.response?.data?.error?.code || "";
  // The API client turns every 429 into a generic text; the monthly AI limit deserves its own.
  const text = code === "AI_QUOTA_REACHED" ? "You have used this month's AI actions. They reset on the 1st." : failure.message;
  return { text, code };
};

function List({ title, items }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map(item => <li key={item} className="text-sm leading-6 text-[var(--dt-text-secondary)]">{item}</li>)}
      </ul>
    </div>
  );
}

// AI mentor: a short written review on top of the numbers. Mounted per week (key), saved per week,
// so reopening it is free; writing it again uses 1 AI action.
function AiReviewNote({ week }) {
  const [available, setAvailable] = useState(false);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState("load");
  const [error, setError] = useState({ text: "", code: "" });

  useEffect(() => {
    let active = true;
    getAiStatus()
      .then(async status => {
        if (!active || !status.available) return;
        setAvailable(true);
        const saved = await getWeeklyReviewNote(week);
        if (active) setNote(saved);
      })
      .catch(() => {})
      .finally(() => active && setBusy(""));
    return () => {
      active = false;
    };
  }, [week]);

  if (!available) return null;

  async function write() {
    setBusy("write");
    setError({ text: "", code: "" });
    try {
      setNote(await writeWeeklyReviewNote(week));
    } catch (failure) {
      setError(failureOf(failure));
    } finally {
      setBusy("");
    }
  }

  const needsSettings = ["AI_CONSENT_REQUIRED", "AI_QUOTA_REACHED", "AI_PLAN_REQUIRED"].includes(error.code);

  return (
    <div className="border border-[var(--dt-border)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">AI mentor · written review</p>
        <button type="button" onClick={write} disabled={Boolean(busy)} className="dt-link-button">
          {busy === "write" ? "Writing..." : note ? "Write again" : "Write my review"}
        </button>
      </div>

      {note ? (
        <div className="mt-4 space-y-5">
          <p className="text-base leading-7 text-[var(--dt-text-primary)]">{note.headline}</p>
          <div className="grid gap-5 md:grid-cols-3">
            <List title="Went well" items={note.wins} />
            <List title="Watch" items={note.watch} />
            <List title="Next steps" items={note.nextSteps} />
          </div>
          <p className="text-xs text-[var(--dt-text-muted)]">Written by AI from the numbers on this page on {new Date(note.createdAt).toLocaleDateString()}.</p>
        </div>
      ) : busy !== "load" ? (
        <p className="mt-3 text-sm leading-6 text-[var(--dt-text-secondary)]">
          Get a short written review of this week with three next steps. Uses 1 AI action; it is saved, so reopening it is free.
        </p>
      ) : null}

      {error.text ? (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error.text}{" "}
          {needsSettings ? <Link to="/app/settings#ai" className="underline underline-offset-2">Open AI settings</Link> : null}
        </p>
      ) : null}
    </div>
  );
}

export default AiReviewNote;
