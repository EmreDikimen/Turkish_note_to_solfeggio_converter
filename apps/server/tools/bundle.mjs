/**
 * Bundle the server into one file for the container.
 *
 * A script rather than a long `esbuild` command line, because of the banner below — it needs quotes
 * inside quotes, and it needs an explanation more than it needs brevity.
 *
 * ⚠ **The banner is why the first Cloud Run deploy failed** (and its second line is opencv.js's — see below). The output is ESM (the source uses
 * `import.meta.url`), but `pngjs` is CommonJS and calls `require("util")`. esbuild cannot resolve a
 * dynamic require at build time, so it emits a shim that throws *at runtime*:
 *
 *     Error: Dynamic require of "util" is not supported
 *
 * That shim first checks whether a `require` exists in scope and uses it if so. Defining one with
 * `createRequire` is the standard fix and makes CommonJS dependencies work inside an ESM bundle.
 *
 * ⚠ **This artifact is not the one `npm run dev:server` runs.** Dev goes through `tsx`, which
 * resolves CommonJS natively and never sees this problem — so the bundle has to be *run*, not just
 * produced. `npm run check:bundle` does that.
 */
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // Left external: it is a native addon, so it must be `require`d from node_modules at runtime,
  // and the Dockerfile copies exactly it and `onnxruntime-common` into the runtime image. ORT's
  // other two dependencies (adm-zip, global-agent) are used only by its install script — checked,
  // `dist/` requires nothing but `./backend`, `./binding`, `./version`, `onnxruntime-common` and
  // `worker_threads`.
  external: ["onnxruntime-node"],
  outfile: "dist/server.js",
  // ⚠ The `__dirname`/`__filename` half is opencv.js's (2026-10-11, the page endpoint): its
  // emscripten loader reads `__dirname` the moment it is evaluated, which a CommonJS module may and
  // an ESM bundle cannot — the bundle died at import with `__dirname is not defined` while `tsx`
  // ran fine. Same lesson as the banner's first half, caught by `check:bundle` the same way.
  banner: {
    js:
      "import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);" +
      "import{fileURLToPath as __fu}from'node:url';import{dirname as __dn}from'node:path';" +
      "const __filename=__fu(import.meta.url);const __dirname=__dn(__filename);",
  },
});

console.log("bundled → apps/server/dist/server.js");
