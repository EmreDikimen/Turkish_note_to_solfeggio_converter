/**
 * A page → the strips `decodePage` reads, on the server. The native app's path (docs/mobile/plan.md).
 *
 * The web app slices in the browser and POSTs finished strips to `/decode`; a phone running React
 * Native has no canvas and no opencv.js, so it POSTs the page to `/page` and this does the rest.
 * Same rule as `decodeBatch.ts`: nothing here re-implements the slicer. It is the browser's own
 * `apps/web/src/omr/slicer/` (made DOM-free for this on 2026-10-11), so a page sliced here and in
 * `omr/page.ts` gives the same crops — the one difference being that the browser's skew sweep
 * yields to the event loop between steps and this one does not, which `prepPage.ts` documents as
 * identical by construction.
 *
 * What IS new is the crop → 409×583 step: the browser draws it on a canvas, this runs
 * `donut.ts` — a byte-exact port of training's own processor.
 */
import { initCv, type Gray } from "../../web/src/omr/slicer/cvOps";
import { cropStrip, sliceStage3, stripName, type Strip } from "../../web/src/omr/slicer/slicer";
import { donutPreprocess } from "./donut";
import type { StripImage } from "./decodeBatch";

let cvReady: Promise<void> | null = null;

/** opencv.js, once per process (~30 ms in Node). */
export function ensureCv(): Promise<void> {
  cvReady ??= initCv();
  return cvReady;
}

export interface SlicedForDecode {
  positions: Array<{ system: number; window: number; name: string }>;
  images: StripImage[];
  geometry: Strip[];
  nStaves: number;
  skewDeg: number;
  pageWidth: number;
  pageHeight: number;
  sliceMs: number;
}

export function slicePageForDecode(gray: Gray, stem: string, width: number, height: number): SlicedForDecode {
  const t0 = performance.now();
  const res = sliceStage3(gray);
  const positions: SlicedForDecode["positions"] = [];
  const images: StripImage[] = [];
  for (const r of res.rows)
    for (const s of r.strips) {
      positions.push({ system: s.system, window: s.window, name: stripName(stem, s.system, s.window) });
      images.push({ rgba: donutPreprocess(cropStrip(r.normalized.row, s), width, height), width, height });
    }
  return {
    positions,
    images,
    geometry: res.strips,
    nStaves: res.staves.length,
    skewDeg: res.skewDeg,
    pageWidth: gray.width,
    pageHeight: gray.height,
    sliceMs: performance.now() - t0,
  };
}
