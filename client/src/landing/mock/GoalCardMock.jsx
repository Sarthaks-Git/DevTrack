import { sampleGoal } from "../sampleData";

const STATE_LABEL = { verified: "Verified", manual: "Marked done", open: "Open" };

// Progress bar split into verified (green) and manual (grey) parts.
export function ProgressSplit({ target }) {
  const verified = (target.verified / target.goal) * 100;
  const manual = (target.manual / target.goal) * 100;
  return (
    <div>
      <div className="lp-bar">
        <span className="lp-bar-verified" style={{ width: `${verified}%` }} />
        <span className="lp-bar-manual" style={{ width: `${manual}%` }} />
      </div>
      <div className="lp-bar-legend">
        <span><i className="lp-dot lp-dot-verified" />{target.verified} verified</span>
        <span><i className="lp-dot lp-dot-manual" />{target.manual} marked by you</span>
        <span className="lp-muted">of {target.goal}</span>
      </div>
    </div>
  );
}

export default function GoalCardMock({ goal = sampleGoal, showSteps = true }) {
  return (
    <div className="lp-card">
      <p className="lp-card-kicker">Goal</p>
      <p className="lp-card-title">{goal.title}</p>
      <p className="lp-card-sub">{goal.target.label}</p>
      <div className="mt-4"><ProgressSplit target={goal.target} /></div>
      {showSteps ? (
        <ul className="lp-steps">
          {goal.steps.map(step => (
            <li key={step.title} className="lp-step">
              <span className={`lp-check lp-check-${step.state}`} />
              <span className="lp-step-title">{step.title}</span>
              <span className={`lp-tag lp-tag-${step.state}`}>{STATE_LABEL[step.state]}</span>
              <span className="lp-step-due">{step.due}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
