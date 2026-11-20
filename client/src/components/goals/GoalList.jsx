import GoalCard from "./GoalCard";

function GoalList({ goals, projects = [], milestoneHandlers, onEdit, onDelete, onPlan, onQuiz, onIdeas, offset = 0 }) {
    return (
        <div>
            {goals.map((goal, index) => (
                <GoalCard
                    key={goal._id}
                    goal={goal}
                    linkedProjects={projects.filter((project) => project.goal === goal._id)}
                    milestoneHandlers={milestoneHandlers}
                    number={String(offset + index + 1).padStart(2, "0")}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPlan={onPlan}
                    onQuiz={onQuiz}
                    onIdeas={onIdeas}
                />
            ))}
        </div>
    );
}

export default GoalList;