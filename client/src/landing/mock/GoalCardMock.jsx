import GoalCard from "../../components/goals/GoalCard";
import MilestonesOpen from "./MilestonesOpen";
import AppFrame from "./AppFrame";
import { sampleGoal } from "../sampleData";

const noop = () => {};

// The real GoalCard (with its real verified target bar), plus its milestone checklist opened.
export default function GoalCardMock({ goal = sampleGoal, showMilestones = true }) {
  return (
    <AppFrame eyebrow="02 — Goals" title="What you are working toward">
      <GoalCard goal={goal} number="01" onEdit={noop} onDelete={noop} />
      {showMilestones ? (
        <div className="md:pl-[52px]">
          <MilestonesOpen milestones={goal.milestones} />
        </div>
      ) : null}
    </AppFrame>
  );
}
