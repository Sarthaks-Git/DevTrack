import Scene from "../Scene";
import AppFrame from "../mock/AppFrame";
import MilestonesOpen from "../mock/MilestonesOpen";
import GoalTargetProgress from "../../components/goals/GoalTargetProgress";
import ActivityItem from "../../components/activity/ActivityItem";
import { sampleActivity, sampleGoal } from "../sampleData";

// Manual and verified side by side, drawn with the app's own components.
function ProofVisual() {
  return (
    <AppFrame>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">Ticked by you</p>
      <MilestonesOpen milestones={sampleGoal.milestones.slice(0, 3)} />
      <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">Confirmed by LeetCode and GitHub</p>
      <GoalTargetProgress target={sampleGoal.target} progress={sampleGoal.targetProgress} />
      <ol className="mt-4 divide-y divide-[var(--dt-border)]">
        {sampleActivity.slice(0, 2).map(item => <ActivityItem key={item._id} item={item} compact />)}
      </ol>
    </AppFrame>
  );
}

export default function ProofScene() {
  return (
    <Scene id="proof" title="See which progress is proven." visual={<ProofVisual />} flip>
      <p>
        Milestones you tick yourself stay plain. Problems solved on your verified LeetCode account and
        commits to GitHub repos you track carry a Verified badge, and they move your goal’s target bar.
      </p>
      <p>The two never mix, so your progress never flatters you.</p>
    </Scene>
  );
}
