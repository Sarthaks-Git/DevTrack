import { useEffect, useState } from "react";
import SettingsSection, { Notice } from "./SettingsSection";
import ConfirmModal from "../common/ConfirmModal";
import { getAiStatus, setAiConsent } from "../../services/aiService";

const QUEUED = "Your commits are queued and will be reviewed on the next sync.";

// Plain wording for the code words the server stores about the last background AI run.
function issueText({ code, reason }) {
  if (code === "AI_UNAVAILABLE") {
    if (reason === "misconfigured" || reason === "rejected") return `The AI service rejected the request (server setup). ${QUEUED}`;
    if (reason === "rate_limited") return `The AI service was busy. ${QUEUED}`;
    return `The AI service could not be reached. ${QUEUED}`;
  }
  if (code === "GITHUB_REAUTH_REQUIRED") return "GitHub access expired. Reconnect GitHub below to resume code review.";
  if (code === "GITHUB_UNAVAILABLE") return `GitHub could not be reached for code review. ${QUEUED}`;
  if (code === "AI_QUOTA_REACHED") return "You've used this month's AI actions. Remaining commits will be reviewed after the 1st.";
  if (code === "AI_BUDGET_REACHED") return "AI is paused on this server for the rest of the month. Commits stay queued.";
  return "The AI could not answer for some commits, so they were skipped.";
}

function AISection() {
  const [state, setState] = useState({ loading: true, status: null });
  const [notice, setNotice] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [confirmOn, setConfirmOn] = useState(false);

  useEffect(() => {
    let active = true;
    getAiStatus()
      .then(status => active && setState({ loading: false, status }))
      .catch(error => {
        if (!active) return;
        setState({ loading: false, status: null });
        setNotice({ kind: "error", text: error.message });
      });
    return () => {
      active = false;
    };
  }, []);

  async function change(enabled) {
    setBusy(true);
    setNotice({ kind: "", text: "" });
    try {
      const status = await setAiConsent(enabled);
      setState({ loading: false, status });
      setNotice({
        kind: "ok",
        text: enabled
          ? "AI features are on. Recent commits on linked repositories are being reviewed; checks appear on your project cards."
          : "AI features are off. Nothing more is sent to the AI provider. Existing security checks stay.",
      });
    } catch (error) {
      setNotice({ kind: "error", text: error.message });
    } finally {
      setBusy(false);
      setConfirmOn(false);
    }
  }

  const status = state.status;
  const usage = status?.usage;

  return (
    <SettingsSection
      number="05"
      label="AI"
      title="AI features"
      description="Optional. When on, DevTrack asks an AI model to suggest security checks for your commits. Code review of changed lines is a separate switch on each linked repository. Suggestions are labelled AI and never count as verified progress."
    >
      {state.loading ? (
        <p className="text-sm text-[var(--dt-text-secondary)]">Loading AI settings...</p>
      ) : !status?.available ? (
        <p className="max-w-3xl text-sm text-[var(--dt-text-muted)]">AI features are not set up on this server yet.</p>
      ) : (
        <div className="max-w-3xl border border-[var(--dt-border)] p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dt-text-primary)]">{status.enabled ? "On" : "Off"}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--dt-text-secondary)]">
                Sent to Anthropic: the first line of your commit messages and the changed file names. Never your code, email or tokens. By default Anthropic does not train its models on API data.
              </p>
            </div>
            <button
              type="button"
              onClick={() => (status.enabled ? change(false) : setConfirmOn(true))}
              disabled={busy}
              aria-pressed={status.enabled}
              className={status.enabled ? "border border-[var(--dt-border)] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--dt-text-primary)] hover:border-[var(--dt-border-strong)] disabled:opacity-50" : "dt-primary-button"}
            >
              {busy ? "Saving..." : status.enabled ? "Turn off" : "Turn on"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="AI model">
            {status.tiers.map(tier => (
              <div
                key={tier.id}
                role="radio"
                aria-checked={status.plan === tier.id}
                aria-disabled={!tier.available}
                className={`border p-4 ${status.plan === tier.id ? "border-[var(--dt-accent)]" : "border-[var(--dt-border)] opacity-60"}`}
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">{tier.label}</p>
                <p className="mt-1 text-sm text-[var(--dt-text-primary)]">{tier.model || "Stronger model"}</p>
                <p className="mt-1 text-xs text-[var(--dt-text-secondary)]">{tier.available ? "Included" : "Paid plan, coming later"}</p>
              </div>
            ))}
          </div>

          {status.enabled && status.lastIssue ? (
            <p role="status" className="mt-4 border-l-2 border-amber-400/60 pl-3 text-xs leading-5 text-amber-200">
              Last review did not finish: {issueText(status.lastIssue)}
              {status.lastIssue.at ? <span className="text-[var(--dt-text-muted)]"> ({new Date(status.lastIssue.at).toLocaleString()})</span> : null}
            </p>
          ) : null}

          {usage ? (
            <p className="mt-4 text-xs text-[var(--dt-text-muted)]">
              Used {usage.used} of {usage.limit} AI actions this month. Resets on the 1st.
            </p>
          ) : null}
        </div>
      )}
      <Notice kind={notice.kind}>{notice.text}</Notice>

      <ConfirmModal
        open={confirmOn}
        title="Turn on AI features?"
        confirmLabel="Turn on"
        busyLabel="Turning on..."
        busy={busy}
        onConfirm={() => change(true)}
        onCancel={() => setConfirmOn(false)}
      >
        The first line of your commit messages and the changed file names from linked repositories will be sent to Anthropic to suggest security checks. Your code, email and tokens are never sent. You can turn this off at any time.
      </ConfirmModal>
    </SettingsSection>
  );
}

export default AISection;
