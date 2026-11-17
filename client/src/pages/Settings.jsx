import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SignInSection from "../components/settings/SignInSection";
import { Notice } from "../components/settings/SettingsSection";
import { listIdentities } from "../services/authService";
import { socialOutcomeText } from "../components/auth/socialMessages";
import { AuthContext } from "../context/authContextObject";
import PageHeader from "../components/common/PageHeader";
import AccountSection from "../components/settings/AccountSection";
import SecuritySection from "../components/settings/SecuritySection";
import PlatformsSection from "../components/settings/PlatformsSection";
import DangerSection from "../components/settings/DangerSection";
import RemindersSection from "../components/settings/RemindersSection";
import GitHubSection from "../components/settings/GitHubSection";
import AISection from "../components/settings/AISection";

export default function Settings() {
  const { user, refreshUser, clearSession } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [identities, setIdentities] = useState([]);
  // Outcome of a provider round trip (linking, or re-confirming identity), read once from the URL.
  const [signInNotice] = useState(() => {
    const linked = searchParams.get("signin");
    if (linked) return { kind: linked === "linked" ? "ok" : "error", text: socialOutcomeText(linked, searchParams.get("provider")) };
    return null;
  });
  const [reauthNotice] = useState(() => {
    const reauth = searchParams.get("reauth");
    if (!reauth) return null;
    return reauth === "ok"
      ? { kind: "ok", text: "Confirmed. You can make account changes for the next 10 minutes." }
      : { kind: "error", text: socialOutcomeText(reauth, searchParams.get("provider")) };
  });

  const loadIdentities = useCallback(() => listIdentities().then(setIdentities).catch(() => {}), []);

  useEffect(() => {
    loadIdentities();
  }, [loadIdentities]);

  useEffect(() => {
    // Drop the outcome words from the address bar so a reload does not show them again.
    if (searchParams.has("signin") || searchParams.has("reauth")) {
      const next = new URLSearchParams(searchParams);
      ["signin", "provider", "reauth"].forEach(key => next.delete(key));
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function reloadAccount() {
    await Promise.all([refreshUser(), loadIdentities()]);
  }

  function signedOut() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <section>
      <PageHeader eyebrow="07 — Settings" title="Settings" description="Manage your account, security, and connected platforms." />
      {reauthNotice ? <Notice kind={reauthNotice.kind}>{reauthNotice.text}</Notice> : null}
      {/* Keyed on the saved values so the form resets to the server's truth after each save. */}
      <AccountSection key={`${user?.username}|${user?.email}`} user={user} identities={identities} onUpdated={refreshUser} />
      <SecuritySection user={user} onSignedOut={signedOut} onPasswordSet={refreshUser} />
      <SignInSection user={user} identities={identities} onChanged={reloadAccount} notice={signInNotice} />
      <PlatformsSection />
      <GitHubSection />
      <AISection />
      <RemindersSection />
      <DangerSection user={user} onDeleted={signedOut} />
    </section>
  );
}
