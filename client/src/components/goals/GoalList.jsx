// GoalList.jsx

// Responsible for rendering the collection of goals.

// Goals
//  └── GoalList
//       ├── GoalCard
//       ├── GoalCard
//       └── GoalCard

import GoalCard from "./GoalCard";

function GoalList({ goals, onEdit, onDelete }) {
  return (
    <div>
      {goals.map((goal) => (
        <GoalCard
          key={goal._id}
          goal={goal}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default GoalList;
