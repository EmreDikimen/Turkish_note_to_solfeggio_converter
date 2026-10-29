/**
 * A photo of a page → the notes on it. The native app's M1 (docs/mobile/plan.md).
 *
 * The phone does no image work: it POSTs the photo's JPEG bytes to the decode server's `/page`,
 * which slices, preprocesses and reads it (`apps/server/src/slicePage.ts`), and the strips that come
 * back are stitched HERE with the web app's own stitcher — `tools/render/stitch.ts`, the same call
 * and the same options as `stitchDecoded` in `apps/web/src/omr/pipeline.ts`. One slicer, one
 * decoder, one stitcher; the phone adds only the upload.
 *
 * Waiting is copied from the web client (`apps/web/src/omr/remote.ts`): a cold Cloud Run container
 * answers 503 "model still loading" for its first seconds, so a 503 is waited out against
 * `/health` rather than reported as a failure.
 */
import { fetch } from "expo/fetch";
import type { NoteModelDocument } from "@turkish-omr/core";
import { stitchStrips, type DecodedStrip, type ScoreStructure } from "../../../tools/render/stitch";

/** The whole request, as long as the web client allows a decode to take. */
const TIMEOUT_MS = 180_000;
/** How long a container that is still loading its model is waited for (the web's figure). */
const WARMUP_WAIT_MS = 120_000;

export class ReadError extends Error {
  constructor(
    readonly kind: "network" | "busy" | "too-large" | "no-staves" | "server",
    message: string,
  ) {
    super(message);
  }
}

export interface PageRead {
  doc: NoteModelDocument;
  /** the repeat and navigation signs the page carries — what the score view draws them from */
  structure: ScoreStructure;
  staves: number;
  strips: number;
  notes: number;
  measures: number;
  warnings: string[];
  /** wall time of the whole read as the phone saw it, and the server's own split */
  totalMs: number;
  sliceMs?: number;
  decodeMs?: number;
}

interface PageReply {
  strips: { system: number; window: number; name?: string; tokens: string }[];
  nStaves: number;
  timings?: { sliceMs?: number; totalMs?: number };
  error?: string;
}

/** Wake the server without waiting on it — call on open, so a first upload finds it warm. */
export function warmServer(base: string): void {
  void fetch(`${base}/health`).catch(() => {});
}

async function waitForReady(base: string, deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/health`);
      const h = (await res.json()) as { ready?: boolean; error?: string };
      if (h.ready) return true;
      if (h.error) return false; // a load that FAILED is not waited on
    } catch {
      /* not answering yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** base64 (what the image picker hands over) → the raw bytes `/page` wants as its body. */
function bytesFromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function readPage(base: string, jpegBase64: string, name: string): Promise<PageRead> {
  const t0 = Date.now();
  const body = bytesFromBase64(jpegBase64);
  const url = `${base}/page?name=${encodeURIComponent(name)}`;

  const post = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body,
        signal: ctrl.signal,
      });
    } catch {
      throw new ReadError("network", "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.");
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await post();
  if (res.status === 503) {
    // A warming container: wait for it once, then try once more.
    if (!(await waitForReady(base, Date.now() + WARMUP_WAIT_MS)))
      throw new ReadError("server", "Okuma sunucusu şu anda hazır değil. Birazdan tekrar deneyin.");
    res = await post();
  }
  const reply = (await res.json().catch(() => ({}))) as PageReply;
  if (res.status === 429) throw new ReadError("busy", "Çok sık istek gönderildi. Bir dakika sonra tekrar deneyin.");
  if (res.status === 413) throw new ReadError("too-large", "Fotoğraf çok büyük. Daha küçük bir fotoğraf deneyin.");
  if (!res.ok) throw new ReadError("server", reply.error ?? `Sunucu hatası (${res.status}).`);
  if (!reply.strips?.length) throw new ReadError("no-staves", "Bu fotoğrafta porte bulunamadı.");

  // ⚠ The same call and options as the web's `stitchDecoded` — keep them in step.
  const forStitch: DecodedStrip[] = reply.strips.map((s) => ({ system: s.system, window: s.window, tokens: s.tokens }));
  const result = stitchStrips(forStitch, { name, accidentals: "carry", expand: false });
  return {
    doc: result.doc,
    structure: result.structure,
    staves: reply.nStaves,
    strips: reply.strips.length,
    notes: result.doc.events.filter((e) => e.kind === "note").length,
    measures: result.writtenMeasures,
    warnings: result.warnings,
    totalMs: Date.now() - t0,
    sliceMs: reply.timings?.sliceMs,
    decodeMs: reply.timings?.totalMs,
  };
}
