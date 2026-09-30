import { Link, useNavigate } from "react-router-dom";

const navigationItems = [
    {
        number: "01",
        label: "Overview",
        path: "/app/dashboard",
    },
    {
        number: "02",
        label: "Goals",
        path: "/app/goals",
    },
    {
        number: "03",
        label: "Projects",
        path: "/app/projects",
    },
    {
        number: "04",
        label: "Coding",
        path: "/app/coding",
    },
    {
        number: "05",
        label: "Journal",
        path: "/app/journal",
    },
    {
        number: "06",
        label: "Timeline",
        path: "/app/timeline",
    },
];

function Sidebar() {
    const navigate = useNavigate();

    async function handleLogout() {
        try {
            const response = await fetch(
                "http://localhost:5000/api/auth/logout",
                {
                    method: "POST",
                    credentials: "include",
                },
            );

            if (!response.ok) {
                throw new Error("Logout failed");
            }

            navigate("/login");
        } catch (error) {
            console.error("Logout Error:", error);
        }
    }

    return (
        <aside className="flex h-full flex-col border-r border-[var(--dt-border)] bg-[var(--dt-background)]/70 px-6 py-8 backdrop-blur-sm">

            {/* Brand */}
            <div>
                <Link
                    to="/app/dashboard"
                    className="font-[var(--dt-font-display)] text-2xl text-[var(--dt-text-primary)]"
                >
                    DevTrack
                </Link>

                <p className="mt-1 text-[9px] uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">
                    Developer Command Center
                </p>
            </div>

            {/* Navigation */}
            <nav className="mt-14">
                <p className="mb-5 text-[9px] font-medium uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">
                    Navigate
                </p>

                <ul className="space-y-1">
                    {navigationItems.map((item) => (
                        <li key={item.path}>
                            <Link
                                to={item.path}
                                className="group flex items-center gap-4 py-2 text-sm text-[var(--dt-text-secondary)] transition-colors duration-200 hover:text-[var(--dt-text-primary)]"
                            >
                                <span className="w-5 font-mono text-[9px] tracking-[0.15em] text-[var(--dt-text-muted)] transition-colors duration-200 group-hover:text-[var(--dt-accent-soft)]">
                                    {item.number}
                                </span>

                                <span>
                                    {item.label}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Bottom */}
            <div className="mt-auto border-t border-[var(--dt-border)] pt-5">
                <button
                    type="button"
                    onClick={handleLogout}
                    className="text-xs uppercase tracking-[0.2em] text-[var(--dt-text-muted)] transition-colors duration-200 hover:text-[var(--dt-text-primary)]"
                >
                    Logout
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;