import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // @turkish-omr/core is consumed as raw TypeScript source from the workspace;
  // don't pre-bundle it so Vite transpiles it directly and picks up edits.
  optimizeDeps: {
    // onnxruntime-web: pre-bundling would break its import.meta.url-relative wasm loading
    exclude: ["@turkish-omr/core", "onnxruntime-web"],
    // opencv.js reaches App.tsx only through the LAZY `import("./omr/page")` in the "Read page"
    // handler, so Vite's static scan never finds it. Discovered at first upload instead, it
    // re-optimizes and full-reloads the tab mid-slice — which throws the upload away and leaves the
    // app waiting forever on a slice that no longer exists. Naming it here makes it a startup cost.
    // Dev-server only: a production build has no dep optimizer and never had the problem.
    include: ["@techstark/opencv-js"],
  },
  // Cross-origin isolation enables SharedArrayBuffer, which onnxruntime-web needs for
  // multi-threaded wasm (the Rung-1.5 OMR gate page; realistic latency numbers).
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
