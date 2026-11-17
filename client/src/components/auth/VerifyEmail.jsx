import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../context/authContextObject";
import { sendVerificationEmail, updateProfile, verifyEmail } from "../../services/authService";

const COOLDOWN_SECONDS = 60;

// Shown instead of the app until the account's email is confirmed with the code sent to it.
function VerifyEmail() {
  const { user, refreshUser, logout } = useContext(AuthContext);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ kind: "", text: "" });
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");

  // Accounts made before verification existed never got a code: send one on arrival. A code sent in
  // the last minute (at sign-up) answers with a cooldown, which simply means it is on its way.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    sendVerificationEmail()
      .then(result => (result.alreadyVerified ? refreshUser() : null))
      .catch(error => {
        if (error.response?.data?.code !== "EMAIL_RESEND_COOLDOWN") setNotice({ kind: "error", text: error.message });
      });
  }, [refreshUser]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function run(action) {
    setBusy(true);
    setNotice({ kind: "", text: "" });
    try {
      await action();
    } catch (error) {
      setNotice({ kind: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    run(async () => {
      await verifyEmail(code);
      await refreshUser();
    });
  }

  function resend() {
    run(async () => {
      const result = await sendVerificationEmail();
      if (result.alreadyVerified) {
        await refreshUser();
        return;
      }
      setCooldown(COOLDOWN_SECONDS);
      setCode("");
      setNotice({ kind: "ok", text: `A new code was sent to ${result.email}.` });
    });
  }

  function changeEmail(event) {
    event.preventDefault();
    run(async () => {
      const payload = { email: email.trim() };
      if (user?.hasPassword !== false) payload.currentPassword = password;
      const result = await updateProfile(payload);
      await refreshUser();
      setEditing(false);
      setPassword("");
      setCode("");
      setCooldown(COOLDOWN_SECONDS);
      setNotice(result.emailSent ? { kind: "ok", text: `Code sent to ${payload.email}.` } : { kind: "error", text: "Email changed, but the code could not be sent. Use Resend." });
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--dt-background)] px-6 py-12">
      <section className="w-full max-w-md">
        <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.35em] text-[var(--dt-text-muted)]">One more step</p>
        <h1 className="font-[family-name:var(--dt-font-display)] text-4xl leading-tight text-[var(--dt-text-primary)] md:text-5xl">Confirm your email.</h1>
        <p className="mt-5 text-sm leading-6 text-[var(--dt-text-secondary)]">
          We sent a 6-digit code to <span className="break-all text-[var(--dt-text-primary)]">{user?.email}</span>. Enter it to start using DevTrack. Check spam if you do not see it.
        </p>

        {notice.text ? (
          <div role={notice.kind === "error" ? "alert" : "status"} className={`mt-6 border-l-2 px-4 py-3 text-sm leading-6 ${notice.kind === "error" ? "border-red-400/70 bg-red-400/5 text-red-300" : "border-emerald-400/70 bg-emerald-400/5 text-emerald-200"}`}>
            {notice.text}
          </div>
        ) : null}

        {editing ? (
          <form onSubmit={changeEmail} className="mt-8 grid gap-4 border-y border-[var(--dt-border)] py-6">
            <label className="dt-label">
              Correct email address
              <input className="dt-input" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" maxLength={254} required />
            </label>
            {user?.hasPassword !== false ? (
              <label className="dt-label">
                Current password
                <input className="dt-input" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />
              </label>
            ) : null}
            <div className="flex flex-wrap gap-4">
              <button type="submit" className="dt-primary-button" disabled={busy || !email.trim() || (user?.hasPassword !== false && !password)}>{busy ? "Saving..." : "Change and send code"}</button>
              <button type="button" className="dt-link-button" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            </div>
          </form>
        ) : (
          <form onSubmit={submit} noValidate className="mt-8 border-y border-[var(--dt-border)] py-6">
            <label htmlFor="email-code" className="mb-3 block text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">Verification code</label>
            <input
              id="email-code"
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              disabled={busy}
              className="w-full border-b border-[var(--dt-border)] bg-transparent px-0 py-3 font-mono text-base tracking-[0.3em] text-[var(--dt-text-primary)] outline-none focus:border-[var(--dt-accent)]"
            />
            <button type="submit" disabled={busy || code.length !== 6} className="mt-8 w-full border border-[var(--dt-accent)] bg-[var(--dt-accent)] px-6 py-4 text-xs font-medium uppercase tracking-[0.2em] text-white hover:bg-[var(--dt-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Checking..." : "Verify email"}
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-wrap justify-between gap-3 text-xs">
          <button type="button" onClick={resend} disabled={busy || cooldown > 0} className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50">
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]">Wrong email? Change it</button>
          ) : null}
          <button type="button" onClick={() => logout()} className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">Sign out</button>
        </div>
      </section>
    </main>
  );
}

export default VerifyEmail;
