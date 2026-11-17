import { useEffect, useState } from "react";
import { listSocialProviders, startSocialSignIn } from "../../services/authService";

// "Continue with Google / GitHub / LinkedIn" buttons. Only providers set up on the server are shown.
function SocialSignIn({ disabled = false, onError }) {
  const [providers, setProviders] = useState([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let active = true;
    listSocialProviders()
      .then(list => active && setProviders(list))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!providers.length) return null;

  async function start(provider) {
    setBusy(provider);
    try {
      await startSocialSignIn(provider);
    } catch (error) {
      setBusy("");
      onError?.(error.message);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
        <span className="h-px flex-1 bg-[var(--dt-border)]" />
        or
        <span className="h-px flex-1 bg-[var(--dt-border)]" />
      </div>
      <div className="mt-6 grid gap-3">
        {providers.map(provider => (
          <button
            key={provider.id}
            type="button"
            onClick={() => start(provider.id)}
            disabled={disabled || Boolean(busy)}
            className="w-full border border-[var(--dt-border)] px-6 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-primary)] transition-colors duration-200 hover:border-[var(--dt-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === provider.id ? "Redirecting..." : `Continue with ${provider.label}`}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SocialSignIn;
