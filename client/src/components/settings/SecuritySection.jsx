import { useCallback, useEffect, useState } from "react";
import SettingsSection, { Notice } from "./SettingsSection";
import ConfirmModal from "../common/ConfirmModal";
import { changePassword, getSessions, revokeSession, logoutEverywhere } from "../../services/authService";

const MIN_LENGTH = 12;
const MAX_BYTES = 72;

function passwordHint(password, user) {
  if (!password) return "";
  if (password.length < MIN_LENGTH) return `At least ${MIN_LENGTH} characters (${password.length} so far).`;
  if (new TextEncoder().encode(password).length > MAX_BYTES) return "Too long: keep it under 72 bytes.";
  if (password !== password.trim()) return "Remove spaces at the start or end.";
  if (user?.username && password.toLowerCase().includes(user.username)) return "Do not include your username.";
  return "";
}

function formatWhen(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SecuritySection({ user, onSignedOut }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState({ kind: "", text: "" });

  const [sessions, setSessions] = useState(null);
  const [sessionsError, setSessionsError] = useState("");
  const [revokingId, setRevokingId] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const hint = passwordHint(newPassword, user);
  const mismatch = confirmPassword && confirmPassword !== newPassword;

  const loadSessions = useCallback(async () => {
    try {
      setSessionsError("");
      setSessions(await getSessions());
    } catch (error) {
      setSessionsError(error.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getSessions()
      .then(result => active && setSessions(result))
      .catch(error => active && setSessionsError(error.message));
    return () => {
      active = false;
    };
  }, []);

  async function handlePassword(event) {
    event.preventDefault();
    setSaving(true);
    setPasswordStatus({ kind: "", text: "" });
    try {
      const result = await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus({ kind: "ok", text: result.message });
      await loadSessions();
    } catch (error) {
      const detail = error.response?.data?.errors?.newPassword;
      setPasswordStatus({ kind: "error", text: detail || error.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(session) {
    setRevokingId(session.id);
    try {
      await revokeSession(session.id);
      if (session.current) {
        onSignedOut();
        return;
      }
      setSessions(previous => previous.filter(item => item.id !== session.id));
    } catch (error) {
      setSessionsError(error.message);
    } finally {
      setRevokingId("");
    }
  }

  async function handleSignOutAll() {
    setSigningOutAll(true);
    try {
      await logoutEverywhere();
      onSignedOut();
    } catch (error) {
      setSessionsError(error.message);
      setSigningOutAll(false);
      setConfirmAll(false);
    }
  }

  return (
    <SettingsSection number="02" label="Security" title="Password and sessions" description="Changing your password signs out every other device. Review where you are signed in and end sessions you do not recognize.">
      <form onSubmit={handlePassword} className="grid max-w-2xl gap-5 sm:grid-cols-2">
        <label className="dt-label sm:col-span-2">
          Current password
          <input className="dt-input" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        <label className="dt-label">
          New password
          <input className="dt-input" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(hint)} aria-describedby="new-password-hint" required />
        </label>
        <label className="dt-label">
          Confirm new password
          <input className="dt-input" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(mismatch)} required />
        </label>
        <p id="new-password-hint" className="text-xs text-[var(--dt-text-muted)] sm:col-span-2">
          {hint || (mismatch ? "Passwords do not match." : "Use 12+ characters. A long passphrase is easiest to remember.")}
        </p>
        <div className="sm:col-span-2">
          <button type="submit" className="dt-primary-button" disabled={saving || !currentPassword || !newPassword || Boolean(hint) || mismatch}>
            {saving ? "Updating..." : "Update password"}
          </button>
        </div>
      </form>
      <Notice kind={passwordStatus.kind}>{passwordStatus.text}</Notice>

      <div className="mt-10 max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--dt-text-primary)]">Active sessions</p>
          <button type="button" className="dt-link-button" onClick={() => setConfirmAll(true)} disabled={!sessions?.length}>
            Sign out everywhere
          </button>
        </div>
        {sessionsError ? <Notice kind="error">{sessionsError}</Notice> : null}
        {!sessions && !sessionsError ? <p className="text-sm text-[var(--dt-text-secondary)]">Loading sessions...</p> : null}
        <ul className="divide-y divide-[var(--dt-border)] border border-[var(--dt-border)]">
          {(sessions || []).map(session => (
            <li key={session.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-[var(--dt-text-primary)]">
                  {session.device}
                  {session.current ? <span className="dt-badge dt-badge-verified ml-3">This device</span> : null}
                </p>
                <p className="mt-1 text-xs text-[var(--dt-text-muted)]">
                  Signed in {formatWhen(session.createdAt)} · last active {formatWhen(session.lastActiveAt)}
                </p>
              </div>
              <button type="button" className="dt-link-button self-start sm:self-auto" onClick={() => handleRevoke(session)} disabled={revokingId === session.id}>
                {revokingId === session.id ? "Ending..." : session.current ? "Sign out" : "End session"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ConfirmModal
        open={confirmAll}
        title="Sign out everywhere?"
        confirmLabel="Sign out all devices"
        busyLabel="Signing out..."
        busy={signingOutAll}
        onConfirm={handleSignOutAll}
        onCancel={() => setConfirmAll(false)}
      >
        Every session, including this one, will end. You will need to sign in again.
      </ConfirmModal>
    </SettingsSection>
  );
}

export default SecuritySection;
