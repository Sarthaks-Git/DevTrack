import { useState } from "react";
import { Link } from "react-router-dom";
import ConfirmModal from "../common/ConfirmModal";
import RepoPicker from "./RepoPicker";
import { getProjectCommits, linkRepository, unlinkRepository } from "../../services/githubService";

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}

// Linked GitHub repository on a project card: link/unlink, plus the latest verified commits.
function ProjectRepository({ project, githubConnected, onChange }) {
  const repository = project.repository;
  const [picker, setPicker] = useState({ open: false, choice: "" });
  const [commits, setCommits] = useState({ open: false, loading: false, items: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  function openPicker() {
    setError("");
    setPicker({ open: true, choice: "" });
  }

  async function handleLink(event) {
    event.preventDefault();
    if (!picker.choice) return;
    setBusy(true);
    setError("");
    try {
      const linked = await linkRepository(project._id, Number(picker.choice));
      onChange({ ...project, repository: linked });
      setPicker(previous => ({ ...previous, open: false }));
      setCommits({ open: false, loading: false, items: [] });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    try {
      await unlinkRepository(project._id);
      onChange({ ...project, repository: null });
      setCommits({ open: false, loading: false, items: [] });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
      setConfirmUnlink(false);
    }
  }

  async function toggleCommits() {
    if (commits.open) {
      setCommits(previous => ({ ...previous, open: false }));
      return;
    }
    setCommits({ open: true, loading: true, items: [] });
    try {
      const data = await getProjectCommits(project._id);
      setCommits({ open: true, loading: false, items: data.commits.slice(0, 5) });
    } catch (failure) {
      setError(failure.message);
      setCommits({ open: false, loading: false, items: [] });
    }
  }

  if (!repository && !githubConnected) {
    return (
      <div className="mt-5 border-t border-[var(--dt-border)] pt-4 text-xs">
        <Link to="/app/settings#github" className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]">
          + Connect GitHub to link a repository
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-[var(--dt-border)] pt-4 text-xs">
      {repository ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href={repository.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-[var(--dt-text-primary)] hover:text-[var(--dt-accent-soft)]">
              {repository.fullName} ↗
            </a>
            <span className="text-[var(--dt-text-muted)]">
              {repository.lastCommitAt ? `Last commit ${formatDay(repository.lastCommitAt)}` : repository.syncedAt ? "No commits by you yet" : "Waiting for first sync"}
            </span>
            <div className="ml-auto flex gap-3">
              <button type="button" onClick={toggleCommits} aria-expanded={commits.open} className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)]">
                {commits.open ? "Hide commits" : "Commits"}
              </button>
              <button type="button" onClick={() => setConfirmUnlink(true)} className="text-[var(--dt-text-muted)] hover:text-red-300">Unlink</button>
            </div>
          </div>
          {commits.open ? (
            commits.loading ? <p className="mt-3 text-[var(--dt-text-muted)]">Loading commits...</p> : commits.items.length ? (
              <ul className="mt-3 space-y-2">
                {commits.items.map(commit => (
                  <li key={commit.sha} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-baseline gap-3">
                    <a href={commit.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-[var(--dt-text-muted)] hover:text-[var(--dt-accent-soft)]">{commit.shortSha}</a>
                    <span className="min-w-0 break-words text-[var(--dt-text-secondary)]">{commit.message}</span>
                    <span className="text-[11px] text-[var(--dt-text-muted)]">{formatDay(commit.committedAt)}</span>
                  </li>
                ))}
                <li><span className="dt-badge dt-badge-verified">Verified from GitHub</span></li>
              </ul>
            ) : <p className="mt-3 text-[var(--dt-text-muted)]">No commits by you have been synced yet.</p>
          ) : null}
        </>
      ) : picker.open ? (
        <form onSubmit={handleLink} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <RepoPicker
            id={`repo-${project._id}`}
            projectId={project._id}
            value={picker.choice}
            onChange={repo => setPicker(previous => ({ ...previous, choice: repo ? String(repo.id) : "" }))}
          />
          <button type="submit" className="dt-primary-button" disabled={busy || !picker.choice}>{busy ? "Linking..." : "Link"}</button>
          <button type="button" className="dt-link-button sm:py-3" onClick={() => setPicker(previous => ({ ...previous, open: false }))}>Cancel</button>
        </form>
      ) : (
        <button type="button" onClick={openPicker} className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]">
          + Link GitHub repository
        </button>
      )}
      {error ? <p role="alert" className="mt-2 text-red-300">{error}{/reconnect/i.test(error) ? <> <Link to="/app/settings#github" className="dt-link-button">Open Settings</Link></> : null}</p> : null}

      <ConfirmModal
        open={confirmUnlink}
        title="Unlink this repository?"
        confirmLabel="Unlink"
        busyLabel="Unlinking..."
        destructive
        busy={busy}
        onConfirm={handleUnlink}
        onCancel={() => setConfirmUnlink(false)}
      >
        Synced commits for this project are removed. You can link the repository again at any time.
      </ConfirmModal>
    </div>
  );
}

export default ProjectRepository;
