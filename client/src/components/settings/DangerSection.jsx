import { useState } from "react";
import SettingsSection from "./SettingsSection";
import ConfirmModal from "../common/ConfirmModal";
import { deleteAccount } from "../../services/authService";

function DangerSection({ user, onDeleted }) {
  const needsPassword = user?.hasPassword !== false;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setConfirmation("");
    setError("");
  }

  async function handleDelete() {
    setBusy(true);
    setError("");
    try {
      await deleteAccount(needsPassword ? { currentPassword: password, confirmation } : { confirmation });
      onDeleted();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <SettingsSection number="08" label="Danger zone" tone="danger" title="Delete account" description="Permanently deletes your account and everything in it: goals, projects, journal, timeline, and connected platforms. This cannot be undone.">
      <button type="button" onClick={() => setOpen(true)} className="border border-red-400/40 px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-red-400 hover:bg-red-400/10">
        Delete my account
      </button>

      <ConfirmModal
        open={open}
        eyebrow="Destructive action"
        title="Delete your account?"
        confirmLabel="Delete forever"
        busyLabel="Deleting..."
        destructive
        busy={busy}
        confirmDisabled={(needsPassword && !password) || confirmation !== "DELETE"}
        onConfirm={handleDelete}
        onCancel={close}
      >
        <p>All of your DevTrack data will be erased immediately.</p>
        {needsPassword ? (
          <label className="dt-label mt-5">
            Current password
            <input className="dt-input" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
        ) : (
          <p className="mt-4 text-xs">This needs a sign-in within the last 10 minutes (Account section above).</p>
        )}
        <label className="dt-label mt-4">
          Type DELETE to confirm
          <input className="dt-input" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
      </ConfirmModal>
    </SettingsSection>
  );
}

export default DangerSection;
