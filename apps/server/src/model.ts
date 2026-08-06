/**
 * Loading the three ONNX graphs into onnxruntime-node.
 *
 * The mirror of `apps/web/src/omr/session.ts`, and deliberately the only file that differs between
 * the two runtimes: everything downstream takes a `Sessions` and cannot tell which one it got.
 *
 * ⚠ These are the SAME int8 graphs the browser ships (`apps/web/public/models/`), not a re-export.
 * A server-side re-export would be a second set of weights to keep in step with the client's
 * fallback, and the first time they drifted nobody would notice.
 */
import * as ort from "onnxruntime-node";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ModelMeta, Sessions } from "../../web/src/omr/types";

const GRAPHS = ["encoder_model", "decoder_model", "decoder_with_past_model"] as const;

export interface LoadedModel {
  sessions: Sessions;
  meta: ModelMeta;
  loadMs: number;
  threads: number;
}

/**
 * How many threads ORT may use inside one operator.
 *
 * Defaults to the container's own CPU allowance rather than the host's core count — on Cloud Run
 * `availableParallelism()` reports the machine, not the vCPU limit, and oversubscribing a 1-vCPU
 * container makes every run slower. Set `OMR_ORT_THREADS` to the deployed `--cpu` value.
 */
export function threadCount(): number {
  const env = Number(process.env.OMR_ORT_THREADS);
  if (Number.isFinite(env) && env > 0) return Math.floor(env);
  return Math.max(1, os.availableParallelism());
}

/**
 * Load the model once, at boot.
 *
 * ⚠ Loading happens at STARTUP, not on the first request. Cloud Run bills a cold start either way,
 * and a request that has to wait ~3 s for `InferenceSession.create` on top of container boot is the
 * difference between "slow" and "timed out". `/health` reports `ready` so a probe can tell them
 * apart, and the graphs are created SEQUENTIALLY for the same peak-memory reason session.ts gives.
 */
export async function loadModel(modelDir: string): Promise<LoadedModel> {
  const t0 = performance.now();
  const threads = threadCount();
  const metaRaw = await readFile(path.join(modelDir, "model.json"), "utf8");
  const meta = JSON.parse(metaRaw) as ModelMeta;

  const opts: ort.InferenceSession.SessionOptions = {
    executionProviders: ["cpu"],
    intraOpNumThreads: threads,
    interOpNumThreads: 1,
    graphOptimizationLevel: "all",
  };

  const loaded: ort.InferenceSession[] = [];
  for (const g of GRAPHS) {
    loaded.push(await ort.InferenceSession.create(path.join(modelDir, `${g}.onnx`), opts));
  }
  const [encoder, decoder, decoderWithPast] = loaded as [
    ort.InferenceSession,
    ort.InferenceSession,
    ort.InferenceSession,
  ];

  return {
    sessions: { encoder, decoder, decoderWithPast, Tensor: ort.Tensor },
    meta,
    loadMs: performance.now() - t0,
    threads,
  };
}
