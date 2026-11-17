import { useEffect, useState } from "react";
import SettingsSection, { Notice } from "./SettingsSection";
import { cancelEmailChange, confirmEmailChange, getEmailChange, resendEmailChange, updateProfile } from "../../services/authService";
import ReauthNotice from "./ReauthNotice";

const COOLDOWN_SECONDS = 60;

// Shown while a new email waits for its code. The account keeps its current email until then.
function PendingEmailChange({ pending, onConfirmed, onCleared, initialCooldown }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ kind: "", text: "" });
  const [cooldown, setCooldown] = useState(initialCooldown);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function run(action) {
    setBusy(true);
    setStatus({ kind: "", text: "" });
    try {
      await action();
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  function confirm(event) {
    event.preventDefault();
    run(async () => {
      const result = await confirmEmailChange(code);
      await onConfirmed(result.email);
    });
  }

  function resend() {
    run(async () => {
      await resendEmailChange();
      setCode("");
      setCooldown(COOLDOWN_SECONDS);
      setStatus({ kind: "ok", text: `A new code was sent to ${pending.pendingEmail}.` });
    });
  }

  function cancel() {
    run(async () => {
      await cancelEmailChange();
      onCleared();
    });
  }

  return (
    <div className="mt-6 max-w-2xl border border-[var(--dt-border)] p-5">
      <p className="text-sm leading-6 text-[var(--dt-text-secondary)]">
        Confirm your new email: we sent a 6-digit code to <span className="break-all text-[var(--dt-text-primary)]">{pending.pendingEmail}</span>.
        Your account keeps its current email until you enter it. Check spam if you do not see it.
      </p>
      {pending.codeUsable === false ? <p className="mt-2 text-sm text-[var(--dt-text-muted)]">That code has expired. Send a new one.</p> : null}
      <form onSubmit={confirm} className="mt-4 flex flex-wrap items-end gap-4">
        <label className="dt-label">
          Code
          <input className="dt-input font-mono tracking-[0.3em]" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" />
        </label>
        <button type="submit" className="dt-primary-button" disabled={busy || code.length !== 6}>{busy ? "Checking..." : "Confirm new email"}</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-5 text-xs">
        <button type="button" className="dt-link-button" onClick={resend} disabled={busy || cooldown > 0}>{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}</button>
        <button type="button" className="dt-link-button" onClick={cancel} disabled={busy}>Cancel change</button>
      </div>
      <Notice kind={status.kind}>{status.text}</Notice>
    </div>
  );
}

function AccountSection({ user, identities = [], onUpdated }) {
  // Accounts made through Google, GitHub or LinkedIn have no password; a recent sign-in confirms instead.
  const needsPassword = user?.hasPassword !== false;
  // The parent remounts this section (via key) when the user changes, so initial state stays in sync.
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ kind: "", text: "" });
  const [pending, setPending] = useState(null);
  const [pendingCooldown, setPendingCooldown] = useState(0);

  // A change started earlier (or on another visit) is still waiting: show its panel.
  useEffect(() => {
    if (!user?.emailVerified) return undefined;
    let active = true;
    getEmailChange()
      .then(result => {
        if (active && result.pendingEmail) setPending(result);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.emailVerified]);

  const unchanged = username.trim().toLowerCase() === user?.username && email.trim().toLowerCase() === user?.email;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setStatus({ kind: "", text: "" });
    try {
      const payload = needsPassword ? { currentPassword } : {};
      if (username.trim().toLowerCase() !== user.username) payload.username = username.trim();
      if (email.trim().toLowerCase() !== user.email) payload.email = email.trim();
      const result = await updateProfile(payload);
      setCurrentPassword("");
      if (result.pendingEmail) {
        // The field goes back to the current email; the panel below finishes the change.
        setEmail(user.email);
        setPendingCooldown(COOLDOWN_SECONDS);
        setPending({ pendingEmail: result.pendingEmail, codeUsable: true });
        setStatus({ kind: "ok", text: result.message });
        if (payload.username) await onUpdated();
        return;
      }
      setStatus({ kind: "ok", text: result.message });
      await onUpdated();
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection number="01" label="Account" title="Personal information" id="account" description={`${needsPassword ? "Changes require your current password." : "Changes require a recent sign-in."} A new email only takes effect after you enter the code sent to it; then your other devices are signed out.`}>
      <form onSubmit={handleSubmit} className="grid max-w-2xl gap-5 sm:grid-cols-2">
        <label className="dt-label">
          Username
          <input className="dt-input" value={username} onChange={event => setUsername(event.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z][A-Za-z0-9_]*" autoComplete="username" required />
        </label>
        <label className="dt-label">
          Email address
          <input className="dt-input" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} autoComplete="email" required />
        </label>
        {needsPassword ? (
          <label className="dt-label sm:col-span-2">
            Current password
            <input className="dt-input" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
          </label>
        ) : (
          <div className="sm:col-span-2"><ReauthNotice identities={identities} /></div>
        )}
        <div className="sm:col-span-2">
          <button type="submit" className="dt-primary-button" disabled={saving || unchanged || (needsPassword && !currentPassword)}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
      <Notice kind={status.kind}>{status.text}</Notice>
      {pending ? (
        <PendingEmailChange
          key={pending.pendingEmail}
          pending={pending}
          initialCooldown={pendingCooldown}
          onConfirmed={async () => {
            setPending(null);
            // Remounts this section with the new email (Settings keys it on username and email).
            await onUpdated();
          }}
          onCleared={() => {
            setPending(null);
            setStatus({ kind: "ok", text: "Email change cancelled. Your email stays the same." });
          }}
        />
      ) : null}
    </SettingsSection>
  );
}

export default AccountSection;
