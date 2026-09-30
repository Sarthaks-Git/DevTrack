import { useEffect, useRef, useState } from "react";
import GoalList from "../components/goals/GoalList";
import GoalForm from "../components/goals/GoalForm";
import DeleteConfirmModal from "../components/goals/DeleteConfirmModal";
import { getGoals, deleteGoal } from "../services/goalService";

function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingGoal, setEditingGoal] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const formSectionRef = useRef(null);

  const [deletingGoal, setDeletingGoal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!showForm) {
      return;
    }

    const timer = setTimeout(() => {
      formSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 180);

    return () => clearTimeout(timer);
  }, [showForm]);

  useEffect(() => {
    async function loadGoals() {
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

    loadGoals();
  }, []);

  function handleNewGoal() {
    setEditingGoal(null);
    setShowForm(true);
  }

  function handleGoalCreated(newGoal) {
    setGoals((previousGoals) => [newGoal, ...previousGoals]);

    setTimeout(() => {
      setShowForm(false);
    }, 100);
  }

  function handleEdit(goal) {
    setEditingGoal(goal);
    setShowForm(true);
  }

  function handleGoalUpdated(updatedGoal) {
    setGoals((previousGoals) =>
      previousGoals.map((goal) =>
        goal._id === updatedGoal._id ? updatedGoal : goal,
      ),
    );

    setTimeout(() => {
      setEditingGoal(null);
      setShowForm(false);
    }, 100);
  }

  function handleCancelForm() {
    setEditingGoal(null);
    setShowForm(false);
  }

  function handleDelete(goal) {
    setDeletingGoal(goal);
  }

  function handleCancelDelete() {
    setDeletingGoal(null);
  }

  async function handleConfirmDelete() {
    try {
      setDeleting(true);
      setError("");

      await deleteGoal(deletingGoal._id);

      setGoals((previousGoals) =>
        previousGoals.filter((item) => item._id !== deletingGoal._id),
      );

      setDeletingGoal(null);
    } catch (error) {
      setError(error.message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <p className="p-8 text-sm text-[var(--dt-text-secondary)]">
        Loading goals...
      </p>
    );
  }

  if (error) {
    return <p className="p-8 text-sm text-red-400">{error}</p>;
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      {/* Page Header */}
      <header className="mb-16 max-w-3xl">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.35em] text-[var(--dt-text-muted)]">
          02 — GOALS
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
          Things you're
          <br />
          building toward.
        </h1>

        <p className="mt-7 max-w-xl text-base leading-7 text-[var(--dt-text-secondary)]">
          Track the things that matter now, the things you're working toward,
          and the things you eventually want to accomplish.
        </p>
      </header>

      {/* Goals Toolbar */}
      <div
        className="
                    mb-8
                    flex
                    items-end
                    justify-between
                    border-b
                    border-[var(--dt-border)]
                    pb-4
                "
      >
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
            Active goals
          </p>

          <p className="mt-2 text-sm text-[var(--dt-text-secondary)]">
            {goals.length} {goals.length === 1 ? "goal" : "goals"}
          </p>
        </div>

        <button
          type="button"
          onClick={showForm ? handleCancelForm : handleNewGoal}
          className="
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
          {showForm ? "× Close" : "+ New goal"}
        </button>
      </div>

      {/* Goal Form */}
      <div
        ref={formSectionRef}
        className={`dt-goal-form-wrapper ${showForm ? "is-open" : ""}`}
      >
        <div className="dt-goal-form-inner">
          <GoalForm
            editingGoal={editingGoal}
            onGoalCreated={handleGoalCreated}
            onGoalUpdated={handleGoalUpdated}
            onCancelEdit={handleCancelForm}
          />
        </div>
      </div>

      {/* Goal List / Empty State */}
      {goals.length === 0 ? (
        <div
          className="
                        border-t
                        border-[var(--dt-border)]
                        py-16
                    "
        >
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
            Nothing here yet
          </p>

          <p
            className="
                            mt-4
                            max-w-md
                            font-[var(--dt-font-display)]
                            text-2xl
                            leading-tight
                            text-[var(--dt-text-primary)]
                        "
          >
            Give yourself something worth building toward.
          </p>

          <button
            type="button"
            onClick={handleNewGoal}
            className="
                            mt-6
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
            + Create your first goal
          </button>
        </div>
      ) : (
        <GoalList goals={goals} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      {/* Delete Modal */}
      <DeleteConfirmModal
        goal={deletingGoal}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </section>
  );
}

export default Goals;
