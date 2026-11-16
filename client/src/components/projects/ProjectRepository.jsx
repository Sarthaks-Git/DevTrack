import { useState } from "react";
import { Link } from "react-router-dom";
import ConfirmModal from "../common/ConfirmModal";
import { getProjectCommits, linkRepository, listGitHubRepos, unlinkRepository } from "../../services/githubService";

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}

// Linked GitHub repository on a project card: link/unlink, plus the latest verified commits.
function ProjectRepository({ project, githubConnected, onChange }) {
  const repository = project.repository;
  const [picker, setPicker] = useState({ open: false, loading: false, repos: [], installUrl: "", choice: "" });
  const [commits, setCommits] = useState({ open: false, loading: false, items: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  async function openPicker() {
    setError("");
    setPicker(previous => ({ ...previous, open: true, loading: true }));
    try {
      const { repos, installUrl } = await listGitHubRepos();
      const available = repos.filter(repo => !repo.linkedProject || repo.linkedProject.id === project._id);
      setPicker({ open: true, loading: false, repos: available, installUrl, choice: available[0] ? String(available[0].id) : "" });
    } catch (failure) {
      setError(failure.message);
      setPicker(previous => ({ ...previous, open: false, loading: false }));
    }
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

  if (!repository && !githubConnected) return null;

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
                    <a href={commit.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-[var(--dt-text-muted)] hover:text-[var(--dt-accent-soft)]">{commit.shortSha}</a>
                    <span className="min-w-0 break-words text-[var(--dt-text-secondary)]">{commit.message}</span>
                    <span className="text-[10px] text-[var(--dt-text-muted)]">{formatDay(commit.committedAt)}</span>
                  </li>
                ))}
                <li><span className="dt-badge dt-badge-verified">Verified from GitHub</span></li>
              </ul>
            ) : <p className="mt-3 text-[var(--dt-text-muted)]">No commits by you have been synced yet.</p>
          ) : null}
        </>
      ) : picker.open ? (
        picker.loading ? <p className="text-[var(--dt-text-muted)]">Loading your repositories...</p> : picker.repos.length ? (
          <form onSubmit={handleLink} className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor={`repo-${project._id}`}>Repository</label>
            <select id={`repo-${project._id}`} className="dt-input mt-0 min-w-0 flex-1" value={picker.choice} onChange={event => setPicker(previous => ({ ...previous, choice: event.target.value }))}>
              {picker.repos.map(repo => <option key={repo.id} value={repo.id}>{repo.fullName}{repo.private ? " (private)" : ""}</option>)}
            </select>
            <button type="submit" className="dt-primary-button" disabled={busy}>{busy ? "Linking..." : "Link"}</button>
            <button type="button" className="dt-link-button" onClick={() => setPicker(previous => ({ ...previous, open: false }))}>Cancel</button>
          </form>
        ) : (
          <p className="text-[var(--dt-text-secondary)]">
            No repositories available. <a href={picker.installUrl} target="_blank" rel="noopener noreferrer" className="dt-link-button">Choose repositories on GitHub ↗</a>
          </p>
        )
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
