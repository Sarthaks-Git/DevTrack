import { useEffect } from "react";
import { createPortal } from "react-dom";
import { activityLabel } from "./activityMeta";

// A plain black-on-white copy of the timeline that only exists on paper. The browser's print
// dialog saves it as a PDF ("Save as PDF"), which keeps every language and emoji intact.
function TimelinePrint({ items, filterLabel, ownerName, truncated, onDone }) {
  useEffect(() => {
    const previousTitle = document.title;
    // Becomes the suggested file name in the save dialog.
    document.title = `DevTrack timeline ${new Date().toISOString().slice(0, 10)}`;
    const finish = () => {
      document.title = previousTitle;
      onDone();
    };
    window.addEventListener("afterprint", finish, { once: true });
    // Let the browser lay the copy out before the dialog opens.
    const timer = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
      document.title = previousTitle;
    };
  }, [onDone]);

  const days = [];
  for (const item of items) {
    const day = new Date(item.occurredAt).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const last = days[days.length - 1];
    if (last?.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }
  const first = items[items.length - 1]?.occurredAt;
  const last = items[0]?.occurredAt;
  const range = first ? `${new Date(first).toLocaleDateString()} to ${new Date(last).toLocaleDateString()}` : "No events";

  return createPortal(
    <div id="timeline-print">
      <header>
        <h1>DevTrack timeline</h1>
        <p>
          {ownerName ? `${ownerName} · ` : ""}{filterLabel} · {range} · {items.length} events
        </p>
        <p>Created {new Date().toLocaleString()}. "Verified" events come from connected sources (LeetCode, GitHub); the rest were entered in DevTrack.</p>
        {truncated ? <p>Only the newest {items.length} events are included.</p> : null}
      </header>
      {days.map(group => (
        <section key={group.day}>
          <h2>{group.day}</h2>
          <table>
            <tbody>
              {group.items.map(item => (
                <tr key={item._id}>
                  <td className="tp-time">{new Date(item.occurredAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>
                    <span className="tp-label">{activityLabel(item.type)}{item.source === "verified" ? " · Verified" : ""}</span>
                    <span className="tp-title">{item.title}</span>
                    {item.detail ? <span className="tp-detail">{item.detail}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>,
    document.body
  );
}

export default TimelinePrint;
