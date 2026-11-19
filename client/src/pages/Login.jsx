import { useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import SocialSignIn from "../components/auth/SocialSignIn";
import TwoFactorPrompt from "../components/auth/TwoFactorPrompt";
import ForgotPassword from "../components/auth/ForgotPassword";
import { socialOutcomeText } from "../components/auth/socialMessages";
import { AuthContext } from "../context/authContextObject";
import { login as loginRequest } from "../services/authService";
import { errorMessage } from "../services/api";

const Login = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    // A failed Google / GitHub / LinkedIn sign-in comes back here with an outcome word.
    const [message, setMessage] = useState(() => {
        const outcome = searchParams.get("oauth");
        if (outcome) return socialOutcomeText(outcome, searchParams.get("provider"));
        return location.state?.sessionEnded
            ? "You were signed out. This session was ended from another tab or device, or it expired."
            : "";
    });
    // "ok" after a successful password reset, "info" for the signed-out notice, else an error.
    const [messageKind, setMessageKind] = useState(() => (
        !searchParams.get("oauth") && location.state?.sessionEnded ? "info" : "error"
    ));
    const [loading, setLoading] = useState(false);
    // "code" once the password (or a provider) was accepted and 2FA asks for the authenticator code.
    const [step, setStep] = useState(() => (searchParams.get("step") === "2fa" ? "code" : "password"));
    // Where to go after signing in (Settings when the sign-in re-confirmed identity there).
    const afterSignIn = useRef("/app/dashboard");

    const navigate = useNavigate();

    const {
        user,
        loading: authLoading,
        refreshUser,
    } = useContext(AuthContext);

    useEffect(() => {
        if (!authLoading && user) {
            navigate(afterSignIn.current, {
                replace: true,
                viewTransition: true,
            });
        }
    }, [authLoading, user, navigate]);

    async function handleSubmit(event) {
        event.preventDefault();

        setMessage("");
        setMessageKind("error");

        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedEmail) {
            setMessage("Email is required.");
            return;
        }

        if (!password) {
            setMessage("Password is required.");
            return;
        }

        setLoading(true);

        try {
            const result = await loginRequest({ email: normalizedEmail, password });
            if (result.twoFactorRequired) {
                setPassword("");
                setStep("code");
                // Keep the step in the address: phones often reload the tab while the user is in
                // the authenticator app, and the pending sign-in (an HttpOnly cookie) survives that.
                setSearchParams({ step: "2fa" }, { replace: true });
                return;
            }

            // The signed-in redirect effect above navigates once the user is loaded.
            await refreshUser();
        } catch (error) {
            setMessage(errorMessage(error, "Unable to log in."));
        } finally {
            setLoading(false);
        }
    }

    if (authLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[var(--dt-background)] px-6">
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
                    Checking session...
                </p>
            </main>
        );
    }

    if (user) {
        return null;
    }

    return (
        <main
            className="relative min-h-screen overflow-hidden bg-[var(--dt-background)]"
            style={{
                viewTransitionName: "main-content",
            }}
        >
            <div
                className="pointer-events-none absolute inset-0 overflow-hidden"
                aria-hidden="true"
            >
                <div className="dt-stars">
                    <div className="dt-stars-layer dt-stars-far" />
                    <div className="dt-stars-layer dt-stars-near" />
                    <div className="dt-stars-glow" />
                </div>
            </div>

            <div className="relative z-10 flex min-h-screen flex-col">
                <header className="flex items-center justify-between px-6 py-7 md:px-10 md:py-8">
                    <Link
                        to="/"
                        viewTransition
                        className="font-[family-name:var(--dt-font-display)] text-2xl tracking-tight text-[var(--dt-text-primary)] transition-colors duration-200 hover:text-[var(--dt-accent-soft)]"
                    >
                        DevTrack
                    </Link>

                    <span className="hidden text-[11px] uppercase tracking-[0.3em] text-[var(--dt-text-muted)] sm:inline">
                        Developer Command Center
                    </span>
                </header>

                <div className="flex flex-1 items-center justify-center px-6 py-12 md:px-10 md:py-16">
                    <section className="w-full max-w-md">
                        <div className="mb-10">
                            <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.35em] text-[var(--dt-text-muted)]">
                                01 — AUTHENTICATION
                            </p>

                            <h1 className="font-[family-name:var(--dt-font-display)] text-5xl leading-[1.02] tracking-tight text-[var(--dt-text-primary)] md:text-6xl">
                                Welcome back.
                            </h1>

                            <p className="mt-5 max-w-sm text-sm leading-6 text-[var(--dt-text-secondary)]">
                                Sign in to continue building,
                                tracking, and growing.
                            </p>
                        </div>

                        {step === "forgot" ? (
                            <ForgotPassword
                                initialEmail={email.trim()}
                                onDone={text => {
                                    setPassword("");
                                    setMessageKind("ok");
                                    setMessage(text);
                                    setStep("password");
                                }}
                                onCancel={() => {
                                    setMessage("");
                                    setStep("password");
                                }}
                            />
                        ) : step === "code" ? (
                            <TwoFactorPrompt
                                onSignedIn={async returnTo => {
                                    if (returnTo === "settings") afterSignIn.current = "/app/settings?reauth=ok#account";
                                    await refreshUser();
                                }}
                                onRestart={text => {
                                    setMessageKind("error");
                                    setStep("password");
                                    setSearchParams({}, { replace: true });
                                    setMessage(text);
                                }}
                            />
                        ) : (
                        <>
                        <form
                            onSubmit={handleSubmit}
                            noValidate
                            className="border-y border-[var(--dt-border)] py-8"
                        >
                            {message && (
                                <div
                                    role={messageKind === "error" ? "alert" : "status"}
                                    className={`mb-7 border-l-2 px-4 py-3 text-sm leading-6 ${messageKind === "ok" ? "border-emerald-400/70 bg-emerald-400/5 text-emerald-200" : messageKind === "info" ? "border-amber-400/70 bg-amber-400/5 text-amber-200" : "border-red-400/70 bg-red-400/5 text-red-300"}`}
                                >
                                    {message}
                                </div>
                            )}

                            <div className="space-y-7">
                                <div>
                                    <label
                                        htmlFor="login-email"
                                        className="mb-3 block text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--dt-text-muted)]"
                                    >
                                        Email
                                    </label>

                                    <input
                                        id="login-email"
                                        name="email"
                                        type="email"
                                        value={email}
                                        onChange={(event) =>
                                            setEmail(
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="email"
                                        autoFocus
                                        placeholder="you@example.com"
                                        disabled={loading}
                                        className="w-full border-b border-[var(--dt-border)] bg-transparent px-0 py-3 text-base text-[var(--dt-text-primary)] outline-none transition-colors duration-200 placeholder:text-[var(--dt-text-muted)] focus:border-[var(--dt-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>

                                <div>
                                    <div className="mb-3 flex items-baseline justify-between gap-4">
                                        <label
                                            htmlFor="login-password"
                                            className="block text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--dt-text-muted)]"
                                        >
                                            Password
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMessage("");
                                                setStep("forgot");
                                            }}
                                            disabled={loading}
                                            className="text-xs text-[var(--dt-text-secondary)] transition-colors duration-200 hover:text-[var(--dt-accent-soft)] disabled:opacity-50"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>

                                    <input
                                        id="login-password"
                                        name="password"
                                        type="password"
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="current-password"
                                        placeholder="Enter your password"
                                        disabled={loading}
                                        className="w-full border-b border-[var(--dt-border)] bg-transparent px-0 py-3 text-base text-[var(--dt-text-primary)] outline-none transition-colors duration-200 placeholder:text-[var(--dt-text-muted)] focus:border-[var(--dt-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-9 w-full border border-[var(--dt-accent)] bg-[var(--dt-accent)] px-6 py-4 text-xs font-medium uppercase tracking-[0.2em] text-white transition-all duration-200 hover:border-[var(--dt-accent-soft)] hover:bg-[var(--dt-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading
                                    ? "Signing in..."
                                    : "Sign in"}
                            </button>
                        </form>

                        <SocialSignIn disabled={loading} onError={setMessage} />
                        </>
                        )}

                        <div className="mt-7 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[var(--dt-text-secondary)]">
                                Don't have an account?
                            </p>

                            <Link
                                to="/register"
                                viewTransition
                                className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-secondary)] transition-colors duration-200 hover:text-[var(--dt-accent-soft)]"
                            >
                                Create account →
                            </Link>
                        </div>
                    </section>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 px-6 py-6 md:px-10">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
                        DevTrack — Build. Track. Evolve.
                    </p>
                    <nav aria-label="Legal" className="flex gap-5 text-xs text-[var(--dt-text-muted)]">
                        <Link to="/privacy" className="hover:text-[var(--dt-accent-soft)]">Privacy</Link>
                        <Link to="/terms" className="hover:text-[var(--dt-accent-soft)]">Terms</Link>
                    </nav>
                </footer>
            </div>
        </main>
    );
};

export default Login;