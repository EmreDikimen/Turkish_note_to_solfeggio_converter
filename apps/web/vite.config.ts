import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // @turkish-omr/core is consumed as raw TypeScript source from the workspace;
  // don't pre-bundle it so Vite transpiles it directly and picks up edits.
  optimizeDeps: {
    // onnxruntime-web: pre-bundling would break its import.meta.url-relative wasm loading
    exclude: ["@turkish-omr/core", "onnxruntime-web"],
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
