/**
 * Is the browser's per-token confidence signal usable? (MVP W1 acceptance)
 *
 * `decode.ts` now returns a log-probability per chosen token. W8 turns those into the "check this
 * measure" highlighting that is half of ROADMAP §0's goal, and it reuses the `min_logprob < -1.0`
 * bad-crop threshold that was validated on the PYTHON side (it is what `decode_page.py` records
 * and what the Rung-3 review queue orders on). So the question this file has to answer is not
 * "are the two numbers equal" — it is **"does the browser land on the same side of -1.0 as
 * Python"**.
 *
 * That distinction was learned the hard way here. The first version of this check demanded ≤1e-3
 * agreement per token and FAILED at 8.6e-2, which looked alarming for about a minute. But the ids
 * agree on 13 of 14 strips, so the decode itself is fine; the gap is the **ORT-web vs ORT-Python
 * int8 numerics difference that this project already documents** (docs/STATUS.md — it is the same
 * effect that tips one strip's 69/31 near-tie). Bit-identical *input* does not buy bit-identical
 * *logits* across two different ORT builds, so ≤1e-3 was never a property of my arithmetic; it was
 * an assumption about the runtimes. Measuring threshold agreement measures the thing W8 depends on.
 *
 * Both sides decode the gate's `.pixels.bin` reference tensors, so the image pipeline is out of the
 * picture and the runtime gap is isolated. Reference: `scripts/logprob_ref.py` →
 * `onnx_parity.onnx_greedy_decode(..., return_logprobs=True)`.
 *
 * ⚠ Exactly one strip is expected to decode differently: `bunca_cevrinle` (the known `\tup3`
 * wobble; Python-ORT int8 reads it exactly). A SECOND divergent strip is a regression, not noise.
 */
import * as ort from "onnxruntime-web";
import { greedyDecode } from "../omr/decode";
import type { ModelMeta, Sessions } from "../omr/types";

/** The validated bad-crop threshold W8 will highlight on. Do not invent a different one. */
const FLAG = -1.0;

const log = document.getElementById("log") as HTMLPreElement;
const lines: string[] = [];
function print(line = "") {
  lines.push(line);
  log.innerHTML = lines.join("\n");
}

interface GateStrip {
  image: string;
  pixels: string;
  pixelsShape: number[];
}
type Gate = ModelMeta & { strips: GateStrip[] };
type Ref = Record<string, { ids: number[]; logprobs: number[] }>;

async function main() {
  const gate: Gate = await (await fetch("/models/gate.json")).json();
  const ref: Ref = await (await fetch("/probe/logprobs_ref.json")).json();

  print("loading ONNX sessions…");
  const opts: ort.InferenceSession.SessionOptions = { executionProviders: ["wasm"] };
  const [encoder, decoder, decoderWithPast] = await Promise.all([
    ort.InferenceSession.create("/models/encoder_model.onnx", opts),
    ort.InferenceSession.create("/models/decoder_model.onnx", opts),
    ort.InferenceSession.create("/models/decoder_with_past_model.onnx", opts),
  ]);
  const sessions: Sessions = { encoder, decoder, decoderWithPast };
  print(`sessions ready\n`);

  let worst = 0;
  let worstAt = "";
  let compared = 0;
  let flagDisagree = 0; // tokens landing on opposite sides of the -1.0 flag
  let stripFlagDisagree = 0; // strips whose min-logprob verdict disagrees
  let nearBoundary = 0; // tokens close enough to -1.0 that the runtime gap could matter
  const divergent: string[] = [];

  for (const strip of gate.strips) {
    const expect = ref[strip.image];
    if (!expect) {
      print(`?? ${strip.image} — no reference entry`);
      continue;
    }
    const buf = await (await fetch(`/models/${strip.pixels}`)).arrayBuffer();
    const tensor = new ort.Tensor("float32", new Float32Array(buf), [1, ...strip.pixelsShape]);
    const { ids, logprobs } = await greedyDecode(sessions, tensor, gate.startId, gate.eosId);

    const sameIds =
      ids.length === expect.ids.length && ids.every((v, i) => v === expect.ids[i]);
    if (!sameIds) {
      divergent.push(strip.image);
      print(`   ~ ${strip.image.slice(0, 58)}  ids differ (${ids.length} vs ${expect.ids.length}) — skipped`);
      continue;
    }

    let maxD = 0;
    let disagree = 0;
    for (let i = 0; i < logprobs.length; i++) {
      const js = logprobs[i]!;
      const py = expect.logprobs[i]!;
      maxD = Math.max(maxD, Math.abs(js - py));
      if (js < FLAG !== py < FLAG) disagree++;
      if (Math.abs(js - FLAG) < 0.1) nearBoundary++;
    }
    compared += logprobs.length;
    flagDisagree += disagree;
    const jsMin = Math.min(...logprobs);
    const pyMin = Math.min(...expect.logprobs);
    if (jsMin < FLAG !== pyMin < FLAG) stripFlagDisagree++;
    if (maxD > worst) {
      worst = maxD;
      worstAt = strip.image;
    }
    print(
      `   ${disagree === 0 ? "✓" : "✗"} ${strip.image.slice(0, 52).padEnd(52)} ` +
        `${String(ids.length).padStart(3)} ids  maxΔ ${maxD.toExponential(2)}  ` +
        `min ${jsMin.toFixed(4)} vs ${pyMin.toFixed(4)}` +
        (disagree ? `  ← ${disagree} token(s) cross ${FLAG}` : "")
    );
  }

  print("");
  print(`ids identical on ${gate.strips.length - divergent.length} of ${gate.strips.length} strips` +
        (divergent.length ? ` — divergent: ${divergent.map((d) => d.slice(0, 40)).join(", ")}` : ""));
  print(`compared ${compared} token logprobs`);
  print(`raw ORT-web vs ORT-Python int8 gap: worst Δ ${worst.toExponential(3)} at ${worstAt.slice(0, 44) || "—"}`);
  print(`tokens within 0.1 of the ${FLAG} flag: ${nearBoundary} (the only ones the gap could flip)`);
  print(`tokens landing on opposite sides of ${FLAG}: ${flagDisagree}`);
  print(`strips whose min-logprob verdict disagrees: ${stripFlagDisagree}`);

  // What must hold: the decode integrates correctly (ids match bar the known wobble) and the
  // confidence VERDICT transfers, so W8 can reuse Python's validated -1.0 threshold. The raw
  // per-token delta is reported, not gated — it is a property of the two ORT builds, not of us.
  const allOk = divergent.length <= 1 && flagDisagree === 0 && stripFlagDisagree === 0;
  print("");
  print(allOk
    ? `PASS — ids match, and every token/strip lands on the same side of ${FLAG} as Python. ` +
      "The confidence threshold transfers to the browser."
    : "FAIL — the confidence verdict does not transfer, or a second strip decoded differently.");

  // Say what this does NOT show. The 14 gate strips are all confident reads (every min-logprob is
  // above -0.15), so there are no marginal tokens here for the runtime gap to flip — "0 crossings"
  // is partly a property of the fixture, not only of the agreement. The boundary gets a real test
  // at W3, on the real-page strips where min-logprob actually approaches -1.0.
  if (nearBoundary === 0)
    print(`⚠ non-claim: 0 of ${compared} tokens came within 0.1 of ${FLAG} — this fixture is too ` +
          "confident to test the boundary. Re-check on real-page strips at W3.");

  (window as unknown as { __logprobCheck: unknown }).__logprobCheck = {
    allOk,
    worst,
    worstAt,
    compared,
    divergent,
    flagDisagree,
    stripFlagDisagree,
    nearBoundary,
  };
}

main().catch((e) => {
  print(`ERROR ${e?.stack ?? e}`);
  (window as unknown as { __logprobCheck: unknown }).__logprobCheck = { error: String(e) };
});
