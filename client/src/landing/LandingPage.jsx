import { useContext } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthContext } from "../context/authContextObject";
import Hero from "./scenes/Hero";
import GoalScene from "./scenes/GoalScene";
import ProofScene from "./scenes/ProofScene";
import DashboardScene from "./scenes/DashboardScene";
import JournalScene from "./scenes/JournalScene";
import AiScene from "./scenes/AiScene";
import PlansScene from "./scenes/PlansScene";
import CloseScene from "./scenes/CloseScene";
import "./landing.css";

// Public story page for first-time visitors. Signed-in people go straight to their dashboard;
// while the session check runs, the page shows as normal so visitors never wait on it.
export default function LandingPage() {
  const { user, loading } = useContext(AuthContext);
  if (!loading && user) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="lp">
      <a href="#lp-main" className="lp-skip">Skip to content</a>
      <div className="dt-stars" aria-hidden="true">
        <div className="dt-stars-layer dt-stars-far" />
        <div className="dt-stars-layer dt-stars-near" />
        <div className="dt-stars-layer dt-stars-glow" />
      </div>

      <header className="lp-header">
        <Link to="/" className="lp-wordmark">DevTrack</Link>
        <Link to="/login" viewTransition className="lp-btn-secondary">Sign in</Link>
      </header>

      <main id="lp-main" tabIndex={-1}>
        <Hero />
        <GoalScene />
        <ProofScene />
        <DashboardScene />
        <JournalScene />
        <AiScene />
        <PlansScene />
        <CloseScene />
      </main>

      <footer className="lp-footer">
        <span className="lp-wordmark lp-wordmark-small">DevTrack</span>
        <nav aria-label="Legal" className="lp-footer-nav">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refunds">Pricing and refunds</Link>
        </nav>
      </footer>
    </div>
  );
}
