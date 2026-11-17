import { ACTIVITY_META, activityLabel } from "./activityMeta";

function ActivityItem({ item, compact = false }) {
  const verified = item.source === "verified";
  return (
    <li className="flex gap-4 py-3">
      <span aria-hidden="true" className={`mt-0.5 w-5 shrink-0 text-center font-mono text-sm ${verified ? "text-emerald-300" : "text-[var(--dt-accent-soft)]"}`}>
        {ACTIVITY_META[item.type]?.marker || "•"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
          {activityLabel(item.type)}
          {verified ? <span className="dt-badge dt-badge-verified ml-3 align-middle">Verified</span> : null}
        </p>
        <p className={`mt-1 break-words text-[var(--dt-text-primary)] ${compact ? "text-sm" : "text-base"}`}>{item.title}</p>
        {item.detail && !compact ? <p className="mt-1 text-xs text-[var(--dt-text-secondary)]">{item.detail}</p> : null}
      </div>
      <time dateTime={item.occurredAt} className="shrink-0 text-xs text-[var(--dt-text-muted)]">
        {new Date(item.occurredAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </time>
    </li>
  );
}

export default ActivityItem;
