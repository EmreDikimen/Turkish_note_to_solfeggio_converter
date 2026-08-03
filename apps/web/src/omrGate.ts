/**
 * Rung 1.5 — ONNX/browser gate (docs/PHASE2.md §5). See omr-gate.html for the why.
 *
 * This is the JS port of `src/vision/onnx_parity.py`: encoder once → first-step decoder
 * (builds the encoder cross-attention K/V cache) → decoder-with-past loop, greedy argmax,
 * stop on </s>. Comparisons happen in token-ID space, exactly like the Python side.
 *
 * Each strip is decoded from two tensors:
 *  - "reference": Python's exact preprocessed pixel_values (.bin) — proves ORT-in-browser;
 *  - "canvas":    pixels preprocessed here from the PNG (rotate → resize → pad → normalize,
 *                 replicating DonutImageProcessor) — proves the real product path.
 */
import * as ort from "onnxruntime-web";
import {
  MAX_TOKENS,
  decodeTokens,
  detokenize,
  greedyDecode,
  stripEos,
} from "./omr/decode";
import { loadImage, preprocessCanvas } from "./omr/preprocess";
import type { ModelMeta, Sessions } from "./omr/types";

// The wasm runtime loads from the bundled package itself (served same-origin by Vite from
// node_modules — no CDN, offline premise intact). Vite must not pre-bundle onnxruntime-web,
// or the import.meta.url-relative wasm paths break (see vite.config.ts optimizeDeps.exclude).

// Everything reusable now lives in ./omr/ — this file is only the gate harness: the DOM, the
// reference-vs-canvas comparison, and the upload demo. See omr/types.ts for why the split.

interface GateStrip {
  image: string;
  pixels: string;
  pixelsShape: number[];
  label: string;
  labelIds: number[];
}
type Gate = ModelMeta & { strips: GateStrip[] };

const log = document.getElementById("log") as HTMLPreElement;
const stripsDiv = document.getElementById("strips") as HTMLDivElement;
const lines: string[] = [];
function print(line = "") {
  lines.push(line);
  log.textContent = lines.join("\n");
}

/**
 * "Try your own strip": decode any user-supplied image through the exact product path
 * (canvas preprocessing → greedy decode). There is no ground-truth label for an upload, so
 * the result is the raw token stream — the user judges it against the picture. Wired only
 * after the sessions are ready.
 */
function setupUpload(sessions: Sessions, gate: Gate) {
  const drop = document.getElementById("drop") as HTMLDivElement;
  const input = document.getElementById("file") as HTMLInputElement;
  const uploads = document.getElementById("uploads") as HTMLDivElement;
  const targetH = gate.preprocess.size.height;
  const targetW = gate.preprocess.size.width;

  async function decodeFile(file: File) {
    const out = document.createElement("pre");
    out.textContent = `== ${file.name}\n   decoding…`;
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      URL.revokeObjectURL(url);
      img.className = "strip";
      const div = document.createElement("div");
      div.append(img, out);
      uploads.prepend(div);

      const pixels = preprocessCanvas(img, targetW, targetH);
      const tensor = new ort.Tensor("float32", pixels, [1, 3, targetH, targetW]);
      const { ids, encoderMs, decodeMs } = await greedyDecode(sessions, tensor, gate.startId, gate.eosId);
      const content = stripEos(ids, gate.eosId);
      out.textContent =
        `== ${file.name}\n` +
        `   read: ${detokenize(content, gate.id2token)}\n` +
        `   ${content.length} tokens; encoder ${encoderMs.toFixed(0)} ms, decode ${decodeMs.toFixed(0)} ms` +
        (ids.length >= MAX_TOKENS
          ? `\n   ⚠ hit the ${MAX_TOKENS}-token cap without an </s> — likely not a single-staff 2–4-measure strip`
          : "");
    } catch (e) {
      out.textContent = `== ${file.name}\nERROR: ${(e as Error)?.message ?? e}`;
      out.classList.add("bad");
      if (!out.isConnected) uploads.prepend(out);
    }
  }

  input.addEventListener("change", () => {
    for (const f of input.files ?? []) void decodeFile(f);
    input.value = ""; // re-selecting the same file must fire change again
  });
  drop.addEventListener("dragover", (e) => e.preventDefault());
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    for (const f of e.dataTransfer?.files ?? []) void decodeFile(f);
  });
  document.getElementById("drop-status")!.textContent = "";
}

async function main() {
  const gate: Gate = await (await fetch("/models/gate.json")).json();
  const { startId, eosId } = gate;
  const targetH = gate.preprocess.size.height; // 583
  const targetW = gate.preprocess.size.width; // 409

  print(`crossOriginIsolated: ${crossOriginIsolated} (wasm threads ${crossOriginIsolated ? "on" : "OFF"})`);
  print("loading ONNX sessions (int8: encoder 91 MB, decoder 69 MB, decoder-with-past 61 MB)…");
  const tLoad = performance.now();
  const opts: ort.InferenceSession.SessionOptions = { executionProviders: ["wasm"] };
  const [encoder, decoder, decoderWithPast] = await Promise.all([
    ort.InferenceSession.create("/models/encoder_model.onnx", opts),
    ort.InferenceSession.create("/models/decoder_model.onnx", opts),
    ort.InferenceSession.create("/models/decoder_with_past_model.onnx", opts),
  ]);
  const sessions: Sessions = { encoder, decoder, decoderWithPast };
  print(`sessions ready in ${(performance.now() - tLoad).toFixed(0)} ms\n`);
  setupUpload(sessions, gate);

  let allOk = true;
  for (const strip of gate.strips) {
    const img = await loadImage(`/models/${strip.image}`);
    img.className = "strip";
    stripsDiv.appendChild(img);

    print(`== ${strip.image}`);
    print(`   label   : ${strip.label}`);
    const want = stripEos(strip.labelIds, eosId).join(",");

    for (const mode of ["reference", "canvas"] as const) {
      let pixels: Float32Array;
      if (mode === "reference") {
        const buf = await (await fetch(`/models/${strip.pixels}`)).arrayBuffer();
        pixels = new Float32Array(buf);
      } else {
        pixels = preprocessCanvas(img, targetW, targetH);
      }
      const tensor = new ort.Tensor("float32", pixels, [1, 3, targetH, targetW]);
      const { ids, encoderMs, decodeMs } = await greedyDecode(sessions, tensor, startId, eosId);
      const got = stripEos(ids, eosId).join(",");
      const ok = got === want;
      allOk &&= ok;
      print(
        `   ${ok ? "✓" : "✗"} ${mode.padEnd(9)} encoder ${encoderMs.toFixed(0)} ms, ` +
          `decode ${decodeMs.toFixed(0)} ms, ${ids.length} tokens`
      );
      if (!ok) print(`     got: ${decodeTokens(stripEos(ids, eosId), gate.id2token)}`);
    }
    print();
  }

  print(`== RESULT: ${allOk ? "PASS — in-browser ONNX decode matches the labels" : "FAIL"}`);
  log.classList.add(allOk ? "ok" : "bad");
  (window as unknown as { __gateResult: string }).__gateResult = lines.join("\n");
  document.title = `OMR gate — ${allOk ? "PASS" : "FAIL"}`;
}

main().catch((e) => {
  print(`ERROR: ${e?.message ?? e}`);
  log.classList.add("bad");
  (window as unknown as { __gateResult: string }).__gateResult = lines.join("\n");
});
