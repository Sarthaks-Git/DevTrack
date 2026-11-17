import { useEffect, useState } from "react";
import { requestPasswordReset, resetPassword } from "../../services/authService";

const COOLDOWN_SECONDS = 60;
const INPUT = "w-full border-b border-[var(--dt-border)] bg-transparent px-0 py-3 text-base text-[var(--dt-text-primary)] outline-none transition-colors duration-200 placeholder:text-[var(--dt-text-muted)] focus:border-[var(--dt-accent)] disabled:cursor-not-allowed disabled:opacity-50";
const LABEL = "mb-3 block text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--dt-text-muted)]";
const PRIMARY = "mt-9 w-full border border-[var(--dt-accent)] bg-[var(--dt-accent)] px-6 py-4 text-xs font-medium uppercase tracking-[0.2em] text-white transition-all duration-200 hover:border-[var(--dt-accent-soft)] hover:bg-[var(--dt-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50";

// Login page "Forgot password?": email → code + new password. On success the user signs in again
// (with the authenticator code too, when 2FA is on).
function ForgotPassword({ initialEmail = "", onDone, onCancel }) {
  const [stage, setStage] = useState("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ kind: "", text: "" });
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode(event) {
    event?.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setNotice({ kind: "error", text: "Email is required." });
      return;
    }
    setBusy(true);
    setNotice({ kind: "", text: "" });
    try {
      await requestPasswordReset(normalized);
      setEmail(normalized);
      setStage("code");
      setCooldown(COOLDOWN_SECONDS);
      setNotice({ kind: "ok", text: `If an account uses ${normalized}, a 6-digit code is on its way. Check spam too.` });
    } catch (error) {
      setNotice({ kind: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(event) {
    event.preventDefault();
    if (password !== confirm) {
      setNotice({ kind: "error", text: "The two passwords do not match." });
      return;
    }
    setBusy(true);
    setNotice({ kind: "", text: "" });
    try {
      await resetPassword({ email, code, newPassword: password });
      onDone("Password changed and every device signed out. Sign in with your new password.");
    } catch (error) {
      const field = error.response?.data?.errors?.newPassword;
      setNotice({ kind: "error", text: field || error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-y border-[var(--dt-border)] py-8">
      <h2 className="text-lg text-[var(--dt-text-primary)]">Reset your password</h2>

      {notice.text ? (
        <div role={notice.kind === "error" ? "alert" : "status"} className={`mt-5 border-l-2 px-4 py-3 text-sm leading-6 ${notice.kind === "error" ? "border-red-400/70 bg-red-400/5 text-red-300" : "border-emerald-400/70 bg-emerald-400/5 text-emerald-200"}`}>
          {notice.text}
        </div>
      ) : null}

      {stage === "email" ? (
        <form onSubmit={sendCode} noValidate className="mt-6">
          <p className="mb-6 text-sm leading-6 text-[var(--dt-text-secondary)]">Enter your account email. We will send a 6-digit code to it.</p>
          <label htmlFor="forgot-email" className={LABEL}>Email</label>
          <input id="forgot-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" autoFocus maxLength={254} placeholder="you@example.com" disabled={busy} className={INPUT} />
          <button type="submit" disabled={busy || !email.trim()} className={PRIMARY}>{busy ? "Sending..." : "Send code"}</button>
        </form>
      ) : (
        <form onSubmit={submitReset} noValidate className="mt-6 space-y-7">
          <div>
            <label htmlFor="reset-code" className={LABEL}>Code from the email</label>
            <input id="reset-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" disabled={busy} className={`${INPUT} font-mono tracking-[0.3em]`} />
          </div>
          <div>
            <label htmlFor="reset-password" className={LABEL}>New password</label>
            <input id="reset-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 12 characters" disabled={busy} className={INPUT} />
          </div>
          <div>
            <label htmlFor="reset-confirm" className={LABEL}>Repeat new password</label>
            <input id="reset-confirm" type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" disabled={busy} className={INPUT} />
          </div>
          <button type="submit" disabled={busy || code.length !== 6 || password.length < 12 || !confirm} className={PRIMARY}>{busy ? "Saving..." : "Set new password"}</button>
        </form>
      )}

      <div className="mt-6 flex flex-wrap justify-between gap-3 text-xs">
        {stage === "code" ? (
          <button type="button" onClick={() => sendCode()} disabled={busy || cooldown > 0} className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50">
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        ) : <span />}
        <button type="button" onClick={onCancel} disabled={busy} className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">Back to sign in</button>
      </div>
    </div>
  );
}

export default ForgotPassword;
