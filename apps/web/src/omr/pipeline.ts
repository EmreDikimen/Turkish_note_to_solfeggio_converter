/**
 * strips → decode → stitch → note model. The product path, minus the slicer.
 *
 * This is stages 7–8 of docs/PIPELINE.md running in the browser: each strip is preprocessed and
 * decoded independently, then the per-strip token streams are stitched back into one editable
 * score. The slicer (stages 2–6) arrives at W6 and plugs in above `decodeStrips` without changing
 * anything here — which is the point of taking W2 before the port.
 *
 * `accidentals: "carry"` is not a preference: it is how real pages print (key signature +
 * measure-scoped carry), and it is what `stitch-cli.ts` passes for real decodes. Using the
 * synthetic default here would silently mis-resolve every accidental on a real page.
 */
import { stitchStrips, type DecodedStrip, type StitchResult } from "../../../../tools/render/stitch";
import { decodeStrip } from "./decode";
import { preprocessCanvas } from "./preprocess";
import type { ModelMeta, Sessions, StripDecode } from "./types";

/** One crop to read, positioned in the page: `system` = staff row, `window` = crop within it. */
export interface StripInput {
  system: number;
  window: number;
  image: CanvasImageSource;
  /** For progress messages and error reporting only. */
  name?: string;
}

export interface DecodedStripResult extends StripDecode {
  system: number;
  window: number;
  name?: string;
}

export interface PageResult extends StitchResult {
  strips: DecodedStripResult[];
  totalMs: number;
}

export interface DecodeOptions {
  name?: string;
  onProgress?: (done: number, total: number, current?: string) => void;
  /** Abort between strips — a 21-strip page is ~25 s and the user may pick another file. */
  signal?: AbortSignal;
}

/**
 * Decode every strip, in order, yielding to the event loop between them.
 *
 * Sequential on purpose. ORT-web already uses every wasm thread it is given, so decoding two
 * strips at once buys nothing and doubles peak memory; and a page is the unit a user waits on, so
 * a truthful "strip 7 of 21" beats an unordered rush.
 */
export async function decodeStrips(
  sessions: Sessions,
  meta: ModelMeta,
  strips: readonly StripInput[],
  opts: DecodeOptions = {}
): Promise<DecodedStripResult[]> {
  const { width, height } = meta.preprocess.size;
  const out: DecodedStripResult[] = [];
  for (let i = 0; i < strips.length; i++) {
    if (opts.signal?.aborted) throw new DOMException("decode cancelled", "AbortError");
    const s = strips[i]!;
    opts.onProgress?.(i, strips.length, s.name);
    const pixels = preprocessCanvas(s.image, width, height);
    const decoded = await decodeStrip(sessions, meta, pixels);
    out.push({ ...decoded, system: s.system, window: s.window, name: s.name });
    // Hand the main thread back so the progress text actually paints between strips.
    await new Promise((r) => setTimeout(r, 0));
  }
  opts.onProgress?.(strips.length, strips.length);
  return out;
}

/**
 * Stitch decoded strips into one score.
 *
 * Split from `decodeStripsToDoc` at W9 so the SERVER path stitches through the same call: where the
 * tokens were produced is not the stitcher's business, and a second `stitchStrips` call site with
 * its own options is how `accidentals: "carry"` would eventually get dropped from one of them.
 */
export function stitchDecoded(
  decoded: readonly DecodedStripResult[],
  name?: string,
  opts: { expand?: boolean } = {},
): StitchResult {
  const forStitch: DecodedStrip[] = decoded.map((d) => ({
    system: d.system,
    window: d.window,
    tokens: d.tokens,
  }));
  // `expand` defaults to the stitcher's own default (flatten), which is what every GATE and
  // parity check reads. The app passes `false`: it keeps the written score, draws the repeat and
  // navigation signs the model read, and unfolds only for playback (`unfoldDoc` in core).
  return stitchStrips(forStitch, { name: name ?? "decoded-page", accidentals: "carry", ...opts });
}

/** Decode a page's strips in the browser and stitch them into a loadable note model. */
export async function decodeStripsToDoc(
  sessions: Sessions,
  meta: ModelMeta,
  strips: readonly StripInput[],
  opts: DecodeOptions = {}
): Promise<PageResult> {
  const t0 = performance.now();
  const decoded = await decodeStrips(sessions, meta, strips, opts);
  return { ...stitchDecoded(decoded, opts.name), strips: decoded, totalMs: performance.now() - t0 };
}

/**
 * Recover a crop's page position from the slicer's filename, e.g. `…_s03_w01.png` → row 3, crop 1.
 *
 * The stitcher groups by `system` and orders by `window`, so getting this wrong silently
 * reorders the music. When a name carries no such suffix (a hand-picked image), the caller's
 * index is used and everything lands on one row — right for a single strip, and honest for the
 * rest, since there is no other information to go on.
 */
export function positionFromName(name: string, index: number): { system: number; window: number } {
  const m = /_s(\d+)_w(\d+)\b/.exec(name);
  if (!m) return { system: 0, window: index };
  return { system: Number(m[1]), window: Number(m[2]) };
}
