import { sampleJournal } from "../sampleData";

export default function JournalMock({ data = sampleJournal }) {
  return (
    <div className="lp-journal">
      <div className="lp-card">
        <p className="lp-card-kicker">Journal · {data.entry.date}</p>
        <p className="lp-card-title">{data.entry.title}</p>
        <p className="lp-card-sub">{data.entry.body}</p>
      </div>
      <ol className="lp-timeline">
        {data.timeline.map(item => (
          <li key={item.text} className="lp-timeline-item">
            <i className={`lp-dot lp-dot-${item.kind}`} />
            <span className="lp-timeline-date">{item.date}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
