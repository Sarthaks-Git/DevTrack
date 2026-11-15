import { useState } from "react";
import { ENTRY_TYPES } from "./journalTypes";

const typeLabel = value => ENTRY_TYPES.find(type => type.value === value)?.label || "Note";
const PREVIEW_LENGTH = 280;

function JournalEntryCard({ entry, onEdit, onDelete, onTagClick }) {
  const [expanded, setExpanded] = useState(false);
  const long = entry.content.length > PREVIEW_LENGTH;
  const body = expanded || !long ? entry.content : `${entry.content.slice(0, PREVIEW_LENGTH).trimEnd()}…`;

  return (
    <article className="dt-card">
      <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
        <time dateTime={entry.entryDate}>{new Date(entry.entryDate).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" })}</time>
        <span aria-hidden="true">·</span>
        <span>{typeLabel(entry.type)}</span>
        {entry.pinned ? <span className="text-[var(--dt-accent-soft)]">Pinned</span> : null}
      </div>
      <h3 className="mt-3 text-lg text-[var(--dt-text-primary)]">{entry.title}</h3>
      {/* Rendered as text, never as HTML, so stored content cannot inject markup. */}
      {entry.content ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--dt-text-secondary)]">{body}</p> : null}
      {long ? (
        <button type="button" className="dt-link-button mt-2" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
      {entry.goal || entry.project ? (
        <p className="mt-4 text-xs text-[var(--dt-text-muted)]">
          {entry.goal ? <>Goal: <span className="text-[var(--dt-text-secondary)]">{entry.goal.title}</span></> : null}
          {entry.goal && entry.project ? " · " : null}
          {entry.project ? <>Project: <span className="text-[var(--dt-text-secondary)]">{entry.project.title}</span></> : null}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {entry.tags.map(tag => (
            <button key={tag} type="button" onClick={() => onTagClick(tag)} className="dt-badge hover:text-[var(--dt-accent-soft)]">
              #{tag}
            </button>
          ))}
        </div>
        <div className="flex gap-4">
          <button type="button" className="dt-link-button" onClick={() => onEdit(entry)}>Edit</button>
          <button type="button" className="dt-link-button hover:!text-red-300" onClick={() => onDelete(entry)}>Delete</button>
        </div>
      </div>
    </article>
  );
}

export default JournalEntryCard;
