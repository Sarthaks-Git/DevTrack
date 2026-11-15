import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    tailwindcss({
      optimize: false,
    }),
    react(),
  ],
  server: {
    // Same-origin API in development: cookies stay first-party and CORS is not needed.
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: false },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/react-dom|react-router|[\\/]react[\\/]|scheduler/.test(id)) return "react";
            if (id.includes("motion")) return "motion";
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
});
