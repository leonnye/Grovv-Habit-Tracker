import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Optional: keep the dependency installed to enable Cloudflare deployments later.
// If you aren't deploying to Cloudflare Workers/Pages, you can remove this import/plugin.
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }) => ({
  plugins: [
    // If you deploy to Cloudflare, this should run before tanstackStart().
    // We only enable it for production builds by default.
    ...(mode === "production" ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
    tanstackStart(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
}));
