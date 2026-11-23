import ActivityItem from "../../components/activity/ActivityItem";
import DayStrip from "../../components/dashboard/DayStrip";
import AppFrame from "./AppFrame";
import { sampleActivity, sampleAttention, sampleCoding, sampleWeek } from "../sampleData";

// Same markup as the dashboard's sections (NeedsAttention, WeeklySnapshot, DashboardPulse),
// fed with sample data instead of API calls. DayStrip and ActivityItem are the real components.
function SectionTitle({ children, link }) {
  return (
    <div className="mb-3 flex items-end justify-between border-b border-[var(--dt-border)] pb-3">
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">{children}</p>
      {link ? <span className="dt-link-button text-[11px]">{link}</span> : null}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="font-[family-name:var(--dt-font-display)] text-3xl text-[var(--dt-text-primary)]">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">{label}</p>
    </div>
  );
}

export default function DashboardMock() {
  return (
    <AppFrame eyebrow="01 — Overview" title="Good evening">
      <section>
        <SectionTitle>Needs attention</SectionTitle>
        <ol>
          {sampleAttention.map((item, index) => (
            <li key={item.title} className="grid grid-cols-[28px_1fr] gap-3 border-b border-[var(--dt-border)] py-3">
              <span className="font-mono text-[11px] tracking-[0.15em] text-[var(--dt-text-muted)]">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="text-base font-medium tracking-tight text-[var(--dt-text-primary)]">{item.title}</p>
                <p className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${item.urgent ? "text-red-300" : "text-[var(--dt-text-secondary)]"}`}>{item.reason}</p>
                <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">{item.next}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6">
        <SectionTitle link="Full review →">This week</SectionTitle>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-start">
          <div>
            <DayStrip days={sampleWeek.days} />
            <p className="mt-3 text-xs text-[var(--dt-text-secondary)]">Active {sampleWeek.activeDays} of {sampleWeek.daysElapsed} days so far</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat value={sampleWeek.solved} label="Verified solves" />
            <Stat value={sampleWeek.finished} label="Finished" />
            <Stat value={sampleWeek.journal} label="Journal" />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6">
        <div>
          <SectionTitle link="Full timeline →">Recent activity</SectionTitle>
          <ol className="divide-y divide-[var(--dt-border)]">
            {sampleActivity.slice(0, 3).map(item => <ActivityItem key={item._id} item={item} compact />)}
          </ol>
        </div>
        <div>
          <SectionTitle>Coding snapshot</SectionTitle>
          <div className="dt-card">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-[var(--dt-text-primary)]">LeetCode · @{sampleCoding.username}</p>
              <span className="dt-badge dt-badge-verified">Verified</span>
            </div>
            <p className="mt-3 font-[family-name:var(--dt-font-display)] text-4xl text-[var(--dt-text-primary)]">{sampleCoding.totalSolved}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">problems solved</p>
            <p className="mt-4 text-xs text-[var(--dt-text-secondary)]">
              {sampleCoding.easySolved} easy · {sampleCoding.mediumSolved} medium · {sampleCoding.hardSolved} hard
            </p>
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
