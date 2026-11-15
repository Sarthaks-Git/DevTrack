import { lazy, Suspense } from "react";
import { createBrowserRouter, Link, RouterProvider } from "react-router-dom";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";

// App pages load on demand so the landing and auth screens stay small.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Goals = lazy(() => import("./pages/Goals"));
const Projects = lazy(() => import("./pages/Projects"));
const Coding = lazy(() => import("./pages/Coding"));
const Journal = lazy(() => import("./pages/Journal"));
const Timeline = lazy(() => import("./pages/Timeline"));
const Settings = lazy(() => import("./pages/Settings"));
const Notifications = lazy(() => import("./pages/Notifications"));

function PageFallback() {
  return <p className="p-8 text-sm text-[var(--dt-text-secondary)]" role="status">Loading...</p>;
}

function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">404</p>
      <h1 className="mt-4 font-[family-name:var(--dt-font-display)] text-5xl text-[var(--dt-text-primary)]">Page not found</h1>
      <Link to="/" className="dt-link-button mt-8 inline-block">Back to DevTrack</Link>
    </section>
  );
}

const page = Component => (
  <Suspense fallback={<PageFallback />}>
    <Component />
  </Suspense>
);

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/register", element: <Register /> },
  { path: "/login", element: <Login /> },
  {
    path: "/app",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "dashboard", element: page(Dashboard) },
          { path: "goals", element: page(Goals) },
          { path: "projects", element: page(Projects) },
          { path: "coding", element: page(Coding) },
          { path: "journal", element: page(Journal) },
          { path: "timeline", element: page(Timeline) },
          { path: "settings", element: page(Settings) },
          { path: "notifications", element: page(Notifications) },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
