import { useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthContext } from "../context/authContextObject";

const ProtectedRoute = () => {
  const { user, loading, authError, refreshUser } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return <p className="p-8 text-sm text-[var(--dt-text-secondary)]" role="status">Checking your session...</p>;
  }

  // A network or server failure is not proof of logout: offer a retry instead of bouncing to login.
  if (!user && authError) {
    return (
      <section className="mx-auto max-w-md px-6 py-24 text-center" role="alert">
        <p className="text-sm text-red-300">{authError.message || "DevTrack is unreachable right now."}</p>
        <button type="button" className="dt-link-button mt-6" onClick={() => refreshUser().catch(() => {})}>
          Try again
        </button>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
