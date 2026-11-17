import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SettingsSection, { Notice } from "./SettingsSection";
import ConfirmModal from "../common/ConfirmModal";
import { disconnectGitHub, getGitHubStatus, startGitHubConnect, syncGitHub } from "../../services/githubService";

// Outcome words the server's OAuth callback appends to /app/settings?github=...
const OUTCOMES = {
  connected: { kind: "ok", text: "GitHub connected. Next, choose which repositories DevTrack may read, then link them to projects." },
  denied: { kind: "error", text: "GitHub access was not granted. Nothing was connected." },
  expired: { kind: "error", text: "That connection attempt expired or came from another browser. Please try again." },
  in_use: { kind: "error", text: "That GitHub account is already connected to another DevTrack account." },
  failed: { kind: "error", text: "GitHub could not be connected. Please try again." },
};

function formatTime(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "never";
}

function GitHubSection() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, status: null });
  const [notice, setNotice] = useState(() => OUTCOMES[params.get("github")] || { kind: "", text: "" });
  const [busy, setBusy] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Show the outcome once, then drop it from the URL so a refresh does not repeat it.
  useEffect(() => {
    if (!params.has("github")) return;
    const next = new URLSearchParams(params);
    next.delete("github");
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    let active = true;
    getGitHubStatus()
      .then(status => active && setState({ loading: false, status }))
      .catch(error => {
        if (!active) return;
        setState({ loading: false, status: null });
        setNotice({ kind: "error", text: error.message });
      });
    return () => {
      active = false;
    };
  }, []);

  const connection = state.status?.connection;

  async function handleConnect() {
    setBusy("connect");
    setNotice({ kind: "", text: "" });
    try {
      // Full-page navigation: GitHub's consent screen cannot run in a popup or iframe safely.
      window.location.assign(await startGitHubConnect());
    } catch (error) {
      setNotice({ kind: "error", text: error.message });
      setBusy("");
    }
  }

  async function handleSync() {
    setBusy("sync");
    setNotice({ kind: "", text: "" });
    try {
      const result = await syncGitHub(true);
      if (result.status === "skipped") setNotice({ kind: "ok", text: "Synced less than a minute ago. Try again shortly." });
      else if (result.status === "synced") {
        const missing = result.unavailable?.length ? ` Lost access to: ${result.unavailable.map(item => item.fullName).join(", ")}.` : "";
        setNotice({ kind: "ok", text: `${result.newCommits} new ${result.newCommits === 1 ? "commit" : "commits"} found.${missing}` });
      }
      setState({ loading: false, status: await getGitHubStatus() });
    } catch (error) {
      setNotice({ kind: "error", text: error.message });
    } finally {
      setBusy("");
    }
  }

  async function handleDisconnect() {
    setBusy("disconnect");
    try {
      await disconnectGitHub();
      setState(previous => ({ ...previous, status: { ...previous.status, connection: null } }));
      setNotice({ kind: "ok", text: "GitHub was disconnected. DevTrack's access was revoked and synced commits were removed." });
    } catch (error) {
      setNotice({ kind: "error", text: error.message });
    } finally {
      setBusy("");
      setConfirmDisconnect(false);
    }
  }

  return (
    <div id="github" className="scroll-mt-24">
      <SettingsSection
        number="05"
        label="Connected accounts"
        title="GitHub"
        description="Link repositories to projects so your commits count as verified progress. DevTrack reads commit messages and file names only, never your code, and only from repositories you choose."
      >
        {state.loading ? (
          <p className="text-sm text-[var(--dt-text-secondary)]">Loading GitHub connection...</p>
        ) : !state.status?.available ? (
          <p className="max-w-3xl text-sm text-[var(--dt-text-muted)]">GitHub connection is not set up on this server yet.</p>
        ) : (
          <div className="max-w-3xl border border-[var(--dt-border)] p-5 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--dt-text-primary)]">GitHub</p>
                <p className="mt-1 break-words text-xs text-[var(--dt-text-secondary)]">
                  {connection ? (
                    <>Connected as <a href={connection.profileUrl} target="_blank" rel="noopener noreferrer" className="dt-link-button">@{connection.login}</a> · last sync {formatTime(connection.lastSyncAt)}</>
                  ) : "Not connected"}
                </p>
              </div>
              <span className={`dt-badge ${connection?.status === "connected" ? "dt-badge-verified" : ""}`}>
                {!connection ? "Optional" : connection.status === "connected" ? "Verified" : "Reconnect needed"}
              </span>
            </div>

            {connection?.status === "reauth_required" ? (
              <p className="mt-4 text-sm text-amber-300">GitHub access expired or was revoked. Reconnect to keep syncing commits.</p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              {!connection || connection.status !== "connected" ? (
                <button type="button" onClick={handleConnect} disabled={busy === "connect"} className="dt-primary-button">
                  {busy === "connect" ? "Opening GitHub..." : connection ? "Reconnect GitHub" : "Connect GitHub"}
                </button>
              ) : (
                <>
                  <a href={state.status.installUrl} target="_blank" rel="noopener noreferrer" className="border border-[var(--dt-border)] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--dt-text-primary)] hover:border-[var(--dt-border-strong)]">
                    Choose repositories ↗
                  </a>
                  <button type="button" onClick={handleSync} disabled={Boolean(busy)} className="border border-[var(--dt-border)] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--dt-text-primary)] hover:border-[var(--dt-border-strong)] disabled:opacity-50">
                    {busy === "sync" ? "Syncing..." : "Sync now"}
                  </button>
                </>
              )}
              {connection ? (
                <button type="button" onClick={() => setConfirmDisconnect(true)} className="border border-red-400/40 px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-red-400 hover:bg-red-400/10">
                  Disconnect GitHub
                </button>
              ) : null}
            </div>
          </div>
        )}
        <Notice kind={notice.kind}>{notice.text}</Notice>
      </SettingsSection>

      <ConfirmModal
        open={confirmDisconnect}
        title="Disconnect GitHub?"
        confirmLabel="Disconnect"
        busyLabel="Disconnecting..."
        destructive
        busy={busy === "disconnect"}
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      >
        DevTrack's access is revoked at GitHub, repositories are unlinked from your projects and synced commits are deleted. Timeline entries stay.
      </ConfirmModal>
    </div>
  );
}

export default GitHubSection;
