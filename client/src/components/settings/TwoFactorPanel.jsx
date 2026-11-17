import { useEffect, useState } from "react";
import ConfirmModal from "../common/ConfirmModal";
import { Notice } from "./SettingsSection";
import { disableTwoFactor, enableTwoFactor, getTwoFactorStatus, regenerateRecoveryCodes, startTwoFactorSetup } from "../../services/authService";

const isCode = value => /^\d{6}$/.test(value);

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";
}

// Backup codes are shown once: copy or download them before closing.
function RecoveryCodes({ codes, onDone }) {
  const [copied, setCopied] = useState(false);
  const text = `DevTrack backup codes (each works once)\n\n${codes.join("\n")}\n`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "devtrack-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-4 max-w-xl border border-amber-400/40 p-5">
      <p className="text-sm text-[var(--dt-text-primary)]">Save these backup codes now</p>
      <p className="mt-1 text-xs leading-5 text-[var(--dt-text-secondary)]">
        If you lose your phone, each code signs you in once. They will not be shown again. Keep them somewhere safe, like a password manager.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm text-[var(--dt-text-primary)]">
        {codes.map(code => <li key={code}>{code}</li>)}
      </ul>
      <div className="mt-5 flex flex-wrap gap-4 text-xs">
        <button type="button" onClick={copy} className="dt-link-button">{copied ? "Copied" : "Copy"}</button>
        <button type="button" onClick={download} className="dt-link-button">Download .txt</button>
        <button type="button" onClick={onDone} className="dt-primary-button ml-auto">I saved them</button>
      </div>
    </div>
  );
}

function TwoFactorPanel({ user }) {
  const needsPassword = user?.hasPassword !== false;
  const [status, setStatus] = useState(null);
  const [notice, setNotice] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [backup, setBackup] = useState("");

  useEffect(() => {
    let active = true;
    getTwoFactorStatus()
      .then(result => active && setStatus(result))
      .catch(error => active && setNotice({ kind: "error", text: error.message }));
    return () => {
      active = false;
    };
  }, []);

  async function run(action, after) {
    setBusy(true);
    setNotice({ kind: "", text: "" });
    try {
      await after(await action());
    } catch (error) {
      setNotice({ kind: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  const refresh = async () => setStatus(await getTwoFactorStatus());

  function begin(event) {
    event.preventDefault();
    run(() => startTwoFactorSetup(needsPassword ? password : undefined), result => {
      setPassword("");
      setCode("");
      setSetup(result);
    });
  }

  function confirmSetup(event) {
    event.preventDefault();
    run(() => enableTwoFactor(code), async result => {
      setSetup(null);
      setCode("");
      setCodes(result.recoveryCodes);
      await refresh();
    });
  }

  function regenerate(event) {
    event.preventDefault();
    run(() => regenerateRecoveryCodes(code), result => {
      setRegenerating(false);
      setCode("");
      setCodes(result.recoveryCodes);
      return refresh();
    });
  }

  function closeDisable() {
    if (busy) return;
    setDisabling(false);
    setPassword("");
    setCode("");
    setBackup("");
  }

  function turnOff() {
    const second = backup ? { recoveryCode: backup.trim() } : { code };
    run(() => disableTwoFactor({ ...(needsPassword ? { currentPassword: password } : {}), ...second }), async () => {
      setDisabling(false);
      setPassword("");
      setCode("");
      setBackup("");
      setNotice({ kind: "ok", text: "Two-factor authentication is off." });
      await refresh();
    });
  }

  return (
    <div id="two-factor" className="mt-10 max-w-3xl scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--dt-text-primary)]">Two-factor authentication</p>
        {status ? <span className={`dt-badge ${status.enabled ? "dt-badge-verified" : ""}`}>{status.enabled ? "On" : "Off"}</span> : null}
      </div>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--dt-text-secondary)]">
        After your password or Google, GitHub or LinkedIn, DevTrack also asks for a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy). A stolen password alone is then not enough.
      </p>

      {!status ? (
        <p className="mt-4 text-sm text-[var(--dt-text-secondary)]">Loading...</p>
      ) : codes ? (
        <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />
      ) : setup ? (
        <form onSubmit={confirmSetup} className="mt-4 grid max-w-xl gap-4 border border-[var(--dt-border)] p-5 sm:grid-cols-[220px_minmax(0,1fr)]">
          <img src={setup.qrDataUrl} alt="QR code to add DevTrack to your authenticator app" width="220" height="220" className="bg-white" />
          <div className="min-w-0 text-xs leading-5 text-[var(--dt-text-secondary)]">
            <p>1. Scan this QR code with your authenticator app.</p>
            <p className="mt-2">Can't scan? Enter this key instead:</p>
            <p className="mt-1 break-all font-mono text-sm text-[var(--dt-text-primary)]">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
            <label className="dt-label mt-4 block">
              2. Enter the 6-digit code it shows
              <input className="dt-input font-mono tracking-[0.3em]" value={code} onChange={event => setCode(event.target.value.trim())} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
            </label>
            <div className="mt-4 flex flex-wrap gap-4">
              <button type="submit" className="dt-primary-button" disabled={busy || !isCode(code)}>{busy ? "Checking..." : "Turn on"}</button>
              <button type="button" className="dt-link-button" onClick={() => setSetup(null)} disabled={busy}>Cancel</button>
            </div>
          </div>
        </form>
      ) : status.enabled ? (
        <div className="mt-4">
          <p className="text-xs text-[var(--dt-text-muted)]">
            On since {formatDay(status.enabledAt)} · {status.recoveryCodesLeft} backup code{status.recoveryCodesLeft === 1 ? "" : "s"} left
          </p>
          {regenerating ? (
            <form onSubmit={regenerate} className="mt-4 flex max-w-xl flex-wrap items-end gap-3">
              <label className="dt-label">
                Code from your app
                <input className="dt-input font-mono tracking-[0.3em]" value={code} onChange={event => setCode(event.target.value.trim())} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
              </label>
              <button type="submit" className="dt-primary-button" disabled={busy || !isCode(code)}>{busy ? "Creating..." : "Create new codes"}</button>
              <button type="button" className="dt-link-button" onClick={() => setRegenerating(false)} disabled={busy}>Cancel</button>
            </form>
          ) : (
            <div className="mt-4 flex flex-wrap gap-5 text-xs">
              <button type="button" className="dt-link-button" onClick={() => { setCode(""); setRegenerating(true); }}>New backup codes</button>
              <button type="button" className="text-[var(--dt-text-muted)] hover:text-red-300" onClick={() => { setCode(""); setDisabling(true); }}>Turn off</button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={begin} className="mt-4 flex max-w-xl flex-wrap items-end gap-3">
          {needsPassword ? (
            <label className="dt-label">
              Current password
              <input className="dt-input" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" />
            </label>
          ) : null}
          <button type="submit" className="dt-primary-button" disabled={busy || (needsPassword && !password)}>{busy ? "Starting..." : "Set up"}</button>
        </form>
      )}
      <Notice kind={notice.kind}>{notice.text}</Notice>

      <ConfirmModal
        open={disabling}
        title="Turn off two-factor authentication?"
        confirmLabel="Turn off"
        busyLabel="Turning off..."
        destructive
        busy={busy}
        confirmDisabled={(needsPassword && !password) || !(isCode(code) || backup.trim().length >= 10)}
        onConfirm={turnOff}
        onCancel={closeDisable}
      >
        <p>Your account will be protected by your password or sign-in provider only.</p>
        {needsPassword ? (
          <label className="dt-label mt-4 block">
            Current password
            <input className="dt-input" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
        ) : null}
        <label className="dt-label mt-4 block">
          Code from your app
          <input className="dt-input font-mono tracking-[0.3em]" value={code} onChange={event => { setCode(event.target.value.trim()); setBackup(""); }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
        </label>
        <label className="dt-label mt-4 block">
          Or a backup code
          <input className="dt-input font-mono" value={backup} onChange={event => { setBackup(event.target.value); setCode(""); }} autoComplete="off" maxLength={14} />
        </label>
      </ConfirmModal>
    </div>
  );
}

export default TwoFactorPanel;
