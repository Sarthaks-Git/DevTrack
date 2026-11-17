import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import AppearanceSection from "../components/settings/AppearanceSection";

// One section at a time, picked from the menu. The address hash names the open section, so links
// and OAuth returns (#account, #signin, #github) land on the right one.
const TABS = [
  { id: "account", label: "Account" },
  { id: "security", label: "Security" },
  { id: "signin", label: "Sign-in methods" },
  { id: "platforms", label: "Coding platforms" },
  { id: "github", label: "GitHub" },
  { id: "ai", label: "AI and plan" },
  { id: "reminders", label: "Reminders" },
  { id: "appearance", label: "Appearance" },
  { id: "danger", label: "Delete account" },
];
// Older links to a part of a section.
const HASH_ALIASES = { "two-factor": "security" };

function tabFromHash(hash) {
  const key = hash.replace(/^#/, "");
  const id = HASH_ALIASES[key] || key;
  return TABS.some(tab => tab.id === id) ? id : "account";
}

export default function Settings() {
  const { user, refreshUser, clearSession } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const active = tabFromHash(location.hash);
  const [searchParams] = useSearchParams();
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
      // Keep the hash: it names the open section.
      navigate({ search: next.toString(), hash: location.hash }, { replace: true });
    }
  }, [searchParams, navigate, location.hash]);

  async function reloadAccount() {
    await Promise.all([refreshUser(), loadIdentities()]);
  }

  function signedOut() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function openTab(id) {
    navigate({ search: location.search, hash: `#${id}` }, { replace: true });
  }

  return (
    <section>
      <PageHeader eyebrow="07 — Settings" title="Settings" description="Manage your account, security, and connected platforms." />
      {reauthNotice ? <Notice kind={reauthNotice.kind}>{reauthNotice.text}</Notice> : null}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:border-l lg:border-[var(--dt-border)] lg:px-0 lg:pb-0">
            {TABS.map(tab => {
              const current = tab.id === active;
              return (
                <li key={tab.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => openTab(tab.id)}
                    aria-current={current ? "page" : undefined}
                    className={`w-full whitespace-nowrap border px-3 py-1.5 text-left text-sm transition-colors lg:-ml-px lg:border-0 lg:border-l-2 lg:py-2 lg:pl-4 ${
                      current
                        ? "border-[var(--dt-accent)] text-[var(--dt-text-primary)] lg:bg-[var(--dt-surface)]"
                        : `border-[var(--dt-border)] hover:text-[var(--dt-text-primary)] lg:border-transparent ${tab.id === "danger" ? "text-red-300/80" : "text-[var(--dt-text-secondary)]"}`
                    }`}
                  >
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0">
          {/* Keyed on the saved values so the form resets to the server's truth after each save. */}
          {active === "account" ? <AccountSection key={`${user?.username}|${user?.email}`} user={user} identities={identities} onUpdated={refreshUser} /> : null}
          {active === "security" ? <SecuritySection user={user} onSignedOut={signedOut} onPasswordSet={refreshUser} /> : null}
          {active === "signin" ? <SignInSection user={user} identities={identities} onChanged={reloadAccount} notice={signInNotice} /> : null}
          {active === "platforms" ? <PlatformsSection /> : null}
          {active === "github" ? <GitHubSection /> : null}
          {active === "ai" ? <AISection /> : null}
          {active === "reminders" ? <RemindersSection /> : null}
          {active === "appearance" ? <AppearanceSection /> : null}
          {active === "danger" ? <DangerSection user={user} onDeleted={signedOut} /> : null}
        </div>
      </div>
    </section>
  );
}
