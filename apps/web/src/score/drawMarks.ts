/**
 * The marks VexFlow does not draw the way real Turkish print does, drawn by hand onto the SVG: tuplet
 * arcs, thin AEU sharps, slurs, dotted usul barlines, staccato dots, voltas, segno/coda, lyrics and
 * time signatures. Split out of SheetView.tsx on 2026-11-20, unchanged.
 *
 * ⚠ Part of the TRAINING-STRIP source, like vexNotes.ts — every constant here was measured on real
 * editions; see the comment on each before changing one.
 */
import { LEFT } from "./layout";
import type { NavMark } from "@turkish-omr/core/labels/navmarks";
import { Stave, StaveNote } from "vexflow";

/**
 * The printed triplet mark, in STAFF SPACES — MEASURED on real editions, not designed.
 *
 * `ml/labels/tuplet_mark_probe.py` read 16 marks across ~11 Turkish editions (`strips_tup` and
 * `strips_exam_v2_clean`, tiles accepted by eye at matched staff size). **All 16 break the arc and set
 * the "3" inside the gap.** Until 2026-08-12 we drew one unbroken quadratic with the digit floating
 * 1.27 S OUTSIDE it, which left a triplet separated from a plain phrase slur (`drawSlurArc`) by a
 * hovering digit — the weakest cue available, where real print differs structurally. `\tup3` recall
 * had fallen to 83.8%, below its own pre-slur-distractor baseline; this is the leading hypothesis
 * for that, same shape as the Bravura sharp-bar defect. Numbers and the caveats:
 * docs/METRICS-DIAGNOSTICS.md.
 *
 * ⚠ `gap` is sized to the DIGIT, not to the group: real print holds 1.63 S whether the mark spans
 * 4.5 S or 28 S. A fraction-of-span rule is the natural guess and it is wrong.
 * ⚠ `stroke` stays at `drawSlurArc`'s weight even though real print draws both HEAVIER (0.133–0.168 S
 * vs our 0.100). Thickening only this one would hand the model a thickness cue separating a triplet
 * from a slur that real pages do not have — the trap `AEU_SHARP_STROKE` documents. Owed as a joint
 * change with the slur. The shape A/B has now run (2026-08-15) and came back null, so the stroke is
 * still owed and still joint — see docs/archive/rounds.md and docs/archive/rounds.md step 5.
 */
export const TUPLET_MARK = {
  gap: 1.63,       // S — arc-end to arc-end, the hole the digit sits in (real: 1.55–1.69, n=16)
  digitH: 1.2,     // S — digit height (real 1.20, ours was 0.97)
  // S — digit centre just INSIDE the arc ends, toward the staff. The probe's +0.20 is measured from
  // the stroke's TOP ink row; `yGap` below is its centreline, so the constant carries that offset.
  digitDrop: 0.07,
  clear: 0.85,     // S — how far an arm's OUTER end clears its OWN end note (real 0.60–0.93, n=7 arms)
  rise: 0.58,      // S — how much further the gap sits above the group's outermost note: clear+rise
                   //     = 1.43 S over the highest notehead, measured on 3 marks of one real page
  minSeg: 0.5,     // S — shortest arm worth drawing; a group too narrow for the gap widens OUTWARD
                   //     rather than closing it
  stroke: 0.11,    // S — deliberately equal to drawSlurArc's; see the warning above
};

/**
 * The THIRD printed shape: a CONTINUOUS arc with the "3" hanging INSIDE its concavity — between the
 * curve and the noteheads — rather than in a break or floating above the apex.
 *
 * ⚠ This refutes the sentence `TUPLET_MARK` above is built on. "All 16 break the arc" is still true
 * of the two pools that probe sampled; it is NOT true of Turkish print in general. The owner supplied
 * two real scanned editions drawing it this way (2026-08-19, `data/real/tuplet_marks/`), and the
 * probe could not have found them because **no labelled real strip we own carries this style**.
 *
 * Measured with `tuplet_mark_probe.py --images --accept`, n=5 marks on the Kemânî Sebuh page (the
 * second page confirms the style by eye but its staff detection is unstable at 12.6–14.8 px, so it
 * is not measured). The load-bearing number is the LAST one:
 *
 *   * digit and arc are SEPARATE ink in 5 of 5. Our legacy mark was one connected component — "a
 *     slur with a bump" — which is exactly what made it indistinguishable from a phrase slur. This
 *     style keeps the two apart, so it is a real second cue rather than a variant of the old defect.
 *
 * ⚠ `share` is CHOSEN, NOT MEASURED — like `STACCATO_RATE`. Nobody has counted how often Turkish
 * editions use this shape against the broken one; two pages is an existence proof, not a frequency.
 * Replace it by reading marks across editions with the probe, not by taste.
 */
export const TUPLET_MARK_CONCAVE = {
  arcAbove: 0.91,  // S — the arc's underside down to the digit's TOP (real 0.57–1.00, n=3 clean marks)
  digitH: 1.22,    // S — digit height (real 1.13–1.26, n=5). Taller than the broken style's 1.20
  digitW: 0.83,    // S — recorded for the probe to check a pilot render against (real 0.83–0.91)
  digitAt: 0.5,    // fraction of the span — real 0.40–0.56, n=5, i.e. centred within the spread
  digitClear: 0.25, // S — digit's bottom to the outermost notehead. ⚠ DERIVED, not measured: it is
                   //     what stops the digit colliding with the notes, and the apex follows from it
  clear: 0.85,     // S — an end of the arc over its OWN end note; same rule as the broken mark
  stroke: 0.11,    // S — the SAME as drawSlurArc and drawTupletArc. Real print draws this one
                   //     heavier (0.174–0.217 S here) but thickening only the tuplet arc invents a
                   //     thickness cue against phrase slurs; owed jointly with drawSlurArc, as before
  share: 0.25,     // of CURVED-style pieces (see the ⚠ above — chosen, not measured)
};

/**
 * Draw the CURVED tuplet mark as raw SVG, like the voltas/nav marks: two arc segments with the "3"
 * set in the gap between them, to the measurements in `TUPLET_MARK`. This is the shape printed
 * Turkish scores use (VexFlow's `Tuplet` only draws the square bracket, which stays as the minority
 * per-piece style — and which, note, already breaks around its digit).
 *
 * **THE ARMS FOLLOW THE NOTES** (owner, 2026-08-12, looking at the redraw beside real pages;
 * measured on `strips_tup/ben_guzele_…_p2_s01_w03.png`, four descending triplets in one strip). A
 * printed mark is NOT a fixed shape floating at one height: **each arm's outer end clears its OWN end
 * note** (0.60–0.93 S over that notehead), while the gap sits 1.43 S above the group's HIGHEST note.
 * So a descending triplet gets a nearly flat left arm and a long sweeping right one — the mark tilts
 * with the contour, which is how a reader sees which notes it covers.
 *
 * ⚠ The digit stays at the **middle of the span**, and that is measured, not assumed: on that page it
 * sits at 0.49–0.50 of the mark's width even on descending figures. Sliding the gap toward the high
 * note (tried first, 2026-08-12) looks right in a screenshot and is wrong — it degenerates into a stub
 * arm whenever the highest note is an outer one. The visual asymmetry of a printed mark comes from the
 * arms' SLOPES, not from where the "3" sits.
 */
export function drawTupletArc(svg: SVGElement, group: StaveNote[], above: boolean) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const S = STAFF_SPACE;
  const sign = above ? -1 : 1; // -1 = the mark is above the noteheads, so "outward" is up
  // Per note: its x and the notehead edge the mark sits beyond. `getYs` is the noteheads, which IS
  // the outer ink on the mark's side — the sign chooses which end of a chord to clear.
  const notes = group
    .map((n) => {
      let ys: number[] = [];
      try {
        ys = n.getYs();
      } catch {
        ys = [];
      }
      return { x: n.getAbsoluteX(), edge: ys.length ? (above ? Math.min(...ys) : Math.max(...ys)) : NaN };
    })
    .filter((p) => Number.isFinite(p.edge))
    .sort((a, b) => a.x - b.x);
  if (notes.length === 0) return;
  const first = notes[0]!;
  const last = notes[notes.length - 1]!;
  const x1 = first.x - 2;
  const x2 = last.x + 12;
  // The gap's HEIGHT comes from the group's outermost note, so the mark clears every notehead under
  // it; its horizontal position is simply the middle of the span (see the ⚠ above).
  const peak = above ? Math.min(...notes.map((p) => p.edge)) : Math.max(...notes.map((p) => p.edge));
  const yGap = peak + sign * (TUPLET_MARK.clear + TUPLET_MARK.rise) * S;

  const half = (TUPLET_MARK.gap * S) / 2;
  const minSeg = TUPLET_MARK.minSeg * S;
  // A group too narrow for a full-width gap widens the mark OUTWARD — never narrows the gap, or the
  // digit fuses with the arc ends after the encoder's shrink (the sharp-bar failure mode).
  const ax1 = Math.min(x1, (x1 + x2) / 2 - half - minSeg);
  const ax2 = Math.max(x2, (x1 + x2) / 2 + half + minSeg);
  const gapX = (ax1 + ax2) / 2;
  // Each arm: quadratic from its own note's clearance point up to the gap, control point at the gap's
  // HEIGHT so the curve arrives horizontally there and does its bending at the outer end.
  for (const [from, yFrom, to] of [
    [ax1, first.edge + sign * TUPLET_MARK.clear * S, gapX - half],
    [ax2, last.edge + sign * TUPLET_MARK.clear * S, gapX + half],
  ] as const) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", `M ${from} ${yFrom} Q ${from + 0.55 * (to - from)} ${yGap} ${to} ${yGap}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#222");
    path.setAttribute("stroke-width", String(TUPLET_MARK.stroke * S));
    svg.appendChild(path);
  }
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(gapX));
  // `y` is the baseline: put the digit's CENTRE `digitDrop` inside the gap, then drop half a digit.
  const centre = yGap - sign * TUPLET_MARK.digitDrop * S;
  text.setAttribute("y", String(centre + (TUPLET_MARK.digitH * S) / 2));
  text.setAttribute("text-anchor", "middle");
  // ⚠ UPRIGHT Times at REGULAR weight, not the bold italic Georgia this used to be. Two reasons, and
  // neither is taste: an italic Georgia "3" (an old-style figure) measured 1.10 S wide where real
  // print draws 0.76, which left 0.26 S of air each side instead of 0.43 — the digit would fuse with
  // the arc ends after the encoder's shrink, the failure mode the sharp bars already cost us once —
  // and the printed digit is a REGULAR-weight serif (owner, 2026-08-12, against real pages; bold was
  // this renderer's invention). Sized so the ink measures TUPLET_MARK.digitH; verify with
  // tuplet_mark_probe.py --dir on a pilot render.
  text.setAttribute("font-family", "'Times New Roman', Georgia, serif");
  text.setAttribute("font-size", "16");
  text.setAttribute("fill", "#222");
  text.textContent = "3";
  svg.appendChild(text);
}

/**
 * The concave style: ONE continuous arc with the "3" hanging inside it, to `TUPLET_MARK_CONCAVE`.
 *
 * ⚠ It is NOT `drawTupletArcLegacy` with the digit moved. The legacy mark's digit touched the apex,
 * making arc+digit one connected component; here they are deliberately separate ink, which is what
 * the real pages measure (5 of 5) and the only reason this shape is worth drawing at all.
 *
 * The arms follow the notes exactly as `drawTupletArc`'s do — each end clears its OWN end note — so
 * the two styles differ in the mark's topology and nothing else. The apex is DERIVED from the digit
 * it has to hold (`arcAbove + digitH + digitClear` above the outermost notehead), never given as a
 * constant, so changing the digit cannot silently push it into the noteheads.
 */
export function drawTupletArcConcave(svg: SVGElement, group: StaveNote[], above: boolean) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const S = STAFF_SPACE;
  const M = TUPLET_MARK_CONCAVE;
  const sign = above ? -1 : 1; // -1 = mark above the noteheads, so "outward" is up
  const notes = group
    .map((n) => {
      let ys: number[] = [];
      try {
        ys = n.getYs();
      } catch {
        ys = [];
      }
      return { x: n.getAbsoluteX(), edge: ys.length ? (above ? Math.min(...ys) : Math.max(...ys)) : NaN };
    })
    .filter((p) => Number.isFinite(p.edge))
    .sort((a, b) => a.x - b.x);
  if (notes.length === 0) return;
  const first = notes[0]!;
  const last = notes[notes.length - 1]!;
  const x1 = first.x - 2;
  const x2 = last.x + 12;
  const peak = above ? Math.min(...notes.map((p) => p.edge)) : Math.max(...notes.map((p) => p.edge));
  // The apex has to hold the whole digit plus its clearance over the outermost notehead.
  const yApex = peak + sign * (M.arcAbove + M.digitH + M.digitClear) * S;
  const y1 = first.edge + sign * M.clear * S;
  const y2 = last.edge + sign * M.clear * S;
  // One quadratic. With the control point at mid-span the curve's t=0.5 point is (y1 + 2yc + y2)/4,
  // so solving for yc puts the apex exactly at yApex — and x is then linear in t, which is what lets
  // the digit be placed at `digitAt` of the span without solving the Bezier.
  const yc = (4 * yApex - y1 - y2) / 2;
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${yc} ${x2} ${y2}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#222");
  path.setAttribute("stroke-width", String(M.stroke * S));
  svg.appendChild(path);

  const t = M.digitAt;
  const xd = x1 + t * (x2 - x1);
  const yArc = (1 - t) * (1 - t) * y1 + 2 * t * (1 - t) * yc + t * t * y2;
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(xd));
  // `y` is the baseline. Above: the digit hangs BELOW the arc, so its top is arcAbove under the
  // curve and the baseline a further digitH down. Below: mirrored, the digit sits over the arc.
  const top = yArc - sign * M.arcAbove * S;
  text.setAttribute("y", String(above ? top + M.digitH * S : top));
  text.setAttribute("text-anchor", "middle");
  // ⚠ ITALIC here, unlike drawTupletArc's upright Times — and that is measured, not a preference.
  // The upright form was chosen for the BROKEN mark because an italic digit at 1.10 S wide ate the
  // clearance inside a 1.63 S gap. This style has no gap to fuse across: the digit hangs in open
  // space under the curve, real print draws it slanted, and it measures 0.83 S wide there.
  text.setAttribute("font-family", "'Times New Roman', Georgia, serif");
  text.setAttribute("font-size", "16");
  text.setAttribute("font-style", "italic");
  text.setAttribute("fill", "#222");
  text.textContent = "3";
  svg.appendChild(text);
}

/**
 * The mark as it was drawn until 2026-08-12 — ONE unbroken quadratic with a bold italic "3"
 * floating above its apex. It exists for exactly one reason: it is the **control arm** of the
 * tuplet A/B pre-registered in docs/archive/rounds.md, reached only through
 * `render.ts --legacy-tuplet-mark` (URL `?legacytuplet=1`). The app itself always draws the
 * measured shape above.
 *
 * ⚠ Do not "fix" or tidy this function. It is a frozen copy of what `strips_v4` was rendered with,
 * and any change to it silently changes what the A/B is comparing against. Delete it once the A/B
 * has been read and written up.
 */
export function drawTupletArcLegacy(svg: SVGElement, group: StaveNote[], above: boolean) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const xs = group.map((n) => n.getAbsoluteX());
  const x1 = Math.min(...xs) - 2;
  const x2 = Math.max(...xs) + 12;
  const ys = group.flatMap((n) => {
    try {
      return n.getYs();
    } catch {
      return [];
    }
  });
  if (ys.length === 0) return;
  const yEdge = above ? Math.min(...ys) - 9 : Math.max(...ys) + 9;
  const bulge = above ? -9 : 9;
  const midX = (x1 + x2) / 2;
  const path = document.createElementNS(SVG_NS, "path");
  // Quadratic arc; its apex sits at yEdge + bulge, where the digit goes.
  path.setAttribute("d", `M ${x1} ${yEdge} Q ${midX} ${yEdge + bulge * 2} ${x2} ${yEdge}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#222");
  path.setAttribute("stroke-width", "1.1");
  svg.appendChild(path);
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(midX));
  text.setAttribute("y", String(yEdge + bulge + (above ? -2 : 11)));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-family", "Georgia, 'Times New Roman', serif");
  text.setAttribute("font-size", "13");
  text.setAttribute("font-style", "italic");
  text.setAttribute("font-weight", "bold");
  text.setAttribute("fill", "#222");
  text.textContent = "3";
  svg.appendChild(text);
}

/** VexFlow's default distance between two staff lines, in SVG units — the unit all the AEU
 *  accidental geometry below is expressed in, so it stays correct at any render scale. */
export const STAFF_SPACE = 10;

/**
 * Shared stroke weights for the AEU sharps, in STAFF SPACES — taken from REAL PRINT, not Bravura.
 *
 * Measured on `data/real/strips/hala_kanayan_kalbimi_ney_p1/..._s03_w00.png`, a real neyzen page
 * carrying a küçük mücennep sharp both in its signature and inline, at a staff size matched to
 * Bravura's (≈30px between staff lines). The two instances agree to the pixel, and a second
 * edition (`strips_exam_v2_clean/bulbulun_cilesi...`) gives the same 0.300 S bar on a koma.
 *
 * **Bravura draws every AEU sharp with a 0.367 S bar; real print draws 0.300 S.** The weight is
 * applied to all four so that BAR COUNT stays the only thing separating them — thinning just the
 * one broken glyph would hand the model a thickness cue that real pages do not have.
 */
export const AEU_SHARP_STROKE = {
  stem: 0.133,
  height: 2.7,   // stem length
  bar: 0.3,      // bar thickness, measured vertically as drawn (Bravura: 0.367)
  slope: 0.357,  // rise / run — each bar's rise scales with its own length
};

/**
 * The four AEU sharps as stem offsets and bar lengths, in STAFF SPACES. The family is one
 * systematic design: 1 or 2 vertical stems crossed by 2 or 3 slanted bars, and the glyphs are told
 * apart ONLY by those counts. Lengths follow Bravura so each keeps its familiar shape; the küçük's
 * are the real-print ones (stubby top/bottom bars either side of a full-width middle bar — the
 * "staircase" a domain reader recognises).
 *
 * Why the three-bar glyphs needed this at all — the white gap left between neighbouring bars:
 *
 *                     bar pitch   Bravura gap   new gap
 *   koma   (2 bars)     0.94 S       0.58 S      0.64 S   (never at risk)
 *   bakiye (2 bars)     1.03 S       0.66 S      0.73 S   (never at risk)
 *   küçük  (3 bars)     0.65 S       0.12 S      0.35 S   ← fused into a block
 *   büyük  (3 bars)     0.51 S       0.14 S      0.21 S   ← fused into a block
 *
 * A 0.12 S gap is ~1–2px once the encoder has shrunk the strip, so a küçük's three bars merge and
 * it decodes as a 2-bar koma. That is the measured failure: gold küçük read as koma, the single
 * most common error on BOTH the clean exam and the photo strips, and one-directional
 * (`ml/labels/sharp_width_test.py`).
 *
 * **The küçük's 0.65 S pitch is deliberately wider than the 0.55 S measured in real print** — a
 * domain-expert call, chosen off `data/real/rung3/sharp_probe/kucuk_pitch_options.png`: it is the
 * glyph the model actually fails on, so its bars are opened a little past life-size to survive the
 * shrink, while staying far from koma's 0.94 S (at which point küçük's outer pair would start to
 * read as a koma). Note the trade: synthetic küçüks are spaced slightly more openly than printed
 * ones, so if the model ever starts missing TIGHTLY printed küçüks, move this back toward 0.55
 * rather than opening it further.
 */
export const AEU_SHARPS: Record<number, { stems: number[]; pitch: number; lengths: number[] }> = {
  0xe444: { stems: [0], pitch: 0.94, lengths: [0.9, 0.9] },                  // koma
  0xe445: { stems: [-0.23, 0.23], pitch: 1.03, lengths: [1.0, 1.0] },        // bakiye
  0xe446: { stems: [0], pitch: 0.65, lengths: [0.73, 1.4, 0.73] },           // küçük mücennep
  0xe447: { stems: [-0.23, 0.23], pitch: 0.51, lengths: [1.0, 1.37, 1.0] },  // büyük mücennep
};

/**
 * Redraw the AEU sharps at real-print bar weight, replacing Bravura's heavier glyphs.
 *
 * Why redraw rather than pick a lighter font: no VexFlow font ships the AEU accidentals at all
 * (they are rendered as raw Bravura `<text>` — see {@link addAccidental}), and a font glyph cannot
 * be thinned, so the shapes are drawn here instead. Sharps only — the flat family scores 89–92%,
 * and changing a healthy class risks a regression for no measured gain.
 *
 * Runs after the engrave, over both VexFlow's inline accidentals and our own key-signature glyphs.
 * Pixels only: labels are serialized from the doc, never from what is drawn.
 */
export function drawThinSharps(svg: SVGSVGElement, staffSpace: number) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const S = staffSpace;
  const w = AEU_SHARP_STROKE;
  for (const text of Array.from(svg.querySelectorAll("text"))) {
    const cp = text.textContent?.codePointAt(0);
    const shape = cp === undefined ? undefined : AEU_SHARPS[cp];
    if (!shape) continue;
    let box: DOMRect;
    try {
      box = text.getBBox();
    } catch {
      continue;
    }
    if (box.width === 0 || box.height === 0) continue; // unmeasurable (font not loaded) — leave it
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("fill", "#000");
    group.setAttribute("data-omr", "aeu-sharp"); // inspection only (an attribute, not pixels)

    for (const dx of shape.stems) {
      const stem = document.createElementNS(SVG_NS, "rect");
      stem.setAttribute("x", String(cx + dx * S - (w.stem * S) / 2));
      stem.setAttribute("y", String(cy - (w.height * S) / 2));
      stem.setAttribute("width", String(w.stem * S));
      stem.setAttribute("height", String(w.height * S));
      group.appendChild(stem);
    }

    // Parallelogram bars rising left→right, stacked around the glyph centre and centred on it.
    // The white gap between them is the whole signal.
    const t = (w.bar * S) / 2;
    const n = shape.lengths.length;
    shape.lengths.forEach((lenS, i) => {
      const len = lenS * S;
      const half = len / 2;
      const rise = (len * w.slope) / 2; // shorter bars rise less — same slope, not same rise
      const y = cy + (i - (n - 1) / 2) * shape.pitch * S;
      const poly = document.createElementNS(SVG_NS, "polygon");
      poly.setAttribute(
        "points",
        [
          [cx - half, y + rise + t],
          [cx + half, y - rise + t],
          [cx + half, y - rise - t],
          [cx - half, y + rise - t],
        ]
          .map(([px, py]) => `${px},${py}`)
          .join(" "),
      );
      group.appendChild(poly);
    });
    text.replaceWith(group);
  }
}

/**
 * Draw a plain PHRASE SLUR — a curved arc over a run of noteheads WITHOUT the tuplet "3" — as raw
 * SVG. Real Turkish editions slur legato groups, but the synthetic corpus drew arcs ONLY on
 * triplets, so the model learned "any over-note arc ⇒ `\tup3`" (baseline tup3 precision 15%, and
 * the arc-triggered false-`\tup3` rate the Step-4.0 metric watches). These label-free distractors
 * teach that an arc ALONE is not a triplet — only arc + "3" is. Pixels only: a slur is never a
 * label token, and buildStrips serializes from the doc, so the labels stay plain automatically.
 */
export function drawSlurArc(svg: SVGSVGElement, group: StaveNote[], above: boolean) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const xs = group.map((n) => n.getAbsoluteX());
  const x1 = Math.min(...xs) - 1;
  const x2 = Math.max(...xs) + 10;
  const ys = group.flatMap((n) => {
    try {
      return n.getYs();
    } catch {
      return [];
    }
  });
  if (ys.length === 0) return;
  const yEdge = above ? Math.min(...ys) - 8 : Math.max(...ys) + 8;
  const bulge = above ? -7 : 7; // shallower than the tuplet arc, and no digit — a phrase slur
  const midX = (x1 + x2) / 2;
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", `M ${x1} ${yEdge} Q ${midX} ${yEdge + bulge * 2} ${x2} ${yEdge}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#222");
  path.setAttribute("stroke-width", "1.1");
  path.setAttribute("data-omr", "slur"); // for tests/inspection only (an attribute, not pixels)
  svg.appendChild(path);
}

/** How often a bar that HAS internal usul groups gets its dotted lines drawn. CHOSEN, NOT
 *  MEASURED, exactly like STACCATO_RATE and the slur distractor's 0.35 — nobody has counted how
 *  often real Turkish editions rule them, and BACKLOG item 5 says the 7.8% on record is a statistic
 *  about the MODEL'S GUESSES, not about print. Coined per PIECE (not per bar): an edition either
 *  uses the convention or it does not, and a page that rules some bars and not others is not a
 *  page any engraver produced. */
export const USUL_BAR_RATE = 0.35;

/** Dash pattern of the usul barline, in staff spaces (dash, gap). A ruled usul line is drawn much
 *  lighter than a real barline — it is a reading aid, not a division of the music. */
export const USUL_BAR_DASH = [0.22, 0.30] as const;

/**
 * Draw the DOTTED (usul) BARLINE — a light dashed vertical rule inside a measure, on the usul's
 * own beat-group boundaries.
 *
 * WHY. Turkish editions rule these to show the usul's subdivisions (aksak 9/8 = 2+2+2+3, so the
 * bar carries three internal rules). The renderer has never drawn one — 0 of 40,826 strips — and
 * `ADDED_TOKENS` has no name for one, so the nearest thing the model knows is a vertical line with
 * DOTS beside it: a repeat sign. It duly emits `\repstart`, and the owner has been deleting those
 * by hand while labelling — ~1 in 5 of `batch3`'s corrections is exactly that (docs/BACKLOG.md
 * item 5, docs/METRICS-INPUT.md).
 *
 * ⭐ This is the same SHAPE of change as the staccato distractor, and that now means something
 * measured rather than argued: a HOLE in what the model has been shown responds to being filled
 * (72.7% → 0.0%), while a domain gap does not (three nulls). Both are symbols it has never seen.
 *
 * ⚠ LABEL-FREE, and that is a decision, not an oversight. Naming it would make every real gold
 * label silently wrong, because no pool on disk annotates one; drawn without a label it is
 * consistent with everything we own and costs ZERO new labelling. The `\dottedbar` token is a
 * Round-4 question (docs/DECISIONS.md).
 *
 * Raw SVG rather than a VexFlow `StaveLine`/`Barline` for the same reason `drawStaccatoDot` and
 * `drawSlurArc` are: a VexFlow modifier feeds `StaveNote.getBoundingBox()`, the merge that once
 * stretched a graced note's click box across the whole score (see `noteBoxOf`). Appending to the
 * SVG leaves every note box untouched.
 *
 * Pixels only: `buildStrips` serializes from the document, so the labels are byte-identical with
 * and without it — which is what `verify-labels.ts` re-checks.
 */
export function drawUsulBars(
  svg: SVGSVGElement,
  stave: Stave,
  notes: StaveNote[],
  onsets: number[],
  boundaries: number[],
): void {
  const top = stave.getYForLine(0);
  const bottom = stave.getYForLine(4);
  const space = (bottom - top) / 4;
  // A boundary must land ON a note's onset. Syncopation across a group boundary does happen, but
  // then there is no gap to rule into and an engraver ties or omits the line; guessing an x inside
  // a note would draw ink through a notehead.
  const eps = 1e-6;
  for (const at of boundaries) {
    const i = onsets.findIndex((o) => Math.abs(o - at) < eps);
    if (i <= 0 || i >= notes.length) continue;
    const prev = notes[i - 1]!, cur = notes[i]!;
    let x0: number, x1: number;
    try {
      x0 = prev.getAbsoluteX();
      x1 = cur.getAbsoluteX();
    } catch {
      continue;
    }
    if (!Number.isFinite(x0) || !Number.isFinite(x1) || x1 <= x0) continue;
    // Biased toward the following note, which is where print puts it — the rule belongs to the
    // group it opens. ⚠ Chosen BY EYE on a pilot render, like STACCATO_RADIUS; not a measurement.
    const x = x0 + (x1 - x0) * 0.62;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x));
    line.setAttribute("x2", String(x));
    line.setAttribute("y1", String(top));
    line.setAttribute("y2", String(bottom));
    line.setAttribute("stroke", "#000");
    line.setAttribute("stroke-width", String(space * 0.11));
    line.setAttribute("stroke-dasharray", USUL_BAR_DASH.map((d) => d * space).join(" "));
    svg.appendChild(line);
  }
}

/** Staccato dot radius, in STAFF SPACES. It must LOOK like Bravura's augmentation dot — the whole
 *  experiment rests on the two marks being the same ink in different PLACES, so if one reads as
 *  bigger the model can separate them by size instead of by position and learns nothing. Checked by
 *  eye on the pilot render, not asserted. Vertical placement is not a constant: see the space-centre
 *  rule in drawStaccatoDot. */
export const STACCATO_RADIUS = 0.15;

/** How often a staccato is drawn. CHOSEN, NOT MEASURED — like the slur distractor's 0.35, which is
 *  the precedent this follows. `dotted` is the rate on notes that ALREADY carry an augmentation
 *  dot and is deliberately the higher of the two: those are the strips that isolate position from
 *  everything else, so the corpus should be rich in them even though real print is not. Nobody has
 *  counted staccato frequency in real Turkish editions; doing so is the way to replace these. */
export const STACCATO_RATE = { dotted: 0.3, run: 0.18 } as const;

/**
 * Draw a STACCATO dot — a filled dot on the notehead side, opposite the stem — as raw SVG.
 *
 * WHY. The corpus has never contained one: 0 of 40,826 strips carry an articulation, and
 * `ADDED_TOKENS` has no name for one either (the augmentation dot is not a token, it is a suffix
 * inside the duration — `8` vs `8.`). So every dot the model has ever seen meant *longer*, and it
 * reads a printed staccato as an augmentation dot, lengthening notes that were never long (owner,
 * 2026-08-15).
 *
 * What this teaches is POSITIONAL, and that is the whole design: an augmentation dot is a suffix
 * beside the notehead, on its line or space (VexFlow's `Dot`, via `Dot.buildAndAttach` above); a
 * staccato sits above or below it. Drawn on the wrong side this distractor teaches the confusion
 * instead of curing it.
 *
 * Raw SVG rather than VexFlow's `Articulation` on purpose. A modifier feeds
 * `StaveNote.getBoundingBox()`, the merge that once stretched a graced note's click box across the
 * whole score (see `noteBoxOf`) — appending to the SVG keeps every note box untouched. It is also
 * what `drawSlurArc` does, and this is that same idea for a different mark: label-free ink that
 * teaches what a symbol is NOT.
 *
 * Pixels only: a staccato is never a label token, and buildStrips serializes from the doc, so the
 * labels stay identical with and without it.
 */
export function drawStaccatoDot(svg: SVGSVGElement, note: StaveNote): void {
  const SVG_NS = "http://www.w3.org/2000/svg";
  let yTop: number;
  let yBottom: number;
  let nonDisplacedX: number | undefined;
  let displacedX: number | undefined;
  let width: number;
  let stemUp: boolean;
  let stave: Stave;
  try {
    ({ yTop, yBottom, nonDisplacedX, displacedX } = note.getNoteHeadBounds());
    width = note.getGlyphWidth();
    stemUp = note.getStemDirection() >= 0;
    stave = note.checkStave();
  } catch {
    return;
  }
  if (!Number.isFinite(yTop) || !Number.isFinite(yBottom) || !Number.isFinite(width) || width <= 0) return;
  const space = stave.getSpacingBetweenLines();
  const yTopLine = stave.getYForLine(0);
  if (!Number.isFinite(space) || space <= 0 || !Number.isFinite(yTopLine)) return;

  // ⚠ `yTop`/`yBottom` are NOT the ink's edges — VexFlow builds them from `notehead.getY()`, the
  // notehead's ANCHOR, so on a single-notehead note they are both simply its CENTRE. Two drafts
  // were rejected by eye on the pilot for missing that, and the failure is worth keeping: treating
  // the anchor as an edge measures every clearance from half a notehead too close, and the dots
  // came out fused to the noteheads.
  //
  // So: the notehead spans centre ± ~0.5 spaces. Step outward from its far side by the dot's own
  // radius plus a margin, then land on the first SPACE CENTRE beyond that — never on a staff line,
  // where a 0.3-space dot simply disappears into the line.
  const centre = (yTop + yBottom) / 2;
  const dir = stemUp ? 1 : -1;
  const clearance = 0.5 + STACCATO_RADIUS + 0.1; // half a notehead, the dot's radius, a margin
  const t0 = (centre - yTopLine) / space + dir * clearance;
  const slot = stemUp ? Math.ceil(t0 - 0.5) + 0.5 : Math.floor(t0 - 0.5) + 0.5;
  // Notes IN a space get the neighbouring space, the textbook placement. Notes ON a line get the
  // one beyond it, because the adjacent space centre is exactly where an on-line notehead's ink
  // already reaches — that collision is geometry, not tuning, and no clearance value avoids it.
  // Looser than a fastidious engraver would set, and the right trade here: an ambiguous mark
  // teaches nothing, a clearly detached one IS the lesson — this dot is not beside the notehead.

  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("cx", String((nonDisplacedX ?? displacedX ?? note.getAbsoluteX()) + width / 2));
  dot.setAttribute("cy", String(yTopLine + slot * space));
  dot.setAttribute("r", String(STACCATO_RADIUS * space));
  dot.setAttribute("fill", "#000");
  dot.setAttribute("data-omr", "staccato"); // inspection only (an attribute, not pixels)
  svg.appendChild(dot);
}

// Volta bracket height above the top staff line: close to the row (clear of most beams) and well
// inside the strip-crop window (which starts ~46px above the top line).
export const VOLTA_ABOVE = 26;

/**
 * Draw a volta (1./2. ending) bracket over one measure, as raw SVG — like the key signature and
 * meter. VexFlow's own `Volta` places the bracket ~7 staff spaces above the top line and its label
 * ignores the y-shift, so it can't be brought closer to the row.
 */
export function drawVolta(svg: SVGSVGElement, stave: Stave, label: string) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const y = stave.getYForLine(0) - VOLTA_ABOVE;
  // Start the bracket where the music starts, not at the stave's left edge — on a row-start
  // measure the bracket must not reach back over the clef / key signature / begin-repeat sign.
  const x1 = Math.max(stave.getX() + 1, stave.getNoteStartX() - 6);
  const x2 = stave.getX() + stave.getWidth() - 2;
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", `M ${x1} ${y + 12} V ${y} H ${x2} V ${y + 12}`); // ⌐¬ down-ticks at both ends
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#222");
  path.setAttribute("stroke-width", "1.2");
  svg.appendChild(path);
  const t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("x", String(x1 + 6));
  t.setAttribute("y", String(y + 12));
  t.setAttribute("font-family", "Georgia, 'Times New Roman', serif");
  t.setAttribute("font-size", "12");
  t.setAttribute("fill", "#222");
  t.textContent = label;
  svg.appendChild(t);
}

// SMuFL codepoints for the navigation glyphs (Bravura, same raw-glyph path as the key signature).
export const NAV_GLYPH_CODEPOINT = { segno: 0xe047, coda: 0xe048 } as const;
// Printed text of the navigation text marks ("Son" = the Turkish Fine, as on the real sheets).
export const NAV_TEXT = { dc: "D.C.", fine: "Son" } as const;

/**
 * Draw one measure's navigation marks (segno 𝄋 / coda ⊕ glyphs, "D.C." / "Son" text) as raw SVG,
 * like the key signature and voltas. Start-edge marks sit above the measure's first note,
 * end-edge marks at its right barline; `below` text marks go under the bottom staff line (both
 * placements appear in real prints). Injection (navmarks.ts) keeps these off repeat/volta
 * measures, so the above-staff band never stacks two kinds of ink.
 */
export function drawNavMarks(svg: SVGSVGElement, stave: Stave, marks: { start: NavMark[]; end: NavMark[] }) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  for (const edge of ["start", "end"] as const) {
    for (const m of marks[edge]) {
      const t = document.createElementNS(SVG_NS, "text");
      const atEnd = edge === "end";
      if (m.type === "segno" || m.type === "coda") {
        // Glyph baseline a touch above the top line; the glyph body extends upward, staying
        // inside the strip-crop window (which starts ~46px above the top line — see drawVolta).
        // End-edge glyphs are right-anchored so they stay inside the measure's crop rect.
        t.setAttribute("x", String(atEnd ? stave.getX() + stave.getWidth() - 2 : Math.max(stave.getX() + 2, stave.getNoteStartX() - 4)));
        t.setAttribute("y", String(stave.getYForLine(0) - 12));
        t.setAttribute("font-family", "Bravura");
        t.setAttribute("font-size", "22"); // ~2.5 staff spaces tall, like the printed sheets
        if (atEnd) t.setAttribute("text-anchor", "end");
        t.textContent = String.fromCodePoint(NAV_GLYPH_CODEPOINT[m.type]);
      } else {
        const y = m.below ? stave.getYForLine(4) + 18 : stave.getYForLine(0) - 16;
        t.setAttribute("x", String(atEnd ? stave.getX() + stave.getWidth() - 2 : stave.getNoteStartX()));
        t.setAttribute("y", String(y));
        t.setAttribute("font-family", "Georgia, 'Times New Roman', serif");
        t.setAttribute("font-size", "13");
        t.setAttribute("font-style", "italic");
        if (atEnd) t.setAttribute("text-anchor", "end");
        t.textContent = NAV_TEXT[m.type];
      }
      t.setAttribute("fill", "#222");
      svg.appendChild(t);
    }
  }
}

/**
 * Draw one lyric syllable centered under a note, below the staff (like the original engraved
 * sheets). SymbTr stores the syllable per note; "." marks a melisma/continuation (no new text)
 * and is skipped by the caller. Drawn as a plain SVG <text> in a serif face.
 */
export function drawLyric(svg: SVGSVGElement, x: number, y: number, text: string): SVGTextElement {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text") as SVGTextElement;
  t.setAttribute("x", String(x));
  t.setAttribute("y", String(y));
  t.setAttribute("font-family", "Georgia, 'Times New Roman', serif");
  t.setAttribute("font-size", "13");
  t.setAttribute("text-anchor", "middle"); // center the syllable under the notehead
  t.setAttribute("fill", "#222");
  t.textContent = text;
  svg.appendChild(t);
  return t;
}

/**
 * Melisma extension line: an underscore-style rule drawn just BELOW the lyric baseline (so it
 * never cuts through the text), between caller-supplied endpoints. Used to carry a held syllable
 * across the notes it's sung over — including spanning multiple rows.
 */
export function drawMelismaLine(svg: SVGSVGElement, startX: number, endX: number, baseY: number) {
  if (endX - startX < 8) return; // too short to read as an extension
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String(startX));
  line.setAttribute("x2", String(endX));
  line.setAttribute("y1", String(baseY + 2)); // below the baseline → reads as an underscore
  line.setAttribute("y2", String(baseY + 2));
  line.setAttribute("stroke", "#222");
  line.setAttribute("stroke-width", "1.3");
  svg.appendChild(line);
}

/** One note's lyric slot: its x, the row's baseline, and what it carries. */
export interface LyricItem {
  x: number;
  baseY: number;
  row: number;
  text: string;
  hold: boolean; // melisma/continuation note (no new syllable)
  wordEnd: boolean; // this syllable ends a word
}

/**
 * Render the lyric line under the staff like an engraved score: syllables centered under their
 * notes, a HYPHEN in the gap between a word's syllables (but not across word boundaries), and a
 * MELISMA underscore carrying a held syllable across the notes it's sung over — continuing across
 * row breaks. Text widths are measured so connectors sit in the gaps and never cut through text.
 */
export function drawLyrics(svg: SVGSVGElement, items: LyricItem[], hyphens: boolean) {
  // Per-row first/last note x and baseline, so a melisma can span whole rows and start at the
  // first note (clear of the clef/key signature), not at the page margin.
  const rowMinX = new Map<number, number>();
  const rowMaxX = new Map<number, number>();
  const rowBaseY = new Map<number, number>();
  for (const it of items) {
    rowMinX.set(it.row, Math.min(rowMinX.get(it.row) ?? Infinity, it.x));
    rowMaxX.set(it.row, Math.max(rowMaxX.get(it.row) ?? 0, it.x));
    rowBaseY.set(it.row, it.baseY);
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (it.hold) continue; // held notes carry no syllable; a preceding melisma underscore spans them
    const el = drawLyric(svg, it.x, it.baseY, it.text);
    const halfW = (el.getComputedTextLength?.() || it.text.length * 7) / 2;
    const rightEdge = it.x + halfW;

    // Run of held notes after this syllable (across rows), up to the next real syllable.
    let j = i + 1;
    while (j < items.length && items[j]!.hold) j++;
    const next = j < items.length ? items[j]! : null;

    if (j > i + 1) {
      // Melisma: an underscore per row segment, from the syllable to the last held note. On the
      // final row it stops just before the next syllable (if any) so the line leads into it.
      const last = items[j - 1]!;
      for (let row = it.row; row <= last.row; row++) {
        // First row starts just after the syllable; later rows start at that row's first note.
        const startX = row === it.row ? rightEdge + 4 : (rowMinX.get(row) ?? LEFT) - 4;
        // Stop at the last held note of the row — on the final row this leaves the gap before the
        // next syllable, so the underscore never runs into it.
        const endX = row === last.row ? last.x : rowMaxX.get(row) ?? startX;
        drawMelismaLine(svg, startX, endX, rowBaseY.get(row) ?? it.baseY);
      }
    } else if (hyphens && next && !it.wordEnd) {
      // Same word continues on the very next note → hyphen (only when enabled).
      if (next.row === it.row) {
        drawLyric(svg, (rightEdge + next.x) / 2, it.baseY, "-"); // in the gap between syllables
      } else {
        drawLyric(svg, rightEdge + 7, it.baseY, "-"); // word breaks across rows → trailing hyphen
      }
    }
  }
}

// SMuFL time-signature digits live at U+E080 (0) … U+E089 (9) in the music font.
export const timeSigGlyphs = (n: number): string =>
  [...String(n)].map((d) => String.fromCodePoint(0xe080 + Number(d))).join("");

/**
 * Draw the meter (e.g. 9/8) as stacked Bravura digits centered on `centerX`: numerator in the
 * upper half of the staff, denominator in the lower half. Drawn ourselves (not via VexFlow's
 * `addTimeSignature`, which always sits right after the clef) so it can follow the key signature.
 */
export function drawTimeSignature(svg: SVGSVGElement, stave: Stave, centerX: number, ts: { num: number; den: number }) {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const space = stave.getYForLine(1) - stave.getYForLine(0); // px per staff space
  // Center the stack on the middle line, nudged up slightly: Bravura's digit baseline renders a
  // touch low, so this small lift makes the meter read vertically centered on the staff.
  const mid = stave.getYForLine(2) - space * 0.35;
  const digit = (value: number, y: number) => {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(centerX));
    text.setAttribute("y", String(y));
    text.setAttribute("font-family", "Bravura");
    text.setAttribute("font-size", "39"); // ~4-space em; each digit spans ~2 staff spaces
    text.setAttribute("text-anchor", "middle"); // auto-centers multi-digit numbers (e.g. "10")
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill", "#222");
    text.textContent = timeSigGlyphs(value);
    svg.appendChild(text);
  };
  digit(ts.num, mid - space); // numerator one space above the middle line
  digit(ts.den, mid + space); // denominator one space below the middle line
}
