import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import ConfirmModal from "../common/ConfirmModal";
import OverlayDialog from "../common/OverlayDialog";
import { setCodeFindingStatus, setCodeReview } from "../../services/aiService";

const SEVERITY_STYLES = {
  high: "border-red-500/60 text-red-300",
  medium: "border-amber-400/60 text-amber-300",
  low: "border-[var(--dt-border-strong)] text-[var(--dt-text-secondary)]",
};
const STATUS_LABELS = { fixed: "Fixed", ignored: "Ignored" };

function FindingCard({ finding, busy, error, onStatus }) {
  const open = finding.status === "open";
  return (
    <div className="border border-[var(--dt-border)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`min-w-0 break-words text-sm font-medium ${open ? "text-[var(--dt-text-primary)]" : "text-[var(--dt-text-muted)] line-through decoration-[var(--dt-border-strong)]"}`}>
          {finding.title}
        </p>
        <span className={`dt-badge ${SEVERITY_STYLES[finding.severity]}`}>{finding.severity}</span>
      </div>
      <a href={finding.lineUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all font-mono text-[11px] text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]">
        {finding.file}{finding.line ? `:${finding.line}` : ""} ↗
      </a>
      {open ? (
        <>
          <p className="mt-2 text-xs leading-5 text-[var(--dt-text-secondary)]">{finding.detail}</p>
          {finding.fix ? <p className="mt-1 text-xs leading-5 text-[var(--dt-text-primary)]"><span className="text-[var(--dt-text-muted)]">Fix: </span>{finding.fix}</p> : null}
        </>
      ) : null}
      <p className="mt-2 break-words text-[11px] text-[var(--dt-text-muted)]">
        In{" "}
        <a href={finding.commitUrl} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-[var(--dt-accent-soft)]">{finding.shortSha}</a>{" "}
        {finding.commitMessage}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px]">
        <span className="dt-badge">AI-suggested</span>
        {open ? (
          <>
            <button type="button" disabled={busy} onClick={() => onStatus("fixed")} className="ml-auto text-[var(--dt-text-secondary)] hover:text-emerald-300">Fixed</button>
            <button type="button" disabled={busy} onClick={() => onStatus("ignored")} className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">Ignore</button>
          </>
        ) : (
          <>
            <span className="ml-auto text-emerald-300">{STATUS_LABELS[finding.status]}</span>
            <button type="button" disabled={busy} onClick={() => onStatus("open")} className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">Reopen</button>
          </>
        )}
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function CodeReviewDialog({ project, allowed, findings, onFindingChange, onToggle, onClose }) {
  const enabled = Boolean(project.repository?.codeReview?.enabled);
  const [busyId, setBusyId] = useState("");
  const [errors, setErrors] = useState({});
  const [toggle, setToggle] = useState({ confirm: false, busy: false, error: "" });
  const [showClosed, setShowClosed] = useState(false);

  const openFindings = findings.filter(finding => finding.status === "open");
  const closed = findings.filter(finding => finding.status !== "open");

  async function changeStatus(finding, status) {
    setBusyId(finding.id);
    setErrors(current => ({ ...current, [finding.id]: "" }));
    try {
      onFindingChange(await setCodeFindingStatus(finding.id, status));
    } catch (failure) {
      setErrors(current => ({ ...current, [finding.id]: failure.message }));
    } finally {
      setBusyId("");
    }
  }

  async function changeEnabled(next) {
    setToggle({ confirm: next, busy: true, error: "" });
    try {
      const result = await setCodeReview(project._id, next);
      onToggle(result.enabled);
      setToggle({ confirm: false, busy: false, error: "" });
    } catch (failure) {
      setToggle({ confirm: false, busy: false, error: failure.message });
    }
  }

  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 text-xs leading-5 text-[var(--dt-text-secondary)]">
        <p className="text-sm text-[var(--dt-text-primary)]">
          {!allowed ? "Part of the Pro plan" : enabled ? "On for this repository" : "Off for this repository"}
        </p>
        {!allowed ? (
          <p className="mt-1">
            Pro reviews the changed lines of your commits with Claude Sonnet 5.5. Upgrades are coming soon.{" "}
            <Link to="/app/settings" className="dt-link-button">See plans</Link>
          </p>
        ) : null}
        <p className="mt-1">
          When on, the changed lines of your new commits are sent to Anthropic for a security review. Secrets are removed first; env files, keys and lockfiles are never sent; the code is not stored.
        </p>
        {toggle.error ? (
          <p role="alert" className="mt-2 text-red-300">
            {toggle.error}
            {/settings/i.test(toggle.error) ? <> <Link to="/app/settings" className="dt-link-button">Open Settings</Link></> : null}
          </p>
        ) : null}
      </div>
      {!allowed && !enabled ? null : <button
        type="button"
        onClick={() => (enabled ? changeEnabled(false) : setToggle(current => ({ ...current, confirm: true, error: "" })))}
        disabled={toggle.busy}
        aria-pressed={enabled}
        className={enabled ? "shrink-0 border border-[var(--dt-border)] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--dt-text-primary)] hover:border-[var(--dt-border-strong)] disabled:opacity-50" : "dt-primary-button shrink-0"}
      >
        {toggle.busy && !toggle.confirm ? "Saving..." : enabled ? "Turn off" : "Turn on"}
      </button>}
    </div>
  );

  const card = finding => (
    <FindingCard key={finding.id} finding={finding} busy={busyId === finding.id} error={errors[finding.id]} onStatus={status => changeStatus(finding, status)} />
  );

  return (
    <>
      <OverlayDialog
        eyebrow="Code review"
        title={project.title}
        subtitle={`${project.repository.fullName}${findings.length ? ` · ${openFindings.length} open` : ""}`}
        locked={Boolean(busyId) || toggle.busy || toggle.confirm}
        onClose={onClose}
        toolbar={toolbar}
      >
        {openFindings.length ? openFindings.map(card) : (
          <p className="text-sm text-[var(--dt-text-secondary)]">
            {!allowed ? "No findings." : enabled ? "No open findings. New commits are reviewed after each sync." : "Turn on code review to have new commits checked for security issues."}
          </p>
        )}
        {closed.length ? (
          <button type="button" onClick={() => setShowClosed(value => !value)} aria-expanded={showClosed} className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)]">
            {showClosed ? "Hide resolved findings" : `Show ${closed.length} resolved`}
          </button>
        ) : null}
        {showClosed ? closed.map(card) : null}
      </OverlayDialog>

      {createPortal(
        <ConfirmModal
          open={toggle.confirm}
          title="Turn on code review?"
          confirmLabel="Turn on"
          busyLabel="Turning on..."
          busy={toggle.busy}
          onConfirm={() => changeEnabled(true)}
          onCancel={() => setToggle({ confirm: false, busy: false, error: "" })}
        >
          For {project.repository.fullName}, the changed lines of your commits (up to about 300 lines per file, 8 files per commit) will be sent to Anthropic for a security review, including commits from the past week. Secrets are replaced with [REDACTED] first. Env files, keys, certificates, lockfiles and build output are never sent, and DevTrack does not store the code. You can turn this off at any time.
        </ConfirmModal>,
        document.body,
      )}
    </>
  );
}

// Opt-in AI review of a linked repository's changed lines: a small button on the card that opens an overlay.
function ProjectCodeReview({ project, allowed, findings, onFindingChange, onToggle }) {
  const [open, setOpen] = useState(false);
  if (!project.repository) return null;

  const enabled = Boolean(project.repository.codeReview?.enabled);
  const openCount = findings.filter(finding => finding.status === "open").length;

  return (
    <div className="mt-3 text-xs">
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex items-center gap-2 text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)]">
        <span>Code review</span>
        {openCount ? (
          <span className="dt-badge border-amber-400/50 text-amber-300">{openCount} open</span>
        ) : (
          <span className="text-[var(--dt-text-muted)]">{!allowed ? "Pro" : enabled ? "on" : "off"}</span>
        )}
      </button>
      {open ? <CodeReviewDialog project={project} allowed={allowed} findings={findings} onFindingChange={onFindingChange} onToggle={onToggle} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

export default ProjectCodeReview;
