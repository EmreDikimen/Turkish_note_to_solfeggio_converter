/**
 * Headless entry point for the browser decode path — the harness `tools/vision/parity/arm-b.ts`
 * drives with Playwright.
 *
 * It exposes exactly what the app's "Read strips" button does, with no DOM of its own, so the
 * thing under test is the shipped code path rather than a Node lookalike. That matters more than
 * it sounds: the canvas resampler only exists in a browser, and it is the known source of
 * browser-vs-Python decode differences (docs/mvp/README.md W3).
 *
 * Strips arrive as data URLs so Node keeps all file I/O and we never have to open `data/real/` to
 * the dev server.
 */
import { decodeStripsToDoc, type StripInput } from "../omr/pipeline";
import { loadImage } from "../omr/preprocess";
import { getModel } from "../omr/session";

export interface HarnessStrip {
  name: string;
  system: number;
  window: number;
  dataUrl: string;
}

async function decode(strips: HarnessStrip[], pageName: string) {
  const { sessions, meta } = await getModel();
  const inputs: StripInput[] = [];
  for (const s of strips)
    inputs.push({
      system: s.system,
      window: s.window,
      name: s.name,
      image: await loadImage(s.dataUrl),
    });

  const result = await decodeStripsToDoc(sessions, meta, inputs, { name: pageName });
  return {
    strips: result.strips.map((d) => ({
      name: d.name,
      system: d.system,
      window: d.window,
      tokens: d.tokens,
      nIds: d.ids.length,
      hitCap: d.hitCap,
      minLogprob: d.minLogprob,
      meanLogprob: d.meanLogprob,
      encoderMs: d.encoderMs,
      decodeMs: d.decodeMs,
    })),
    doc: result.doc,
    warnings: result.warnings,
    writtenMeasures: result.writtenMeasures,
    playedMeasures: result.playedMeasures,
    totalMs: result.totalMs,
  };
}

(window as unknown as { __omr: unknown }).__omr = { decode, ready: true };
