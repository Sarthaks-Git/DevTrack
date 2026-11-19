import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import AmbientBackground from "./ui/AmbientBackground";
import NotificationBell from "./common/NotificationBell";
import { useUnreadNotifications } from "./common/useUnreadNotifications";

function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { unread, refresh: refreshUnread } = useUnreadNotifications();

  // Move focus to the page on navigation so keyboard and screen-reader users land on new content.
  useEffect(() => {
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = event => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <AmbientBackground>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-[var(--dt-surface)] focus:px-4 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      <div className="relative min-h-screen">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--dt-border)] bg-[var(--dt-background)]/90 px-4 py-3 backdrop-blur-sm lg:hidden">
          <Link to="/" viewTransition className="font-[family-name:var(--dt-font-display)] text-xl text-[var(--dt-text-primary)]">DevTrack</Link>
          <div className="flex items-center gap-5">
            <NotificationBell unread={unread} />
            <button type="button" className="dt-link-button" aria-expanded={menuOpen} aria-controls="app-sidebar" onClick={() => setMenuOpen(true)}>
              Menu
            </button>
          </div>
        </div>

        {menuOpen ? <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" aria-hidden="true" onClick={() => setMenuOpen(false)} /> : null}

        <aside
          id="app-sidebar"
          className={`fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <Sidebar unread={unread} onNavigate={() => setMenuOpen(false)} />
        </aside>

        <main id="main-content" tabIndex={-1} className="min-h-screen overflow-x-clip outline-none lg:pl-64" style={{ viewTransitionName: "main-content" }}>
          {/* One container for every page: same width, gutters and top offset everywhere. */}
          <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 md:px-8 md:pt-6">
            <Outlet context={{ refreshUnread }} />
          </div>
        </main>
      </div>
    </AmbientBackground>
  );
}

export default AppLayout;
