import { useState } from "react";
import { startSocialSignIn } from "../../services/authService";
import { PROVIDER_LABELS } from "../auth/socialMessages";

// For accounts without a password: changes are confirmed by signing in again with a linked provider.
function ReauthNotice({ identities }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function confirm(provider) {
    setBusy(provider);
    setError("");
    try {
      await startSocialSignIn(provider, "settings");
    } catch (failure) {
      setBusy("");
      setError(failure.message);
    }
  }

  return (
    <div className="max-w-2xl border-l-2 border-[var(--dt-border-strong)] pl-4 text-xs leading-5 text-[var(--dt-text-secondary)]">
      <p>Your account has no password. To confirm a change, sign in again; you then have 10 minutes.</p>
      <div className="mt-2 flex flex-wrap gap-4">
        {identities.map(identity => (
          <button key={identity.provider} type="button" onClick={() => confirm(identity.provider)} disabled={Boolean(busy)} className="dt-link-button">
            {busy === identity.provider ? "Redirecting..." : `Confirm with ${PROVIDER_LABELS[identity.provider]}`}
          </button>
        ))}
      </div>
      {error ? <p role="alert" className="mt-2 text-red-300">{error}</p> : null}
    </div>
  );
}

export default ReauthNotice;
