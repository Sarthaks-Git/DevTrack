import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/authContextObject";

function Landing() {
    const { user, loading, isAuthenticated } = useContext(AuthContext);

    const getInitial = () => {
        if (user?.username) {
            return user.username.charAt(0).toUpperCase();
        }

        if (user?.email) {
            return user.email.charAt(0).toUpperCase();
        }

        return "U";
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-[var(--dt-background)]">
            {/* Ambient star field */}
            <div className="dt-stars" aria-hidden="true">
                <div className="dt-stars-layer dt-stars-far" />
                <div className="dt-stars-layer dt-stars-near" />
                <div className="dt-stars-layer dt-stars-glow" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col px-6 py-7 sm:px-10 lg:px-14">
                {/* Header */}
                <header className="flex items-center justify-between border-b border-[var(--dt-border)] pb-5">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-8 w-8 items-center justify-center border border-[var(--dt-border-strong)] text-sm font-semibold"
                            aria-hidden="true"
                        >
                            D
                        </div>

                        <span className="text-sm font-semibold tracking-[0.18em] text-[var(--dt-text-primary)]">
                            DEVTRACK
                        </span>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--dt-text-muted)] sm:block">
                            Developer Command Center
                        </div>

                        {/* Logged-in profile indicator */}
                        {!loading && isAuthenticated && (
                            <Link
                                to="/app/dashboard"
                                viewTransition
                                aria-label="Open DevTrack dashboard"
                                title={`Logged in as ${user?.username || user?.email || "user"}`}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--dt-border-strong)] text-xs font-semibold text-[var(--dt-text-primary)] transition-all duration-200 hover:border-[var(--dt-accent)] hover:text-[var(--dt-accent-soft)]"
                            >
                                {getInitial()}
                            </Link>
                        )}
                    </div>
                </header>

                {/* Hero */}
                <section className="flex flex-1 items-center py-20 sm:py-24 lg:py-28">
                    <div className="w-full">
                        <div className="mb-8 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--dt-accent-soft)]">
                            <span>00 — INTRODUCTION</span>
                            <span className="h-px w-12 bg-[var(--dt-border-strong)]" />
                        </div>

                        <div className="max-w-5xl">
                            <h1 className="font-[family-name:var(--dt-font-display)] text-[clamp(4rem,10vw,9rem)] leading-[0.88] tracking-[-0.045em] text-[var(--dt-text-primary)]">
                                Build.
                                <br />
                                <span className="text-[var(--dt-text-secondary)]">
                                    Track.
                                </span>
                                <br />
                                Evolve.
                            </h1>
                        </div>

                        <div className="mt-12 grid max-w-4xl gap-10 border-t border-[var(--dt-border)] pt-8 md:grid-cols-[1fr_1.2fr]">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
                                    Your development, documented.
                                </p>
                            </div>

                            <div>
                                <p className="max-w-xl text-base leading-8 text-[var(--dt-text-secondary)] sm:text-lg">
                                    DevTrack is your developer command center —
                                    connecting goals, projects, coding activity,
                                    notes, and progress into one evolving record
                                    of what you are building.
                                </p>

                                {/* Authentication-aware CTA */}
                                <div className="mt-8">
                                    {loading ? (
                                        <div className="h-11 w-52" />
                                    ) : isAuthenticated ? (
                                        <Link
                                            to="/app/dashboard"
                                            viewTransition
                                            className="group inline-flex items-center gap-4 border border-[var(--dt-text-primary)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dt-text-primary)] transition-all duration-200 hover:border-[var(--dt-accent)] hover:bg-[var(--dt-accent)] hover:text-white"
                                        >
                                            <span>Continue to DevTrack</span>

                                            <span
                                                className="transition-transform duration-200 group-hover:translate-x-1"
                                                aria-hidden="true"
                                            >
                                                →
                                            </span>
                                        </Link>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-6">
                                            <Link
                                                to="/register"
                                                viewTransition
                                                className="group inline-flex items-center gap-4 border border-[var(--dt-text-primary)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dt-text-primary)] transition-all duration-200 hover:border-[var(--dt-accent)] hover:bg-[var(--dt-accent)] hover:text-white"
                                            >
                                                <span>Start Building</span>

                                                <span
                                                    className="transition-transform duration-200 group-hover:translate-x-1"
                                                    aria-hidden="true"
                                                >
                                                    →
                                                </span>
                                            </Link>

                                            <Link
                                                to="/login"
                                                viewTransition
                                                className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dt-text-secondary)] transition-colors duration-200 hover:text-[var(--dt-text-primary)]"
                                            >
                                                Sign In
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bottom information strip */}
                <footer className="border-t border-[var(--dt-border)] py-5">
                    <div className="flex flex-col gap-4 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-muted)] sm:flex-row sm:items-center sm:justify-between">
                        <span>One system. Every step.</span>

                        <div className="flex items-center gap-6">
                            <span>Goals</span>
                            <span>Projects</span>
                            <span>Coding</span>
                            <span>Timeline</span>
                        </div>

                        <nav aria-label="Legal" className="flex gap-6">
                            <Link to="/privacy" className="hover:text-[var(--dt-accent-soft)]">Privacy</Link>
                            <Link to="/terms" className="hover:text-[var(--dt-accent-soft)]">Terms</Link>
                            <Link to="/refunds" className="hover:text-[var(--dt-accent-soft)]">Pricing and refunds</Link>
                        </nav>
                    </div>
                </footer>
            </div>
        </main>
    );
}

export default Landing;