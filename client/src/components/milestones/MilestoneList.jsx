import { useId, useState } from "react";
import { formatMilestoneDue, isMilestoneOverdue } from "../../utils/milestoneUtils";

// Checklist shared by goal and project cards. Parent handlers call the API and store the
// updated parent. Toggling and removing are optimistic: the change shows at once and is
// rolled back with a message if the server rejects it.
function MilestoneList({ milestones: serverMilestones = [], onAdd, onUpdate, onRemove }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  // Optimistic overrides by milestone id: { done } for a toggle, { removed: true } for a delete.
  const [optimistic, setOptimistic] = useState({});
  const panelId = useId();

  const milestones = serverMilestones
    .filter((item) => !optimistic[item._id]?.removed)
    .map((item) => (item._id in optimistic ? { ...item, ...optimistic[item._id] } : item));

  const doneCount = milestones.filter((item) => item.done).length;
  const total = milestones.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;

  async function run(key, action) {
    setBusy(key);
    setError("");
    try {
      await action();
      return true;
    } catch (err) {
      setError(err.message || "Could not update milestones.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function optimisticChange(item, override, action, failure) {
    setError("");
    setOptimistic((current) => ({ ...current, [item._id]: override }));
    try {
      await action();
    } catch (err) {
      setError(`${failure} ${err.message || ""}`.trim());
    } finally {
      // On success the parent now holds the server's version; on failure this restores the old one.
      setOptimistic((current) => {
        const next = { ...current };
        delete next[item._id];
        return next;
      });
    }
  }

  const toggle = (item) =>
    optimisticChange(item, { done: !item.done }, () => onUpdate(item._id, { done: !item.done }), `Couldn't save "${item.title}", so it was undone.`);

  const remove = (item) =>
    optimisticChange(item, { removed: true }, () => onRemove(item._id), `Couldn't remove "${item.title}", so it was restored.`);

  async function handleAdd(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const ok = await run("add", () => onAdd({ title: trimmed, ...(dueDate ? { dueDate } : {}) }));
    if (ok) {
      setTitle("");
      setDueDate("");
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-muted)] transition-colors hover:text-[var(--dt-text-primary)]"
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span>Milestones</span>
        <span className="text-[var(--dt-text-secondary)]">
          {total ? `${doneCount}/${total}` : "none yet"}
        </span>
        {total > 0 && (
          <span className="ml-1 h-px flex-1 bg-[var(--dt-border)]" aria-hidden="true">
            <span className="block h-px bg-[var(--dt-accent-soft)]" style={{ width: `${percent}%` }} />
          </span>
        )}
      </button>

      {open && (
        <div id={panelId} className="mt-4">
          {total > 0 && (
            <ul className="space-y-1">
              {milestones.map((item) => {
                const overdue = isMilestoneOverdue(item);
                // A second click on the same item waits for the first request to settle.
                const pending = item._id in optimistic;
                return (
                  <li key={item._id} className="group/ms flex items-center gap-3 py-1">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.done}
                      aria-label={`Mark "${item.title}" as ${item.done ? "not done" : "done"}`}
                      disabled={pending}
                      onClick={() => toggle(item)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[11px] transition-colors ${
                        item.done
                          ? "border-[var(--dt-accent)] bg-[var(--dt-accent)] text-white"
                          : "border-[var(--dt-border-strong)] hover:border-[var(--dt-accent-soft)]"
                      }`}
                    >
                      {item.done ? "✓" : ""}
                    </button>
                    <span
                      className={`min-w-0 flex-1 break-words text-sm ${
                        item.done ? "text-[var(--dt-text-muted)] line-through" : "text-[var(--dt-text-secondary)]"
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.dueDate && (
                      <span className={`shrink-0 text-[11px] uppercase tracking-[0.12em] ${overdue ? "text-red-300" : "text-[var(--dt-text-muted)]"}`}>
                        {overdue ? "Overdue · " : ""}
                        {formatMilestoneDue(item.dueDate)}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove milestone "${item.title}"`}
                      disabled={pending}
                      onClick={() => remove(item)}
                      className="shrink-0 px-1 text-xs text-[var(--dt-text-muted)] transition-opacity hover:text-red-300 md:opacity-0 md:group-hover/ms:opacity-100 md:focus:opacity-100"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="Add a milestone"
              aria-label="New milestone title"
              className="min-w-0 flex-1 basis-40 border-b border-[var(--dt-border)] bg-transparent py-1.5 text-sm text-[var(--dt-text-primary)] outline-none placeholder:text-[var(--dt-text-muted)] focus:border-[var(--dt-accent)]"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              aria-label="Milestone due date (optional)"
              className="border-b border-[var(--dt-border)] bg-transparent py-1.5 text-xs text-[var(--dt-text-secondary)] outline-none focus:border-[var(--dt-accent)]"
            />
            <button
              type="submit"
              disabled={busy === "add" || !title.trim()}
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)] disabled:opacity-40"
            >
              {busy === "add" ? "Adding…" : "+ Add"}
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-2 text-xs text-red-300">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default MilestoneList;
