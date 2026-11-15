import { useState } from "react";
import SettingsSection, { Notice } from "./SettingsSection";
import { updateProfile } from "../../services/authService";

function AccountSection({ user, onUpdated }) {
  // The parent remounts this section (via key) when the user changes, so initial state stays in sync.
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ kind: "", text: "" });

  const unchanged = username.trim().toLowerCase() === user?.username && email.trim().toLowerCase() === user?.email;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setStatus({ kind: "", text: "" });
    try {
      const payload = { currentPassword };
      if (username.trim().toLowerCase() !== user.username) payload.username = username.trim();
      if (email.trim().toLowerCase() !== user.email) payload.email = email.trim();
      const result = await updateProfile(payload);
      setCurrentPassword("");
      setStatus({ kind: "ok", text: payload.email ? "Saved. Other devices were signed out because your email changed." : result.message });
      await onUpdated();
    } catch (error) {
      setStatus({ kind: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection number="01" label="Account" title="Personal information" description="Changes require your current password. Changing your email signs out your other devices.">
      <form onSubmit={handleSubmit} className="grid max-w-2xl gap-5 sm:grid-cols-2">
        <label className="dt-label">
          Username
          <input className="dt-input" value={username} onChange={event => setUsername(event.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z][A-Za-z0-9_]*" autoComplete="username" required />
        </label>
        <label className="dt-label">
          Email address
          <input className="dt-input" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} autoComplete="email" required />
        </label>
        <label className="dt-label sm:col-span-2">
          Current password
          <input className="dt-input" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="dt-primary-button" disabled={saving || unchanged || !currentPassword}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
      <Notice kind={status.kind}>{status.text}</Notice>
    </SettingsSection>
  );
}

export default AccountSection;
