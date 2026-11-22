import { useEffect, useState } from "react";
import { listGitHubRepos } from "../../services/githubService";

const SEARCH_THRESHOLD = 6;

// Lists the GitHub repositories DevTrack can read, minus ones already linked to another project.
// Shows a search box when the list is long. `value` is the repo id as a string ("" = none).
function RepoPicker({ id, projectId, value, onChange, allowNone = false }) {
  const [state, setState] = useState({ loading: true, repos: [], installUrl: "", error: "" });
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    listGitHubRepos()
      .then(({ repos, installUrl }) => {
        if (!active) return;
        const available = repos.filter(repo => !repo.linkedProject || (projectId && repo.linkedProject.id === projectId));
        setState({ loading: false, repos: available, installUrl, error: "" });
        if (!allowNone && !value && available[0]) onChange(available[0]);
      })
      .catch(failure => active && setState({ loading: false, repos: [], installUrl: "", error: failure.message }));
    return () => {
      active = false;
    };
    // Load once per mount; value/onChange only seed the first choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (state.loading) return <p className="text-xs text-[var(--dt-text-muted)]">Loading your repositories...</p>;
  if (state.error) return <p role="alert" className="text-xs text-red-300">{state.error}</p>;
  if (!state.repos.length) {
    return (
      <p className="text-xs text-[var(--dt-text-secondary)]">
        No repositories available.{" "}
        {state.installUrl ? <a href={state.installUrl} target="_blank" rel="noopener noreferrer" className="dt-link-button">Choose repositories on GitHub ↗</a> : null}
      </p>
    );
  }

  const needle = query.trim().toLowerCase();
  const shown = needle ? state.repos.filter(repo => repo.fullName.toLowerCase().includes(needle)) : state.repos;
  const selected = state.repos.find(repo => String(repo.id) === value);
  // Keep the current choice visible in the list even when the search hides it.
  const options = selected && !shown.includes(selected) ? [selected, ...shown] : shown;

  function choose(repoId) {
    onChange(state.repos.find(repo => String(repo.id) === repoId) || null);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {state.repos.length > SEARCH_THRESHOLD ? (
        <>
          <label className="sr-only" htmlFor={`${id}-search`}>Search repositories</label>
          <input
            id={`${id}-search`}
            type="search"
            className="dt-input mt-0"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={`Search ${state.repos.length} repositories`}
          />
        </>
      ) : null}
      <label className="sr-only" htmlFor={id}>Repository</label>
      <select id={id} className="dt-input mt-0 min-w-0" value={value} onChange={event => choose(event.target.value)}>
        {allowNone ? <option value="">Don't link a repository</option> : null}
        {options.map(repo => <option key={repo.id} value={String(repo.id)}>{repo.fullName}{repo.private ? " (private)" : ""}</option>)}
      </select>
      {needle && !shown.length ? <p className="text-xs text-[var(--dt-text-muted)]">No repositories match "{query.trim()}".</p> : null}
    </div>
  );
}

export default RepoPicker;
