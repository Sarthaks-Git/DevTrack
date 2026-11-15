import { useEffect, useState } from "react";
import SettingsSection, { Notice } from "./SettingsSection";
import ConfirmModal from "../common/ConfirmModal";
import {
  getCodingProfiles,
  startLeetCodeVerification,
  verifyLeetCodeProfile,
  disconnectLeetCodeProfile,
} from "../../services/codingService";

// Shown so users know what is planned; never enabled until verified support ships (see CODING_PLATFORMS.md).
const UPCOMING = ["Codeforces", "CodeChef", "HackerRank", "LeetCode China"];

function PlatformsSection() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [verificationToken, setVerificationToken] = useState("");
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState({ kind: "", text: "" });

  useEffect(() => {
    let active = true;
    getCodingProfiles()
      .then(result => {
        if (!active) return;
        const linked = result.data.profiles.find(item => item.platform === "leetcode" && item.connectionStatus === "verified") || null;
        setProfile(linked);
        setLeetcodeUsername(linked?.username || "");
      })
      .catch(error => active && setStatus({ kind: "error", text: error.message }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function handleStart(event) {
    event.preventDefault();
    setStatus({ kind: "", text: "" });
    setStarting(true);
    try {
      const result = await startLeetCodeVerification(leetcodeUsername.trim());
      setChallenge(result.data.challenge);
      setVerificationToken("");
      setStatus({ kind: "ok", text: "Token created. Add it to your LeetCode About Me section, then verify below." });
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
    } finally {
      setStarting(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setStatus({ kind: "", text: "" });
    setVerifying(true);
    try {
      const result = await verifyLeetCodeProfile(verificationToken.trim());
      setProfile(result.data.profile);
      setLeetcodeUsername(result.data.profile.username);
      setChallenge(null);
      setVerificationToken("");
      setStatus({ kind: "ok", text: "LeetCode ownership verified. You can remove the token from your About Me now. Statistics appear in Coding." });
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
    } finally {
      setVerifying(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(challenge.token);
      setStatus({ kind: "ok", text: "Verification token copied." });
    } catch {
      setStatus({ kind: "error", text: "Clipboard access was unavailable. Copy the token manually." });
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectLeetCodeProfile();
      setProfile(null);
      setLeetcodeUsername("");
      setChallenge(null);
      setConfirmDisconnect(false);
      setStatus({ kind: "ok", text: "LeetCode was disconnected. Its statistics are no longer shown in Coding." });
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
      setConfirmDisconnect(false);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <SettingsSection number="03" label="Connected accounts" title="Coding platforms" description="Connect and verify accounts here. Ownership is proven with a one-time token, so nobody can claim your profile. The Coding page only shows statistics.">
      {loading ? (
        <p className="text-sm text-[var(--dt-text-secondary)]">Loading connections...</p>
      ) : (
        <div className="max-w-3xl border border-[var(--dt-border)] p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--dt-text-primary)]">LeetCode</p>
              <p className="mt-1 text-xs text-[var(--dt-text-secondary)]">{profile ? `Connected as @${profile.username}` : "Not connected"}</p>
            </div>
            <span className={`dt-badge ${profile ? "dt-badge-verified" : ""}`}>
              {profile ? "Verified" : challenge ? "Pending verification" : "Optional"}
            </span>
          </div>

          {profile ? (
            <button type="button" onClick={() => setConfirmDisconnect(true)} className="mt-5 border border-red-400/40 px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-red-400 hover:bg-red-400/10">
              Disconnect LeetCode
            </button>
          ) : (
            <>
              <form onSubmit={handleStart} className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="settings-leetcode-username">LeetCode username</label>
                <input id="settings-leetcode-username" className="dt-input mt-0 min-w-0 flex-1" value={leetcodeUsername} onChange={event => setLeetcodeUsername(event.target.value)} placeholder="LeetCode username" pattern="[A-Za-z0-9_-]+" maxLength={100} required />
                <button type="submit" className="dt-primary-button" disabled={starting || !leetcodeUsername.trim()}>
                  {starting ? "Generating..." : "Start verification"}
                </button>
              </form>

              {challenge ? (
                <div className="mt-5 border border-[var(--dt-border)] p-4">
                  <p className="text-sm font-medium text-[var(--dt-text-primary)]">Step 1: add this token to your LeetCode About Me</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--dt-text-secondary)]">
                    Save it in the About Me field on your LeetCode profile. It expires at {new Date(challenge.expiresAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <code className="min-w-0 flex-1 break-all border border-[var(--dt-border)] px-3 py-2.5 text-xs text-[var(--dt-text-primary)]">{challenge.token}</code>
                    <button type="button" onClick={handleCopy} className="dt-link-button px-3 text-left">Copy token</button>
                  </div>
                  <p className="mt-5 text-sm font-medium text-[var(--dt-text-primary)]">Step 2: paste it back to verify</p>
                  <form onSubmit={handleVerify} className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <label className="sr-only" htmlFor="settings-verification-token">Verification token</label>
                    <input id="settings-verification-token" className="dt-input mt-0 min-w-0 flex-1" value={verificationToken} onChange={event => setVerificationToken(event.target.value)} placeholder="Paste token to verify ownership" required />
                    <button type="submit" className="dt-primary-button" disabled={verifying || !verificationToken.trim()}>
                      {verifying ? "Verifying..." : "Verify ownership"}
                    </button>
                  </form>
                  <button type="button" onClick={() => { setChallenge(null); setVerificationToken(""); }} className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">
                    Cancel verification
                  </button>
                </div>
              ) : null}
            </>
          )}

          <div className="mt-6 grid gap-3 border-t border-[var(--dt-border)] pt-5 sm:grid-cols-2">
            {UPCOMING.map(platform => (
              <div key={platform} className="flex items-center justify-between border border-[var(--dt-border)]/70 px-3 py-3">
                <span className="text-sm text-[var(--dt-text-secondary)]">{platform}</span>
                <span className="text-[9px] uppercase tracking-[0.15em] text-[var(--dt-text-muted)]">Coming soon</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <Notice kind={status.kind}>{status.text}</Notice>

      <ConfirmModal
        open={confirmDisconnect}
        eyebrow="Confirm action"
        title="Disconnect LeetCode?"
        confirmLabel="Yes, disconnect"
        busyLabel="Disconnecting..."
        destructive
        busy={disconnecting}
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      >
        This removes the linked LeetCode profile and its saved statistics from DevTrack. Your LeetCode account itself is not changed.
      </ConfirmModal>
    </SettingsSection>
  );
}

export default PlatformsSection;
