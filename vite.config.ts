import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    // Netlify's TanStack Start adapter must run before tanstackStart().
    // It emits the SSR handler to .netlify/v1/functions/server.mjs so the
    // deployed site is server-rendered instead of returning 404s.
    netlify(),
    tanstackStart(),
    react(),
    tailwindcss(),
    tsconfigPaths({ ignoreConfigErrors: true }),
  ],
});
