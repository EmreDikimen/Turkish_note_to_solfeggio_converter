/**
 * W0 — opencv.js primitive parity probe (plan W0). THROWAWAY: deleted at W6.
 *
 * The slicer port (W4-W6) transliterates `src/vision/page_to_strips.py`. That is only worth doing
 * if the primitives underneath behave identically, so this checks the four it rests on —
 * Otsu threshold, MORPH_OPEN row projection, connectedComponents, INTER_AREA resize — plus the
 * PNG->grayscale decode that feeds all of them.
 *
 * Grayscale is the one that cannot be exact, and it is worth stating why here rather than
 * rediscovering it later. `cv2.imread(IMREAD_GRAYSCALE)` converts inside the PNG decoder; a browser
 * only ever gets RGBA out of the decoder and converts afterwards. Measured on the corpus: OpenCV's
 * OWN two paths (imread-gray vs cvtColor on imread-colour) already disagree by ±1 on 7.4% of pixels
 * of a colour page. So the bar for grayscale is |Δ| ≤ 1, not equality — justified by a separate
 * measurement (scripts, 2026-08-02): re-running the whole slicer on the 6 most-colour-shifted pages
 * in the corpus with that ±1 perturbation left all 119 strips bit-identical (same count, row_x0/x1,
 * scale, row_bars, pads). Sub-quantization grayscale noise does not reach the output.
 *
 * The other four are exact-or-bust: they are integer/accumulator operations where a mismatch means
 * a genuinely different algorithm, not rounding.
 */
import cvReady from "@techstark/opencv-js";

const log = document.getElementById("log") as HTMLPreElement;
const lines: string[] = [];
function print(line = "") {
  lines.push(line);
  log.innerHTML = lines.join("\n");
}
const mark = (ok: boolean) => (ok ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>');

interface Ref {
  page: string;
  width: number;
  height: number;
  grayBytes: number;
  otsuThreshold: number;
  inkCount: number;
  horLen: number;
  rowInk: number[];
  ccLabelCount: number;
  resize: { cropTop: number; cropRows: number; newW: number; newH: number; colSums: number[] };
}

/** Decode the PNG with every browser colour transform disabled, so we get the file's own bytes. */
async function decodeRgba(url: string): Promise<ImageData> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** First index where two numeric sequences differ, or -1. */
function firstDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

/** Largest absolute difference between two numeric sequences. */
function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
}

interface ArmResult {
  otsu: number;
  inkCount: number;
  rowInk: Float64Array;
  ccLabels: number;
  colSums: Float64Array;
}

/**
 * Run all four primitives over one grayscale Mat.
 *
 * Called twice, which is the whole point of this probe. Arm B feeds it Python's own grayscale
 * bytes, so any difference there is opencv.js disagreeing with OpenCV-Python about an algorithm —
 * that is fatal. Arm A feeds it the browser's PNG decode, so a difference there is only the ±1
 * decode gap propagating, which the corpus measurement says does not reach the slicer's output.
 */
function runPrimitives(cv: Awaited<typeof cvReady>, gray: any, ref: Ref): ArmResult {
  const ink = new cv.Mat();
  const otsu = cv.threshold(gray, ink, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  const inkData = ink.data as Uint8Array;
  let inkCount = 0;
  for (let i = 0; i < inkData.length; i++) if (inkData[i]) inkCount++;

  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(ref.horLen, 1));
  const horiz = new cv.Mat();
  cv.morphologyEx(ink, horiz, cv.MORPH_OPEN, kernel);
  kernel.delete();
  const hData = horiz.data as Uint8Array;
  const rowInk = new Float64Array(ref.height);
  for (let y = 0; y < ref.height; y++) {
    let s = 0;
    const off = y * ref.width;
    for (let x = 0; x < ref.width; x++) s += hData[off + x]!;
    rowInk[y] = s / 255;
  }
  horiz.delete();

  const labels = new cv.Mat();
  const ccLabels = cv.connectedComponents(ink, labels, 8);
  labels.delete();
  ink.delete();

  const roi = gray.roi(new cv.Rect(0, ref.resize.cropTop, ref.width, ref.resize.cropRows));
  const resized = new cv.Mat();
  cv.resize(roi, resized, new cv.Size(ref.resize.newW, ref.resize.newH), 0, 0, cv.INTER_AREA);
  const rData = resized.data as Uint8Array;
  const colSums = new Float64Array(ref.resize.newW);
  for (let y = 0; y < ref.resize.newH; y++) {
    const off = y * ref.resize.newW;
    for (let x = 0; x < ref.resize.newW; x++) colSums[x]! += rData[off + x]!;
  }
  roi.delete();
  resized.delete();

  return { otsu, inkCount, rowInk, ccLabels, colSums };
}

async function main() {
  const cv = await cvReady;
  print("opencv.js ready");

  const ref: Ref = await (await fetch("/probe/ref.json")).json();
  const refGray = new Uint8Array(await (await fetch("/probe/gray.bin")).arrayBuffer());
  print(`page ${ref.page.split("/").pop()}  ${ref.width}x${ref.height}`);
  print("");

  // ---- decode grayscale two ways ---------------------------------------------------------------
  const rgba = await decodeRgba("/probe/page.png");
  const srcRgba = cv.matFromImageData(rgba);
  const grayA = new cv.Mat();
  cv.cvtColor(srcRgba, grayA, cv.COLOR_RGBA2GRAY);
  srcRgba.delete();

  const grayB = cv.matFromArray(ref.height, ref.width, cv.CV_8UC1, Array.from(refGray));

  const gA = grayA.data as Uint8Array;
  let nDiff = 0;
  let maxDiff = 0;
  for (let i = 0; i < refGray.length; i++) {
    const d = Math.abs(gA[i]! - refGray[i]!);
    if (d) {
      nDiff++;
      if (d > maxDiff) maxDiff = d;
    }
  }
  const grayOk = maxDiff <= 1;
  print(`PNG → grayscale     ${mark(grayOk)}  maxΔ ${maxDiff} (bar: ≤1), ` +
        `differing ${nDiff}/${refGray.length} (${((100 * nDiff) / refGray.length).toFixed(3)}%)`);
  print("");

  // ---- arm B: Python's own grayscale bytes → is the ALGORITHM identical? ------------------------
  const b = runPrimitives(cv, grayB, ref);
  const algo = {
    otsu: b.otsu === ref.otsuThreshold,
    inkCount: b.inkCount === ref.inkCount,
    rowProjection: firstDiff(b.rowInk, ref.rowInk) === -1,
    connectedComponents: b.ccLabels === ref.ccLabelCount,
    interArea: firstDiff(b.colSums, ref.resize.colSums) === -1,
  };
  const algoOk = Object.values(algo).every(Boolean);
  print("ARM B — opencv.js on Python's grayscale bytes (must be EXACT: this is algorithm parity)");
  print(`  Otsu threshold    ${mark(algo.otsu)}  ${b.otsu} vs ${ref.otsuThreshold}`);
  print(`  ink pixels        ${mark(algo.inkCount)}  ${b.inkCount} vs ${ref.inkCount}`);
  print(`  MORPH_OPEN proj   ${mark(algo.rowProjection)}  ${ref.height} rows, kernel ${ref.horLen}x1`);
  print(`  connectedComps    ${mark(algo.connectedComponents)}  ${b.ccLabels} vs ${ref.ccLabelCount}`);
  print(`  INTER_AREA        ${mark(algo.interArea)}  → ${ref.resize.newW}x${ref.resize.newH}`);
  grayB.delete();
  print("");

  // ---- arm A: the browser's own grayscale → how far does the ±1 decode gap propagate? -----------
  const a = runPrimitives(cv, grayA, ref);
  grayA.delete();
  const inkDrift = Math.abs(a.inkCount - ref.inkCount) / ref.inkCount;
  const rowDrift = maxAbsDiff(a.rowInk, ref.rowInk);
  const colDrift = maxAbsDiff(a.colSums, ref.resize.colSums);
  print("ARM A — opencv.js on the browser's own PNG decode (drift from the ±1 grayscale gap)");
  print(`  Otsu threshold    ${a.otsu} vs ${ref.otsuThreshold}` +
        (a.otsu === ref.otsuThreshold ? "  (same)" : "  ← DIFFERS"));
  print(`  ink pixels        ${a.inkCount} vs ${ref.inkCount}  ` +
        `(Δ ${a.inkCount - ref.inkCount}, ${(100 * inkDrift).toFixed(4)}%)`);
  print(`  MORPH_OPEN proj   max row Δ ${rowDrift} of ${Math.max(...ref.rowInk).toFixed(0)} peak`);
  print(`  connectedComps    ${a.ccLabels} vs ${ref.ccLabelCount}` +
        (a.ccLabels === ref.ccLabelCount ? "  (same)" : "  ← DIFFERS"));
  print(`  INTER_AREA        max col Δ ${colDrift} of ~${(ref.resize.colSums[0] ?? 0).toFixed(0)}`);

  // ---- verdict ---------------------------------------------------------------------------------
  // Arm B is the gate. Arm A cannot be exact — a browser never sees the PNG decoder's own
  // grayscale — and the corpus measurement (6 most-colour-shifted pages, 119 strips bit-identical
  // under exactly this ±1 perturbation) is what says arm A's drift does not reach the output.
  print("");
  print(algoOk && grayOk
    ? '<span class="pass">PASS</span> — opencv.js algorithms are bit-identical to OpenCV-Python ' +
      "(arm B exact), and the decode gap stays within ±1. Slicer port can proceed."
    : !algoOk
      ? '<span class="fail">FAIL</span> — an algorithm diverged on identical input bytes. ' +
        "Do not start the port; take the W0 fallback."
      : '<span class="fail">FAIL</span> — grayscale decode exceeds ±1; hand-write the conversion.');

  (window as unknown as { __cvProbe: unknown }).__cvProbe = {
    algo,
    algoOk,
    grayOk,
    grayMaxDiff: maxDiff,
    grayDiffFrac: nDiff / refGray.length,
    armADrift: { inkDelta: a.inkCount - ref.inkCount, rowMaxDelta: rowDrift, colMaxDelta: colDrift },
    allOk: algoOk && grayOk,
  };
  document.title = algoOk && grayOk ? "cv-probe PASS" : "cv-probe FAIL";
}

main().catch((e) => {
  print(`<span class="fail">ERROR</span> ${e?.stack ?? e}`);
  document.title = "cv-probe ERROR";
  (window as unknown as { __cvProbe: unknown }).__cvProbe = { error: String(e) };
});
