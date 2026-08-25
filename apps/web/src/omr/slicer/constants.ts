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
/**
 * ... and the STAFF LINE ITSELF is not an attachment — `BLOB_SKIP_LINE` (L152, `OMR_BLOB_LINE`
 * unset => "1"). The overshoot walk starts ON the outer staff line, so the line's own thickness is
 * the first thing it meets, and the row is upscaled to TARGET_SPACING, which multiplies it. Those
 * rows are very wide connected ink hanging off the stroke, so on a coarse scan every barline
 * carried a "notehead" and gate 3 rejected it. A row whose ink SPANS THE STAFF is therefore
 * neutral: not a wide attachment, and it does not break the run either, so the walk looks straight
 * through it for a real notehead. Measured in docs/METRICS-SLICER-BARLINES.md.
 */
export const BLOB_SKIP_LINE = true;
export const BLOB_LINE_FILL = 0.4; // L153 — ... "spans the staff" = this full, gate 2's own test
/**
 * ... and a staff row must also BE where a staff line is — `STAFF_ROW_POS_SP` (L163,
 * `OMR_STAFF_ROW_POS` unset => 0.2). Gate 2 skips staff rows so the five lines cannot make every
 * candidate look fat, and it found them by fill alone. On a dense photocopy that claims rows the
 * lines are nowhere near (101 of 140 band rows on one, 61 of them off every line), so gate 2 can
 * never collect `fatRun` CONSECUTIVE fat rows, a notehead sitting inside the staff is invisible,
 * and its stem passes as a barline. The normalized row fixes the five line positions exactly, so
 * requiring a staff row to sit within this many line-spaces of one costs nothing.
 */
export const STAFF_ROW_POS_SP = 0.2;
export const PAD_PX = 6; // L97 — crop padding past enclosing barlines
export const TRIM_SHARED_EDGE = true; // L102 (OMR_EDGE_TRIM unset => "1")

// ---- staff detection (L308) ------------------------------------------------------------------
// Fraction of page width a staff line must span as CONTINUOUS ink to survive the opening. 0.11,
// not the older 0.25: the long kernel erased faint/short bottom systems.
/**
 * How far apart two runs of qualifying staff-line columns may sit and still count as ONE staff
 * (in line-spaces) — `STAFF_GAP_BRIDGE_SP` (L337). A photocopy fades a staff line in patches;
 * each fade splits the run, and `emitStaff` keeps only the LONGEST piece, so the rest of the row
 * is never cut into strips. It cannot simply be huge: a scan border or a stray blob far from the
 * staff would then stretch the extent across the page. Measured in docs/METRICS-SLICER.md.
 */
export const STAFF_GAP_BRIDGE_SP = 6.0;

/** Rebuild a staff whose opening dropped lines when 3 of the 5 survive — `STAFF_REPAIR_3LINE`. */
export const STAFF_REPAIR_3LINE = true;

/**
 * ... and only when the rebuilt staff has the SAME line spacing as the rest of the page, as a
 * ratio to the page's median line-row gap — `STAFF_REPAIR_SP_BAND`. Without it the repair invents
 * a staff out of a block of UNDERLINED LYRICS: measured on
 * `huzzam/gonul_dustu_care_yoktur_nota_p1`, where the lyric block repaired at 1.97x the page's
 * spacing while every genuine repair in the 400-page sample sat at 0.94-1.32x.
 */
export const STAFF_REPAIR_SP_BAND: [number, number] = [0.7, 1.4];

/**
 * ---- one page, one staff SIZE — `STAFF_SPAN_CONSENSUS` ----------------------------------------
 * Every staff printed on a page is the same height, so the page's median first-line-to-last-line
 * SPAN is a far more reliable measurement than any single group's individual line rows. On a faded
 * photocopy the horizontal opening does not lose whole lines so much as CHOP them: the thresholded
 * row profile dips below the threshold at random heights inside one staff and `clusterRows` reports
 * 6 or 7 "lines" where 5 are printed. `emitStaff`'s most-evenly-spaced-5-window rule then had to
 * choose among windows that are ALL wrong, and it systematically took the tightest one — measured
 * on bozukNihavendLonga, every row's span is 43-49 px (true spacing ~11.75) while the chosen
 * windows read 8-10 px. The consequence is not cosmetic: `normalizeRow` scales by 30/spacing, so a
 * 30% low spacing upscales the row 30% too much, the staff band the barline gates analyse no longer
 * sits on the staff, and real barlines fail gate 1 while note stems pass — the "cut through the
 * music, never at a bar" failure. Measured in docs/METRICS-SLICER.md.
 */
export const STAFF_SPAN_CONSENSUS = true;
/** A page needs this many 4+-line groups before its median span means anything. */
export const STAFF_SPAN_MIN_GROUPS = 3;
/** How far a group's span may sit from the page median and still be "one staff". */
export const STAFF_SPAN_TOL = 0.15;
/** Smallest group the rebuild touches — 6, because a staff only prints 5 lines. */
export const STAFF_SPAN_MIN_ROWS = 6;

/**
 * ---- one page, one staff WIDTH — `STAFF_WIDTH_CONSENSUS` --------------------------------------
 * `emitStaff` keeps only the LONGEST run of qualifying columns, so a fade that opens a gap wider
 * than STAFF_GAP_BRIDGE_SP throws away everything on the far side of it — whole measures at a row's
 * left or right end, which then never become strips at all. Raising the bridge is not the answer:
 * it is what stops a scan border or a page number from stretching the extent across the paper, and
 * the gaps that break real rows are MARGINAL (69 px against a 60 px bridge, 73 against 72). The
 * page settles it: a printed page uses ONE left and ONE right margin, so the median x0/x1 over its
 * staves say where a row may reach. Only runs that already qualified as staff-line columns can be
 * re-admitted, so a row that genuinely ends early has nothing out there to re-admit.
 */
export const STAFF_WIDTH_CONSENSUS = true;
/** Same argument as STAFF_SPAN_MIN_GROUPS: 1-2 staves is not a consensus. */
export const STAFF_WIDTH_MIN_STAVES = 3;
/** How far past the page margin a re-admitted run may reach, in line-spaces. */
export const STAFF_WIDTH_SLACK_SP = 2.0;

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
