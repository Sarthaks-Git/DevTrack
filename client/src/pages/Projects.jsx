
import { useCallback, useEffect, useRef, useState } from "react";
import Pagination from "../components/common/Pagination";
import { usePagination } from "../components/common/usePagination";

const PROJECTS_PER_PAGE = 6;
import { Link } from "react-router-dom";
import api, { ensureCsrfToken, errorMessage } from "../services/api";
import { getGoals } from "../services/goalService";
import MilestoneList from "../components/milestones/MilestoneList";
import PageHeader from "../components/common/PageHeader";
import ProjectCodeReview from "../components/projects/ProjectCodeReview";
import ProjectRepository from "../components/projects/ProjectRepository";
import ProjectSecurityChecks from "../components/projects/ProjectSecurityChecks";
import { getAiStatus, listCodeFindings, listSecurityReviews } from "../services/aiService";
import { getGitHubStatus, syncGitHub } from "../services/githubService";

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const PRIORITY_OPTIONS = ["low", "medium", "high"];

const EMPTY_FORM = {
  title: "",
  description: "",
  status: "planning",
  priority: "medium",
  technologies: "",
  githubUrl: "",
  liveUrl: "",
  startDate: "",
  endDate: "",
  goal: "",
};

async function requestProjects(path = "", config = {}) {
  const method = (config.method || "GET").toLowerCase();
  const isMutation = !["get", "head", "options"].includes(method);

  // Make sure the readable CSRF cookie exists before the Axios request
  // interceptor copies it into the X-CSRF-Token request header.
  if (isMutation) {
    await ensureCsrfToken();
  }

  try {
    const response = await api.request({
      ...config,
      url: `/projects${path}`,
    });

    // Keep the response shape expected by this page:
    // { projects: [...] } for GET and { project: {...} } for mutations.
    return response.data.data;
  } catch (error) {
    throw new Error(errorMessage(error, "Unable to complete the request."), { cause: error });
  }
}

function formatDate(value) {
  if (!value) return null;

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function StatusLabel({ status }) {
  const labels = {
    planning: "Planning",
    in_progress: "In progress",
    completed: "Completed",
    archived: "Archived",
  };

  return (
    <span className="inline-flex items-center gap-2 border border-[var(--dt-border-strong)] px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-[var(--dt-text-secondary)]">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "completed"
            ? "bg-emerald-400"
            : status === "in_progress"
              ? "bg-[var(--dt-accent-soft)]"
              : "bg-[var(--dt-text-muted)]"
        }`}
      />
      {labels[status] || status}
    </span>
  );
}

function ProjectCard({ project, goal, milestoneHandlers, githubConnected, securityReviews, onSecurityReviewChange, codeFindings, codeReviewAllowed, onCodeFindingChange, onCodeReviewToggle, onReplace, onEdit, onDelete }) {
  return (
    <article className="group flex h-full flex-col border border-[var(--dt-border)] bg-[var(--dt-surface)] shadow-[var(--dt-shadow-card)] p-5 transition-colors duration-200 hover:border-[var(--dt-border-strong)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
            Project
          </p>

          <h3 className="break-words font-[family-name:var(--dt-font-display)] text-2xl text-[var(--dt-text-primary)]">
            {project.title}
          </h3>
        </div>

        <StatusLabel status={project.status} />
      </div>

      <p className="mt-4 min-h-12 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--dt-text-secondary)]">
        {project.description || "No description added yet."}
      </p>

      {project.technologies?.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {project.technologies.map((technology) => (
            <span
              key={technology}
              className="border border-[var(--dt-border)] px-2 py-1 text-[11px] text-[var(--dt-text-secondary)]"
            >
              {technology}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[var(--dt-text-muted)]">
        <span>
          Priority:{" "}
          <span className="capitalize text-[var(--dt-text-secondary)]">
            {project.priority}
          </span>
        </span>

        {project.startDate && (
          <span>Started {formatDate(project.startDate)}</span>
        )}

        {project.endDate && (
          <span>Ended {formatDate(project.endDate)}</span>
        )}
      </div>

      {goal && (
        <p className="mt-3 text-[11px] text-[var(--dt-text-muted)]">
          Toward{" "}
          <Link
            to="/app/goals"
            className="text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)]"
          >
            {goal.title}
          </Link>
        </p>
      )}

      <MilestoneList
        milestones={project.milestones}
        onAdd={(milestone) => milestoneHandlers.add(project._id, milestone)}
        onUpdate={(milestoneId, changes) => milestoneHandlers.update(project._id, milestoneId, changes)}
        onRemove={(milestoneId) => milestoneHandlers.remove(project._id, milestoneId)}
      />

      <ProjectRepository project={project} githubConnected={githubConnected} onChange={onReplace} />
      <ProjectSecurityChecks projectTitle={project.title} reviews={securityReviews} onChange={onSecurityReviewChange} />
      <ProjectCodeReview
        project={project}
        allowed={codeReviewAllowed}
        findings={codeFindings}
        onFindingChange={onCodeFindingChange}
        onToggle={enabled => onCodeReviewToggle(project, enabled)}
      />

      <div className="mt-auto mt-6 flex flex-wrap items-center gap-4 border-t border-[var(--dt-border)] pt-5">
        {project.githubUrl && (
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)]"
          >
            GitHub ↗
          </a>
        )}

        {project.liveUrl && (
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)]"
          >
            Live demo ↗
          </a>
        )}

        <div className="ml-auto flex gap-3">
          <button
            type="button"
            onClick={() => onEdit(project)}
            className="text-xs text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)]"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => onDelete(project)}
            className="text-xs text-red-400/80 hover:text-red-300"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function ProjectForm({ initialProject, goals = [], saving, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => {
    if (!initialProject) return { ...EMPTY_FORM };

    return {
      title: initialProject.title || "",
      description: initialProject.description || "",
      status: initialProject.status || "planning",
      priority: initialProject.priority || "medium",
      technologies: (initialProject.technologies || []).join(", "),
      githubUrl: initialProject.githubUrl || "",
      liveUrl: initialProject.liveUrl || "",
      startDate: initialProject.startDate
        ? initialProject.startDate.slice(0, 10)
        : "",
      goal: initialProject.goal || "",
      endDate: initialProject.endDate
        ? initialProject.endDate.slice(0, 10)
        : "",
    };
  });

  const [formError, setFormError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const startDate = form.startDate || null;
    const endDate = form.endDate || null;

    if (startDate && endDate && endDate < startDate) {
      setFormError("End date cannot be earlier than start date.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      technologies: form.technologies
        .split(",")
        .map((technology) => technology.trim())
        .filter(Boolean),
      githubUrl: form.githubUrl.trim(),
      liveUrl: form.liveUrl.trim(),
      startDate,
      endDate,
      goal: form.goal || null,
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      setFormError(error.message || "Unable to save this project.");
    }
  }

  const inputClass =
    "mt-2 w-full border border-[var(--dt-border)] bg-[var(--dt-background)] px-3 py-3 text-sm text-[var(--dt-text-primary)] outline-none transition-colors focus:border-[var(--dt-accent)]";

  const labelClass =
    "block text-xs font-medium tracking-wide text-[var(--dt-text-secondary)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-[var(--dt-border-strong)] bg-[var(--dt-surface)] p-5 shadow-[var(--dt-shadow-card)] sm:p-7"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-accent-soft)]">
            {initialProject ? "Edit project" : "New project"}
          </p>

          <h2 className="mt-2 font-[family-name:var(--dt-font-display)] text-3xl text-[var(--dt-text-primary)]">
            {initialProject ? "Refine your work." : "What are you building?"}
          </h2>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-sm text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]"
        >
          Close
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          Project title *
          <input
            className={inputClass}
            name="title"
            value={form.title}
            onChange={updateField}
            minLength={3}
            maxLength={120}
            required
            placeholder="e.g. DevTrack"
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Description
          <textarea
            className={`${inputClass} min-h-28 resize-y`}
            name="description"
            value={form.description}
            onChange={updateField}
            maxLength={2000}
            placeholder="What does this project do?"
          />
        </label>

        <label className={labelClass}>
          Status
          <select
            className={inputClass}
            name="status"
            value={form.status}
            onChange={updateField}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Priority
          <select
            className={inputClass}
            name="priority"
            value={form.priority}
            onChange={updateField}
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Working toward goal
          <select
            className={inputClass}
            name="goal"
            value={form.goal}
            onChange={updateField}
          >
            <option value="">No linked goal</option>
            {goals
              .filter((goal) => goal.status !== "archived" || goal._id === form.goal)
              .map((goal) => (
                <option key={goal._id} value={goal._id}>
                  {goal.title}
                </option>
              ))}
          </select>
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Technologies
          <input
            className={inputClass}
            name="technologies"
            value={form.technologies}
            onChange={updateField}
            placeholder="React, Node.js, MongoDB"
          />
          <span className="mt-1 block text-[11px] text-[var(--dt-text-muted)]">
            Separate technologies with commas.
          </span>
        </label>

        <label className={labelClass}>
          GitHub URL
          <input
            className={inputClass}
            name="githubUrl"
            type="url"
            value={form.githubUrl}
            onChange={updateField}
            placeholder="https://github.com/..."
          />
        </label>

        <label className={labelClass}>
          Live demo URL
          <input
            className={inputClass}
            name="liveUrl"
            type="url"
            value={form.liveUrl}
            onChange={updateField}
            placeholder="https://..."
          />
        </label>

        <label className={labelClass}>
          Start date
          <input
            className={inputClass}
            name="startDate"
            type="date"
            value={form.startDate}
            onChange={updateField}
          />
        </label>

        <label className={labelClass}>
          End date
          <input
            className={inputClass}
            name="endDate"
            type="date"
            value={form.endDate}
            onChange={updateField}
          />
        </label>
      </div>

      {formError && (
        <p
          role="alert"
          className="mt-5 border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-300"
        >
          {formError}
        </p>
      )}

      <div className="mt-7 flex flex-wrap gap-3 border-t border-[var(--dt-border)] pt-5">
        <button
          type="submit"
          disabled={saving}
          className="border border-[var(--dt-accent)] bg-[var(--dt-accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : initialProject
              ? "Save changes"
              : "Create project"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="border border-[var(--dt-border-strong)] px-5 py-3 text-xs uppercase tracking-[0.12em] text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteProjectModal({ project, deleting, onCancel, onConfirm }) {
  useEffect(() => {
    if (!project) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !deleting) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [project, deleting, onCancel]);

  if (!project) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) {
          onCancel();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        aria-describedby="delete-project-description"
        className="w-full max-w-md border border-[var(--dt-border-strong)] bg-[var(--dt-surface)] p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-6 flex h-11 w-11 items-center justify-center border border-red-400/30 bg-red-400/5 text-xl text-red-400">
          !
        </div>

        <p className="text-[11px] uppercase tracking-[0.2em] text-red-400">
          Destructive action
        </p>

        <h2
          id="delete-project-title"
          className="mt-3 font-[family-name:var(--dt-font-display)] text-3xl text-[var(--dt-text-primary)]"
        >
          Delete project?
        </h2>

        <p
          id="delete-project-description"
          className="mt-4 break-words text-sm leading-7 text-[var(--dt-text-secondary)]"
        >
          You're about to permanently delete{" "}
          <span className="font-medium text-[var(--dt-text-primary)]">
            {project.title}
          </span>
          . This action cannot be undone.
        </p>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="border border-[var(--dt-border-strong)] px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-text-primary)] disabled:opacity-50"
          >
            Keep project
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="border border-red-400/50 bg-red-500/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete project"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Projects() {
  const [projects, setProjects] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [filter, setFilter] = useState("all");
  const [githubConnected, setGithubConnected] = useState(false);
  const [securityReviews, setSecurityReviews] = useState([]);
  const [codeFindings, setCodeFindings] = useState([]);
  const findingsTimer = useRef(null);
  // The server enforces the plan; this only decides what the card offers.
  const [codeReviewAllowed, setCodeReviewAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    getAiStatus()
      .then(status => {
        const current = status.tiers.find(tier => tier.current);
        if (active) setCodeReviewAllowed(Boolean(status.available && current?.features.includes("codeReview")));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // AI results (message checks and code findings) are produced in the background after a sync.
  const loadAiResults = useCallback(() => Promise.all([
    listSecurityReviews().then(setSecurityReviews).catch(() => {}),
    listCodeFindings().then(setCodeFindings).catch(() => {}),
  ]), []);

  useEffect(() => () => clearTimeout(findingsTimer.current), []);

  const fetchProjects = useCallback(
    () => requestProjects().then(data => data.projects || []),
    [],
  );

  useEffect(() => {
    let active = true;
    // Goals only label and link projects; the page still works without them.
    getGoals()
      .then((data) => active && setGoals(data.goals || []))
      .catch(() => {});
    fetchProjects()
      .then(list => active && setProjects(list))
      .catch(error => active && setPageError(error.message || "Unable to load projects."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [fetchProjects]);

  // GitHub is optional: when connected, pull new commits and refresh cards if any arrived.
  useEffect(() => {
    let active = true;
    let reviewTimer;
    let lateTimer;
    getGitHubStatus()
      .then(async (status) => {
        const connected = status.connection?.status === "connected";
        if (!active) return;
        setGithubConnected(connected);
        if (!connected) return;
        const loadReviews = () => active && loadAiResults();
        await loadReviews();
        const result = await syncGitHub();
        if (active && result.newCommits > 0) setProjects(await fetchProjects());
        // AI security review runs in the background after a sync; pick up its results shortly after.
        // Code review fetches each commit from GitHub, so it finishes later than the message checks.
        if (active && result.status === "synced") {
          reviewTimer = setTimeout(loadReviews, 8000);
          lateTimer = setTimeout(loadReviews, 30000);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      clearTimeout(reviewTimer);
      clearTimeout(lateTimer);
    };
  }, [fetchProjects, loadAiResults]);

  function replaceCodeFinding(updated) {
    setCodeFindings(previous => previous.map(finding => (finding.id === updated.id ? updated : finding)));
  }

  function handleCodeReviewToggle(project, enabled) {
    replaceProject({ ...project, repository: { ...project.repository, codeReview: { enabled } } });
    // Turning it on reviews the past week's commits in the background; fetch the findings shortly after.
    clearTimeout(findingsTimer.current);
    if (enabled) findingsTimer.current = setTimeout(loadAiResults, 20000);
  }

  function replaceSecurityReview(updated) {
    setSecurityReviews(previous => previous.map(review => (review.id === updated.id ? updated : review)));
  }

  async function retryLoadProjects() {
    setLoading(true);
    setPageError("");
    try {
      setProjects(await fetchProjects());
    } catch (error) {
      setPageError(error.message || "Unable to load projects.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(payload) {
    setSaving(true);
    setPageError("");

    try {
      if (editingProject) {
        const data = await requestProjects(`/${editingProject._id}`, {
          method: "PATCH",
          data: payload,
        });

        setProjects((current) =>
          current.map((project) =>
            project._id === editingProject._id ? data.project : project
          )
        );
      } else {
        const data = await requestProjects("", {
          method: "POST",
          data: payload,
        });

        setProjects((current) => [data.project, ...current]);
      }

      setFormOpen(false);
      setEditingProject(null);
    } catch (error) {
      setPageError(error.message || "Unable to save the project.");
      throw error;
    } finally {
      setSaving(false);
    }
  }

  function replaceProject(updated) {
    setProjects((current) =>
      current.map((project) => (project._id === updated._id ? updated : project))
    );
  }

  async function mutateMilestone(projectId, path, config) {
    const data = await requestProjects(`/${projectId}/milestones${path}`, config);
    replaceProject(data.project);
  }

  const milestoneHandlers = {
    add: (projectId, milestone) => mutateMilestone(projectId, "", { method: "POST", data: milestone }),
    update: (projectId, milestoneId, changes) =>
      mutateMilestone(projectId, `/${milestoneId}`, { method: "PATCH", data: changes }),
    remove: (projectId, milestoneId) =>
      mutateMilestone(projectId, `/${milestoneId}`, { method: "DELETE" }),
  };

  const goalsById = new Map(goals.map((goal) => [goal._id, goal]));

  function openCreateForm() {
    setEditingProject(null);
    setFormOpen(true);
    setPageError("");
  }

  function openEditForm(project) {
    setEditingProject(project);
    setFormOpen(true);
    setPageError("");
  }

  const openDeleteModal = useCallback((project) => {
    setPageError("");
    setProjectToDelete(project);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deletingId) return;
    setProjectToDelete(null);
  }, [deletingId]);

  async function handleDelete() {
    if (!projectToDelete || deletingId) return;

    const project = projectToDelete;

    setDeletingId(project._id);
    setPageError("");

    try {
      await requestProjects(`/${project._id}`, {
        method: "DELETE",
      });

      setProjects((current) =>
        current.filter((item) => item._id !== project._id)
      );

      setProjectToDelete(null);
    } catch (error) {
      setPageError(error.message || "Unable to delete the project.");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredProjects =
    filter === "all"
      ? projects
      : projects.filter((project) => project.status === filter);
  // Six cards a page (two rows on wide screens); a new filter starts at page 1.
  const projectPages = usePagination(filteredProjects, PROJECTS_PER_PAGE, filter);

  const counts = {
    total: projects.length,
    active: projects.filter((project) => project.status === "in_progress")
      .length,
    planning: projects.filter((project) => project.status === "planning")
      .length,
    completed: projects.filter((project) => project.status === "completed")
      .length,
  };

  const buttonClass =
    "border border-[var(--dt-border-strong)] px-3 py-2 text-[11px] uppercase tracking-[0.12em] transition-colors";

  return (
    <div className="text-[var(--dt-text-primary)]">
      <div>
        <PageHeader
          eyebrow="03 — Projects"
          title={
            <>
              Projects<span className="text-[var(--dt-accent-soft)]">.</span>
            </>
          }
          description="A record of what you're building, the tools behind it, and the progress that turns ideas into real work."
        >
          <button
            type="button"
            onClick={openCreateForm}
            className="group inline-flex items-center gap-3 border border-[var(--dt-text-primary)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors hover:border-[var(--dt-accent)] hover:bg-[var(--dt-accent)]"
          >
            <span className="text-lg leading-none">+</span>
            New project
          </button>
        </PageHeader>

        <section aria-label="Project counts" className="border-b border-[var(--dt-border)] pb-8">
          <div className="grid grid-cols-2 gap-px border border-[var(--dt-border)] bg-[var(--dt-border)] sm:grid-cols-4">
            {[
              { label: "Total projects", value: counts.total },
              { label: "In progress", value: counts.active },
              { label: "Planning", value: counts.planning },
              { label: "Completed", value: counts.completed },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-[var(--dt-background)] p-4 sm:p-5"
              >
                <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--dt-text-muted)]">
                  {item.label}
                </p>
                <p className="mt-3 font-[family-name:var(--dt-font-display)] text-3xl">
                  {item.value.toString().padStart(2, "0")}
                </p>
              </div>
            ))}
          </div>
        </section>

        {pageError && (
          <div
            role="alert"
            className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300"
          >
            <span>{pageError}</span>
            <button
              type="button"
              onClick={retryLoadProjects}
              className="underline underline-offset-4"
            >
              Retry
            </button>
          </div>
        )}

        {formOpen && (
          <section className="mt-8">
            <ProjectForm
              key={editingProject?._id || "new-project"}
              initialProject={editingProject}
              goals={goals}
              saving={saving}
              onCancel={() => {
                setFormOpen(false);
                setEditingProject(null);
              }}
              onSubmit={handleSave}
            />
          </section>
        )}

        <section className="mt-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
                Your workspace
              </p>
              <h2 className="mt-2 text-lg font-medium">
                All projects
                <span className="ml-2 text-sm font-normal text-[var(--dt-text-muted)]">
                  ({filteredProjects.length})
                </span>
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {[{ value: "all", label: "All" }, ...STATUS_OPTIONS].map(
                (option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    aria-pressed={filter === option.value}
                    className={`${buttonClass} ${
                      filter === option.value
                        ? "border-[var(--dt-accent)] text-[var(--dt-accent-soft)]"
                        : "text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]"
                    }`}
                  >
                    {option.label}
                  </button>
                )
              )}
            </div>
          </div>

          {loading ? (
            <div
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              aria-label="Loading projects"
            >
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-64 animate-pulse border border-[var(--dt-border)] bg-[var(--dt-surface)]"
                />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="border border-dashed border-[var(--dt-border-strong)] px-6 py-10 text-center">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--dt-accent-soft)]">
                {projects.length === 0 ? "A clean slate" : "No matching projects"}
              </p>

              <h3 className="mt-4 font-[family-name:var(--dt-font-display)] text-3xl">
                {projects.length === 0
                  ? "Every great build starts somewhere."
                  : "Nothing in this category yet."}
              </h3>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--dt-text-secondary)]">
                {projects.length === 0
                  ? "Document something you're building. Add its technology stack, links, and progress in one place."
                  : "Try another status filter to find your projects."}
              </p>

              {projects.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-7 border border-[var(--dt-accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dt-accent-soft)] transition-colors hover:bg-[var(--dt-accent)] hover:text-white"
                >
                  Create your first project
                </button>
              )}
            </div>
          ) : (
            <div id="project-grid">
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projectPages.pageItems.map((project) => (
                <div
                  key={project._id}
                  className={
                    deletingId === project._id
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                >
                  <ProjectCard
                    project={project}
                    goal={goalsById.get(project.goal)}
                    milestoneHandlers={milestoneHandlers}
                    githubConnected={githubConnected}
                    securityReviews={securityReviews.filter(review => review.project.id === project._id)}
                    onSecurityReviewChange={replaceSecurityReview}
                    codeFindings={codeFindings.filter(finding => finding.project === project._id)}
                    codeReviewAllowed={codeReviewAllowed}
                    onCodeFindingChange={replaceCodeFinding}
                    onCodeReviewToggle={handleCodeReviewToggle}
                    onReplace={replaceProject}
                    onEdit={openEditForm}
                    onDelete={openDeleteModal}
                  />
                </div>
              ))}
            </div>
            <Pagination page={projectPages.page} pageCount={projectPages.pageCount} onChange={projectPages.setPage} label="Project pages" scrollTargetId="project-grid" total={filteredProjects.length} pageSize={PROJECTS_PER_PAGE} />
            </div>
          )}
        </section>
      </div>

      <DeleteProjectModal
        project={projectToDelete}
        deleting={deletingId === projectToDelete?._id}
        onCancel={closeDeleteModal}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default Projects;
