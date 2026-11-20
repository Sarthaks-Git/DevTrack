import { useEffect, useState } from "react";
import SettingsSection, { Notice } from "./SettingsSection";
import { getReminderSettings, updateReminderSettings } from "../../services/notificationService";
import PushPanel from "./PushPanel";

const inputClass =
  "w-28 border border-[var(--dt-border)] bg-[var(--dt-surface)] px-3 py-2 text-sm text-[var(--dt-text-primary)] outline-none focus:border-[var(--dt-accent)]";

function RemindersSection() {
  const [settings, setSettings] = useState(null);
  const [days, setDays] = useState("14");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ kind: "", text: "" });

  useEffect(() => {
    let active = true;
    getReminderSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setDays(String(data.stalledAfterDays));
      })
      .catch((error) => active && setStatus({ kind: "error", text: error.message }));
    return () => {
      active = false;
    };
  }, []);

  async function save(changes, message) {
    setSaving(true);
    setStatus({ kind: "", text: "" });
    try {
      const data = await updateReminderSettings(changes);
      setSettings(data);
      setDays(String(data.stalledAfterDays));
      setStatus({ kind: "ok", text: message });
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  function saveDays(event) {
    event.preventDefault();
    const value = Number(days);
    if (!Number.isInteger(value) || value < 3 || value > 60) {
      setStatus({ kind: "error", text: "Choose a whole number of days from 3 to 60." });
      return;
    }
    save({ stalledAfterDays: value }, `Goals and projects in progress are now flagged after ${value} idle days.`);
  }

  return (
    <SettingsSection
      number="07"
      label="Reminders"
      title="Reminders"
      description="DevTrack checks your goals and projects and nudges you in Alerts when something is overdue, stalled, or a verified target is reached. New reminders can also come to your inbox as one short email each morning."
    >
      {!settings ? (
        status.text ? null : <p className="text-sm text-[var(--dt-text-muted)]">Loading...</p>
      ) : (
        <div className="space-y-6">
          <label className="flex items-start gap-3 text-sm text-[var(--dt-text-secondary)]">
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={saving}
              onChange={(event) => save({ enabled: event.target.checked }, event.target.checked ? "Reminders are on." : "Reminders are off.")}
              className="mt-1"
            />
            <span>Send me in-app reminders</span>
          </label>

          <label className="flex items-start gap-3 text-sm text-[var(--dt-text-secondary)]">
            <input
              type="checkbox"
              checked={settings.email}
              disabled={saving || !settings.enabled}
              onChange={(event) => save({ email: event.target.checked }, event.target.checked ? "You'll get one email each morning when there are new reminders." : "Reminder emails are off.")}
              className="mt-1"
            />
            <span>
              Email me new reminders
              <span className="block text-xs text-[var(--dt-text-muted)]">One summary around 8 am (India time), only on days with something new.</span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-[var(--dt-text-secondary)]">
            <input
              type="checkbox"
              checked={settings.deadlineAlerts}
              disabled={saving || !settings.enabled}
              onChange={(event) => save({ deadlineAlerts: event.target.checked }, event.target.checked ? "Deadline alerts are on." : "Deadline alerts are off.")}
              className="mt-1"
            />
            <span>Alert me about overdue and upcoming deadlines</span>
          </label>

          <label className="flex items-start gap-3 text-sm text-[var(--dt-text-secondary)]">
            <input
              type="checkbox"
              checked={settings.weeklyReview}
              disabled={saving || !settings.enabled}
              onChange={(event) => save({ weeklyReview: event.target.checked }, event.target.checked ? "Weekly review reminders are on." : "Weekly review reminders are off.")}
              className="mt-1"
            />
            <span>Tell me when last week's review is ready</span>
          </label>

          <form onSubmit={saveDays} className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="stalled-days" className="mb-2 block text-xs uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
                Flag as stalled after
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="stalled-days"
                  type="number"
                  min={3}
                  max={60}
                  step={1}
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  disabled={saving}
                  className={inputClass}
                />
                <span className="text-sm text-[var(--dt-text-secondary)]">days without progress</span>
              </div>
            </div>
            <button type="submit" disabled={saving || String(settings.stalledAfterDays) === days} className="dt-link-button">
              {saving ? "Saving..." : "Save"}
            </button>
          </form>
          <p className="text-xs leading-5 text-[var(--dt-text-muted)]">
            This also sets when the dashboard marks work as stalled. Progress includes edits, milestones, linked journal notes and work on linked projects.
          </p>

          <PushPanel remindersOn={settings.enabled} />
        </div>
      )}
      <Notice kind={status.kind === "error" ? "error" : "ok"}>{status.text}</Notice>
    </SettingsSection>
  );
}

export default RemindersSection;
