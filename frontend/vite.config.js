import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, Vite proxies /api to the Express server so the auth cookie
// stays same-origin (no CORS setup needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
