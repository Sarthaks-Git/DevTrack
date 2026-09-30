import GoalCard from "./GoalCard";

function GoalList({ goals, onEdit, onDelete }) {
    return (
        <div>
            {goals.map((goal, index) => (
                <GoalCard
                    key={goal._id}
                    goal={goal}
                    number={String(index + 1).padStart(2, "0")}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}

export default GoalList;