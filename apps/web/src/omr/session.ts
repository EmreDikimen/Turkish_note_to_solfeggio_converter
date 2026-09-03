/**
 * Loading the model into the browser — the FALLBACK's entry point since W9.
 *
 * On the normal path the decode server reads the page and nothing here runs. These ~211 MB arrive
 * only when the server fails, times out or is cold beyond patience (`omr/remote.ts`), which is why
 * the split below matters: `getMeta()` is ~12 KB and is needed on *every* path, `getModel()` is the
 * weights and is needed on almost none.
 *
 * **Where the weights come from is a build-time choice** (`VITE_WEIGHTS_URL`):
 *
 *   unset  → `/models/…`, i.e. `apps/web/public/models/` — the dev default, same files the gate and
 *            the harnesses use. Nothing to configure to run locally.
 *   set    → any base URL, in practice a Hugging Face Hub repo. This is what a deployed build uses,
 *            because 211 MB of weights cannot live in a static site's `dist/`.
 *
 * The remote layout is exactly what `apps/server/tools/prepare-models.mjs` emits — three graphs plus
 * a trimmed `model.json`. One artifact set, three consumers: the server's container, the Hub, and
 * a local checkout. If they were assembled separately they would drift, and the first symptom would
 * be a friend's fallback disagreeing with the server for no visible reason.
 *
 * Sessions are created ONCE and memoised: they hold ~211 MB between them, and the failure mode on a
 * mid-range phone is memory, not bandwidth.
 */
import * as ort from "onnxruntime-web";
import { configureOrt } from "./ortEnv";
import type { ModelMeta, Sessions } from "./types";

export interface LoadedModel {
  sessions: Sessions;
  meta: ModelMeta;
}

const GRAPHS = ["encoder_model", "decoder_model", "decoder_with_past_model"] as const;

/** Empty in dev, a Hub URL in a deployed build. Trailing slash trimmed so joins stay predictable. */
const WEIGHTS_BASE = ((import.meta.env.VITE_WEIGHTS_URL as string | undefined) ?? "")
  .trim()
  .replace(/\/$/, "");

/**
 * `gate.json` locally, `model.json` remotely — the same four fields either way.
 *
 * They are different files on purpose. `gate.json` also carries the 14 test strips the browser gate
 * replays, which belong in a checkout and have no business being downloaded by a friend.
 */
const metaUrl = WEIGHTS_BASE ? `${WEIGHTS_BASE}/model.json` : "/models/gate.json";
const graphUrl = (name: string) =>
  WEIGHTS_BASE ? `${WEIGHTS_BASE}/${name}.onnx` : `/models/${name}.onnx`;

/** Bump when the shipped graphs change, so a stale cached copy cannot outlive them. */
const CACHE_NAME = "omr-weights-r3a-stage2-best-real-int8";

let pending: Promise<LoadedModel> | null = null;
let metaPending: Promise<ModelMeta> | null = null;

/**
 * The model's metadata WITHOUT its weights — ~12 KB against ~211 MB.
 *
 * Separate from `getModel` because the server path needs `preprocess.size` to prepare the upload
 * and nothing else: a friend whose decode runs on Cloud Run must never download the graphs.
 */
export function getMeta(): Promise<ModelMeta> {
  metaPending ??= (async () => {
    const res = await fetch(metaUrl);
    if (!res.ok) throw new Error(`model metadata ${res.status} from ${metaUrl}`);
    return (await res.json()) as ModelMeta;
  })();
  metaPending.catch(() => {
    metaPending = null;
  });
  return metaPending;
}

/**
 * One graph's bytes, from the Cache Storage copy when there is one.
 *
 * Fetched by hand rather than handing ORT the URL, for three reasons: the download can report
 * progress (a friend on a slow line is otherwise staring at nothing for a minute), it is cached
 * explicitly so the second fallback of the day is instant, and the request is plain CORS `fetch`,
 * which satisfies COEP `require-corp` without the Hub needing to send a CORP header.
 *
 * ⚠ Cache Storage is best-effort and treated as such: it is absent in a non-secure context, and iOS
 * evicts it for non-installed sites after roughly a week (the phone problem, parked with phones —
 * docs/mvp/deploy.md). A miss costs a re-download, never a failure.
 */
async function graphBytes(url: string, onProgress?: (msg: string) => void): Promise<Uint8Array> {
  let cache: Cache | null = null;
  try {
    cache = typeof caches !== "undefined" ? await caches.open(CACHE_NAME) : null;
  } catch {
    cache = null;
  }

  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) return new Uint8Array(await hit.arrayBuffer());

  const res = await fetch(url);
  if (!res.ok) throw new Error(`model weights ${res.status} from ${url}`);
  // `put` consumes a body, so the clone has to happen before we read it ourselves.
  const forCache = res.clone();
  const bytes = new Uint8Array(await res.arrayBuffer());
  // A cache write must never break the load — quota is finite and 211 MB is not small.
  cache?.put(url, forCache).catch(() => onProgress?.("(could not cache the model locally)"));
  return bytes;
}

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
    // Before any session is created: in a production build ORT needs to be told where its
    // own wasm and worker glue live, or session creation hangs. See ./ortEnv.
    configureOrt();
    onProgress?.("loading model metadata…");
    const meta = await getMeta();

    const opts: ort.InferenceSession.SessionOptions = { executionProviders: ["wasm"] };
    const loaded: ort.InferenceSession[] = [];
    for (let i = 0; i < GRAPHS.length; i++) {
      onProgress?.(`loading model ${i + 1} of ${GRAPHS.length}…`);
      const bytes = await graphBytes(graphUrl(GRAPHS[i]!), onProgress);
      loaded.push(await ort.InferenceSession.create(bytes, opts));
    }
    const [encoder, decoder, decoderWithPast] = loaded as [
      ort.InferenceSession,
      ort.InferenceSession,
      ort.InferenceSession,
    ];
    onProgress?.("model ready");
    return { sessions: { encoder, decoder, decoderWithPast, Tensor: ort.Tensor }, meta };
  })();
  // A failed load must not poison every later attempt.
  pending.catch(() => {
    pending = null;
  });
  return pending;
}
