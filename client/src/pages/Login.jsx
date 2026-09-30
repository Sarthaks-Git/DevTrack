import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const { user, loading: authLoading, refreshUser } = useContext(AuthContext);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/app/dashboard", {
        replace: true,
        viewTransition: true,
      });
    }
  }, [authLoading, user, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");

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
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login failed.");
      }

      await refreshUser();

      navigate("/app/dashboard", {
        replace: true,
        viewTransition: true,
      });
    } catch (error) {
      setMessage(error.message || "Unable to log in.");
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
    <main className="relative min-h-screen overflow-hidden bg-[var(--dt-background)]">
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
            className="font-[var(--dt-font-display)] text-2xl tracking-tight text-[var(--dt-text-primary)] transition-colors duration-200 hover:text-[var(--dt-accent-soft)]"
          >
            DevTrack
          </Link>

          <span className="text-[9px] uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">
            Developer Command Center
          </span>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-12 md:px-10 md:py-16">
          <section className="w-full max-w-md">
            <div className="mb-10">
              <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--dt-text-muted)]">
                01 — AUTHENTICATION
              </p>

              <h1 className="font-[var(--dt-font-display)] text-5xl leading-[1.02] tracking-tight text-[var(--dt-text-primary)] md:text-6xl">
                Welcome back.
              </h1>

              <p className="mt-5 max-w-sm text-sm leading-6 text-[var(--dt-text-secondary)]">
                Sign in to continue building, tracking, and growing.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="border-y border-[var(--dt-border)] py-8"
            >
              {message && (
                <div
                  role="alert"
                  className="mb-7 border-l-2 border-red-400/70 bg-red-400/5 px-4 py-3 text-sm leading-6 text-red-300"
                >
                  {message}
                </div>
              )}

              <div className="space-y-7">
                <div>
                  <label
                    htmlFor="login-email"
                    className="mb-3 block text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--dt-text-muted)]"
                  >
                    Email
                  </label>

                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    autoFocus
                    placeholder="you@example.com"
                    disabled={loading}
                    className="w-full border-b border-[var(--dt-border)] bg-transparent px-0 py-3 text-base text-[var(--dt-text-primary)] outline-none transition-colors duration-200 placeholder:text-[var(--dt-text-muted)] focus:border-[var(--dt-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-3 block text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--dt-text-muted)]"
                  >
                    Password
                  </label>

                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
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
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

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

        <footer className="px-6 py-6 md:px-10">
          <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--dt-text-muted)]">
            DevTrack — Build. Track. Evolve.
          </p>
        </footer>
      </div>
    </main>
  );
};

export default Login;
