// GoalForm.jsx

// Handles:

// Title
// Description
// Priority
// Status
// Deadline

// and works for both:

// Create
// Edit

// We don't want two completely separate forms if the underlying fields are the same.
import { useEffect, useState } from "react";
import { createGoal, updateGoal } from "../../services/goalService";

const initialFormData = {
  title: "",
  description: "",
  status: "not_started",
  priority: "medium",
  deadline: "",
};

function GoalForm({ editingGoal, onGoalCreated, onGoalUpdated, onCancelEdit }) {
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editingGoal) {
      setFormData(initialFormData);
      setError("");
      return;
    }

    setFormData({
      title: editingGoal.title || "",
      description: editingGoal.description || "",
      status: editingGoal.status || "not_started",
      priority: editingGoal.priority || "medium",
      deadline: editingGoal.deadline ? editingGoal.deadline.slice(0, 10) : "",
    });

    setError("");
  }, [editingGoal]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!formData.title.trim()) {
      setError("Goal title is required");
      return;
    }

    try {
      setLoading(true);

      const goalData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        priority: formData.priority,
        deadline: formData.deadline || null,
      };

      if (editingGoal) {
        const data = await updateGoal(editingGoal._id, goalData);

        onGoalUpdated(data.goal);
      } else {
        const data = await createGoal(goalData);

        onGoalCreated(data.goal);

        setFormData(initialFormData);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>{editingGoal ? "Edit Goal" : "Create Goal"}</h2>

      {error && <p>{error}</p>}

      <div>
        <label htmlFor="title">Title</label>

        <input
          id="title"
          name="title"
          type="text"
          value={formData.title}
          onChange={handleChange}
          placeholder="e.g. Learn System Design"
          maxLength={120}
        />
      </div>

      <div>
        <label htmlFor="description">Description</label>

        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Describe what you want to achieve"
          maxLength={2000}
        />
      </div>

      <div>
        <label htmlFor="status">Status</label>

        <select
          id="status"
          name="status"
          value={formData.status}
          onChange={handleChange}
        >
          <option value="not_started">Not Started</option>

          <option value="in_progress">In Progress</option>

          <option value="completed">Completed</option>

          <option value="archived">Archived</option>
        </select>
      </div>

      <div>
        <label htmlFor="priority">Priority</label>

        <select
          id="priority"
          name="priority"
          value={formData.priority}
          onChange={handleChange}
        >
          <option value="low">Low</option>

          <option value="medium">Medium</option>

          <option value="high">High</option>
        </select>
      </div>

      <div>
        <label htmlFor="deadline">Deadline</label>

        <input
          id="deadline"
          name="deadline"
          type="date"
          value={formData.deadline}
          onChange={handleChange}
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading
          ? editingGoal
            ? "Updating..."
            : "Creating..."
          : editingGoal
            ? "Update Goal"
            : "Create Goal"}
      </button>

      {editingGoal && (
        <button type="button" onClick={onCancelEdit} disabled={loading}>
          Cancel
        </button>
      )}
    </form>
  );
}

export default GoalForm;
