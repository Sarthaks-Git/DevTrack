import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./components/AppLayout";
import Coding from "./pages/Coding";
import Projects from "./pages/Projects";
import Goals from "./pages/Goals";
import Journal from "./pages/Journal";
import Timeline from "./pages/Timeline";
import Test from "./components/Test";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
const router = createBrowserRouter([
  {
    path: "/test",
    element: <Test />,
  },
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/app",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "dashboard", element: <Dashboard /> },
          { path: "goals", element: <Goals /> },
          { path: "projects", element: <Projects /> },
          { path: "coding", element: <Coding /> },
          { path: "journal", element: <Journal /> },
          { path: "timeline", element: <Timeline /> },
        ],
      },
    ],
  },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
