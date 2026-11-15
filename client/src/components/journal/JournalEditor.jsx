import { useState } from "react";
import { ENTRY_TYPES } from "./journalTypes";


const today = () => new Date().toISOString().slice(0, 10);

function toForm(entry) {
  return {
    title: entry?.title || "",
    content: entry?.content || "",
    type: entry?.type || "note",
    tags: (entry?.tags || []).join(", "),
    goal: entry?.goal?._id || "",
    project: entry?.project?._id || "",
    pinned: Boolean(entry?.pinned),
    entryDate: entry?.entryDate ? entry.entryDate.slice(0, 10) : today(),
  };
}

function toPayload(form) {
  return {
    title: form.title.trim(),
    content: form.content,
    type: form.type,
    tags: form.tags.split(",").map(tag => tag.trim().toLowerCase()).filter(Boolean),
    goal: form.goal || null,
    project: form.project || null,
    pinned: form.pinned,
    entryDate: form.entryDate,
  };
}

function JournalEditor({ entry, goals, projects, saving, error, onSave, onCancel }) {
  const [form, setForm] = useState(() => toForm(entry));
  const set = field => event => setForm(previous => ({ ...previous, [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const tagCount = form.tags.split(",").filter(tag => tag.trim()).length;

  function handleSubmit(event) {
    event.preventDefault();
    onSave(toPayload(form));
  }

  return (
    <form onSubmit={handleSubmit} className="dt-card grid gap-5 md:grid-cols-2" aria-label={entry ? "Edit journal entry" : "New journal entry"}>
      <label className="dt-label md:col-span-2">
        Title
        <input className="dt-input" value={form.title} onChange={set("title")} maxLength={150} placeholder="What did you learn, decide, or figure out?" required autoFocus />
      </label>
      <label className="dt-label md:col-span-2">
        Notes
        <textarea className="dt-input min-h-40 resize-y leading-6" value={form.content} onChange={set("content")} maxLength={20000} placeholder="Context, what worked, what you would do differently..." />
        <span className="mt-1 block text-right text-[10px] text-[var(--dt-text-muted)]">{form.content.length.toLocaleString()} / 20,000</span>
      </label>
      <label className="dt-label">
        Type
        <select className="dt-input" value={form.type} onChange={set("type")}>
          {ENTRY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </label>
      <label className="dt-label">
        Date
        <input className="dt-input" type="date" value={form.entryDate} onChange={set("entryDate")} required />
      </label>
      <label className="dt-label md:col-span-2">
        Tags <span className="text-[var(--dt-text-muted)]">(comma separated, up to 10)</span>
        <input className="dt-input" value={form.tags} onChange={set("tags")} placeholder="react, debugging, interviews" aria-invalid={tagCount > 10} />
      </label>
      <label className="dt-label">
        Linked goal
        <select className="dt-input" value={form.goal} onChange={set("goal")}>
          <option value="">None</option>
          {goals.map(goal => <option key={goal._id} value={goal._id}>{goal.title}</option>)}
        </select>
      </label>
      <label className="dt-label">
        Linked project
        <select className="dt-input" value={form.project} onChange={set("project")}>
          <option value="">None</option>
          {projects.map(project => <option key={project._id} value={project._id}>{project.title}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-3 text-sm text-[var(--dt-text-secondary)] md:col-span-2">
        <input type="checkbox" checked={form.pinned} onChange={set("pinned")} className="h-4 w-4 accent-[var(--dt-accent)]" />
        Pin to the top of your journal
      </label>
      {error ? <p role="alert" className="text-sm text-red-300 md:col-span-2">{error}</p> : null}
      <div className="flex gap-4 md:col-span-2">
        <button type="submit" className="dt-primary-button" disabled={saving || !form.title.trim() || tagCount > 10}>
          {saving ? "Saving..." : entry ? "Save changes" : "Add entry"}
        </button>
        <button type="button" className="dt-link-button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}

export default JournalEditor;
