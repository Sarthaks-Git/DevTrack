import { useState } from "react";
import { verifyTwoFactor } from "../../services/authService";

const inputClass =
  "w-full border-b border-[var(--dt-border)] bg-transparent px-0 py-3 text-base text-[var(--dt-text-primary)] outline-none transition-colors duration-200 placeholder:text-[var(--dt-text-muted)] focus:border-[var(--dt-accent)] disabled:cursor-not-allowed disabled:opacity-50";

// Second step of signing in: the 6-digit code from the authenticator app, or a backup code.
function TwoFactorPrompt({ onSignedIn, onRestart }) {
  const [useBackup, setUseBackup] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const code = value.replace(/\s/g, "");
  const ready = useBackup ? code.replace(/-/g, "").length === 10 : /^\d{6}$/.test(code);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const result = await verifyTwoFactor(useBackup ? { recoveryCode: code } : { code });
      await onSignedIn(result.returnTo);
    } catch (failure) {
      if (failure.response?.data?.code === "TWO_FACTOR_CHALLENGE_EXPIRED") {
        onRestart(failure.message);
        return;
      }
      setError(failure.message);
      setValue("");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="border-y border-[var(--dt-border)] py-8">
      <p className="text-sm leading-6 text-[var(--dt-text-secondary)]">
        {useBackup ? "Enter one of your backup codes. Each code works once." : "Enter the 6-digit code from your authenticator app."}
      </p>
      {error ? (
        <div role="alert" className="mt-5 border-l-2 border-red-400/70 bg-red-400/5 px-4 py-3 text-sm leading-6 text-red-300">{error}</div>
      ) : null}
      <label htmlFor="two-factor-code" className="mt-7 mb-3 block text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">
        {useBackup ? "Backup code" : "Authentication code"}
      </label>
      <input
        id="two-factor-code"
        value={value}
        onChange={event => setValue(event.target.value)}
        inputMode={useBackup ? "text" : "numeric"}
        autoComplete="one-time-code"
        autoFocus
        maxLength={useBackup ? 14 : 6}
        placeholder={useBackup ? "abcde-fghjk" : "123456"}
        disabled={busy}
        className={`${inputClass} font-mono tracking-[0.3em]`}
      />
      <button
        type="submit"
        disabled={busy || !ready}
        className="mt-9 w-full border border-[var(--dt-accent)] bg-[var(--dt-accent)] px-6 py-4 text-xs font-medium uppercase tracking-[0.2em] text-white transition-all duration-200 hover:border-[var(--dt-accent-soft)] hover:bg-[var(--dt-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Checking..." : "Verify"}
      </button>
      <div className="mt-6 flex flex-wrap justify-between gap-3 text-xs">
        <button
          type="button"
          onClick={() => {
            setUseBackup(current => !current);
            setValue("");
            setError("");
          }}
          className="text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]"
        >
          {useBackup ? "Use the authenticator app" : "Use a backup code"}
        </button>
        <button type="button" onClick={() => onRestart("")} className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">
          Start over
        </button>
      </div>
    </form>
  );
}

export default TwoFactorPrompt;
