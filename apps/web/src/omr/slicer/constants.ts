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
// A TRAILING span narrower than this is the row's closing barline counted twice (a `:|` whose thin
// and thick strokes sit further apart than the candidate-merge gap), not a measure. Python
// `TAIL_SPAN_MAX_SP` (OMR_TAIL_SPAN unset => "1.5"); moving one without the other splits the port.
export const TAIL_SPAN_MAX_SP = 1.5;

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
/**
 * How much of a barline may have FADED AWAY at its ends and still be recognised — `BAR_FADE_SP`
 * (L124, `OMR_BAR_FADE` unset => 0.25). Gate 1 wants one unbroken run covering 0.85 of the analysis
 * band, which works out at ~the full staff height, so a photocopied barline missing its bottom few
 * px fails by ONE pixel. Rather than lower the fraction — which lets any long stem in anywhere in
 * the band — the extra rule is POSITIONAL: the run must still START at the top staff line and END
 * at the bottom one, each within this tolerance. It is OR-ed with the original, so it only ADDS
 * candidates and nothing found without it can be lost.
 *
 * ⚠ IT SHIPS OFF (0), and that is a measurement. Turned on at 0.25 on 2026-08-25 because on the
 * hand-marked truth — 93 barlines over the 4 most faded pages we own — it buys +4 real barlines for
 * +1 false one with precision unmoved (79.7% both ways). That did not generalise: `score_slicer.py`
 * at FULL scale (6,440 rows) pairs the two settings at BETTER 111 / WORSE 187, net −76 rows, and the
 * dominant move is a row whose measure count was RIGHT gaining a spurious barline (108 rows). Turned
 * back off the same day. Higher values were rejected on the PIXELS: every false barline each further
 * step adds is a NOTE STEM, which cuts a crop through the music.
 * ⚠ The rule itself is ported and was verified against Python at 0.25 (parity 100% on all three
 * rungs, rejected candidates identical 844/844), so re-enabling it is this constant plus the Python
 * one. They must move TOGETHER or the app cuts differently from the training data.
 * docs/METRICS-SLICER-BARLINES.md.
 */
export const BAR_FADE_SP = 0;
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
 * ...and the same rebuild fires when a group's MEASURED spacing contradicts its own height —
 * `STAFF_SPAN_FIX_SPACING`. The line-count gate above only catches a staff chopped into MORE lines
 * than it has; the identical defect with too FEW lines went straight through, and it is worse,
 * because `normalizeRow` scales by `30 / spacing` and a spacing read 54% high under-magnifies the
 * row until its fixed-height frame reaches into the system above (owner-reported on
 * `bozukNihavendLonga2` s03: the crop included the previous staff). See `emitStaff`.
 * Full scale: **3748 exact against 3746**, paired BETTER 7 / WORSE 6 over 13 rows on 12 pages.
 * ⚠ Must move together with Python's `STAFF_SPAN_FIX_SPACING`.
 */
export const STAFF_SPAN_FIX_SPACING = true;
/** Only a GROSS disagreement fires it; a healthy staff's two measurements already agree. */
export const STAFF_SPAN_SPACING_TOL = 0.25;

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

// ---- grouping lines into systems, by staff HEIGHT — `STAFF_GROUP_BY_SPAN` --------------------
/**
 * Where one staff ENDS and the next begins.
 *
 * The shipped rule splits when a gap exceeds `2.2 * sp`, where `sp` is the page's MEDIAN LINE GAP —
 * a page-global number deciding a local question, and close enough to the data to be flipped by
 * rounding. ⚠ **This browser is where that was caught.** On `bozukNihavendLonga2.png` the port and
 * Python found the SAME three staff lines on one row (y = 266, 285, 291) and disagreed on whether
 * they were one staff: Python measured sp = 9.0 -> threshold 19.8 px, the browser sp = 8.0 ->
 * 17.6 px, and the gap in question is 19 px. Python grouped them and `repairGroup` rebuilt the row
 * to 5 lines; the browser split them into a 1-line and a 2-line group, both under the 3-line floor,
 * so the repair never ran and the staff was LOST — 9 staves here against Python's 10.
 *
 * ⚠ There is no code difference and it is not a port bug. `cv2.imread(IMREAD_GRAYSCALE)` converts
 * inside the PNG decoder and a browser cannot (see `decodeGray`), so the two greyscales differ by
 * ±1 on ~16% of this page's pixels BY CONSTRUCTION. Python won that page by 0.8 px of luck, and
 * `parity:slicer` passed 100% throughout because its 120-page sample does not contain it.
 *
 * A staff is defined by its HEIGHT, not by a multiple of the median line gap, and the page already
 * measures that height (`pageStaffSpan`). Grouping on it removes the rounding knife-edge.
 * ⚠ Falls back to the shipped rule when the page has too few confident staves to have a trustworthy
 * span, so a 1–2 staff page behaves exactly as before.
 * ⚠ Must move together with Python's `STAFF_GROUP_BY_SPAN` or the app cuts differently from the
 * training data. docs/METRICS-SLICER.md.
 */
export const STAFF_GROUP_BY_SPAN = true;
/** How far a MERGED pair may EXCEED the page's staff height. ⛔ At 1.2 this meant something
 * else — the broad regrouping that measured −545 exact rows and was thrown away. */
export const STAFF_GROUP_SPAN_TOL = 0.15;

// ---- the staff RESCUE second pass — `STAFF_RESCUE` (Python: OMR_STAFF_RESCUE) -----------------
/**
 * Re-detect a staff only in the bands where the page's own rhythm says a row is MISSING.
 *
 * It exists because a whole row is currently lost on faint, photocopied and hand-ruled pages —
 * `vuslata_nail_de_etse_ger_felek_nota_p2` finds 4 of its 9 rows, `kacma_mecburundan…_nota_p1` 4
 * of 9, and that second one is ordinary printed TRT engraving, not handwriting. A lost row is not
 * a bad crop, it is NO crop: that music never reaches the model at all.
 *
 * The mechanism is the `horLen x 1` opening in `staffLineRows` — one pixel tall, so it demands the
 * line stay inside a single row for 11% of the page width. A line that wanders is erased outright.
 *
 * ⚠ WHY A SECOND PASS AND NOT A LOOSER RULE. Loosening detection globally was tried first and
 * rejected on measurement: dilating before the opening takes one hand-ruled page 5 -> 8 staves and
 * takes `bozukNihavendLonga` 10 -> 1, because on a page whose lines sit 9 px apart any useful
 * dilation fuses them. Scaling the dilation to the measured line spacing does not escape it either.
 * A pass that only looks inside a band pass 1 left EMPTY cannot move a page whose rows were all
 * found — the property a dial could not have.
 *
 * ⚠ SHIPS OFF, and it must move together with the Python constant or `parity:slicer` breaks and
 * the app cuts differently from the training data. Full-scale reading (`score_slicer.py`, 6,440
 * rows, 1,159 pieces): every scored number IDENTICAL to the baseline — 3750/6440 exact, 1296
 * improved, 694 regressed, same dn histogram — while gaining **320 staff rows on 227 of 1,592
 * pages**. Those gained rows cannot be scored there: the truth is aligned from the OLD pipeline's
 * decodes, which never saw them. docs/METRICS-SLICER.md.
 */
export let STAFF_RESCUE = false;

/**
 * Turn the rescue on or off for a diagnostic A/B — the shipped app never calls this.
 *
 * Same shape as `setVplaceTopClaim`: the slice inspector is where a slicer rule gets checked on a
 * real page rather than taken on trust, and this rule is invisible in any other view — a row the
 * slicer never found leaves no crop to look at, so the ONLY way to see it is to draw the page with
 * the rescue on. ⚠ The inspector therefore defaults it ON while the app and the cutting pipeline
 * default it OFF, which means **the inspector deliberately shows more staves than the app cuts**.
 * It says so on screen; do not "fix" that by changing either default.
 */
export function setStaffRescue(on: boolean): void {
  STAFF_RESCUE = on;
}
/** A rescued staff's HEIGHT must be within this of the page's median staff height. */
export const RESCUE_SPAN_TOL = 0.18;
/**
 * ...and it must be about as WIDE as the page's real staves. Not a tidy-up: without it the block of
 * UNDERLINED LYRICS at the foot of a handwritten page is rescued as a staff, because lyric rules sit
 * at staff-like spacing and so pass the height test. They span only the part of the page the text
 * occupies. `repairGroup` documents the same false positive and refuses it on spacing; height alone
 * cannot, since these two agree on height.
 */
export const RESCUE_WIDTH_FRAC = 0.6;
/**
 * Below this many staves a page has no trustworthy pitch to predict a missing row FROM, so the
 * second pass does not run at all — the same argument as STAFF_SPAN_MIN_GROUPS.
 */
export const RESCUE_MIN_STAVES = 3;
/**
 * The readings tried inside a band, cheapest first, stopping at the first accepted:
 * [dilate, threshold fraction]. The first entry is pass 1's own rule minus its page-GLOBAL parts,
 * and it is the one that rescues most rows — the ink was there and readable, and it was the
 * page-wide threshold and grouping that lost it, not absent ink.
 */
export const RESCUE_READS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.3],
  [0, 0.2],
  [2, 0.25],
  [3, 0.25],
  [0, 0.12],
];

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
