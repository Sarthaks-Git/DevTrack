import { useEffect, useRef, useState } from "react";
import Pagination from "../components/common/Pagination";
import { usePagination } from "../components/common/usePagination";

const GOALS_PER_PAGE = 8;
import GoalList from "../components/goals/GoalList";
import PageHeader from "../components/common/PageHeader";
import GoalForm from "../components/goals/GoalForm";
import DeleteConfirmModal from "../components/goals/DeleteConfirmModal";
import RoadmapModal from "../components/goals/RoadmapModal";
import QuizModal from "../components/goals/QuizModal";
import { getAiStatus } from "../services/aiService";
import {
  getGoals,
  deleteGoal,
  addGoalMilestone,
  updateGoalMilestone,
  deleteGoalMilestone,
} from "../services/goalService";
import { getProjects } from "../services/projectService";

function Goals() {
  const [goals, setGoals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingGoal, setEditingGoal] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const formSectionRef = useRef(null);

  const [planningGoal, setPlanningGoal] = useState(null);
  const [quizGoal, setQuizGoal] = useState(null);
  // "Plan with AI" shows only when AI is set up on the server; consent is asked for in the modal.
  const [aiAvailable, setAiAvailable] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const goalPages = usePagination(goals, GOALS_PER_PAGE);

  useEffect(() => {
    let active = true;
    getAiStatus()
      .then((status) => active && setAiAvailable(Boolean(status.available)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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

        // Linked projects are context only; the page still works if they fail to load.
        getProjects()
          .then((response) => setProjects(response.data?.projects || []))
          .catch(() => setProjects([]));
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

  // Milestone responses carry the goal without computed target progress, so keep the last value.
  function replaceGoal(updatedGoal) {
    setGoals((previousGoals) =>
      previousGoals.map((goal) =>
        goal._id === updatedGoal._id
          ? { ...updatedGoal, targetProgress: updatedGoal.targetProgress ?? goal.targetProgress }
          : goal,
      ),
    );
  }

  const milestoneHandlers = {
    add: async (goalId, milestone) => replaceGoal(await addGoalMilestone(goalId, milestone)),
    update: async (goalId, milestoneId, changes) =>
      replaceGoal(await updateGoalMilestone(goalId, milestoneId, changes)),
    remove: async (goalId, milestoneId) =>
      replaceGoal(await deleteGoalMilestone(goalId, milestoneId)),
  };

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
      // The server unlinks projects from a deleted goal; mirror that locally.
      setProjects((previous) =>
        previous.map((project) =>
          project.goal === deletingGoal._id ? { ...project, goal: null } : project,
        ),
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
      <p className="text-sm text-[var(--dt-text-secondary)]">
        Loading goals...
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <section>
      <PageHeader
        eyebrow="02 — Goals"
        title="Things you're building toward."
        description="Track the things that matter now, the things you're working toward, and the things you eventually want to accomplish."
      />

      {/* Goals Toolbar */}
      <div
        className="
                    mb-4
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
            key={editingGoal?._id || (showForm ? "new-open" : "new")}
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
                        py-10
                    "
        >
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
            Nothing here yet
          </p>

          <p
            className="
                            mt-4
                            max-w-md
                            font-[family-name:var(--dt-font-display)]
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
        <div id="goal-list">
        <GoalList
          goals={goalPages.pageItems}
          offset={goalPages.offset}
          projects={projects}
          milestoneHandlers={milestoneHandlers}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPlan={aiAvailable ? setPlanningGoal : undefined}
          onQuiz={aiAvailable ? setQuizGoal : undefined}
        />
        <Pagination page={goalPages.page} pageCount={goalPages.pageCount} onChange={goalPages.setPage} label="Goal pages" scrollTargetId="goal-list" total={goals.length} pageSize={GOALS_PER_PAGE} />
        </div>
      )}

      <RoadmapModal goal={planningGoal} onClose={() => setPlanningGoal(null)} onSaved={replaceGoal} />
      <QuizModal key={quizGoal?._id || "none"} goal={quizGoal} onClose={() => setQuizGoal(null)} />

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
