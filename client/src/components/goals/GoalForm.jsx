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
    <div
      className="
                mb-12
                border-y
                border-[var(--dt-border)]
                py-8
                md:py-10
            "
    >
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
            {editingGoal ? "Edit goal" : "Create new goal"}
          </p>

          <p className="mt-2 text-sm text-[var(--dt-text-secondary)]">
            {editingGoal
              ? "Update the direction of this goal."
              : "Define something worth building toward."}
          </p>
        </div>

        {editingGoal && (
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={loading}
            className="
                            text-xs
                            uppercase
                            tracking-[0.18em]
                            text-[var(--dt-text-muted)]
                            transition-colors
                            duration-200
                            hover:text-[var(--dt-text-primary)]
                            disabled:opacity-40
                        "
          >
            Close
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div
            role="alert"
            className="
                            mb-6
                            border-l-2
                            border-red-400
                            bg-red-400/5
                            px-4
                            py-3
                            text-sm
                            text-red-300
                        "
          >
            {error}
          </div>
        )}

        <div className="space-y-8">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="
                                mb-3
                                block
                                text-xs
                                font-medium
                                uppercase
                                tracking-[0.2em]
                                text-[var(--dt-text-muted)]
                            "
            >
              Title
            </label>

            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              placeholder="What are you building toward?"
              maxLength={120}
              autoComplete="off"
              className="
                                w-full
                                border-b
                                border-[var(--dt-border)]
                                bg-transparent
                                px-0
                                py-3
                                text-lg
                                text-[var(--dt-text-primary)]
                                outline-none
                                placeholder:text-[var(--dt-text-muted)]
                                transition-colors
                                duration-200
                                focus:border-[var(--dt-accent)]
                            "
            />

            <div className="mt-2 text-right text-[10px] uppercase tracking-[0.15em] text-[var(--dt-text-muted)]">
              {formData.title.length}/120
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="
                                mb-3
                                block
                                text-xs
                                font-medium
                                uppercase
                                tracking-[0.2em]
                                text-[var(--dt-text-muted)]
                            "
            >
              Description
            </label>

            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Give this goal some context..."
              maxLength={2000}
              rows={4}
              className="
                                w-full
                                resize-y
                                border
                                border-[var(--dt-border)]
                                bg-[var(--dt-surface)]
                                px-4
                                py-3
                                text-sm
                                leading-6
                                text-[var(--dt-text-primary)]
                                outline-none
                                placeholder:text-[var(--dt-text-muted)]
                                transition-colors
                                duration-200
                                focus:border-[var(--dt-accent)]
                            "
            />

            <div className="mt-2 text-right text-[10px] uppercase tracking-[0.15em] text-[var(--dt-text-muted)]">
              {formData.description.length}/2000
            </div>
          </div>

          {/* Status / Priority */}
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <label
                htmlFor="status"
                className="
                                    mb-3
                                    block
                                    text-xs
                                    font-medium
                                    uppercase
                                    tracking-[0.2em]
                                    text-[var(--dt-text-muted)]
                                "
              >
                Status
              </label>

              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="
                                    w-full
                                    border
                                    border-[var(--dt-border)]
                                    bg-[var(--dt-surface)]
                                    px-4
                                    py-3
                                    text-sm
                                    text-[var(--dt-text-primary)]
                                    outline-none
                                    transition-colors
                                    duration-200
                                    focus:border-[var(--dt-accent)]
                                "
              >
                <option value="not_started">○ Not Started</option>

                <option value="in_progress">◐ In Progress</option>

                <option value="completed">✓ Completed</option>

                <option value="archived">— Archived</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="priority"
                className="
                                    mb-3
                                    block
                                    text-xs
                                    font-medium
                                    uppercase
                                    tracking-[0.2em]
                                    text-[var(--dt-text-muted)]
                                "
              >
                Priority
              </label>

              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="
                                    w-full
                                    border
                                    border-[var(--dt-border)]
                                    bg-[var(--dt-surface)]
                                    px-4
                                    py-3
                                    text-sm
                                    text-[var(--dt-text-primary)]
                                    outline-none
                                    transition-colors
                                    duration-200
                                    focus:border-[var(--dt-accent)]
                                "
              >
                <option value="low">LOW</option>

                <option value="medium">MEDIUM</option>

                <option value="high">HIGH</option>
              </select>
            </div>
          </div>

          {/* Deadline */}
          <div className="max-w-sm">
            <label
              htmlFor="deadline"
              className="
                                mb-3
                                block
                                text-xs
                                font-medium
                                uppercase
                                tracking-[0.2em]
                                text-[var(--dt-text-muted)]
                            "
            >
              Deadline
            </label>

            <input
              id="deadline"
              name="deadline"
              type="date"
              value={formData.deadline}
              onChange={handleChange}
              className="
                                w-full
                                border
                                border-[var(--dt-border)]
                                bg-[var(--dt-surface)]
                                px-4
                                py-3
                                text-sm
                                text-[var(--dt-text-primary)]
                                outline-none
                                transition-colors
                                duration-200
                                focus:border-[var(--dt-accent)]
                            "
            />
          </div>
        </div>

        {/* Actions */}
        <div
          className="
                        mt-10
                        flex
                        flex-col-reverse
                        gap-4
                        border-t
                        border-[var(--dt-border)]
                        pt-6
                        sm:flex-row
                        sm:items-center
                        sm:justify-end
                    "
        >
          {editingGoal && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={loading}
              className="
                                px-4
                                py-3
                                text-xs
                                font-medium
                                uppercase
                                tracking-[0.18em]
                                text-[var(--dt-text-secondary)]
                                transition-colors
                                duration-200
                                hover:text-[var(--dt-text-primary)]
                                disabled:opacity-40
                            "
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="
                            border
                            border-[var(--dt-accent)]
                            bg-[var(--dt-accent)]
                            px-6
                            py-3
                            text-xs
                            font-medium
                            uppercase
                            tracking-[0.18em]
                            text-white
                            transition-all
                            duration-200
                            hover:bg-[var(--dt-accent-soft)]
                            hover:border-[var(--dt-accent-soft)]
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
          >
            {loading
              ? editingGoal
                ? "Updating..."
                : "Creating..."
              : editingGoal
                ? "Update Goal"
                : "Create Goal"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default GoalForm;
