import { useEffect, useRef, useState } from "react";
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
  const [copyState, setCopyState] = useState("");
  const tokenRef = useRef(null);
  const copyTimer = useRef(null);

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
      clearTimeout(copyTimer.current);
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

  // Older browsers and some embedded views block navigator.clipboard; fall back to a hidden
  // textarea, and if that fails too, select the token so the user can copy it themselves.
  function copyWithFallback(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let copied;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    document.body.removeChild(area);
    return copied;
  }

  function selectToken() {
    const node = tokenRef.current;
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function handleCopy() {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(challenge.token);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) copied = copyWithFallback(challenge.token);
    if (!copied) selectToken();
    setCopyState(copied ? "copied" : "failed");
    clearTimeout(copyTimer.current);
    // The failure hint is an instruction, so it stays until the next attempt.
    if (copied) copyTimer.current = setTimeout(() => setCopyState(""), 2500);
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
    <SettingsSection number="04" label="Connected accounts" title="Coding platforms" description="Connect and verify accounts here. Ownership is proven with a one-time token, so nobody can claim your profile. The Coding page only shows statistics.">
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
            <button type="button" onClick={() => setConfirmDisconnect(true)} className="mt-5 border border-red-400/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-red-400 hover:bg-red-400/10">
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
                    <code ref={tokenRef} className="min-w-0 flex-1 break-all border border-[var(--dt-border)] px-3 py-2.5 text-xs text-[var(--dt-text-primary)]">{challenge.token}</code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`shrink-0 border px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors ${copyState === "copied" ? "border-[var(--dt-verified-border)] text-[var(--dt-verified)]" : "border-[var(--dt-border-strong)] text-[var(--dt-text-primary)] hover:bg-[var(--dt-surface-elevated)]"}`}
                    >
                      {copyState === "copied" ? "Copied ✓" : "Copy token"}
                    </button>
                  </div>
                  <p role="status" aria-live="polite" className={`mt-2 min-h-4 text-xs ${copyState === "failed" ? "text-amber-300" : "text-[var(--dt-verified)]"}`}>
                    {copyState === "copied" ? "Token copied to your clipboard." : copyState === "failed" ? "Your browser blocked copying. The token is selected: press Ctrl+C (or ⌘C)." : ""}
                  </p>
                  <p className="mt-5 text-sm font-medium text-[var(--dt-text-primary)]">Step 2: paste it back to verify</p>
                  <form onSubmit={handleVerify} className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <label className="sr-only" htmlFor="settings-verification-token">Verification token</label>
                    <input id="settings-verification-token" className="dt-input mt-0 min-w-0 flex-1" value={verificationToken} onChange={event => setVerificationToken(event.target.value)} placeholder="Paste token to verify ownership" required />
                    <button type="submit" className="dt-primary-button" disabled={verifying || !verificationToken.trim()}>
                      {verifying ? "Verifying..." : "Verify ownership"}
                    </button>
                  </form>
                  <button type="button" onClick={() => { setChallenge(null); setVerificationToken(""); }} className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">
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
                <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--dt-text-muted)]">Coming soon</span>
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
