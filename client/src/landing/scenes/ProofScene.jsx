import Scene from "../Scene";
import { ProgressSplit } from "../mock/GoalCardMock";
import { sampleGoal } from "../sampleData";

function ProofVisual() {
  return (
    <div className="lp-proof">
      <div className="lp-card lp-proof-row">
        <span className="lp-check lp-check-manual" />
        <div>
          <p className="lp-card-title">Trees and recursion notes</p>
          <p className="lp-card-sub">You ticked this step. It counts as manual.</p>
        </div>
        <span className="lp-tag lp-tag-manual">Marked done</span>
      </div>
      <div className="lp-card lp-proof-row">
        <span className="lp-check lp-check-verified" />
        <div>
          <p className="lp-card-title">Solved “Course Schedule”</p>
          <p className="lp-card-sub">LeetCode confirmed it. It counts as verified.</p>
        </div>
        <span className="lp-tag lp-tag-verified">Verified</span>
      </div>
      <div className="lp-card"><ProgressSplit target={sampleGoal.target} /></div>
    </div>
  );
}

export default function ProofScene() {
  return (
    <Scene id="proof" title="See which progress is proven." visual={<ProofVisual />} flip>
      <p>
        Ticking a step yourself counts as manual. A problem solved on your verified LeetCode account,
        or commits pushed to a GitHub repo you track, count as verified.
      </p>
      <p>DevTrack keeps the two apart, so your progress bar never flatters you.</p>
    </Scene>
  );
}
