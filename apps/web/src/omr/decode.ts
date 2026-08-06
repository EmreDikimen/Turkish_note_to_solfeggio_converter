/**
 * Greedy ONNX decode in the browser — the JS port of `src/vision/onnx_parity.py`.
 *
 * encoder once → first-step decoder (which also builds the encoder cross-attention K/V cache) →
 * decoder-with-past loop, greedy argmax, stop on `</s>`. Comparisons against Python happen in
 * token-ID space, which is why the gate reports ids rather than strings.
 *
 * Extracted verbatim from `../omrGate.ts` (Rung 1.5) apart from one addition: `argmaxLast` now
 * also returns the chosen token's log-probability. The full logits row was always in hand and was
 * being thrown away; `decode_page.py` has recorded `min_logprob`/`mean_logprob` on the Python side
 * all along, and those are what the labelling queue orders on. Surfacing them is what lets the app
 * show a user WHERE to look (ROADMAP §0).
 *
 * **This module runs in BOTH the browser and the decode server (W9).** Two consequences:
 *
 *  1. It imports no ORT runtime — only types, from `onnxruntime-common`. The `Tensor` constructor
 *     arrives on `Sessions` (see `./types`). Adding `import * as ort from "onnxruntime-web"` back
 *     would break the server at import time, which is the whole reason it is gone.
 *  2. The encoder is separable from the decode loop (`runEncoder` / `decodeFromHidden`), because
 *     the server runs ONE batched encoder pass over a page's ~19 strips and then loops each strip's
 *     decoder separately. `greedyDecode` is those two, unchanged, and is still what the browser and
 *     the gate call.
 */
import type { InferenceSession, Tensor, TensorConstructor } from "onnxruntime-common";
import type { ModelMeta, Sessions, StripDecode } from "./types";

/** Matches overfit10.py / onnx_parity.py judgement decoding. */
export const MAX_TOKENS = 100;

export function int64(T: TensorConstructor, values: number[], dims: number[]): Tensor {
  return new T("int64", BigInt64Array.from(values.map(BigInt)), dims);
}

/**
 * argmax over the vocab at the last decoded position of a [1, seq, vocab] logits tensor,
 * with the chosen token's natural-log probability.
 *
 * The logprob is `row[tok] - logsumexp(row)`, computed as `-log(Σ exp(row - row[tok]))` exactly as
 * `onnx_parity.py:83` does. Because `tok` is the argmax every exponent is ≤ 0, so this is stable
 * by construction — no separate max-subtraction needed.
 */
export function argmaxLast(logits: Tensor): { id: number; logprob: number } {
  const seq = logits.dims[1]!;
  const vocab = logits.dims[2]!;
  const data = logits.data as Float32Array;
  const off = (seq - 1) * vocab;
  let best = 0;
  for (let i = 1; i < vocab; i++) if (data[off + i]! > data[off + best]!) best = i;
  const top = data[off + best]!;
  let sum = 0;
  for (let i = 0; i < vocab; i++) sum += Math.exp(data[off + i]! - top);
  return { id: best, logprob: -Math.log(sum) };
}

/**
 * The encoder pass. `pixelValues` may carry a BATCH of strips ([n, 3, h, w]) — both graphs were
 * exported with a dynamic `batch_size` axis (verified 2026-08-05, docs/mvp/deploy.md), so batching
 * needs no re-export. The browser passes n = 1; the server passes a whole page.
 */
export async function runEncoder(
  s: Sessions,
  pixelValues: Tensor
): Promise<{ hidden: Tensor; encoderMs: number }> {
  const t0 = performance.now();
  const enc = await s.encoder.run({ pixel_values: pixelValues });
  return { hidden: enc.last_hidden_state! as Tensor, encoderMs: performance.now() - t0 };
}

/**
 * Row `i` of a batched encoder output as its own [1, seq, hidden] tensor.
 *
 * `subarray` is a VIEW, not a copy: the decoder only reads its encoder states, and copying ~19
 * of these per page would be pure waste. Nothing downstream writes to it.
 */
export function sliceHidden(T: TensorConstructor, hidden: Tensor, i: number): Tensor {
  const [, seq, size] = hidden.dims as readonly [number, number, number];
  const data = hidden.data as Float32Array;
  const n = seq * size;
  return new T("float32", data.subarray(i * n, (i + 1) * n), [1, seq, size]);
}

/**
 * The greedy loop for ONE strip, given its encoder states: first-step decoder (which also builds
 * the encoder cross-attention K/V cache), then the decoder-with-past loop, argmax, stop on `</s>`.
 */
export async function decodeFromHidden(
  s: Sessions,
  hidden: Tensor,
  startId: number,
  eosId: number
): Promise<{ ids: number[]; logprobs: number[]; decodeMs: number }> {
  const t0 = performance.now();
  // First step (no cache yet): also emits the encoder cross-attention K/V, computed once.
  let outs: InferenceSession.OnnxValueMapType = await s.decoder.run({
    input_ids: int64(s.Tensor, [startId], [1, 1]),
    encoder_hidden_states: hidden,
  });
  const past: Record<string, Tensor> = {};
  const keepPresents = (o: InferenceSession.OnnxValueMapType) => {
    for (const [name, value] of Object.entries(o))
      if (name.startsWith("present."))
        past[name.replace("present.", "past_key_values.")] = value as Tensor;
  };
  keepPresents(outs);

  const ids: number[] = [];
  const logprobs: number[] = [];
  for (;;) {
    const { id: tok, logprob } = argmaxLast(outs.logits! as Tensor);
    ids.push(tok);
    logprobs.push(logprob);
    if (tok === eosId || ids.length >= MAX_TOKENS) break;
    // Later steps: only the new token goes in; the self-attention cache grows, the encoder
    // K/V entries stay as computed on step one.
    outs = await s.decoderWithPast.run({ input_ids: int64(s.Tensor, [tok], [1, 1]), ...past });
    keepPresents(outs);
  }
  return { ids, logprobs, decodeMs: performance.now() - t0 };
}

/** One strip, end to end: encoder then decode loop. The browser's and the gate's entry point. */
export async function greedyDecode(
  s: Sessions,
  pixelValues: Tensor,
  startId: number,
  eosId: number
): Promise<{ ids: number[]; logprobs: number[]; encoderMs: number; decodeMs: number }> {
  const { hidden, encoderMs } = await runEncoder(s, pixelValues);
  const { ids, logprobs, decodeMs } = await decodeFromHidden(s, hidden, startId, eosId);
  return { ids, logprobs, encoderMs, decodeMs };
}

/** Raw space-joined tokens — the gate's diff format, unreadable but exact. */
export function decodeTokens(ids: number[], id2token: Record<string, string>): string {
  return ids.map((i) => id2token[String(i)] ?? `<${i}?>`).join(" ");
}

/**
 * Human-readable form of a decoded id sequence, for images with no ground-truth label.
 * The base vocab is BPE with `</w>` word-end markers (`c''8` decodes as `c` `'` `'` `8</w>`),
 * so raw tokens are unreadable; our `\…` and `|` added tokens are standalone words with no
 * marker. The added token `3` is NOT standalone — it exists only to spell 32nd durations
 * (`e''32` = … `3` `2</w>`), so it continues the current word like any un-marked subword.
 * Mirrors the label strings the serializer emits (tools/render/lilypond.ts).
 */
export function detokenize(ids: number[], id2token: Record<string, string>): string {
  let out = "";
  for (const id of ids) {
    const t = id2token[String(id)] ?? `<${id}?>`;
    if (t.startsWith("\\") || t === "|") out += t + " ";
    else if (t.endsWith("</w>")) out += t.slice(0, -4) + " ";
    else out += t;
  }
  return out.trim();
}

export function stripEos(ids: number[], eosId: number): number[] {
  return ids.filter((i) => i !== eosId);
}

/**
 * A raw greedy result in the shape the stitcher and the confidence UI want.
 *
 * Shared by the browser (`decodeStrip`) and the server (`apps/server/src/decodeBatch.ts`) so the
 * scoring rules below have exactly one definition. `hitCap` deserves its name: stopping at
 * MAX_TOKENS instead of `</s>` means the strip is a truncated read, not a short one, and W8 treats
 * it as "check this" regardless of logprob.
 */
export function summarizeDecode(
  meta: ModelMeta,
  raw: { ids: number[]; logprobs: number[]; encoderMs: number; decodeMs: number }
): StripDecode {
  const { ids, logprobs } = raw;
  const hitCap = ids.length >= MAX_TOKENS && ids[ids.length - 1] !== meta.eosId;

  // Score the content tokens only: the </s> step is a formality and is always confident, so
  // including it would quietly lift every strip's mean.
  const contentIdx = ids.map((_, i) => i).filter((i) => ids[i] !== meta.eosId);
  const contentLp = contentIdx.map((i) => logprobs[i]!);
  const content = stripEos(ids, meta.eosId);

  return {
    ids: content,
    logprobs: contentLp,
    tokens: detokenize(content, meta.id2token),
    hitCap,
    minLogprob: contentLp.length ? Math.min(...contentLp) : 0,
    meanLogprob: contentLp.length ? contentLp.reduce((a, b) => a + b, 0) / contentLp.length : 0,
    encoderMs: raw.encoderMs,
    decodeMs: raw.decodeMs,
  };
}

/** Decode one preprocessed strip. */
export async function decodeStrip(
  sessions: Sessions,
  meta: ModelMeta,
  pixels: Float32Array
): Promise<StripDecode> {
  const { height, width } = meta.preprocess.size;
  const tensor = new sessions.Tensor("float32", pixels, [1, 3, height, width]);
  return summarizeDecode(meta, await greedyDecode(sessions, tensor, meta.startId, meta.eosId));
}
