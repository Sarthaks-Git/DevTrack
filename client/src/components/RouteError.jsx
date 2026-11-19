import { useRouteError } from "react-router-dom";

// Shown when a page crashes or fails to load. Never shows the error itself: its message can name
// internal code. After a new deploy, an open tab may ask for page files that no longer exist;
// reloading fetches the current version.
export default function RouteError() {
  const error = useRouteError();
  const staleBuild = /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(String(error?.message || ""));

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--dt-background)] px-6">
      <section className="max-w-md text-center" role="alert">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">{staleBuild ? "Update" : "Error"}</p>
        <h1 className="mt-4 font-[family-name:var(--dt-font-display)] text-4xl text-[var(--dt-text-primary)]">
          {staleBuild ? "DevTrack was updated" : "Something went wrong"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--dt-text-secondary)]">
          {staleBuild ? "Reload to get the latest version." : "This page hit a problem. Reloading usually fixes it; your data is safe."}
        </p>
        <div className="mt-8 flex justify-center gap-6">
          <button type="button" className="dt-link-button" onClick={() => window.location.reload()}>Reload</button>
          <a href="/" className="dt-link-button">Back to DevTrack</a>
        </div>
      </section>
    </main>
  );
}
