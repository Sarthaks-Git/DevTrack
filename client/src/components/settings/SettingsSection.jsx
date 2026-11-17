function SettingsSection({ id, number, label, title, description, children, tone }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-[var(--dt-border)] py-10 first:pt-0" aria-labelledby={`settings-${number}`}>
      <div className="mb-6">
        <p className={`text-[10px] uppercase tracking-[0.2em] ${tone === "danger" ? "text-red-400/80" : "text-[var(--dt-text-muted)]"}`}>
          {number} / {label}
        </p>
        <h2 id={`settings-${number}`} className="mt-2 text-xl text-[var(--dt-text-primary)]">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--dt-text-secondary)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Notice({ kind, children }) {
  if (!children) return null;
  return kind === "error" ? (
    <p role="alert" className="mt-4 border-l-2 border-red-400 py-1 pl-3 text-sm text-red-300">{children}</p>
  ) : (
    <p role="status" className="mt-4 border-l-2 border-[var(--dt-accent-soft)] py-1 pl-3 text-sm text-[var(--dt-text-secondary)]">{children}</p>
  );
}

export default SettingsSection;
