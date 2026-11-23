import { Link } from "react-router-dom";
import { plans } from "../sampleData";

export default function PlansScene() {
  const { free, pro, comingSoon } = plans;
  return (
    <section id="plans" aria-labelledby="plans-title" className="lp-scene">
      <div className="lp-scene-inner lp-scene-stack">
        <div className="lp-scene-text">
          <h2 id="plans-title" className="lp-h2">Free to start. Pro if you want more AI.</h2>
        </div>
        <div className="lp-plans">
          <div className="lp-card lp-plan">
            <p className="lp-plan-name">{free.name}</p>
            <p className="lp-plan-price">{free.price}</p>
            <ul className="lp-plan-list">{free.items.map(item => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="lp-card lp-plan lp-plan-pro">
            <p className="lp-plan-name">{pro.name}</p>
            <p className="lp-plan-price">{pro.prices[0]}</p>
            <p className="lp-muted text-sm">or {pro.prices[1]}</p>
            <ul className="lp-plan-list">{pro.items.map(item => <li key={item}>{item}</li>)}</ul>
            <p className="lp-muted text-sm">{pro.note} <Link to="/refunds" className="lp-link">Pricing and refunds</Link></p>
          </div>
        </div>
        <p className="lp-soon"><span className="lp-tag lp-tag-open">Coming soon</span> {comingSoon.join(", ")}</p>
      </div>
    </section>
  );
}
