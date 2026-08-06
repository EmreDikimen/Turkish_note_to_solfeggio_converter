/**
 * Headless entry point for the CLIENT HALF of the decode-server contract (MVP W9).
 *
 * `tools/vision/parity/server-parity.ts` drives it. For each strip it returns two things:
 *
 *   1. the exact bytes the client would POST — `preprocessToCanvas` output, PNG-encoded, which is
 *      the seam described in `omr/pixels.ts`;
 *   2. what the IN-BROWSER path reads from that same strip, ids and all.
 *
 * Producing both in one pass is the point. The server is then handed (1) and its answer compared
 * to (2), so the only thing that can differ between the two sides is the ONNX runtime — not the
 * resampler, not the padding, not the PNG. Held any other way, "the server matches the browser"
 * would be a claim about four things at once.
 *
 * It runs the shipped modules (`preprocessToCanvas`, `decodeStrip`, `getModel`), not lookalikes:
 * the canvas resampler exists only in a browser, which is why this is a page and not a Node script.
 */
import { decodeStrip } from "../omr/decode";
import { loadImage, preprocessCanvas, preprocessToCanvas } from "../omr/preprocess";
import { getMeta, getModel } from "../omr/session";

export interface ParityStripInput {
  name: string;
  system: number;
  window: number;
  dataUrl: string;
}

export interface ParityStripOutput {
  name: string;
  system: number;
  window: number;
  /** base64 PNG of the preprocessed 409×583 image — what the client would upload */
  png: string;
  /** what the browser itself read from it */
  ids: number[];
  tokens: string;
  /** per-token log-probability, so a divergence can be read as a near-tie or as a real one */
  logprobs: number[];
  minLogprob: number;
  hitCap: boolean;
  encoderMs: number;
  decodeMs: number;
  /** bytes of the raw crop, for the payload question deploy.md leaves open */
  cropBytes: number;
}

/**
 * `preprocessOnly` skips the browser's own decode and loads no weights — the mode
 * `decode-pool.ts --server` uses to score the SERVER against gold. Preprocessing is still the
 * browser's job there, because the upload has to be the same bytes a real client would send.
 */
async function prepare(
  strips: ParityStripInput[],
  opts: { preprocessOnly?: boolean } = {}
): Promise<ParityStripOutput[]> {
  const meta = opts.preprocessOnly ? await getMeta() : (await getModel()).meta;
  const sessions = opts.preprocessOnly ? null : (await getModel()).sessions;
  const { width, height } = meta.preprocess.size;
  const out: ParityStripOutput[] = [];

  for (const s of strips) {
    const img = await loadImage(s.dataUrl);

    // The upload bytes and the decoded pixels come from ONE call each, in the app's own order:
    // canvas first, then read it. Preprocessing twice would risk two different canvases.
    const canvas = preprocessToCanvas(img, width, height);
    const png = canvas.toDataURL("image/png").split(",")[1]!;
    const decoded = sessions
      ? await decodeStrip(sessions, meta, preprocessCanvas(img, width, height))
      : null;

    out.push({
      name: s.name,
      system: s.system,
      window: s.window,
      png,
      ids: decoded?.ids ?? [],
      tokens: decoded?.tokens ?? "",
      logprobs: decoded?.logprobs ?? [],
      minLogprob: decoded?.minLogprob ?? 0,
      hitCap: decoded?.hitCap ?? false,
      encoderMs: decoded?.encoderMs ?? 0,
      decodeMs: decoded?.decodeMs ?? 0,
      cropBytes: Math.round((s.dataUrl.length - s.dataUrl.indexOf(",") - 1) * 0.75),
    });
  }
  return out;
}

(window as unknown as { __omrParity: unknown }).__omrParity = { prepare, ready: true };
