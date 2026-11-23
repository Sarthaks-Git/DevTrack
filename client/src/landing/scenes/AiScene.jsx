import { aiTools } from "../sampleData";

export default function AiScene() {
  return (
    <section id="ai" aria-labelledby="ai-title" className="lp-scene">
      <div className="lp-scene-inner lp-scene-stack">
        <div className="lp-scene-text">
          <h2 id="ai-title" className="lp-h2">Ask for help when you want it.</h2>
          <div className="lp-body">
            <p>The AI tools stay off until you turn them on in Settings, and each plan has a monthly limit.</p>
          </div>
        </div>
        <ul className="lp-ai-grid">
          {aiTools.map(tool => (
            <li key={tool.name} className="lp-card">
              <p className="lp-card-title">
                {tool.name}
                {tool.pro ? <span className="lp-tag lp-tag-pro">Pro</span> : null}
              </p>
              <p className="lp-card-sub">{tool.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
