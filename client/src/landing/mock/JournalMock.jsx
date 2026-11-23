import JournalEntryCard from "../../components/journal/JournalEntryCard";
import ActivityItem from "../../components/activity/ActivityItem";
import AppFrame from "./AppFrame";
import { sampleActivity, sampleJournalEntry } from "../sampleData";

const noop = () => {};

// The real JournalEntryCard, then the real timeline rows it sits among.
export default function JournalMock() {
  return (
    <AppFrame eyebrow="05 — Journal" title="Notes as you go">
      <JournalEntryCard entry={sampleJournalEntry} onEdit={noop} onDelete={noop} onTagClick={noop} />
      <p className="mt-6 border-b border-[var(--dt-border)] pb-3 text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">Timeline · 21 Nov</p>
      <ol className="divide-y divide-[var(--dt-border)]">
        {sampleActivity.slice(0, 3).map(item => <ActivityItem key={item._id} item={item} compact />)}
      </ol>
    </AppFrame>
  );
}
