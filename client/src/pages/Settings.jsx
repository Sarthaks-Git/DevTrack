import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/authContextObject";
import PageHeader from "../components/common/PageHeader";
import AccountSection from "../components/settings/AccountSection";
import SecuritySection from "../components/settings/SecuritySection";
import PlatformsSection from "../components/settings/PlatformsSection";
import DangerSection from "../components/settings/DangerSection";
import RemindersSection from "../components/settings/RemindersSection";

export default function Settings() {
  const { user, refreshUser, clearSession } = useContext(AuthContext);
  const navigate = useNavigate();

  function signedOut() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <section>
      <PageHeader eyebrow="07 — Settings" title="Settings" description="Manage your account, security, and connected platforms." />
      {/* Keyed on the saved values so the form resets to the server's truth after each save. */}
      <AccountSection key={`${user?.username}|${user?.email}`} user={user} onUpdated={refreshUser} />
      <SecuritySection user={user} onSignedOut={signedOut} />
      <PlatformsSection />
      <RemindersSection />
      <DangerSection onDeleted={signedOut} />
    </section>
  );
}
