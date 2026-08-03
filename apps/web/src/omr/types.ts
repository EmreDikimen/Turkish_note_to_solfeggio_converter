/**
 * Shared types for the in-browser OMR runtime.
 *
 * This directory is the product decode path, extracted from the Rung-1.5 gate harness
 * (`../omrGate.ts`) so the app can use it. Two rules hold here:
 *
 *  1. **Nothing in `src/omr/` may touch the DOM by id.** The gate grabbed `#log` at import time,
 *     which is precisely what made it unimportable from React. Modules take what they need as
 *     arguments and return values.
 *  2. **This is not `packages/core`.** ROADMAP §2 keeps core free of platform APIs, and
 *     onnxruntime + canvas are platform APIs. When a mobile app arrives, this directory becomes a
 *     package and the ORT import moves behind `Sessions`; nothing else should have to change.
 */
import type * as ort from "onnxruntime-web";

/** The three ONNX graphs the encoder-decoder needs. Split export, so three sessions. */
export interface Sessions {
  encoder: ort.InferenceSession;
  decoder: ort.InferenceSession;
  decoderWithPast: ort.InferenceSession;
}

/**
 * Everything the runtime needs about the model that isn't weights.
 *
 * Served today as `/models/gate.json`, which also carries the gate's 14 test strips; the product
 * only ever needs these four fields (W9 publishes a trimmed `model.json` with exactly this shape).
 */
export interface ModelMeta {
  startId: number;
  eosId: number;
  id2token: Record<string, string>;
  preprocess: { size: { height: number; width: number } };
}

/** One decoded strip: what the stitcher consumes, plus the confidence fields W8 surfaces. */
export interface StripDecode {
  ids: number[];
  /** Natural-log probability of each chosen token, same length as `ids`. */
  logprobs: number[];
  /** The detokenized label string — what `stitchStrips` reads. */
  tokens: string;
  /** True when decoding stopped at the token cap instead of `</s>`: the read is truncated. */
  hitCap: boolean;
  minLogprob: number;
  meanLogprob: number;
  encoderMs: number;
  decodeMs: number;
}
