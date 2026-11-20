/**
 * Serve `data/audio_voices/` on localhost, so a voice can be heard BEFORE it is uploaded.
 *
 * Why this exists: `npm run dev:voices` points `VITE_VOICES_URL` at the Hugging Face repo, which
 * only has what has already been published. A new instrument has to be listened to before anyone
 * decides it is worth uploading — otherwise the only way to hear a bad split is to publish it first.
 *
 * ⚠ **`python -m http.server` will NOT do**, and the failure is confusing rather than obvious. The
 * dev server sends `Cross-Origin-Embedder-Policy: require-corp` (apps/web/vite.config.ts), so every
 * cross-origin subresource must be fetched CORS-successfully or carry CORP. A plain static server
 * sends neither header, the fetch is blocked by the embedder policy rather than by the network, and
 * the app reports the voice as failed while the file is plainly there and serves fine in a browser
 * tab. The two headers below are the whole reason this file is not a one-liner. They are also what
 * the Hub sends, so what is heard here is what will be heard from the Hub.
 *
 *   npm run serve:voices        # this, on :8788
 *   npm run dev:voices:local    # the app, pointed at it
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VOICES = path.join(ROOT, "data/audio_voices");
const PORT = Number(process.env.VOICES_PORT ?? 8788);

const TYPES: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".md": "text/markdown; charset=utf-8",
};

// ⚠ Both, not either. `access-control-allow-origin` is what makes the CORS fetch succeed, which is
// what satisfies COEP for a `fetch()`; `cross-origin-resource-policy` covers a plain subresource
// load. Sending both costs nothing and removes a whole class of "it works in a tab but not in the
// app" confusion.
const CORS = {
  "access-control-allow-origin": "*",
  "cross-origin-resource-policy": "cross-origin",
};

if (!existsSync(VOICES)) {
  console.error(
    `✗ ${path.relative(ROOT, VOICES)} does not exist.\n` +
      `  Stage the voices first:  .venv-ml/bin/python scripts/prepare_voices.py`,
  );
  process.exit(1);
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...CORS, "access-control-allow-methods": "GET,HEAD,OPTIONS" });
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  // ⚠ Decoded, because the app escapes per path segment on the way out — `A#2` arrives as `A%232`
  // and must be turned back into a filename. Getting this wrong is exactly the bug that cost the
  // clarinet three of its eleven samples against the real Hub.
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = path.join(VOICES, rel);

  // Nothing outside the staging directory, however the path is spelled.
  if (!file.startsWith(VOICES + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, CORS);
    res.end("not found\n");
    console.log(`  404  ${rel}`);
    return;
  }

  const size = statSync(file).size;
  res.writeHead(200, {
    ...CORS,
    "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "content-length": String(size),
  });
  console.log(`  200  ${rel}  ${(size / 1e6).toFixed(1)} MB`);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`voices: ${path.relative(ROOT, VOICES)} → http://localhost:${PORT}`);
  console.log(`then:   npm run dev:voices:local`);
});
