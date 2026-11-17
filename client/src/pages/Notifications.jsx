import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import PageHeader from "../components/common/PageHeader";
import StateMessage from "../components/common/StateMessage";
import CursorPager from "../components/common/CursorPager";
import { relativeTime } from "../components/activity/activityMeta";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationService";

const PAGE_SIZE = 20;

const TYPE_LABELS = {
  goal_overdue: "Overdue",
  project_overdue: "Overdue",
  milestone_overdue: "Milestone",
  due_soon: "Due soon",
  stalled: "Stalled",
  target_reached: "Verified win",
  weekly_review: "Weekly review",
  security_review: "Security check",
  code_review: "Code review",
};

function Notifications() {
  const navigate = useNavigate();
  const { refreshUnread } = useOutletContext() || {};
  const [state, setState] = useState({ status: "loading", items: [], nextCursor: null, error: "" });
  const [busy, setBusy] = useState(false);
  // The cursor that loads each visited page (page 0 needs none), so "Newer" can go back.
  const [pages, setPages] = useState({ index: 0, cursors: [null] });

  useEffect(() => {
    let active = true;
    getNotifications({ limit: PAGE_SIZE })
      .then((data) => {
        if (!active) return;
        setState({ status: "ready", items: data.items, nextCursor: data.nextCursor, error: "" });
        // Loading the list can generate new reminders, so sync the bell badge.
        refreshUnread?.();
      })
      .catch((error) => active && setState({ status: "error", items: [], nextCursor: null, error: error.message }));
    return () => {
      active = false;
    };
  }, [refreshUnread]);

  async function showPage(index, cursors) {
    setBusy(true);
    try {
      const data = await getNotifications({ limit: PAGE_SIZE, before: cursors[index] || undefined });
      setState((current) => ({ ...current, items: data.items, nextCursor: data.nextCursor, error: "" }));
      setPages({ index, cursors });
      document.getElementById("notification-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  }

  async function open(item) {
    if (!item.readAt) {
      const updated = await markNotificationRead(item._id).catch(() => null);
      if (updated) {
        setState((current) => ({ ...current, items: current.items.map((row) => (row._id === item._id ? updated : row)) }));
        refreshUnread?.();
      }
    }
    const destination = { goal: "/app/goals", project: "/app/projects", review: "/app/review?week=last" }[item.subjectType] || "/app/dashboard";
    navigate(destination, { viewTransition: true });
  }

  async function markAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setState((current) => ({ ...current, items: current.items.map((row) => ({ ...row, readAt: row.readAt || now })) }));
      refreshUnread?.();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  }

  const unread = state.items.filter((item) => !item.readAt).length;

  return (
    <section>
      <PageHeader
        eyebrow="08 — Alerts"
        title="What needs a nudge."
        description="Reminders built from your own goals, projects and verified progress. Tune them in Settings."
      >
        {unread > 0 ? (
          <button type="button" onClick={markAll} disabled={busy} className="dt-link-button self-start sm:self-auto">
            Mark all read
          </button>
        ) : null}
      </PageHeader>

      {state.status === "loading" ? <StateMessage tone="loading" title="Checking your goals and projects..." /> : null}
      {state.status === "error" ? <StateMessage tone="error" title="Couldn't load notifications" message={state.error} /> : null}
      {state.status === "ready" && state.items.length === 0 ? (
        <StateMessage title="You're all caught up" message="Nothing is overdue or stalled. Reminders show up here when something needs you." action={{ to: "/app/settings", label: "Reminder settings" }} />
      ) : null}

      {state.items.length > 0 ? (
        <ul id="notification-list" className={`scroll-mt-6 divide-y divide-[var(--dt-border)] border-y border-[var(--dt-border)] ${busy ? "opacity-60" : ""}`}>
          {state.items.map((item) => (
            <li key={item._id}>
              <button
                type="button"
                onClick={() => open(item)}
                className="grid w-full gap-1.5 py-3 text-left transition-colors hover:bg-[var(--dt-surface)] sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-start sm:gap-6 sm:px-3"
              >
                <span className={`text-[11px] uppercase tracking-[0.16em] ${item.type === "target_reached" ? "text-emerald-300" : item.type.includes("overdue") ? "text-red-300" : "text-[var(--dt-text-secondary)]"}`}>
                  {TYPE_LABELS[item.type] || "Reminder"}
                </span>
                <span className="min-w-0">
                  <span className={`block break-words text-sm ${item.readAt ? "text-[var(--dt-text-secondary)]" : "font-medium text-[var(--dt-text-primary)]"}`}>
                    {!item.readAt ? <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--dt-accent-soft)] align-middle" aria-label="Unread" /> : null}
                    {item.title}
                  </span>
                  {item.body ? <span className="mt-1 block text-xs leading-5 text-[var(--dt-text-muted)]">{item.body}</span> : null}
                </span>
                <span className="text-[11px] text-[var(--dt-text-muted)]">{relativeTime(item.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {state.status === "ready" ? (
        <CursorPager
          label="Notification pages"
          pageIndex={pages.index}
          hasOlder={Boolean(state.nextCursor)}
          busy={busy}
          onNewer={() => showPage(pages.index - 1, pages.cursors)}
          onOlder={() => showPage(pages.index + 1, [...pages.cursors.slice(0, pages.index + 1), state.nextCursor])}
        />
      ) : null}
    </section>
  );
}

export default Notifications;
