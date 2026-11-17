import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/common/PageHeader";
import Pagination from "../components/common/Pagination";
import StateMessage from "../components/common/StateMessage";
import ConfirmModal from "../components/common/ConfirmModal";
import JournalEditor from "../components/journal/JournalEditor";
import { ENTRY_TYPES } from "../components/journal/journalTypes";
import JournalEntryCard from "../components/journal/JournalEntryCard";
import { getJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry } from "../services/journalService";
import { getGoals } from "../services/goalService";
import { getProjects } from "../services/projectService";

const PAGE_SIZE = 10;

function Journal() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: "" });

  const [goals, setGoals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [editor, setEditor] = useState(null); // null | { entry?: object }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const params = useMemo(() => ({ q: query, type, tag, page, limit: PAGE_SIZE }), [query, type, tag, page]);
  const requestKey = `${JSON.stringify(params)}#${reloadToken}`;
  const loading = result.key !== requestKey;

  // Debounce typing so search does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    getJournalEntries(params)
      .then(data => active && setResult({ key: requestKey, data, error: "" }))
      .catch(error => active && setResult(previous => ({ key: requestKey, data: previous.data, error: error.message })));
    return () => {
      active = false;
    };
  }, [params, requestKey]);

  // Link options load once; failures only hide the pickers' options.
  useEffect(() => {
    let active = true;
    Promise.allSettled([getGoals(), getProjects()]).then(([goalResult, projectResult]) => {
      if (!active) return;
      if (goalResult.status === "fulfilled") setGoals(goalResult.value.goals || []);
      if (projectResult.status === "fulfilled") setProjects(projectResult.value.data?.projects || []);
    });
    return () => {
      active = false;
    };
  }, []);

  const data = result.data;
  const filtered = Boolean(query || type || tag);

  function reload() {
    setReloadToken(value => value + 1);
  }

  function openEditor(entry) {
    setSaveError("");
    setEditor({ entry });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(payload) {
    setSaving(true);
    setSaveError("");
    try {
      if (editor.entry) await updateJournalEntry(editor.entry._id, payload);
      else await createJournalEntry(payload);
      setEditor(null);
      if (!editor.entry) setPage(1);
      reload();
    } catch (error) {
      const fieldErrors = error.response?.data?.errors;
      setSaveError(fieldErrors ? Object.values(fieldErrors).join(" ") : error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      await deleteJournalEntry(deleting._id);
      setDeleting(null);
      if (data?.items.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (error) {
      setResult(previous => ({ ...previous, error: error.message }));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setQuery("");
    setType("");
    setTag("");
    setPage(1);
  }

  return (
    <section>
      <PageHeader
        eyebrow="05 — Journal"
        title="What you learned, kept."
        description="Capture concepts, debugging lessons, decisions, and reflections, so they don't disappear into chat history and browser tabs."
      >
        {!editor ? <button type="button" className="dt-primary-button" onClick={() => openEditor(undefined)}>+ New entry</button> : null}
      </PageHeader>

      {editor ? (
        <div className="mb-6">
          <JournalEditor
            key={editor.entry?._id || "new"}
            entry={editor.entry}
            goals={goals}
            projects={projects}
            saving={saving}
            error={saveError}
            onSave={handleSave}
            onCancel={() => setEditor(null)}
          />
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 border-b border-[var(--dt-border)] pb-5 sm:flex-row sm:items-end">
        <label className="dt-label flex-1">
          Search
          <input className="dt-input" type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} placeholder="Search titles, notes, and tags" />
        </label>
        <label className="dt-label sm:w-48">
          Type
          <select className="dt-input" value={type} onChange={event => { setType(event.target.value); setPage(1); }}>
            <option value="">All types</option>
            {ENTRY_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {data?.tags?.length ? (
        <div className="mb-8 flex flex-wrap gap-2" aria-label="Filter by tag">
          {data.tags.map(item => (
            <button
              key={item}
              type="button"
              aria-pressed={tag === item}
              onClick={() => { setTag(tag === item ? "" : item); setPage(1); }}
              className={`dt-badge ${tag === item ? "border-[var(--dt-accent)] text-[var(--dt-accent-soft)]" : "hover:text-[var(--dt-text-secondary)]"}`}
            >
              #{item}
            </button>
          ))}
          {filtered ? <button type="button" className="dt-link-button ml-2" onClick={clearFilters}>Clear filters</button> : null}
        </div>
      ) : null}

      {result.error ? <div className="mb-6"><StateMessage tone="error" title="Could not load your journal" message={result.error} onRetry={reload} /></div> : null}

      {loading && !data ? <StateMessage tone="loading" title="Loading journal..." /> : null}

      {data && !data.items.length && !result.error ? (
        filtered ? (
          <StateMessage title="No entries match these filters" message="Try a different search or clear the filters." />
        ) : (
          <StateMessage title="Your journal is empty" message="Write down one thing you learned today. Small notes add up to a record of your growth." />
        )
      ) : null}

      {data?.items.length ? (
        <div id="journal-entries" className={`space-y-3 scroll-mt-6 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          {data.items.map(entry => (
            <JournalEntryCard key={entry._id} entry={entry} onEdit={openEditor} onDelete={setDeleting} onTagClick={item => { setTag(item); setPage(1); }} />
          ))}
        </div>
      ) : null}

      {data ? (
        <div className={loading ? "pointer-events-none opacity-60" : ""}>
          <Pagination page={data.page} pageCount={data.pages} onChange={setPage} label="Journal pages" scrollTargetId="journal-entries" total={data.total} pageSize={PAGE_SIZE} />
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(deleting)}
        eyebrow="Destructive action"
        title="Delete this entry?"
        confirmLabel="Delete entry"
        busyLabel="Deleting..."
        destructive
        busy={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      >
        <p className="border-l-2 border-[var(--dt-border-strong)] pl-4 text-[var(--dt-text-primary)]">{deleting?.title}</p>
        <p className="mt-4 text-xs text-[var(--dt-text-muted)]">This cannot be undone.</p>
      </ConfirmModal>
    </section>
  );
}

export default Journal;
