import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./theme/theme.js";
import App from "./App.jsx";
import "./styles/globals.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
