import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { undoEmailChange } from "../services/authService";
import { errorMessage } from "../services/api";

// Opened from the "Your DevTrack email was changed" alert. The token rides in the URL fragment so it
// never reaches server logs or a Referer header, and it is wiped from the address bar on load.
// Nothing happens until the owner presses the button, so mail scanners that open links change nothing.
function readToken() {
  const match = window.location.hash.match(/token=([A-Za-z0-9_-]{43})/);
  return match ? match[1] : null;
}

export default function UndoEmailChange() {
  const [token] = useState(readToken);
  const [state, setState] = useState({ status: token ? "ready" : "missing", message: "" });

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function confirm() {
    setState({ status: "busy", message: "" });
    try {
      const result = await undoEmailChange(token);
      setState({ status: "done", message: result.email });
    } catch (error) {
      setState({ status: "error", message: errorMessage(error, "Couldn't undo the change. Try the link again.") });
    }
  }

  return (
    <main className="min-h-screen bg-[var(--dt-background)] px-6 py-16">
      <section className="mx-auto w-full max-w-md">
        <Link to="/" className="font-[family-name:var(--dt-font-display)] text-2xl tracking-tight text-[var(--dt-text-primary)]">
          DevTrack
        </Link>
        <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.35em] text-[var(--dt-text-muted)]">Account security</p>
        <h1 className="mt-4 font-[family-name:var(--dt-font-display)] text-4xl leading-tight tracking-tight text-[var(--dt-text-primary)]">
          Undo the email change
        </h1>

        {state.status === "done" ? (
          <div role="status" className="mt-8 border-l-2 border-emerald-400/70 bg-emerald-400/5 px-4 py-3 text-sm leading-6 text-emerald-200">
            Your account email is back to {state.message}. Every device was signed out and the old password no longer works.
            Set a new one with <strong>Forgot password</strong> on the sign-in page; the code goes to this address.
          </div>
        ) : null}

        {state.status === "missing" ? (
          <p role="alert" className="mt-8 border-l-2 border-red-400/70 bg-red-400/5 px-4 py-3 text-sm leading-6 text-red-300">
            This link is incomplete. Open it again from the email, without changing it.
          </p>
        ) : null}

        {state.status === "ready" || state.status === "busy" || state.status === "error" ? (
          <>
            <p className="mt-6 text-sm leading-6 text-[var(--dt-text-secondary)]">
              If you did not change your DevTrack email, this puts your old address back, signs out every device, and asks for a new
              password. Any Google, GitHub or LinkedIn sign-in that does not use your old address is removed.
            </p>
            {state.status === "error" ? (
              <p role="alert" className="mt-6 border-l-2 border-red-400/70 bg-red-400/5 px-4 py-3 text-sm leading-6 text-red-300">
                {state.message}
              </p>
            ) : null}
            <button
              type="button"
              onClick={confirm}
              disabled={state.status === "busy"}
              className="mt-8 w-full border border-[var(--dt-accent)] bg-[var(--dt-accent)] px-6 py-4 text-xs font-medium uppercase tracking-[0.2em] text-white transition-colors duration-200 hover:border-[var(--dt-accent-soft)] hover:bg-[var(--dt-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.status === "busy" ? "Restoring..." : "Restore my old email"}
            </button>
          </>
        ) : null}

        <Link to="/login" className="dt-link-button mt-8 inline-block">Go to sign in</Link>
      </section>
    </main>
  );
}
