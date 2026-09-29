// GoalCard.jsx

// Displays one goal:

// Title
// Description
// Priority
// Status
// Deadline

// [Edit] [Delete]

function GoalCard({ goal, onEdit, onDelete }) {
  return (
    <article>
      <h3>{goal.title}</h3>

      {goal.description && <p>{goal.description}</p>}

      <div>
        <span>Status: {goal.status}</span>
        {" | "}
        <span>Priority: {goal.priority}</span>
      </div>

      {goal.deadline && (
        <p>Deadline: {new Date(goal.deadline).toLocaleDateString()}</p>
      )}

      <button type="button" onClick={() => onEdit(goal)}>
        Edit
      </button>

      <button type="button" onClick={() => onDelete(goal)}>
        Delete
      </button>
    </article>
  );
}

export default GoalCard;
