/**
 * Everything the page reads from its own URL, once, at load — almost all of it for the batch strip
 * renderer (tools/render/render.ts), which drives the app by URL instead of clicks. Split out of
 * App.tsx on 2026-11-20, unchanged.
 *
 * ⚠ `SIG_TOLERANT` is ONE flag for the draw path and the label path (CLAUDE.md, group 1): on for a
 * renderer-driven page (`?mode=` present), off for a person.
 */
import type { AccidentalMode } from "../score/vexNotes";
import { parseSignatureBody } from "@turkish-omr/core/labels/lilypond";

// Render-automation parameters: the batch renderer (tools/render/render.ts) drives the harness
// with one page.goto per job instead of UI clicks, e.g.
//   /?score=/scores/foo.json&mode=keysig&lyrics=0&transpose=-4&repseed=123&navseed=789&textseed=456
// Read once at load (each render job is a fresh page); all absent in interactive use.
export const RENDER_PARAMS = new URLSearchParams(window.location.search);
export const URL_SCORE = RENDER_PARAMS.get("score"); // path under apps/web/public/

/**
 * How long after the last edit the score is written back to the browser's store.
 *
 * ⚠ It is a debounce, not an interval: dragging a note emits dozens of documents a second and each
 * one would otherwise be a ~100 KB serialise-and-store. Two seconds is long enough that a gesture
 * costs one write and short enough that nobody reloads inside it.
 */
export const SAVE_DEBOUNCE_MS = 2000;
export const URL_MODE = RENDER_PARAMS.get("mode") as AccidentalMode | null; // "every" | "keysig" | "measure"
export const URL_LYRICS = RENDER_PARAMS.get("lyrics"); // "1" | "0"
export const URL_FOLLOW = RENDER_PARAMS.get("follow"); // "1" | "0" — see `readFollow` below

// Does the page chase the playhead while the piece plays? (owner, 2026-09-03)
//
// ON by default: a score that runs past the bottom of the window and stays there is a score the
// reader has to chase by hand, which is the opposite of reading along. It is still the reader's
// call — the checkbox in the score card's head — so the answer is remembered per browser, and a
// reader who turns it off never meets it again.
//
// ⚠ `?follow=` wins over the remembered answer and is NOT written back, so a harness can pin the
// behaviour without changing what the next human sees. The render harness never plays a score, so
// nothing moves under its screenshots either way, but pinning it costs one query parameter.
export const FOLLOW_KEY = "kv.followPlayhead";

/** ⚠ Swallows everything: `localStorage` does not merely come back empty in a private window or
 *  with site data blocked — the accessor itself throws, and a score that refuses to open because
 *  it could not remember a scrolling preference would be a much worse bug than the preference. */
export function readFollow(): boolean {
  if (URL_FOLLOW != null) return URL_FOLLOW === "1";
  try {
    return localStorage.getItem(FOLLOW_KEY) !== "0";
  } catch {
    return true;
  }
}
export function writeFollow(v: boolean): void {
  try {
    localStorage.setItem(FOLLOW_KEY, v ? "1" : "0");
  } catch {
    /* remembering the answer is a convenience, never a requirement */
  }
}
// Conventional PRINTED-signature override body (drawn order, e.g. "\bakiyeFlat b \bakiyeSharp c"),
// the makam variant render.ts sampled from data/makam_signatures.json. Parsed once; fed to BOTH the
// draw path (SheetView) and the label path (buildStrips) so synthetic carry pages wear the real
// printed signature. Absent in interactive use → each derives the signature from the doc.
export const URL_SIG = RENDER_PARAMS.get("sig");
export const SIG_OVERRIDE = URL_SIG ? parseSignatureBody(URL_SIG) : undefined;
// The same-direction accidental tolerance (`sigTolerant` — see SheetView's `applyAccidental`):
// ON for a renderer-driven page, OFF for a human (owner decision 2026-08-09). A synthetic page has
// to imitate a real printed edition, which writes an intonation refinement BARE under the donanım;
// the app instead has to show what it PLAYS, and it was showing a koma bemol as a küçük bemol
// wherever the two pointed the same way (134 of the 213 bundled scores have at least one such
// letter). Both the draw path (SheetView) and the label path (buildStrips) read this ONE flag, so
// pixels still equal labels on either setting.
// Why "the mode came from the URL" IS "this is a render job": every render job's URL carries
// `mode` (render.ts `jobUrl`, and verify-labels' manifest replay), and the tolerance only ever
// applies in measure mode — so no existing corpus job or replay changes.
export const SIG_TOLERANT = URL_MODE != null;
export const URL_TRANSPOSE = Number(RENDER_PARAMS.get("transpose") ?? 0) || 0; // commas
/**
 * How a transposed note is spelled (core `transpose`). A person gets "letters" — every note moves
 * by the same number of letters, so si–do a tone down reads la–si♭ (owner, 2026-10-16). A RENDER job
 * (`?mode=`) keeps "nearest", the spelling every synthetic corpus was rendered with: the product
 * track does not change what the model track generates.
 */
export const TRANSPOSE_SPELLING = URL_MODE ? "nearest" : "letters";
export const URL_REPSEED = RENDER_PARAMS.has("repseed") ? Number(RENDER_PARAMS.get("repseed")) : null;
export const URL_NAVSEED = RENDER_PARAMS.has("navseed") ? Number(RENDER_PARAMS.get("navseed")) : null;
export const URL_RESPELLSEED = RENDER_PARAMS.has("respellseed") ? Number(RENDER_PARAMS.get("respellseed")) : null;
export const URL_TEXTSEED = RENDER_PARAMS.has("textseed") ? Number(RENDER_PARAMS.get("textseed")) : null;
export const URL_SLURSEED = RENDER_PARAMS.has("slurseed") ? Number(RENDER_PARAMS.get("slurseed")) : null;
// ⚠ DENSE-PAGE EXPERIMENT — `?dense=<ids>` (try 50). Cuts a dense row into more, shorter strips
// so the model is never handed a strip whose label needs more ids than it can emit; without it
// such a strip comes back as confident, silently wrong notes (`hitCap` catches almost none of
// them). Costs decode time on dense pages only — a normal page is unchanged. Absent = today's
// behaviour. Delete with the block in `omr/slicer/windows.ts`.
export const URL_DENSE = RENDER_PARAMS.has("dense") ? Number(RENDER_PARAMS.get("dense")) : null;
export const DENSE_BUDGET = URL_DENSE != null && Number.isFinite(URL_DENSE) && URL_DENSE > 0 ? URL_DENSE : undefined;
// Round-3 staccato distractors: label-free dots on the notehead side (see SheetView's
// drawStaccatoDot), teaching that a dot only means "longer" BESIDE the notehead. Absent → none,
// i.e. every strip rendered before 2026-08-15.
export const URL_STACCATOSEED = RENDER_PARAMS.has("staccatoseed") ? Number(RENDER_PARAMS.get("staccatoseed")) : null;
// Round-3 dotted (usul) barlines: label-free dashed rules on the usul's beat-group boundaries (see
// drawUsulBars in score/drawMarks.ts). The symbol has never been drawn, so the model reads a printed one as
// `\repstart`. Absent → none, i.e. every strip rendered before 2026-08-30.
export const URL_USULBARSEED = RENDER_PARAMS.has("usulbarseed") ? Number(RENDER_PARAMS.get("usulbarseed")) : null;
// Round-3 print realism: seeded staff-line weight + usul beam grouping (see SheetView's
// STAFF_LINE_WIDTH / USUL_BEAM_GROUPS). Absent → VexFlow's defaults, i.e. every pre-Round-3 strip.
export const URL_PRINTSEED = RENDER_PARAMS.has("printseed") ? Number(RENDER_PARAMS.get("printseed")) : null;
// Round-2: draw the four AEU sharps with real-print bar weight (see drawThinSharps in score/drawMarks.ts).
// Render-automation only; absent → Bravura's glyphs, as before.
export const URL_THIN_SHARPS = RENDER_PARAMS.get("thinsharps") === "1";
// The tuplet A/B's CONTROL arm: draw the pre-2026-08-12 continuous arc with the digit floating above
// it (see drawTupletArcLegacy in score/drawMarks.ts). Render-automation only — absent → the measured shape the
// app ships. docs/archive/rounds.md
export const URL_LEGACY_TUPLET = RENDER_PARAMS.get("legacytuplet") === "1";
// The THIRD printed tuplet shape — a continuous arc with the "3" inside its concavity, drawn on a
// share of pieces (see drawTupletArcConcave in score/drawMarks.ts). Render-automation only, OPT-IN, absent →
// every piece draws the broken mark exactly as before. docs/archive/rounds.md
export const URL_CONCAVE_TUPLET = RENDER_PARAMS.get("concavetuplet") === "1";
// Round-3 Lever 1 (crop geometry): how many measures one training strip may span. Render-automation
// only; absent → STRIP_BUDGET.maxMeasures, i.e. every strip rendered before 2026-08-17.
//
// ⚠ This is the RENDERER's rail and it is NOT the slicer's. The slicer cuts real pages at
// MEASURES_PER_STRIP = 3 / MAX_STRIP_W = 1450 px (apps/web/src/omr/slicer/constants.ts); the renderer
// packs by measures and LABEL TOKENS and has no pixel-width rail at all, which is why our strips run
// wider than the real pools' (docs/archive/rounds.md §4). Lowering this alone narrows the synthetic
// side only — the matching re-slice is the other half. docs/archive/rounds.md, Lever 1.
export const URL_MAX_MEASURES = RENDER_PARAMS.has("maxmeasures")
  ? Number(RENDER_PARAMS.get("maxmeasures"))
  : null;
// Passed to buildStrips as its budget override. Undefined (not a partial object) when the param is
// absent, so the default STRIP_BUDGET destructuring applies untouched.
export const STRIP_BUDGET_OVERRIDE =
  URL_MAX_MEASURES != null && Number.isFinite(URL_MAX_MEASURES) && URL_MAX_MEASURES > 0
    ? { maxMeasures: URL_MAX_MEASURES }
    : undefined;
// Stable object identity (SheetView's engrave effect depends on it; an inline literal would
// re-engrave on every render). Constant per page load, like all render params.
export const TEXT_NOISE = URL_TEXTSEED != null ? { seed: URL_TEXTSEED } : undefined;
export const SLUR_NOISE = URL_SLURSEED != null ? { seed: URL_SLURSEED } : undefined;
export const STACCATO_NOISE = URL_STACCATOSEED != null ? { seed: URL_STACCATOSEED } : undefined;
export const USUL_BAR_NOISE = URL_USULBARSEED != null ? { seed: URL_USULBARSEED } : undefined;
export const PRINT_NOISE = URL_PRINTSEED != null ? { seed: URL_PRINTSEED } : undefined;
