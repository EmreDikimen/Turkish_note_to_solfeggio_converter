/**
 * Every constant the slicer port needs, transliterated from `src/vision/page_to_strips.py` with
 * the Python line it came from. Keep the line references — they are how a reviewer checks the port
 * against its source, and how the next rung finds the comment explaining a number.
 *
 * Environment-switchable constants in Python (`OMR_VPLACE`, `OMR_MEASURES_PER_STRIP`,
 * `OMR_EDGE_TRIM`, `OMR_WINDOW_MODE`) are frozen here at the values the decode caches on disk were
 * produced under, which is also what ships. Budget mode is NOT ported at all (docs/mvp/slicer-port.md).
 */

// ---- target strip geometry the model was trained on (page_to_strips.py L32-37) ----------------
export const STRIP_H = 336; // L32 — output strip height (px)
export const TARGET_SPACING = 30.0; // L33 — staff line spacing after normalization (px)
export const STAFF_SPAN = 120; // L34 — top line -> bottom line (= 4 * spacing)
export const TOP_LINE_Y = 138; // L35 — y of the top staff line inside the 336-tall strip
export const HEADROOM_SP = TOP_LINE_Y / TARGET_SPACING; // L36 — line-spaces above the top line (~4.6)
export const BELOW_SP = (STRIP_H - TOP_LINE_Y - STAFF_SPAN) / TARGET_SPACING; // L37 — below (~2.6)

// ---- adaptive vertical placement (L44-49) ----------------------------------------------------
// ON by default in Python and it CHANGES THE CROPS: turning it off re-introduces the measured
// 11.6% beam clipping. It is why the port needs a whole-page connectedComponents label map.
export const VPLACE_ADAPTIVE = true; // L44 (OMR_VPLACE unset => "1")
export const VPLACE_MARGIN_SP = 0.25; // L45 — breathing room past the measured ink extent
export const VPLACE_MIN_HEAD_SP = 3.3; // L46 (OMR_VPLACE_MIN_HEAD unset => "3.30")

/**
 * How far ABOVE the top staff line ink may claim room when the frame cannot hold both sides (L440).
 *
 * A notehead three ledger lines up sits ~3.0 sp above the top line, ~3.5 with its accidental. Ink
 * beyond that is a slur, phrase mark, segno or ornament — and our own renderer injects slurs as
 * deliberately LABEL-FREE distractors, so the model is trained to ignore them. Uncapped, that
 * decoration pushed the staff down and sheared the BEAMS, which is what carries the durations.
 *
 * Measured over 120 real pages / 901 rows (2026-08-05), capped against uncapped:
 *   ink lost within 3.5 sp above (real notes):  0 → 0        nothing that was kept is now lost
 *   ink lost below the staff (beams):      19,932 → 17,231   −13.6%
 * It only moves rows ALREADY in conflict. Set it huge to restore the old uncapped rule exactly —
 * which is what the slice inspector's toggle does. Numbers: docs/METRICS-SLICER.md.
 */
export let VPLACE_TOP_CLAIM_SP = 3.5;

/** Restore the old uncapped rule (diagnostic A/B only — the app never calls this). */
export function setVplaceTopClaim(sp: number): void {
  VPLACE_TOP_CLAIM_SP = sp;
}

// ---- windowing (L55-58) — W6 uses these; listed here so one file owns the constants -----------
export const MEASURES_PER_STRIP = 3; // L55 (OMR_MEASURES_PER_STRIP unset => "3")
export const MAX_STRIP_W = 1450; // L57 — cap width (training strips topped out ~1443 px)
export const MIN_STRIP_W = 200; // L58 — ignore degenerate slivers

// ---- DENSE-PAGE EXPERIMENT (opt-in, `?dense=` — delete this block with `tokenBudget`) --------
// Python's label-budget packing constants (page_to_strips L97-100), fitted on 2,500 decoded
// strips. Python ships this OFF as a measured wash for LABELLING YIELD; the app enables it for a
// different reason — a strip whose label needs more ids than the model can emit comes back as
// silently wrong notes, and at inference an over-eager cut is nearly free (77.4% of real windows
// are single-measure already, so a split strip is the shape the model saw most).
export const COST_PER_STEM = 1.889; // a stemmed note ~2 ids (pitch + duration); shared beams less
export const COST_PER_INK_COL = 0.0288; // residual: rests, dots, accidentals, ledgers
export const COST_ROW_START = -5.25; // a row-start crop carries the \sig block but less music

// ---- barline discrimination, in line-space units (L85-102) — W5 ------------------------------
export const EXT_SP = 2.5; // L88 — analysis band past the outer staff lines
export const OV_TOL_SP = 0.5; // L90 — a real barline may overshoot a staff line by this much
export const WIDE_BEYOND_SP = 0.5; // L91 — connected ink this wide past a line = notehead/flag/beam
export const WIDE_RUN_SP = 0.2; // L92 — ... but only when wide for this many CONSECUTIVE rows
export const WIDE_NEAR_SP = 1.5; // L94 — ... and only within this distance of the staff line
export const PAD_PX = 6; // L97 — crop padding past enclosing barlines
export const TRIM_SHARED_EDGE = true; // L102 (OMR_EDGE_TRIM unset => "1")

// ---- staff detection (L308) ------------------------------------------------------------------
// Fraction of page width a staff line must span as CONTINUOUS ink to survive the opening. 0.11,
// not the older 0.25: the long kernel erased faint/short bottom systems.
export const STAFF_HOR_FRAC = 0.11;

// ---- pale-staff-line binarization (L361-362) --------------------------------------------------
// Why the fallback exists and why its guard is this narrow: `pageBinarizer` in staves.ts.
export const PALE_LINE_MIN_ROWS = 4; // fewer clustered line rows than this = Otsu found no staff
export const PALE_LINE_DELTA = 25; // ink is anything this much darker than the paper

// What the fallback's result must look like to be believed, as interline / page height. Many pages
// Otsu reports 0 staves on are LYRICS pages that genuinely have no staff, and on those a more
// sensitive binarization finds text baselines and groups them into "staves" with interlines of
// 90-471 px. Measured over the 2,843 corpus pages that detect staves today, interline/height sits
// between 0.29% and 0.73% for 99 of every 100; this band is deliberately wider on both sides, so it
// rejects only the absurd. Without it the fallback invents staves on 13 lyrics pages.
export const PALE_LINE_MIN_REL = 0.0025;
export const PALE_LINE_MAX_REL = 0.02;

/**
 * Python's `round()` — half-to-EVEN — which JavaScript's `Math.round` (half-UP) is not.
 *
 * This is not a theoretical difference. Two barline-discrimination parameters land exactly on .5
 * at the trained spacing of 30 px:
 *
 *     int(round(30 * 0.35))  ->  Python 10,  Math.round 11    # `tol`,   detect_barlines gate 1
 *     int(round(30 * 0.75))  ->  Python 22,  Math.round 23    # `fat_w`, detect_barlines gate 2
 *
 * A naive port silently retunes both gates and every measure boundary downstream of them. Use this
 * at EVERY `round()` site in the Python, including ones whose arguments look arbitrary
 * (`_emit_staff`'s `tol`, `normalize_row`'s `band_top`/`band_bot`/`top_line_y`) — arbitrary floats
 * land on .5 for some staff spacings too.
 */
export function pyRound(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1; // exactly .5 -> to even
}

/** `np.median` — sorts, and AVERAGES the two middle values on an even count (so it can be x.5). */
export function median(values: ArrayLike<number>): number {
  const n = values.length;
  if (n === 0) return NaN;
  const s = Array.from(values).sort((a, b) => a - b);
  const mid = n >> 1;
  return n % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** `np.diff` over a 1-D sequence. */
export function diff(values: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) out.push(values[i]! - values[i - 1]!);
  return out;
}
