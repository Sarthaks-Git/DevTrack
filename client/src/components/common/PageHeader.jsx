import { useNow } from "./useNow";

function LiveDateTime() {
  const now = useNow();
  const weekday = now.toLocaleDateString("en-IN", { weekday: "short" });
  const day = now.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const date = `${weekday}, ${day} ${now.getFullYear()}`;
  const time = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return (
    <time dateTime={now.toISOString()} className="text-[10px] tracking-[0.2em] text-[var(--dt-text-muted)]">
      {date} · {time}
    </time>
  );
}

// The one header every app page uses, so eyebrow, title and description sizes and spacing match.
function PageHeader({ eyebrow, title, description, children, below }) {
  return (
    <header className="mb-12 md:mb-14">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-[var(--dt-text-muted)]">{eyebrow}</p>
        <LiveDateTime />
      </div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h1 className="font-[family-name:var(--dt-font-display)] text-4xl leading-[1.05] tracking-tight text-[var(--dt-text-primary)] md:text-6xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-6 max-w-xl text-base leading-7 text-[var(--dt-text-secondary)]">{description}</p>
          ) : null}
        </div>
        {children ? <div className="flex shrink-0 items-center gap-3">{children}</div> : null}
      </div>
      {below}
    </header>
  );
}

export default PageHeader;
