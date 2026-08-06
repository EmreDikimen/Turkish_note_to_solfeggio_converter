/**
 * The decode server (MVP W9) — POST a page's strips, get the tokens back.
 *
 * Node + `onnxruntime-node`, importing `apps/web/src/omr/decode.ts`: the browser's own module, so
 * there is ONE decode implementation rather than a third to hold in parity (docs/mvp/deploy.md).
 * Slicing stays on the client, the editor and playback stay on the client, and the client keeps a
 * working in-browser decode as its fallback. What moves here is the ~19 s of neural decode that
 * was heating the user's laptop — the reason the server exists at all.
 *
 * The contract is deliberately small:
 *
 *   GET  /health   → readiness, model info, limits. Cheap enough to poll.
 *   POST /decode   → { strips: [{ system, window, name?, png }] } with `png` base64-encoded,
 *                    409×583 RGBA, ALREADY rotated/resized/padded by the client (see omr/pixels.ts
 *                    for why the seam is there). Returns one decoded strip per input, in order.
 *
 * Stitching is NOT here. The stitcher is where a score gets its shape and the editor loads it
 * locally; sending tokens back keeps the server a pure function of pixels.
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePage, maxBatch, type StripImage } from "./decodeBatch";
import { clientIp, limits, RateLimiter } from "./limits";
import { loadModel, type LoadedModel } from "./model";
import { decodeRGBA, readHeader } from "./png";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = process.env.MODEL_DIR ?? path.resolve(HERE, "../models");
const PORT = Number(process.env.PORT ?? 8080);
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim());
const LIMITS = limits();
const limiter = new RateLimiter(LIMITS.rateRequests, LIMITS.rateWindowMs);

let model: LoadedModel | null = null;
let loadError: string | null = null;

/** One page at a time. See `runExclusive`. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Serialize decodes within the process.
 *
 * ORT already spreads one run across every thread it was given, so a second concurrent page buys
 * no throughput and doubles peak memory — the same reasoning `pipeline.ts` gives for decoding
 * strips in order on the client. Cloud Run should ALSO be deployed with `--concurrency=1`; this is
 * the belt to that braces, and it is what keeps a burst from OOM-killing the container.
 */
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function cors(req: http.IncomingMessage, res: http.ServerResponse): void {
  const origin = req.headers.origin;
  const allow = ORIGINS.includes("*") ? "*" : origin && ORIGINS.includes(origin) ? origin : "";
  if (allow) res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(json);
}

/**
 * Read the body, refusing to buffer more than the cap.
 *
 * The check is on bytes SEEN, not on `content-length`: a chunked request can lie about its length
 * or omit it, and the point of the cap is that this process never holds more than it agreed to.
 */
function readBody(req: http.IncomingMessage, cap: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > cap) {
        reject(Object.assign(new Error("payload too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Where a strip sits on the page. Carried through untouched so the client can stitch. */
interface StripPosition {
  system: number;
  window: number;
  name?: string;
}

class BadRequest extends Error {
  readonly status = 400;
}

/**
 * Turn the request body into pixels, or explain exactly what was wrong with it.
 *
 * Every rejection here happens before a single ONNX op runs, and the dimension check is doing two
 * jobs: it is the "reject non-image payloads early" line of the safety checklist, and it is the
 * guard that the client really did the geometry. A strip that is not 409×583 was preprocessed by
 * something other than `preprocessToCanvas`, and decoding it would silently produce a bad read
 * rather than an error.
 */
function parseStrips(
  body: Buffer,
  meta: LoadedModel["meta"]
): { positions: StripPosition[]; images: StripImage[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    throw new BadRequest("body is not JSON");
  }
  const strips = (parsed as { strips?: unknown })?.strips;
  if (!Array.isArray(strips) || strips.length === 0) throw new BadRequest("no strips");
  if (strips.length > LIMITS.maxStrips)
    throw new BadRequest(`too many strips (${strips.length} > ${LIMITS.maxStrips})`);

  const { width, height } = meta.preprocess.size;
  const positions: StripPosition[] = [];
  const images: StripImage[] = [];

  for (const [i, raw] of strips.entries()) {
    const s = raw as Partial<StripPosition & { png: string }>;
    if (typeof s?.png !== "string") throw new BadRequest(`strip ${i}: no png`);
    const { system, window } = s;
    if (!Number.isInteger(system) || !Number.isInteger(window))
      throw new BadRequest(`strip ${i}: system/window must be integers`);

    const buf = Buffer.from(s.png, "base64");
    if (buf.length > LIMITS.maxPixelBytes) throw new BadRequest(`strip ${i}: png too large`);
    const head = readHeader(buf);
    if (!head) throw new BadRequest(`strip ${i}: not a PNG`);
    if (head.width !== width || head.height !== height)
      throw new BadRequest(
        `strip ${i}: expected a ${width}×${height} preprocessed strip, got ${head.width}×${head.height}`
      );
    if (head.bitDepth !== 8) throw new BadRequest(`strip ${i}: expected 8-bit PNG`);

    let decoded;
    try {
      decoded = decodeRGBA(buf);
    } catch (err) {
      throw new BadRequest(`strip ${i}: unreadable PNG (${String(err)})`);
    }
    if (decoded.rgba.length !== width * height * 4)
      throw new BadRequest(`strip ${i}: unexpected pixel count`);

    positions.push({
      system: system as number,
      window: window as number,
      name: typeof s.name === "string" ? s.name.slice(0, 200) : undefined,
    });
    images.push(decoded);
  }
  return { positions, images };
}

async function handleDecode(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // Rate limit BEFORE the readiness check: a client hammering a cold or broken instance is exactly
  // the traffic worth limiting, and answering it with an unlimited stream of 503s is free work for
  // whoever is doing the hammering.
  const ip = clientIp(req.headers["x-forwarded-for"], req.socket.remoteAddress ?? undefined);
  const retryAfter = limiter.check(ip);
  if (retryAfter !== null) {
    res.setHeader("Retry-After", String(retryAfter));
    send(res, 429, { error: "rate limit exceeded", retryAfterS: retryAfter });
    return;
  }
  if (!model) {
    send(res, 503, { error: loadError ? `model failed to load: ${loadError}` : "model still loading" });
    return;
  }

  const body = await readBody(req, LIMITS.maxBodyBytes);
  const { positions, images } = parseStrips(body, model.meta);

  const t0 = performance.now();
  const cpu0 = process.cpuUsage();
  const { strips, timings } = await runExclusive(() => decodePage(model!.sessions, model!.meta, images));
  const cpu = process.cpuUsage(cpu0);
  const queuedAndRanMs = performance.now() - t0;

  // CPU time, not wall time: this is the number Cloud Run bills and the one the cost estimate in
  // deploy.md was guessed from. Reported per request so the estimate can be replaced with a
  // measurement — with threads > 1 it is legitimately larger than the wall time.
  const cpuMs = (cpu.user + cpu.system) / 1000;
  // Peak resident memory after the decode. The batch size trades memory for (in principle) speed,
  // and on Cloud Run the memory side of that trade is what gets the container OOM-killed — so it
  // is reported rather than reasoned about.
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

  send(res, 200, {
    strips: strips.map((d, i) => ({
      system: positions[i]!.system,
      window: positions[i]!.window,
      name: positions[i]!.name,
      ids: d.ids,
      logprobs: d.logprobs,
      tokens: d.tokens,
      hitCap: d.hitCap,
      minLogprob: d.minLogprob,
      meanLogprob: d.meanLogprob,
    })),
    timings: { ...timings, queuedAndRanMs, cpuMs, rssMb },
    threads: model.threads,
  });
}

const server = http.createServer((req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
    // 200 while the model is still loading — the process IS alive, and `ready: false` is the
    // fact the client's fallback needs. 503 is reserved for a load that actually failed.
    send(res, loadError ? 503 : 200, {
      ok: !loadError,
      ready: Boolean(model),
      error: loadError ?? undefined,
      threads: model?.threads,
      loadMs: model?.loadMs,
      maxBatch: maxBatch(),
      limits: LIMITS,
      uptimeS: Math.round(process.uptime()),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/decode") {
    handleDecode(req, res).catch((err: unknown) => {
      const status = (err as { status?: number })?.status ?? 500;
      const message = err instanceof Error ? err.message : String(err);
      if (status === 500) console.error("decode failed:", err);
      if (!res.headersSent) send(res, status, { error: message });
    });
    return;
  }

  send(res, 404, { error: "not found" });
});

/**
 * Listen FIRST, load the model after.
 *
 * Cloud Run only routes traffic once the port is open, and a container that takes ~3 s of session
 * creation before binding looks like a failed start. Requests arriving in that window get a
 * truthful 503 with `ready: false`, which is exactly what the client's fallback wants to see.
 */
server.listen(PORT, () => {
  console.log(`decode server on :${PORT} — models ${MODEL_DIR}, max batch ${maxBatch()}`);
  loadModel(MODEL_DIR)
    .then((m) => {
      model = m;
      console.log(
        `model ready in ${m.loadMs.toFixed(0)} ms, ${m.threads} thread(s), ` +
          `${m.meta.preprocess.size.width}×${m.meta.preprocess.size.height}`
      );
    })
    .catch((err: unknown) => {
      loadError = err instanceof Error ? err.message : String(err);
      console.error("model load failed:", err);
    });
});
