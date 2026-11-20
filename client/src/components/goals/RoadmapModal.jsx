import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { addGoalMilestones, suggestGoalRoadmap } from "../../services/goalService";

const TYPE_LABEL = { learn: "Learn", practice: "Practice", build: "Build", review: "Review" };
const KIND_LABEL = { theory: "Mostly theory", practical: "Mostly practical", mixed: "Theory and practice" };

const inputClass =
  "w-full border border-[var(--dt-border)] bg-[var(--dt-background)] px-3 py-2 text-sm text-[var(--dt-text-primary)] outline-none focus:border-[var(--dt-accent)]";

const failureOf = failure => {
  const code = failure.response?.data?.code || failure.response?.data?.error?.code || "";
  // The API client turns every 429 into a generic text; the monthly AI limit deserves its own.
  const text = code === "AI_QUOTA_REACHED" ? "You have used this month's AI actions. They reset on the 1st." : failure.message;
  return { text, code };
};

// AI mentor: suggests a plan for a goal. Nothing is saved until the user picks steps and adds them.
function RoadmapModal({ goal, onClose, onSaved }) {
  const [plan, setPlan] = useState(null);
  const [steps, setSteps] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState({ text: "", code: "" });

  useEffect(() => {
    if (!goal) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goal, busy, onClose]);

  if (!goal) return null;

  async function suggest() {
    setBusy("suggest");
    setError({ text: "", code: "" });
    try {
      const data = await suggestGoalRoadmap(goal._id);
      setPlan(data);
      setSteps(data.steps.map((step, index) => ({ ...step, key: index, keep: true })));
    } catch (failure) {
      setError(failureOf(failure));
    } finally {
      setBusy("");
    }
  }

  async function save() {
    const chosen = steps.filter(step => step.keep && step.title.trim());
    if (!chosen.length) {
      setError({ text: "Keep at least one step.", code: "" });
      return;
    }
    setBusy("save");
    setError({ text: "", code: "" });
    try {
      const updated = await addGoalMilestones(goal._id, chosen.map(step => ({ title: step.title.trim().slice(0, 120), dueDate: step.dueDate || null })));
      onSaved(updated);
      onClose();
    } catch (failure) {
      setError(failureOf(failure));
    } finally {
      setBusy("");
    }
  }

  const update = (key, changes) => setSteps(list => list.map(step => (step.key === key ? { ...step, ...changes } : step)));
  const kept = steps.filter(step => step.keep).length;
  const needsSettings = ["AI_CONSENT_REQUIRED", "AI_QUOTA_REACHED", "AI_PLAN_REQUIRED"].includes(error.code);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roadmap-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-[var(--dt-border-strong)] bg-[var(--dt-surface)] p-6 shadow-2xl animate-[dt-modal-in_180ms_ease-out] md:p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">AI mentor</p>
        <h2 id="roadmap-title" className="mt-3 font-[family-name:var(--dt-font-display)] text-2xl leading-tight text-[var(--dt-text-primary)] md:text-3xl">
          Plan this goal
        </h2>
        <p className="mt-2 break-words text-sm text-[var(--dt-text-secondary)]">{goal.title}</p>

        {!plan ? (
          <p className="mt-5 text-sm leading-6 text-[var(--dt-text-secondary)]">
            Get a step-by-step plan with due dates{goal.deadline ? " that fit your deadline" : ""}. You can edit or drop any step
            before adding them as milestones. Uses 1 AI action.
          </p>
        ) : (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">{KIND_LABEL[plan.kind]}</p>
            {plan.summary ? <p className="mt-2 text-sm leading-6 text-[var(--dt-text-secondary)]">{plan.summary}</p> : null}
            <ol className="mt-4 space-y-4">
              {steps.map((step, index) => (
                <li key={step.key} className={`border-l-2 pl-4 ${step.keep ? "border-[var(--dt-accent)]" : "border-[var(--dt-border)] opacity-60"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">
                    <span>Step {index + 1} · {TYPE_LABEL[step.type] || "Step"}</span>
                    <label className="flex items-center gap-2 normal-case tracking-normal">
                      <input type="checkbox" checked={step.keep} disabled={Boolean(busy)} onChange={event => update(step.key, { keep: event.target.checked })} />
                      Keep
                    </label>
                  </div>
                  <label className="sr-only" htmlFor={`step-title-${step.key}`}>Step {index + 1} title</label>
                  <input
                    id={`step-title-${step.key}`}
                    className={`${inputClass} mt-2`}
                    value={step.title}
                    maxLength={120}
                    disabled={Boolean(busy) || !step.keep}
                    onChange={event => update(step.key, { title: event.target.value })}
                  />
                  {step.detail ? <p className="mt-1 text-xs leading-5 text-[var(--dt-text-secondary)]">{step.detail}</p> : null}
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--dt-text-muted)]">
                    <label htmlFor={`step-date-${step.key}`}>Due</label>
                    <input
                      id={`step-date-${step.key}`}
                      type="date"
                      className="border border-[var(--dt-border)] bg-[var(--dt-background)] px-2 py-1 text-xs text-[var(--dt-text-primary)]"
                      value={step.dueDate || ""}
                      disabled={Boolean(busy) || !step.keep}
                      onChange={event => update(step.key, { dueDate: event.target.value || null })}
                    />
                  </div>
                </li>
              ))}
            </ol>
            {plan.room < plan.steps.length ? (
              <p className="mt-3 text-xs text-[var(--dt-text-muted)]">Only {plan.room} more milestones fit on this goal.</p>
            ) : null}
          </div>
        )}

        {error.text ? (
          <p role="alert" className="mt-5 text-sm text-red-300">
            {error.text}{" "}
            {needsSettings ? <Link to="/app/settings#ai" className="underline underline-offset-2">Open AI settings</Link> : null}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busy)}
            className="px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)] disabled:opacity-40"
          >
            Cancel
          </button>
          {plan ? (
            <>
              <button
                type="button"
                onClick={suggest}
                disabled={Boolean(busy)}
                className="px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)] disabled:opacity-40"
              >
                {busy === "suggest" ? "Thinking..." : "Try again"}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={Boolean(busy) || kept === 0}
                className="border border-[var(--dt-accent)] px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-primary)] hover:bg-[var(--dt-accent)]/10 disabled:opacity-40"
              >
                {busy === "save" ? "Adding..." : `Add ${kept} milestone${kept === 1 ? "" : "s"}`}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={suggest}
              disabled={Boolean(busy)}
              className="border border-[var(--dt-accent)] px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-primary)] hover:bg-[var(--dt-accent)]/10 disabled:opacity-40"
            >
              {busy === "suggest" ? "Thinking..." : "Suggest a plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RoadmapModal;
