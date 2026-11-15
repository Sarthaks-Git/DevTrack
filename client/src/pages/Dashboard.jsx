
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getGoals } from "../services/goalService";
import { getProjects } from "../services/projectService";
import DashboardPulse from "../components/dashboard/DashboardPulse";
import UpcomingMilestones from "../components/dashboard/UpcomingMilestones";
import { useDayPeriod } from "../components/dashboard/useDayPeriod";
import TechTip from "../components/dashboard/TechTip";
import PageHeader from "../components/common/PageHeader";
import { getOpenMilestones } from "../utils/milestoneUtils";
import {
    getAttentionGoals,
    getFocusGoal,
    formatGoalDeadline,
} from "../utils/goalUtils";

function Dashboard() {
    const [goals, setGoals] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const period = useDayPeriod();

    useEffect(() => {
        let isMounted = true;

        async function loadDashboardData() {
            try {
                setLoading(true);
                setError("");

                const [goalsResponse, projectsResponse] =
                    await Promise.all([getGoals(), getProjects()]);

                if (!isMounted) return;

                // Goals API returns { goals: [...] }.
                // Projects API returns { success, message, data: { projects: [...] } }.
                const fetchedGoals = goalsResponse.goals;
                const fetchedProjects = projectsResponse.data?.projects;

                if (!Array.isArray(fetchedGoals)) {
                    throw new Error("Unexpected response received for goals.");
                }

                if (!Array.isArray(fetchedProjects)) {
                    throw new Error("Unexpected response received for projects.");
                }

                setGoals(fetchedGoals);
                setProjects(fetchedProjects);
            } catch (error) {
                if (isMounted) {
                    setError(
                        error.message || "Failed to load dashboard data."
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadDashboardData();

        return () => {
            isMounted = false;
        };
    }, []);

    const goalStatistics = useMemo(() => {
        return {
            total: goals.length,
            inProgress: goals.filter(
                (goal) => goal.status === "in_progress"
            ).length,
            completed: goals.filter(
                (goal) => goal.status === "completed"
            ).length,
            notStarted: goals.filter(
                (goal) => goal.status === "not_started"
            ).length,
        };
    }, [goals]);

    const projectStatistics = useMemo(() => {
        return {
            total: projects.length,
            inProgress: projects.filter(
                (project) => project.status === "in_progress"
            ).length,
            completed: projects.filter(
                (project) => project.status === "completed"
            ).length,
            planning: projects.filter(
                (project) => project.status === "planning"
            ).length,
        };
    }, [projects]);

    const focusGoal = useMemo(() => getFocusGoal(goals), [goals]);

    const attentionGoals = useMemo(
        () => getAttentionGoals(goals),
        [goals]
    );

    const recentProjects = useMemo(() => {
        return [...projects]
            .sort(
                (a, b) =>
                    new Date(b.updatedAt || b.createdAt).getTime() -
                    new Date(a.updatedAt || a.createdAt).getTime()
            )
            .slice(0, 3);
    }, [projects]);

    const openMilestones = useMemo(
        () => getOpenMilestones(goals, projects),
        [goals, projects]
    );

    const focusMilestones = focusGoal?.milestones || [];

    function formatProjectDate(date) {
        if (!date) return null;

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) return null;

        return parsedDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }

    function formatStatus(status) {
        return status?.replaceAll("_", " ") || "Unknown";
    }

    if (loading) {
        return (
            <p className="text-sm text-[var(--dt-text-secondary)]">
                Loading overview...
            </p>
        );
    }

    if (error) {
        return (
            <section>
                <p className="text-sm text-red-400">{error}</p>

                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)]"
                >
                    Try again
                </button>
            </section>
        );
    }

    return (
        <section className="relative isolate">
            {/* Time-of-day tint: decorative only. */}
            <div
                aria-hidden="true"
                data-period={period.key}
                className="dt-atmosphere pointer-events-none absolute -left-24 -top-32 -z-10 h-[28rem] w-[36rem] max-w-[100vw]"
            />

            <PageHeader
                eyebrow="01 — Overview"
                title={
                    <>
                        {period.greeting}
                        <br />
                        Here's where you stand.
                    </>
                }
                description="A quick view of what you're building toward and what deserves your attention."
                below={<TechTip />}
            />

            {/* Current Focus */}
            <section className="mb-16">
                <div className="mb-5 flex items-end justify-between border-b border-[var(--dt-border)] pb-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
                        Current focus
                    </p>

                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
                        {focusGoal ? "ACTIVE" : "NONE"}
                    </span>
                </div>

                {focusGoal ? (
                    <div className="py-8">
                        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                            <div>
                                <Link
                                    to="/app/goals"
                                    className="
                                        inline-block
                                        text-2xl
                                        font-medium
                                        tracking-tight
                                        text-[var(--dt-text-primary)]
                                        transition-colors
                                        duration-200
                                        hover:text-[var(--dt-accent-soft)]
                                        md:text-3xl
                                    "
                                >
                                    {focusGoal.title}
                                </Link>

                                {focusGoal.description && (
                                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--dt-text-secondary)]">
                                        {focusGoal.description}
                                    </p>
                                )}

                                {focusMilestones.length > 0 && (
                                    <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">
                                        Milestones{" "}
                                        <span className="text-[var(--dt-text-secondary)]">
                                            {focusMilestones.filter((m) => m.done).length}/{focusMilestones.length}
                                        </span>
                                    </p>
                                )}
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center gap-5">
                                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--dt-accent-soft)]">
                                    {focusGoal.priority}
                                </span>

                                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-secondary)]">
                                    {formatStatus(focusGoal.status)}
                                </span>

                                {focusGoal.deadline && (
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">
                                        Due{" "}
                                        {formatGoalDeadline(focusGoal.deadline)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="border-b border-[var(--dt-border)] py-10">
                        <p className="font-[family-name:var(--dt-font-display)] text-2xl text-[var(--dt-text-primary)]">
                            Nothing needs your attention yet.
                        </p>

                        <p className="mt-3 text-sm text-[var(--dt-text-secondary)]">
                            Create or activate a goal to establish your current
                            focus.
                        </p>

                        <Link
                            to="/app/goals"
                            className="
                                mt-6
                                inline-block
                                text-xs
                                font-medium
                                uppercase
                                tracking-[0.2em]
                                text-[var(--dt-text-secondary)]
                                transition-colors
                                duration-200
                                hover:text-[var(--dt-accent-soft)]
                            "
                        >
                            + Create a goal
                        </Link>
                    </div>
                )}
            </section>

            <UpcomingMilestones
                milestones={openMilestones.slice(0, 5)}
                total={openMilestones.length}
            />

            {/* Goal Statistics */}
            <section className="mb-16">
                <div className="mb-5 border-b border-[var(--dt-border)] pb-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
                        Goal snapshot
                    </p>
                </div>

                <div className="grid border-b border-[var(--dt-border)] sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: "Total", value: goalStatistics.total },
                        {
                            label: "In progress",
                            value: goalStatistics.inProgress,
                        },
                        {
                            label: "Completed",
                            value: goalStatistics.completed,
                        },
                        {
                            label: "Not started",
                            value: goalStatistics.notStarted,
                        },
                    ].map((statistic, index) => (
                        <div
                            key={statistic.label}
                            className={[
                                "border-b border-[var(--dt-border)] py-7 lg:border-b-0",
                                index > 0 ? "sm:pl-7" : "",
                                index < 3 ? "lg:border-r" : "",
                            ].join(" ")}
                        >
                            <p className="text-4xl font-medium tracking-tight text-[var(--dt-text-primary)]">
                                {String(statistic.value).padStart(2, "0")}
                            </p>

                            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
                                {statistic.label}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Project Snapshot */}
            <section className="mb-16">
                <div className="mb-5 flex items-end justify-between border-b border-[var(--dt-border)] pb-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
                        Project snapshot
                    </p>

                    <Link
                        to="/app/projects"
                        className="text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)]"
                    >
                        View all projects →
                    </Link>
                </div>

                <div className="grid border-b border-[var(--dt-border)] sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: "Total", value: projectStatistics.total },
                        {
                            label: "In progress",
                            value: projectStatistics.inProgress,
                        },
                        {
                            label: "Completed",
                            value: projectStatistics.completed,
                        },
                        {
                            label: "Planning",
                            value: projectStatistics.planning,
                        },
                    ].map((statistic, index) => (
                        <div
                            key={statistic.label}
                            className={[
                                "border-b border-[var(--dt-border)] py-7 lg:border-b-0",
                                index > 0 ? "sm:pl-7" : "",
                                index < 3 ? "lg:border-r" : "",
                            ].join(" ")}
                        >
                            <p className="text-4xl font-medium tracking-tight text-[var(--dt-text-primary)]">
                                {String(statistic.value).padStart(2, "0")}
                            </p>

                            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
                                {statistic.label}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Recent Projects */}
                <div className="mt-8">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
                            Recent projects
                        </p>

                        <Link
                            to="/app/projects"
                            className="text-xs text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)]"
                        >
                            Manage projects
                        </Link>
                    </div>

                    {recentProjects.length === 0 ? (
                        <div className="border-b border-[var(--dt-border)] py-8">
                            <p className="text-sm text-[var(--dt-text-secondary)]">
                                No projects yet. Start building something
                                you're proud of.
                            </p>

                            <Link
                                to="/app/projects"
                                className="mt-4 inline-block text-xs font-medium uppercase tracking-[0.2em] text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)]"
                            >
                                + Add a project
                            </Link>
                        </div>
                    ) : (
                        <div>
                            {recentProjects.map((project, index) => (
                                <article
                                    key={project._id}
                                    className="grid gap-3 border-b border-[var(--dt-border)] py-5 md:grid-cols-[40px_1fr_auto] md:items-start md:gap-6"
                                >
                                    <span className="font-mono text-[9px] tracking-[0.15em] text-[var(--dt-text-muted)]">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>

                                    <div>
                                        <Link
                                            to="/app/projects"
                                            className="text-base font-medium tracking-tight text-[var(--dt-text-primary)] transition-colors hover:text-[var(--dt-accent-soft)]"
                                        >
                                            {project.title}
                                        </Link>

                                        {project.description && (
                                            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--dt-text-secondary)]">
                                                {project.description}
                                            </p>
                                        )}

                                        {Array.isArray(project.technologies) &&
                                            project.technologies.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {project.technologies
                                                        .slice(0, 5)
                                                        .map((technology) => (
                                                            <span
                                                                key={technology}
                                                                className="border border-[var(--dt-border)] px-2 py-1 text-[10px] text-[var(--dt-text-muted)]"
                                                            >
                                                                {technology}
                                                            </span>
                                                        ))}
                                                </div>
                                            )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 md:justify-end">
                                        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--dt-text-secondary)]">
                                            {formatStatus(project.status)}
                                        </span>

                                        {formatProjectDate(
                                            project.updatedAt || project.createdAt
                                        ) && (
                                            <span className="text-[10px] text-[var(--dt-text-muted)]">
                                                Updated{" "}
                                                {formatProjectDate(
                                                    project.updatedAt ||
                                                        project.createdAt
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Needs Attention */}
            <section>
                <div className="mb-5 flex items-end justify-between border-b border-[var(--dt-border)] pb-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
                        Needs attention
                    </p>

                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
                        {attentionGoals.length}{" "}
                        {attentionGoals.length === 1 ? "ITEM" : "ITEMS"}
                    </span>
                </div>

                {attentionGoals.length === 0 ? (
                    <div className="border-b border-[var(--dt-border)] py-10">
                        <p className="text-sm text-[var(--dt-text-secondary)]">
                            Nothing currently needs your attention.
                        </p>
                    </div>
                ) : (
                    <div>
                        {attentionGoals.map((goal, index) => (
                            <article
                                key={goal._id}
                                className="grid gap-4 border-b border-[var(--dt-border)] py-6 md:grid-cols-[40px_1fr_auto] md:items-start md:gap-6"
                            >
                                <span className="font-mono text-[9px] tracking-[0.15em] text-[var(--dt-text-muted)]">
                                    {String(index + 1).padStart(2, "0")}
                                </span>

                                <div>
                                    <Link
                                        to="/app/goals"
                                        className="inline-block text-base font-medium tracking-tight text-[var(--dt-text-primary)] transition-colors duration-200 hover:text-[var(--dt-accent-soft)]"
                                    >
                                        {goal.title}
                                    </Link>

                                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                                        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--dt-text-secondary)]">
                                            {formatStatus(goal.status)}
                                        </span>

                                        {goal.deadline && (
                                            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">
                                                Due{" "}
                                                {formatGoalDeadline(
                                                    goal.deadline
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <span className="text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-muted)] md:text-right">
                                    {goal.priority}
                                </span>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <DashboardPulse />
        </section>
    );
}

export default Dashboard;
