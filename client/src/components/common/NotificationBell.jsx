import { NavLink } from "react-router-dom";

// Link to the notifications page with an unread badge. The count is owned by AppLayout.
function NotificationBell({ unread, onNavigate, className = "" }) {
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <NavLink
      to="/app/notifications"
      viewTransition
      onClick={onNavigate}
      aria-label={label}
      className={({ isActive }) =>
        `relative inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] transition-colors duration-200 ${isActive ? "text-[var(--dt-text-primary)]" : "text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]"} ${className}`
      }
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      <span>Alerts</span>
      {unread > 0 ? (
        <span className="min-w-5 rounded-full bg-[var(--dt-accent)] px-1.5 py-0.5 text-center font-mono text-[9px] leading-none tracking-normal text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </NavLink>
  );
}

export default NotificationBell;
