import { useEffect, useState } from "react";
import GoalList from "../components/goals/GoalList";
import GoalForm from "../components/goals/GoalForm";
import DeleteConfirmModal from "../components/goals/DeleteConfirmModal";
import { getGoals, deleteGoal } from "../services/goalService";

function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingGoal, setEditingGoal] = useState(null);

  const [deletingGoal, setDeletingGoal] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  function handleGoalCreated(newGoal) {
    setGoals((previousGoals) => [newGoal, ...previousGoals]);
  }

  function handleEdit(goal) {
    setEditingGoal(goal);
  }

  function handleGoalUpdated(updatedGoal) {
    setGoals((previousGoals) =>
      previousGoals.map((goal) =>
        goal._id === updatedGoal._id ? updatedGoal : goal,
      ),
    );

    setEditingGoal(null);
  }

  function handleCancelEdit() {
    setEditingGoal(null);
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
    return <p>Loading goals...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <section>
      <h1>Your Goals</h1>

      <GoalForm
        editingGoal={editingGoal}
        onGoalCreated={handleGoalCreated}
        onGoalUpdated={handleGoalUpdated}
        onCancelEdit={handleCancelEdit}
      />

      {goals.length === 0 ? (
        <p>No goals yet. Create your first goal.</p>
      ) : (
        <GoalList goals={goals} onEdit={handleEdit} onDelete={handleDelete} />
      )}

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
