import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // @turkish-omr/core is consumed as raw TypeScript source from the workspace;
  // don't pre-bundle it so Vite transpiles it directly and picks up edits.
  optimizeDeps: {
    exclude: ["@turkish-omr/core"],
  },
});
