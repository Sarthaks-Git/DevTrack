// A slice of the real app: same page header, tokens and components, frozen with sample data.
// `inert` keeps the app's buttons out of the tab order and away from the pointer.
export default function AppFrame({ eyebrow, title, children, className = "" }) {
  return (
    <div className={`lp-app ${className}`} inert>
      <div className="lp-app-chrome">
        <span /><span /><span />
      </div>
      <div className="lp-app-body">
        {eyebrow ? (
          <header className="mb-5">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-[var(--dt-text-muted)]">{eyebrow}</p>
            {title ? (
              <p className="mt-2 font-[family-name:var(--dt-font-display)] text-2xl leading-tight tracking-tight text-[var(--dt-text-primary)]">{title}</p>
            ) : null}
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}
