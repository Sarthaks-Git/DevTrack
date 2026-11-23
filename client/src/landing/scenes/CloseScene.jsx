import { Link } from "react-router-dom";

export default function CloseScene() {
  return (
    <section aria-labelledby="close-title" className="lp-close">
      <h2 id="close-title" className="lp-h2">Start with one goal and let real data fill it in.</h2>
      <div className="lp-actions lp-actions-center">
        <Link to="/register" viewTransition className="lp-btn-primary">Create an account</Link>
        <Link to="/login" viewTransition className="lp-btn-secondary">Sign in</Link>
      </div>
    </section>
  );
}
