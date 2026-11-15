import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ActivityItem from "../activity/ActivityItem";
import { relativeTime } from "../activity/activityMeta";
import { getActivity, getActivitySummary } from "../../services/activityService";
import { getCodingProfiles, syncLeetCode } from "../../services/codingService";

function SectionTitle({ children, to, linkLabel }) {
  return (
    <div className="mb-5 flex items-end justify-between border-b border-[var(--dt-border)] pb-4">
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">{children}</p>
      {to ? <Link to={to} className="dt-link-button text-[10px]">{linkLabel}</Link> : null}
    </div>
  );
}

function CodingSnapshot({ profile }) {
  if (!profile) {
    return (
      <div className="dt-card">
        <p className="text-sm text-[var(--dt-text-secondary)]">No coding platform connected yet.</p>
        <Link to="/app/settings" className="dt-link-button mt-4 inline-block">Connect in Settings →</Link>
      </div>
    );
  }
  const stats = profile.stats || {};
  const synced = Boolean(stats.lastFetchedAt);
  return (
    <div className="dt-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--dt-text-primary)]">LeetCode · @{profile.username}</p>
        <span className="dt-badge dt-badge-verified">Verified</span>
      </div>
      {synced ? (
        <>
          <p className="mt-5 font-[family-name:var(--dt-font-display)] text-5xl text-[var(--dt-text-primary)]">{stats.totalSolved}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">problems solved</p>
          <p className="mt-4 text-xs text-[var(--dt-text-secondary)]">
            {stats.easySolved} easy · {stats.mediumSolved} medium · {stats.hardSolved} hard
          </p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">Synced {relativeTime(stats.lastFetchedAt)}</p>
        </>
      ) : (
        <p className="mt-4 text-sm text-[var(--dt-text-secondary)]">Verified, but not synced yet.</p>
      )}
      <Link to="/app/coding" className="dt-link-button mt-5 inline-block">Open Coding →</Link>
    </div>
  );
}

// Secondary dashboard data. Each source fails independently so one outage never blanks the overview.
function DashboardPulse() {
  const [activity, setActivity] = useState(null);
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    let active = true;
    const load = () => {
      getActivity({ limit: 6 }).then(data => active && setActivity(data.items)).catch(() => active && setActivity([]));
      getActivitySummary().then(data => active && setSummary(data.counts)).catch(() => active && setSummary({}));
      return getCodingProfiles()
        .then(result => {
          const verified = result.data.profiles.find(item => item.platform === "leetcode" && item.connectionStatus === "verified") || null;
          if (active) setProfile(verified);
          return verified;
        })
        .catch(() => {
          if (active) setProfile(null);
          return null;
        });
    };
    // Show what is stored now; if LeetCode has new accepted problems, reload once they are in.
    load().then(verified => {
      if (!verified) return;
      syncLeetCode()
        .then(outcome => active && outcome?.status === "synced" && load())
        .catch(() => {});
    });
    return () => {
      active = false;
    };
  }, []);

  const weekWins = summary ? (summary.goal_completed || 0) + (summary.project_completed || 0) : null;
  const weekNotes = summary?.journal_created || 0;
  const weekProblems = summary?.problem_solved || 0;

  return (
    <section className="mt-16 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <SectionTitle to="/app/timeline" linkLabel="Full timeline →">Recent activity</SectionTitle>
        {summary ? (
          <p className="mb-4 text-sm text-[var(--dt-text-secondary)]">
            This week: <span className="text-[var(--dt-text-primary)]">{weekWins}</span> {weekWins === 1 ? "thing" : "things"} finished,{" "}
            <span className="text-[var(--dt-text-primary)]">{weekNotes}</span> journal {weekNotes === 1 ? "entry" : "entries"},{" "}
            <span className="text-[var(--dt-text-primary)]">{weekProblems}</span> {weekProblems === 1 ? "problem" : "problems"} solved.
          </p>
        ) : null}
        {activity === null ? <p className="text-sm text-[var(--dt-text-muted)]">Loading activity...</p> : null}
        {activity?.length === 0 ? (
          <p className="text-sm text-[var(--dt-text-muted)]">Nothing yet. Your goals, projects, and notes will show up here as you work.</p>
        ) : null}
        {activity?.length ? (
          <ol className="divide-y divide-[var(--dt-border)]">
            {activity.map(item => <ActivityItem key={item._id} item={item} compact />)}
          </ol>
        ) : null}
      </div>
      <div>
        <SectionTitle>Coding snapshot</SectionTitle>
        {profile === undefined ? <p className="text-sm text-[var(--dt-text-muted)]">Loading...</p> : <CodingSnapshot profile={profile} />}
      </div>
    </section>
  );
}

export default DashboardPulse;
