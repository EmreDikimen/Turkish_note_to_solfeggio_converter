/**
 * A page's worth of strips, decoded — the one thing the server does that the browser cannot.
 *
 * The browser decodes strip by strip because `onnxruntime-web` gives it no choice: one encoder run
 * per strip, ~0.9 s each. Here the encoder runs over a BATCH, which is the structural half of the
 * case for having a server at all (docs/mvp/deploy.md). Both graphs carry a dynamic `batch_size`
 * axis, so this needs no re-export — verified 2026-08-05.
 *
 * Everything else is `apps/web/src/omr/decode.ts` unchanged: the greedy loop, the stopping rule,
 * the logprob scoring and the `StripDecode` shape all come from the module the browser runs. That
 * is the whole design — there is one decode implementation, and this file only decides what goes
 * through the encoder together.
 */
import {
  decodeFromHidden,
  runEncoder,
  sliceHidden,
  summarizeDecode,
} from "../../web/src/omr/decode";
import { pixelsFromRGBA } from "../../web/src/omr/pixels";
import type { ModelMeta, Sessions, StripDecode } from "../../web/src/omr/types";

/** One strip as it arrives: already rotated, resized and padded by the client. */
export interface StripImage {
  /** interleaved RGBA, `width * height * 4` bytes */
  rgba: Uint8Array;
  width: number;
  height: number;
}

export interface BatchTimings {
  /** wall time inside the encoder, summed over sub-batches */
  encoderMs: number;
  /** wall time inside the greedy loops, summed over strips */
  decodeMs: number;
  totalMs: number;
  /** the sub-batch sizes actually used, in order */
  batches: number[];
}

/**
 * Encoder sub-batch size. **Defaults to 1 — batching was measured and it does not pay.**
 *
 * This is the one place where the plan's reasoning did not survive contact with a benchmark.
 * `docs/mvp/deploy.md` listed "no batching, ever" as a structural advantage of a server over
 * `onnxruntime-web`. Measured on an M4 over 6 real pages (128 strips), batch 8 against batch 1:
 *
 *   threads 1 — 12.0 s vs 11.8 s per page | threads 2 — 8.7 s vs 8.3 s | threads 4 — 7.4 s vs 7.4 s
 *   peak RSS on a 38-strip page — **2,778 MB vs 955 MB**
 *
 * So it is consistently a few percent SLOWER and costs 2.9× the memory, which on Cloud Run is the
 * difference between a 1 GiB and a 4 GiB container. The reason is not mysterious: one 409×583 Swin
 * forward already fills the cores, so there is no idle width for a batch to use.
 *
 * The batched path is KEPT and reachable through `OMR_MAX_BATCH` — the measurement is one CPU
 * architecture, and a different host could answer differently. It has to be re-measured there
 * rather than assumed. What is not kept is the claim.
 */
export function maxBatch(): number {
  const env = Number(process.env.OMR_MAX_BATCH);
  return Number.isFinite(env) && env > 0 ? Math.floor(env) : 1;
}

/**
 * Decode every strip of a page.
 *
 * `encoderMs` is reported per strip as the sub-batch's cost divided by its size — an attribution,
 * not a measurement, and the only number here that is. The batch totals in `BatchTimings` are the
 * measured ones and are what the benchmark quotes.
 */
export async function decodePage(
  sessions: Sessions,
  meta: ModelMeta,
  images: readonly StripImage[]
): Promise<{ strips: StripDecode[]; timings: BatchTimings }> {
  const t0 = performance.now();
  const { height, width } = meta.preprocess.size;
  const perImage = 3 * width * height;
  const size = maxBatch();

  const out: StripDecode[] = [];
  const timings: BatchTimings = { encoderMs: 0, decodeMs: 0, totalMs: 0, batches: [] };

  for (let start = 0; start < images.length; start += size) {
    const chunk = images.slice(start, start + size);
    const pixels = new Float32Array(perImage * chunk.length);
    chunk.forEach((img, i) => {
      pixels.set(pixelsFromRGBA(img.rgba, width, height), i * perImage);
    });

    const batched = new sessions.Tensor("float32", pixels, [chunk.length, 3, height, width]);
    const { hidden, encoderMs } = await runEncoder(sessions, batched);
    timings.encoderMs += encoderMs;
    timings.batches.push(chunk.length);

    for (let i = 0; i < chunk.length; i++) {
      const raw = await decodeFromHidden(
        sessions,
        sliceHidden(sessions.Tensor, hidden, i),
        meta.startId,
        meta.eosId
      );
      timings.decodeMs += raw.decodeMs;
      out.push(summarizeDecode(meta, { ...raw, encoderMs: encoderMs / chunk.length }));
    }
  }

  timings.totalMs = performance.now() - t0;
  return { strips: out, timings };
}
