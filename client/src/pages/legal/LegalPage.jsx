import { useEffect } from "react";
import { Link } from "react-router-dom";
import { EFFECTIVE_DATE, OPERATOR } from "./operator";

// Shared layout for /privacy and /terms: readable measure, numbered sections, links to each other.
export default function LegalPage({ eyebrow, title, intro, sections, otherPage }) {
  useEffect(() => {
    document.title = `${title} · DevTrack`;
    return () => {
      document.title = "DevTrack";
    };
  }, [title]);

  return (
    <main className="min-h-screen bg-[var(--dt-background)] px-6 py-16">
      <article className="mx-auto w-full max-w-2xl">
        <Link to="/" className="font-[family-name:var(--dt-font-display)] text-2xl tracking-tight text-[var(--dt-text-primary)]">
          DevTrack
        </Link>
        <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.35em] text-[var(--dt-text-muted)]">{eyebrow}</p>
        <h1 className="mt-4 font-[family-name:var(--dt-font-display)] text-4xl leading-tight tracking-tight text-[var(--dt-text-primary)]">
          {title}
        </h1>
        <p className="mt-3 text-sm text-[var(--dt-text-muted)]">Effective {EFFECTIVE_DATE}</p>
        <p className="mt-6 text-sm leading-7 text-[var(--dt-text-secondary)]">{intro}</p>

        <nav aria-label="Sections" className="mt-8 border-y border-[var(--dt-border)] py-4">
          <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]">
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((section, index) => (
          <section key={section.id} id={section.id} className="mt-10 scroll-mt-8">
            <h2 className="text-lg font-semibold text-[var(--dt-text-primary)]">
              {index + 1}. {section.title}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--dt-text-secondary)] [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5 [&_strong]:text-[var(--dt-text-primary)]">
              {section.body}
            </div>
          </section>
        ))}

        <footer className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--dt-border)] pt-6 text-sm">
          <Link to={otherPage.to} className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]">
            {otherPage.label}
          </Link>
          <Link to="/" className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]">
            Home
          </Link>
          <a href={`mailto:${OPERATOR.email}`} className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]">
            {OPERATOR.email}
          </a>
        </footer>
      </article>
    </main>
  );
}
