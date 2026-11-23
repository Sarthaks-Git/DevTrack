import { Link } from "react-router-dom";
import GoalCardMock from "../mock/GoalCardMock";

export default function Hero() {
  return (
    <section aria-labelledby="hero-title" className="lp-hero">
      <div className="lp-hero-text">
        <h1 id="hero-title" className="lp-h1">Your developer progress, checked against real data.</h1>
        <p className="lp-lead">
          Goals, projects and LeetCode practice in one place. DevTrack keeps what you mark done
          yourself apart from what LeetCode and GitHub confirm.
        </p>
        <div className="lp-actions">
          <Link to="/register" viewTransition className="lp-btn-primary">Create an account</Link>
          <Link to="/login" viewTransition className="lp-btn-secondary">Sign in</Link>
        </div>
      </div>
      <figure className="lp-hero-visual">
        <div aria-hidden="true"><GoalCardMock showSteps={false} /></div>
        <figcaption className="lp-caption">Sample data</figcaption>
      </figure>
    </section>
  );
}
