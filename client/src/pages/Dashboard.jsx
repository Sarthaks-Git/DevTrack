import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getGoals } from "../services/goalService";
import {
  getAttentionGoals,
  getFocusGoal,
  formatGoalDeadline,
} from "../utils/goalUtils";

function Dashboard() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        setError("");

        const data = await getGoals();

        setGoals(data.goals);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const statistics = useMemo(() => {
    return {
      total: goals.length,

      inProgress: goals.filter((goal) => goal.status === "in_progress").length,

      completed: goals.filter((goal) => goal.status === "completed").length,

      notStarted: goals.filter((goal) => goal.status === "not_started").length,
    };
  }, [goals]);

  const focusGoal = useMemo(() => getFocusGoal(goals), [goals]);

  const attentionGoals = useMemo(() => getAttentionGoals(goals), [goals]);

  function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) {
      return "Good morning.";
    }

    if (hour < 18) {
      return "Good afternoon.";
    }

    return "Good evening.";
  }

  if (loading) {
    return (
      <p className="p-8 text-sm text-[var(--dt-text-secondary)]">
        Loading overview...
      </p>
    );
  }

  if (error) {
    return <p className="p-8 text-sm text-red-400">{error}</p>;
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      {/* Page Header */}
      <header className="mb-16 max-w-4xl">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.35em] text-[var(--dt-text-muted)]">
          01 — OVERVIEW
        </p>

        <h1
          className="
                        font-[var(--dt-font-display)]
                        text-5xl
                        leading-[1.02]
                        tracking-tight
                        text-[var(--dt-text-primary)]
                        md:text-7xl
                    "
        >
          {getGreeting()}
          <br />
          Here's where you stand.
        </h1>

        <p className="mt-7 max-w-xl text-base leading-7 text-[var(--dt-text-secondary)]">
          A quick view of what you're building toward and what deserves your
          attention.
        </p>
      </header>

      {/* Current Focus */}
      <section className="mb-16">
        <div
          className="
                        mb-5
                        flex
                        items-end
                        justify-between
                        border-b
                        border-[var(--dt-border)]
                        pb-4
                    "
        >
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
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-5">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--dt-accent-soft)]">
                  {focusGoal.priority}
                </span>

                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-secondary)]">
                  {focusGoal.status.replace("_", " ")}
                </span>

                {focusGoal.deadline && (
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">
                    Due {formatGoalDeadline(focusGoal.deadline)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border-b border-[var(--dt-border)] py-10">
            <p className="font-[var(--dt-font-display)] text-2xl text-[var(--dt-text-primary)]">
              Nothing needs your attention yet.
            </p>

            <p className="mt-3 text-sm text-[var(--dt-text-secondary)]">
              Create or activate a goal to establish your current focus.
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

      {/* Goal Statistics */}
      <section className="mb-16">
        <div className="mb-5 border-b border-[var(--dt-border)] pb-4">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
            Goal snapshot
          </p>
        </div>

        <div className="grid border-b border-[var(--dt-border)] sm:grid-cols-2 lg:grid-cols-4">
          {/* Total */}
          <div className="border-b border-[var(--dt-border)] py-7 sm:border-r lg:border-b-0">
            <p className="text-4xl font-medium tracking-tight text-[var(--dt-text-primary)]">
              {statistics.total.toString().padStart(2, "0")}
            </p>

            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
              Total
            </p>
          </div>

          {/* In Progress */}
          <div className="border-b border-[var(--dt-border)] py-7 sm:pl-7 lg:border-b-0 lg:border-r">
            <p className="text-4xl font-medium tracking-tight text-[var(--dt-text-primary)]">
              {statistics.inProgress.toString().padStart(2, "0")}
            </p>

            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
              In progress
            </p>
          </div>

          {/* Completed */}
          <div className="border-b border-[var(--dt-border)] py-7 lg:border-b-0 lg:border-r lg:pl-7">
            <p className="text-4xl font-medium tracking-tight text-[var(--dt-text-primary)]">
              {statistics.completed.toString().padStart(2, "0")}
            </p>

            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
              Completed
            </p>
          </div>

          {/* Not Started */}
          <div className="py-7 lg:pl-7">
            <p className="text-4xl font-medium tracking-tight text-[var(--dt-text-primary)]">
              {statistics.notStarted.toString().padStart(2, "0")}
            </p>

            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
              Not started
            </p>
          </div>
        </div>
      </section>

      {/* Needs Attention */}
      <section>
        <div
          className="
                        mb-5
                        flex
                        items-end
                        justify-between
                        border-b
                        border-[var(--dt-border)]
                        pb-4
                    "
        >
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
                className="
                                        grid
                                        gap-4
                                        border-b
                                        border-[var(--dt-border)]
                                        py-6
                                        md:grid-cols-[40px_1fr_auto]
                                        md:items-start
                                        md:gap-6
                                    "
              >
                {/* Number */}
                <span className="font-mono text-[9px] tracking-[0.15em] text-[var(--dt-text-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>

                {/* Goal */}
                <div>
                  <Link
                    to="/app/goals"
                    className="
                                                inline-block
                                                text-base
                                                font-medium
                                                tracking-tight
                                                text-[var(--dt-text-primary)]
                                                transition-colors
                                                duration-200
                                                hover:text-[var(--dt-accent-soft)]
                                            "
                  >
                    {goal.title}
                  </Link>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--dt-text-secondary)]">
                      {goal.status.replace("_", " ")}
                    </span>

                    {goal.deadline && (
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">
                        Due {formatGoalDeadline(goal.deadline)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Priority */}
                <span className="text-left text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-muted)] md:text-right">
                  {goal.priority}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default Dashboard;
