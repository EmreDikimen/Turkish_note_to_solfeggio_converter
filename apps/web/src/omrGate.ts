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

// The wasm runtime loads from the bundled package itself (served same-origin by Vite from
// node_modules — no CDN, offline premise intact). Vite must not pre-bundle onnxruntime-web,
// or the import.meta.url-relative wasm paths break (see vite.config.ts optimizeDeps.exclude).

const MAX_TOKENS = 100; // matches overfit10.py / onnx_parity.py judgement decoding

interface GateStrip {
  image: string;
  pixels: string;
  pixelsShape: number[];
  label: string;
  labelIds: number[];
}
interface Gate {
  startId: number;
  eosId: number;
  id2token: Record<string, string>;
  preprocess: { size: { height: number; width: number } };
  strips: GateStrip[];
}

const log = document.getElementById("log") as HTMLPreElement;
const stripsDiv = document.getElementById("strips") as HTMLDivElement;
const lines: string[] = [];
function print(line = "") {
  lines.push(line);
  log.textContent = lines.join("\n");
}

function int64(values: number[], dims: number[]): ort.Tensor {
  return new ort.Tensor("int64", BigInt64Array.from(values.map(BigInt)), dims);
}

/** argmax over the vocab at the last decoded position of a [1, seq, vocab] logits tensor. */
function argmaxLast(logits: ort.Tensor): number {
  const seq = logits.dims[1]!;
  const vocab = logits.dims[2]!;
  const data = logits.data as Float32Array;
  const off = (seq - 1) * vocab;
  let best = 0;
  for (let i = 1; i < vocab; i++) if (data[off + i]! > data[off + best]!) best = i;
  return best;
}

interface Sessions {
  encoder: ort.InferenceSession;
  decoder: ort.InferenceSession;
  decoderWithPast: ort.InferenceSession;
}

async function greedyDecode(
  s: Sessions,
  pixelValues: ort.Tensor,
  startId: number,
  eosId: number
): Promise<{ ids: number[]; encoderMs: number; decodeMs: number }> {
  const t0 = performance.now();
  const enc = await s.encoder.run({ pixel_values: pixelValues });
  const t1 = performance.now();

  // First step (no cache yet): also emits the encoder cross-attention K/V, computed once.
  let outs = await s.decoder.run({
    input_ids: int64([startId], [1, 1]),
    encoder_hidden_states: enc.last_hidden_state!,
  });
  const past: Record<string, ort.Tensor> = {};
  const keepPresents = (o: typeof outs) => {
    for (const [name, value] of Object.entries(o))
      if (name.startsWith("present."))
        past[name.replace("present.", "past_key_values.")] = value;
  };
  keepPresents(outs);

  const ids: number[] = [];
  for (;;) {
    const tok = argmaxLast(outs.logits!);
    ids.push(tok);
    if (tok === eosId || ids.length >= MAX_TOKENS) break;
    // Later steps: only the new token goes in; the self-attention cache grows, the encoder
    // K/V entries stay as computed on step one.
    outs = await s.decoderWithPast.run({ input_ids: int64([tok], [1, 1]), ...past });
    keepPresents(outs);
  }
  const t2 = performance.now();
  return { ids, encoderMs: t1 - t0, decodeMs: t2 - t1 };
}

/**
 * DonutImageProcessor, ported (the values below mirror the checkpoint's preprocessor config):
 *  1. align_long_axis: target is portrait (409×583) and strips are landscape → rotate 90° CW
 *     (numpy's rot90(image, 3), which Python applied to every training image).
 *  2. resize: shortest edge → min(583, 409) = 409, aspect preserved (int truncation like HF).
 *  3. thumbnail: shrink to fit within 409×583 (never enlarges).
 *  4. pad: center on a 409×583 black canvas (constant 0, HF's default).
 *  5. rescale + normalize: x/255 → (x − 0.5)/0.5, i.e. [0, 255] → [−1, 1], channels-first.
 */
function preprocessCanvas(img: HTMLImageElement, targetW: number, targetH: number): Float32Array {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const rotate = (w > h && targetH > targetW) || (h > w && targetW > targetH);
  if (rotate) [w, h] = [h, w];

  // steps 2+3 with HF's exact int() truncations, then one high-quality canvas draw
  const shortest = Math.min(targetH, targetW);
  let [rw, rh] = w < h ? [shortest, Math.trunc((shortest * h) / w)] : [Math.trunc((shortest * w) / h), shortest];
  let th = Math.min(rh, targetH);
  let tw = Math.min(rw, targetW);
  if (rh > rw) tw = Math.trunc((rw * th) / rh);
  else if (rw > rh) th = Math.trunc((rh * tw) / rw);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const padLeft = Math.trunc((targetW - tw) / 2);
  const padTop = Math.trunc((targetH - th) / 2);
  ctx.save();
  if (rotate) {
    // 90° CW: the image's left edge becomes the top edge
    ctx.translate(padLeft + tw, padTop);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0, th, tw); // pre-rotation axes: width along th, height along tw
  } else {
    ctx.drawImage(img, padLeft, padTop, tw, th);
  }
  ctx.restore();

  const { data } = ctx.getImageData(0, 0, targetW, targetH); // RGBA, row-major
  const n = targetW * targetH;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = data[i * 4]! / 127.5 - 1; // R plane
    out[n + i] = data[i * 4 + 1]! / 127.5 - 1; // G plane
    out[2 * n + i] = data[i * 4 + 2]! / 127.5 - 1; // B plane
  }
  return out;
}

function decodeTokens(ids: number[], id2token: Record<string, string>): string {
  return ids.map((i) => id2token[String(i)] ?? `<${i}?>`).join(" ");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function stripEos(ids: number[], eosId: number): number[] {
  return ids.filter((i) => i !== eosId);
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
