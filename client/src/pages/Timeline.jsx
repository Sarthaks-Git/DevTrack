import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/common/PageHeader";
import StateMessage from "../components/common/StateMessage";
import CursorPager from "../components/common/CursorPager";
import ActivityItem from "../components/activity/ActivityItem";
import TimelinePrint from "../components/activity/TimelinePrint";
import { AuthContext } from "../context/authContextObject";
import { ACTIVITY_FILTERS } from "../components/activity/activityMeta";
import { getActivity } from "../services/activityService";
import { getGitHubStatus, syncGitHub } from "../services/githubService";

const PAGE_SIZE = 20;
// The PDF holds at most this many events (the newest), fetched 50 at a time.
const EXPORT_MAX = 1000;
const EXPORT_PAGE = 50;

function dayHeading(date) {
  const day = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return "Today";
  if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
  return day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: day.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function groupByDay(items) {
  const groups = [];
  for (const item of items) {
    const heading = dayHeading(item.occurredAt);
    const last = groups[groups.length - 1];
    if (last?.heading === heading) last.items.push(item);
    else groups.push({ heading, items: [item] });
  }
  return groups;
}

function Timeline() {
  const [type, setType] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({ key: null, items: [], nextCursor: null, error: "" });
  const [loadingMore, setLoadingMore] = useState(false);
  // The cursor that loads each visited page (page 0 needs none), so "Newer" can go back.
  const [pages, setPages] = useState({ index: 0, cursors: [null] });
  const { user } = useContext(AuthContext) || {};
  const [exporting, setExporting] = useState(false);
  const [printable, setPrintable] = useState(null);
  const [exportError, setExportError] = useState("");
  const donePrinting = useCallback(() => setPrintable(null), []);

  // Loads every event for the current filter (newest first, capped), then opens the print dialog.
  async function downloadPdf() {
    setExporting(true);
    setExportError("");
    try {
      const items = [];
      let cursor;
      do {
        const data = await getActivity({ type, limit: EXPORT_PAGE, before: cursor });
        items.push(...data.items);
        cursor = data.nextCursor;
      } while (cursor && items.length < EXPORT_MAX);
      const filterLabel = ACTIVITY_FILTERS.find(filter => filter.value === type)?.label || "All events";
      setPrintable({ items: items.slice(0, EXPORT_MAX), truncated: Boolean(cursor) || items.length > EXPORT_MAX, filterLabel });
    } catch (error) {
      setExportError(error.message);
    } finally {
      setExporting(false);
    }
  }

  const requestKey = `${type}#${reloadToken}`;
  const loading = state.key !== requestKey;

  useEffect(() => {
    let active = true;
    getActivity({ type, limit: PAGE_SIZE })
      .then(data => {
        if (!active) return;
        setState({ key: requestKey, items: data.items, nextCursor: data.nextCursor, error: "" });
        setPages({ index: 0, cursors: [null] });
      })
      .catch(error => active && setState({ key: requestKey, items: [], nextCursor: null, error: error.message }));
    return () => {
      active = false;
    };
  }, [type, requestKey]);

  // When GitHub is connected, pull new commits (server-throttled) and reload if any arrived.
  useEffect(() => {
    let active = true;
    getGitHubStatus()
      .then(async status => {
        if (!active || status.connection?.status !== "connected") return;
        const result = await syncGitHub();
        if (active && result.newCommits > 0) setReloadToken(token => token + 1);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function showPage(index, cursors) {
    setLoadingMore(true);
    try {
      const data = await getActivity({ type, limit: PAGE_SIZE, before: cursors[index] || undefined });
      setState(previous => ({ ...previous, items: data.items, nextCursor: data.nextCursor, error: "" }));
      setPages({ index, cursors });
      document.getElementById("timeline-feed")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setState(previous => ({ ...previous, error: error.message }));
    } finally {
      setLoadingMore(false);
    }
  }

  const groups = useMemo(() => groupByDay(state.items), [state.items]);

  return (
    <section>
      <PageHeader
        eyebrow="06 — Timeline"
        title="The story so far."
        description="Every goal set and finished, project shipped, note written, and verified coding milestone, in order."
      />

      {/* The feed reads best as a narrower column; the header stays full width like every page. */}
      <div className="max-w-4xl">
      <div id="timeline-feed" className="mb-5 flex scroll-mt-6 flex-wrap gap-2" role="group" aria-label="Filter timeline">
        {ACTIVITY_FILTERS.map(filter => (
          <button
            key={filter.value || "all"}
            type="button"
            aria-pressed={type === filter.value}
            onClick={() => setType(filter.value)}
            className={`dt-badge px-3 py-1 ${type === filter.value ? "border-[var(--dt-accent)] text-[var(--dt-accent-soft)]" : "hover:text-[var(--dt-text-secondary)]"}`}
          >
            {filter.label}
          </button>
        ))}
        <button
          type="button"
          onClick={downloadPdf}
          disabled={exporting || loading || !state.items.length}
          className="dt-badge ml-auto px-3 py-1 hover:text-[var(--dt-text-secondary)] disabled:opacity-40"
          title="Opens the print dialog: choose Save as PDF"
        >
          {exporting ? "Preparing..." : "Download PDF"}
        </button>
      </div>
      {exportError ? <p role="alert" className="mb-4 text-sm text-red-300">Could not prepare the PDF: {exportError}</p> : null}
      {printable ? (
        <TimelinePrint
          items={printable.items}
          filterLabel={printable.filterLabel}
          truncated={printable.truncated}
          ownerName={user?.displayName || user?.username || ""}
          onDone={donePrinting}
        />
      ) : null}

      {loading ? <StateMessage tone="loading" title="Loading timeline..." /> : null}
      {!loading && state.error ? <StateMessage tone="error" title="Could not load your timeline" message={state.error} onRetry={() => setReloadToken(value => value + 1)} /> : null}
      {!loading && !state.error && !state.items.length ? (
        type ? (
          <StateMessage title="Nothing here yet" message="No events of this kind so far." />
        ) : (
          <StateMessage title="Your timeline starts now" message="Set a goal, start a project, or write a journal entry. Each step shows up here." action={{ to: "/app/goals", label: "Set a goal" }} />
        )
      ) : null}

      {!loading && groups.length ? (
        <div className={`space-y-6 ${loadingMore ? "opacity-60" : ""}`}>
          {groups.map(group => (
            <section key={group.heading} aria-label={group.heading}>
              <h2 className="sticky top-0 z-10 bg-[var(--dt-background)]/90 py-2 text-xs font-medium uppercase tracking-[0.25em] text-[var(--dt-text-muted)] backdrop-blur-sm">
                {group.heading}
              </h2>
              <ol className="divide-y divide-[var(--dt-border)] border-l border-[var(--dt-border)] pl-4">
                {group.items.map(item => <ActivityItem key={item._id} item={item} />)}
              </ol>
            </section>
          ))}
        </div>
      ) : null}

      {!loading ? (
        <CursorPager
          label="Timeline pages"
          pageIndex={pages.index}
          hasOlder={Boolean(state.nextCursor)}
          busy={loadingMore}
          onNewer={() => showPage(pages.index - 1, pages.cursors)}
          onOlder={() => showPage(pages.index + 1, [...pages.cursors.slice(0, pages.index + 1), state.nextCursor])}
        />
      ) : null}
      </div>
    </section>
  );
}

export default Timeline;
