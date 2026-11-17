import { useEffect, useState } from "react";
import SettingsSection, { Notice } from "./SettingsSection";
import ConfirmModal from "../common/ConfirmModal";
import { listSocialProviders, startSocialLink, unlinkIdentity } from "../../services/authService";
import { PROVIDER_LABELS } from "../auth/socialMessages";

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";
}

// Linked Google / GitHub / LinkedIn sign-ins: link more, or unlink (never the last way in).
function SignInSection({ user, identities, onChanged, notice }) {
  const [providers, setProviders] = useState(null);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState({ kind: "", text: "" });
  const [unlinking, setUnlinking] = useState(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    listSocialProviders()
      .then(list => active && setProviders(list))
      .catch(() => active && setProviders([]));
    return () => {
      active = false;
    };
  }, []);

  const linkedBy = new Map(identities.map(identity => [identity.provider, identity]));
  const shown = (providers || []).filter(provider => provider.enabled || linkedBy.has(provider.id));
  const lastWayIn = !user?.hasPassword && identities.length <= 1;

  async function link(provider) {
    setBusy(provider);
    setStatus({ kind: "", text: "" });
    try {
      await startSocialLink(provider);
    } catch (error) {
      setBusy("");
      setStatus({ kind: "error", text: error.message });
    }
  }

  function closeUnlink() {
    if (busy) return;
    setUnlinking(null);
    setPassword("");
  }

  async function handleUnlink() {
    const provider = unlinking;
    setBusy(provider);
    setStatus({ kind: "", text: "" });
    try {
      await unlinkIdentity(provider, user?.hasPassword ? password : undefined);
      setStatus({ kind: "ok", text: `${PROVIDER_LABELS[provider]} was unlinked.` });
      setUnlinking(null);
      setPassword("");
      await onChanged();
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
      setUnlinking(null);
    } finally {
      setBusy("");
      setPassword("");
    }
  }

  return (
    <SettingsSection
      id="signin"
      number="03"
      label="Sign-in"
      title="Sign-in methods"
      description="Sign in with Google, GitHub or LinkedIn instead of a password. A provider is linked only when its email is verified there."
    >
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
      {providers === null ? (
        <p className="text-sm text-[var(--dt-text-secondary)]">Loading sign-in methods...</p>
      ) : !shown.length ? (
        <p className="max-w-3xl text-sm text-[var(--dt-text-muted)]">Sign-in with other providers is not set up on this server yet.</p>
      ) : (
        <ul className="max-w-3xl divide-y divide-[var(--dt-border)] border border-[var(--dt-border)]">
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="text-sm text-[var(--dt-text-primary)]">Password</div>
            <span className="text-xs text-[var(--dt-text-muted)]">{user?.hasPassword ? "Set" : "Not set: add one under Security"}</span>
          </li>
          {shown.map(provider => {
            const identity = linkedBy.get(provider.id);
            return (
              <li key={provider.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--dt-text-primary)]">{provider.label}</p>
                  {identity ? (
                    <p className="mt-0.5 break-all text-xs text-[var(--dt-text-muted)]">
                      {identity.email} · linked {formatDay(identity.linkedAt)}
                      {identity.lastUsedAt ? ` · last used ${formatDay(identity.lastUsedAt)}` : ""}
                    </p>
                  ) : null}
                </div>
                {identity ? (
                  <button
                    type="button"
                    onClick={() => setUnlinking(provider.id)}
                    disabled={Boolean(busy) || lastWayIn}
                    title={lastWayIn ? "Set a password or link another method first" : undefined}
                    className="text-xs text-[var(--dt-text-muted)] hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Unlink
                  </button>
                ) : (
                  <button type="button" onClick={() => link(provider.id)} disabled={Boolean(busy)} className="dt-link-button">
                    {busy === provider.id ? "Redirecting..." : "Link"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Notice kind={status.kind}>{status.text}</Notice>

      <ConfirmModal
        open={Boolean(unlinking)}
        title={unlinking ? `Unlink ${PROVIDER_LABELS[unlinking]}?` : ""}
        confirmLabel="Unlink"
        busyLabel="Unlinking..."
        destructive
        busy={Boolean(busy)}
        confirmDisabled={Boolean(user?.hasPassword) && !password}
        onConfirm={handleUnlink}
        onCancel={closeUnlink}
      >
        <p>You will no longer be able to sign in with {unlinking ? PROVIDER_LABELS[unlinking] : ""}. You can link it again later.</p>
        {user?.hasPassword ? (
          <label className="dt-label mt-4 block">
            Current password
            <input className="dt-input" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
        ) : null}
      </ConfirmModal>
    </SettingsSection>
  );
}

export default SignInSection;
