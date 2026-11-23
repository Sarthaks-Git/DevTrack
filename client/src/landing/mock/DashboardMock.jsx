import { sampleDashboard } from "../sampleData";

export default function DashboardMock({ data = sampleDashboard }) {
  return (
    <div className="lp-dash">
      <div className="lp-card lp-dash-focus">
        <p className="lp-card-kicker">Today’s focus</p>
        <p className="lp-card-title">{data.focus}</p>
      </div>
      <div className="lp-card">
        <p className="lp-card-kicker">Needs attention</p>
        <ul className="lp-list">
          {data.attention.map(item => (
            <li key={item.label}><span className="lp-list-strong">{item.label}</span><span className="lp-muted">{item.detail}</span></li>
          ))}
        </ul>
      </div>
      <div className="lp-card">
        <p className="lp-card-kicker">Last 7 days</p>
        <div className="lp-week">
          {data.week.map((d, i) => (
            <span key={i} className="lp-week-day">
              <span className={`lp-week-box ${d.active ? "lp-week-on" : ""}`} />
              {d.day}
            </span>
          ))}
        </div>
      </div>
      <div className="lp-card lp-dash-recent">
        <p className="lp-card-kicker">Recent</p>
        <ul className="lp-list">
          {data.recent.map(item => (
            <li key={item.text}><i className={`lp-dot lp-dot-${item.kind}`} />{item.text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
