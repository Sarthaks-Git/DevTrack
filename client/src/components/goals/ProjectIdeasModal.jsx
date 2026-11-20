import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { suggestProjectIdeas } from "../../services/goalService";
import { addProjectMilestones, createProject } from "../../services/projectService";

const failureOf = failure => {
  const code = failure.response?.data?.code || failure.response?.data?.error?.code || "";
  // The API client turns every 429 into a generic text; the monthly AI limit deserves its own.
  const text = code === "AI_QUOTA_REACHED" ? "You have used this month's AI actions. They reset on the 1st." : failure.message;
  return { text, code };
};

const DIFFICULTY = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

// AI mentor: practice projects that prove a goal's skills. Picking one creates a normal project linked
// to the goal, with the idea's steps as milestones.
function ProjectIdeasModal({ goal, onClose }) {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState(null);
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
      setIdeas(await suggestProjectIdeas(goal._id));
    } catch (failure) {
      setError(failureOf(failure));
    } finally {
      setBusy("");
    }
  }

  async function start(idea, index) {
    setBusy(`start-${index}`);
    setError({ text: "", code: "" });
    try {
      const created = await createProject({ title: idea.title, description: idea.description, technologies: idea.technologies, goal: goal._id, status: "planning" });
      const projectId = created.data?.project?._id;
      if (projectId && idea.milestones.length) await addProjectMilestones(projectId, idea.milestones.map(title => ({ title })));
      onClose();
      navigate("/app/projects");
    } catch (failure) {
      setError(failureOf(failure));
      setBusy("");
    }
  }

  const needsSettings = ["AI_CONSENT_REQUIRED", "AI_QUOTA_REACHED", "AI_PLAN_REQUIRED"].includes(error.code);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="ideas-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-[var(--dt-border-strong)] bg-[var(--dt-surface)] p-6 shadow-2xl animate-[dt-modal-in_180ms_ease-out] md:p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">AI mentor</p>
        <h2 id="ideas-title" className="mt-3 font-[family-name:var(--dt-font-display)] text-2xl leading-tight text-[var(--dt-text-primary)] md:text-3xl">Practice projects</h2>
        <p className="mt-2 break-words text-sm text-[var(--dt-text-secondary)]">{goal.title}</p>

        {!ideas ? (
          <p className="mt-5 text-sm leading-6 text-[var(--dt-text-secondary)]">
            Get three small projects that would prove this goal's skills. Starting one creates a project linked to this goal, with its
            build steps as milestones. Uses 1 AI action.
          </p>
        ) : (
          <ol className="mt-5 space-y-5">
            {ideas.map((idea, index) => (
              <li key={idea.title} className="border-l-2 border-[var(--dt-accent)] pl-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">{DIFFICULTY[idea.difficulty]} · about {idea.days} days</p>
                <p className="mt-1 break-words text-base text-[var(--dt-text-primary)]">{idea.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--dt-text-secondary)]">{idea.description}</p>
                {idea.technologies.length ? <p className="mt-1 text-xs text-[var(--dt-text-muted)]">{idea.technologies.join(" · ")}</p> : null}
                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-[var(--dt-text-secondary)]">
                  {idea.milestones.map(step => <li key={step}>{step}</li>)}
                </ol>
                <button type="button" onClick={() => start(idea, index)} disabled={Boolean(busy)} className="dt-link-button mt-3">
                  {busy === `start-${index}` ? "Creating..." : "Start this project"}
                </button>
              </li>
            ))}
          </ol>
        )}

        {error.text ? (
          <p role="alert" className="mt-5 text-sm text-red-300">
            {error.text}{" "}
            {needsSettings ? <Link to="/app/settings#ai" className="underline underline-offset-2">Open AI settings</Link> : null}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={Boolean(busy)} className="px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)] disabled:opacity-40">
            Close
          </button>
          <button type="button" onClick={suggest} disabled={Boolean(busy)} className="border border-[var(--dt-accent)] px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-primary)] hover:bg-[var(--dt-accent)]/10 disabled:opacity-40">
            {busy === "suggest" ? "Thinking..." : ideas ? "Other ideas" : "Suggest projects"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectIdeasModal;
