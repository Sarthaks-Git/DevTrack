import { Link, NavLink, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../context/authContextObject";
import NotificationBell from "./common/NotificationBell";

const navigationItems = [
  { number: "01", label: "Overview", path: "/app/dashboard" },
  { number: "02", label: "Goals", path: "/app/goals" },
  { number: "03", label: "Projects", path: "/app/projects" },
  { number: "04", label: "Coding", path: "/app/coding" },
  { number: "05", label: "Journal", path: "/app/journal" },
  { number: "06", label: "Timeline", path: "/app/timeline" },
  { number: "07", label: "Settings", path: "/app/settings" },
];

function Sidebar({ unread = 0, onNavigate }) {
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    // logout() clears local state even if the request fails, so always leave the app.
    await logout().catch(() => {});
    navigate("/login", { replace: true, viewTransition: true });
  }

  return (
    <div className="flex h-full flex-col border-r border-[var(--dt-border)] bg-[var(--dt-background)]/90 px-6 py-8 backdrop-blur-sm">
      <div>
        <Link to="/app/dashboard" viewTransition onClick={onNavigate} className="font-[family-name:var(--dt-font-display)] text-2xl text-[var(--dt-text-primary)]">
          DevTrack
        </Link>
        <p className="mt-1 text-[9px] uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">Developer Command Center</p>
      </div>

      <nav className="mt-14" aria-label="Main">
        <p className="mb-5 text-[9px] font-medium uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">Navigate</p>
        <ul className="space-y-1">
          {navigationItems.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                viewTransition
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex items-center gap-4 py-2 text-sm transition-colors duration-200 ${isActive ? "text-[var(--dt-text-primary)]" : "text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)]"}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`w-5 font-mono text-[9px] tracking-[0.15em] transition-colors duration-200 ${isActive ? "text-[var(--dt-accent-soft)]" : "text-[var(--dt-text-muted)] group-hover:text-[var(--dt-accent-soft)]"}`}>
                      {item.number}
                    </span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto border-t border-[var(--dt-border)] pt-5">
        <NotificationBell unread={unread} onNavigate={onNavigate} className="mb-4" />
        {user ? <p className="mb-3 truncate text-xs text-[var(--dt-text-muted)]">@{user.username}</p> : null}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-xs uppercase tracking-[0.2em] text-[var(--dt-text-muted)] transition-colors duration-200 hover:text-[var(--dt-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
