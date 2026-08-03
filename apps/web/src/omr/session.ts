/**
 * Loading the model into the browser.
 *
 * W2 keeps this deliberately simple: the three int8 graphs come from `/models/`, same as the gate,
 * so the end-to-end path can be proven before the delivery problem is solved. **W9 replaces the
 * fetch with Hugging Face Hub + Cache API persistence** — see docs/mvp/README.md. The rest of the
 * app only ever sees `getModel()`, so that swap should not reach any other file.
 *
 * Sessions are created ONCE and memoised: they hold ~211 MB of weights between them, and the
 * failure mode on a mid-range phone is memory, not bandwidth.
 */
import * as ort from "onnxruntime-web";
import type { ModelMeta, Sessions } from "./types";

export interface LoadedModel {
  sessions: Sessions;
  meta: ModelMeta;
}

const GRAPHS = ["encoder_model", "decoder_model", "decoder_with_past_model"] as const;

let pending: Promise<LoadedModel> | null = null;

/**
 * Get the model, loading it on first call. Concurrent callers share one load.
 *
 * ⚠ Graphs are created SEQUENTIALLY, not with `Promise.all` as the gate does. Three
 * `InferenceSession.create` calls in flight at once means three sets of weights plus ORT's
 * internal copies live simultaneously; loading one at a time keeps the peak near the largest
 * single graph instead of the sum.
 */
export function getModel(onProgress?: (msg: string) => void): Promise<LoadedModel> {
  if (pending) return pending;
  pending = (async () => {
    onProgress?.("loading model metadata…");
    const meta: ModelMeta = await (await fetch("/models/gate.json")).json();

    const opts: ort.InferenceSession.SessionOptions = { executionProviders: ["wasm"] };
    const loaded: ort.InferenceSession[] = [];
    for (let i = 0; i < GRAPHS.length; i++) {
      onProgress?.(`loading model ${i + 1} of ${GRAPHS.length}…`);
      loaded.push(await ort.InferenceSession.create(`/models/${GRAPHS[i]}.onnx`, opts));
    }
    const [encoder, decoder, decoderWithPast] = loaded as [
      ort.InferenceSession,
      ort.InferenceSession,
      ort.InferenceSession,
    ];
    onProgress?.("model ready");
    return { sessions: { encoder, decoder, decoderWithPast }, meta };
  })();
  // A failed load must not poison every later attempt.
  pending.catch(() => {
    pending = null;
  });
  return pending;
}
