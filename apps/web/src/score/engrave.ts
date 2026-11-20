/**
 * Engraving: draws the whole score into the host element with VexFlow and the hand-drawn marks,
 * then reports the measured boxes back to SheetView. It is the body of SheetView's layout effect,
 * moved here verbatim on 2026-11-20 (the effect still decides WHEN it runs, with the same deps).
 *
 * ⚠ This is the TRAINING-STRIP source: tools/render/render.ts screenshots what it draws. Pixels and
 * labels come from one code path — never change a drawing rule here without the label side.
 */
import type { TimeSignature } from "@turkish-omr/core";
import { mulberry32 } from "@turkish-omr/core/labels/rng";
import {
  USUL_BAR_RATE,
  TUPLET_MARK_CONCAVE,
  type LyricItem,
  drawVolta,
  drawNavMarks,
  drawTupletArcLegacy,
  drawTupletArcConcave,
  drawTupletArc,
  drawSlurArc,
  drawUsulBars,
  drawStaccatoDot,
  STACCATO_RATE,
  drawTimeSignature,
  drawLyrics,
  drawThinSharps,
  STAFF_SPACE,
} from "./drawMarks";
import {
  USUL_BEAM_GROUPS,
  tupletCurvedFor,
  buildStaveNotes,
  attachTitles,
  tupletAbove,
  drawSignature,
} from "./vexNotes";
import {
  STAFF_LINE_WIDTH,
  SIG_GLYPH_ADVANCE,
  CLEF_W,
  ROW_HEIGHT,
  STAVE_TOP_PAD,
  LEFT,
  CURSOR_MARGIN,
  LYRIC_DY,
  MIN_FIT_SCALE,
} from "./layout";
import {
  Fraction,
  Renderer,
  Stave,
  Barline,
  StaveModifierPosition,
  Beam,
  StaveNote,
  Formatter,
  Tuplet,
  Dot,
  StaveTie,
} from "vexflow";
import { groupMeasures, type Measure, eventBeats, type NoteModelDocument } from "@turkish-omr/core";
import {
  type MeasureBox,
  type NotePos,
  type NoteBox,
  noteBoxOf,
  type TupletMarkBox,
  markBoxOf,
} from "./hitTest";
import { repeatMarksAt, type RepeatSpan } from "@turkish-omr/core/labels/repeats";
import { navMarksAt, type NavMark } from "@turkish-omr/core/labels/navmarks";
import { closedTupletAt, memberPositions } from "@turkish-omr/core/labels/rhythm";
import { buildTextNoise } from "./textNoise";
import type { RefObject, MutableRefObject, SetStateAction } from "react";

export function engraveScore({
  accidentalMode,
  boxContentW,
  concaveTuplet,
  contentW,
  doc,
  fitBoxW,
  fitExtra,
  fitKey,
  hostRef,
  justify,
  legacyTupletMark,
  lyricHyphens,
  navMarks,
  onLayout,
  onlyMeasure,
  posByEvRef,
  positionsRef,
  printNoise,
  repeatSpans,
  setBoxes,
  setFit,
  setFitScale,
  setNoteBoxes,
  setSvgHeight,
  setTupletMarks,
  showLyrics,
  signature,
  signatureMap,
  sigTolerant,
  slurNoise,
  staccatoNoise,
  svgMarker,
  svgW,
  textNoise,
  thinSharps,
  timeSig,
  usulBarNoise,
}: {
  accidentalMode: "every" | "keysig" | "measure";
  boxContentW: number;
  concaveTuplet: boolean | undefined;
  contentW: number;
  doc: NoteModelDocument;
  fitBoxW: number | null;
  fitExtra: number;
  fitKey: string;
  hostRef: RefObject<HTMLDivElement>;
  justify: boolean;
  legacyTupletMark: boolean | undefined;
  lyricHyphens: boolean;
  navMarks: NavMark[] | undefined;
  onLayout: ((layout: { boxes: { index: number; x: number; y: number; width: number; }[]; svgWidth: number; svgHeight: number; rowHeight: number; }) => void) | undefined;
  onlyMeasure: number | undefined;
  posByEvRef: MutableRefObject<Map<number, NotePos>>;
  positionsRef: MutableRefObject<NotePos[]>;
  printNoise: { seed: number; } | null | undefined;
  repeatSpans: RepeatSpan[] | undefined;
  setBoxes: (value: SetStateAction<MeasureBox[]>) => void;
  setFit: (value: SetStateAction<{ key: string; extra: number; }>) => void;
  setFitScale: (value: SetStateAction<number>) => void;
  setNoteBoxes: (value: SetStateAction<NoteBox[]>) => void;
  setSvgHeight: (value: SetStateAction<number>) => void;
  setTupletMarks: (value: SetStateAction<TupletMarkBox[]>) => void;
  showLyrics: boolean;
  signature: { letter: string; alterCommas: number; }[];
  signatureMap: Map<string, number>;
  sigTolerant: boolean;
  slurNoise: { seed: number; } | null | undefined;
  staccatoNoise: { seed: number; } | null | undefined;
  svgMarker: string;
  svgW: number;
  textNoise: { seed: number; } | null | undefined;
  thinSharps: boolean | undefined;
  timeSig: TimeSignature | null;
  usulBarNoise: { seed: number; } | null | undefined;
}): (() => void) | undefined {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = ""; // clear any previous render (also handles React 18 double-invoke)

    // Seeded RNG for the phrase-slur distractors (drawn per measure below; same seed → same slurs).
    const slurRng = slurNoise ? mulberry32(slurNoise.seed) : null;
    // Seeded RNG for the staccato distractors, drawn in the same per-measure walk. Its own stream,
    // so turning staccato on does not shift which slurs the slur seed draws — the two distractors
    // have to be separable, or an A/B on one of them silently moves the other.
    const staccatoRng = staccatoNoise ? mulberry32(staccatoNoise.seed) : null;
    // ⭐ The usul rule is coined ONCE for the whole page, not per bar: an edition either uses the
    // convention or it does not. Its group boundaries come from USUL_BEAM_GROUPS, which already
    // holds the conventional groupings by meter. ⚠ That table is quarantined as a BEAMING change
    // (it would move every beam in ~40k strips); reading it for where a RULE goes is a different
    // use and moves no beam.
    const usulBarGroups = (() => {
      if (!usulBarNoise || !timeSig) return null;
      if (mulberry32(usulBarNoise.seed)() >= USUL_BAR_RATE) return null;
      const pattern = USUL_BEAM_GROUPS[`${timeSig.num}/${timeSig.den}`];
      if (!pattern || pattern.length < 2) return null;
      // Cumulative INTERNAL boundaries, in whole-note units — the same unit `eventBeats` counts in.
      // The final entry is the barline itself and is dropped.
      const out: number[] = [];
      let acc = 0;
      for (const g of pattern.slice(0, -1)) {
        acc += g / timeSig.den;
        out.push(acc);
      }
      return out;
    })();

    // Round-3 print realism, drawn once per render so a whole page is internally consistent (a
    // real edition has ONE staff weight and ONE beaming convention). Draw order is fixed so a
    // seed always yields the same page.
    const printRng = printNoise ? mulberry32(printNoise.seed) : null;
    const staffLineWidth = printRng
      ? STAFF_LINE_WIDTH.min + printRng() * (STAFF_LINE_WIDTH.max - STAFF_LINE_WIDTH.min)
      : null;
    // Beam by the usul's groups on a seeded coin (half the corpus), else VexFlow's quarter-note
    // clock. Only meters we have actually seen engraved get a grouping.
    const usulGroups =
      printRng && printRng() < 0.5 && timeSig
        ? USUL_BEAM_GROUPS[`${timeSig.num}/${timeSig.den}`]?.map((n) => new Fraction(n, timeSig.den))
        : undefined;
    const beamConfig = usulGroups ? { groups: usulGroups } : {};

    // The key signature is drawn whenever accidentals aren't shown on every note.
    const showSignature = accidentalMode !== "every";
    // Width the key signature needs after the clef on each row's first stave (0 when off).
    const sigWidth = showSignature && signature.length ? signature.length * SIG_GLYPH_ADVANCE + 10 : 0;
    // The clef + (optional) signature both repeat on the first stave of every row.
    const leadWidth = CLEF_W + sigWidth;
    // Extra room the meter (e.g. 9/8) needs — only on the very first stave of the piece.
    // Scales with the widest of numerator/denominator so multi-digit meters (10/8) still fit.
    const timeSigWidth = timeSig
      ? Math.max(String(timeSig.num).length, String(timeSig.den).length) * 16 + 10
      : 0;

    // Tuplet mark style, chosen ONCE per piece (a real edition engraves them one way): the
    // curved arc + "3" of most printed Turkish scores (~90% of pieces, by name hash) or
    // VexFlow's square bracket. The label token is identical either way — the style variety
    // is free training realism. 70% until 2026-08-12; the owner reads arcs as more dominant than
    // that in real editions, and 10% keeps the bracket represented, since real print does use it.
    const tupletCurved = tupletCurvedFor(doc);
    // A SECOND coin inside the curved style (2026-08-19): the continuous arc with the "3" inside its
    // concavity, which the owner found on two real scanned editions. Hashed on a DIFFERENT salt than
    // `tupletCurved` so the two styles are independent — reusing the same sum would tie "is it
    // curved" to "is it concave" and put a hidden correlation in the corpus.
    // ⚠ Chosen share, not measured — see TUPLET_MARK_CONCAVE. OPT-IN: without the flag this is
    // always false, so every render made before 2026-08-19 reproduces byte for byte.
    const tupletConcave =
      !!concaveTuplet &&
      Array.from(`${doc.name ?? ""}:concave`).reduce((s, ch) => s + ch.charCodeAt(0), 0) % 100
      < TUPLET_MARK_CONCAVE.share * 100;

    // Pack measures into rows (greedy wrap). The first stave of each row pays for the clef;
    // the very first measure additionally pays for the one-time time signature.
    const all = groupMeasures(doc);
    // ⚠ FILTERED, never re-numbered — see `onlyMeasure`'s own note. `Measure.index` stays the bar's
    // number in the whole score, so everything bar-indexed on both sides still means the same bar.
    const measures = onlyMeasure != null ? all.filter((m) => m.index === onlyMeasure) : all;
    type Cell = { m: Measure; width: number; firstInRow: boolean };
    const rows: Cell[][] = [];
    let cur: Cell[] = [];
    let used = 0;
    let firstMeasure = true;
    for (const m of measures) {
      const extra = firstMeasure ? timeSigWidth : 0;
      const base = Math.max(130, Math.min(420, m.events.length * 28 + 24));
      const isFirst = cur.length === 0;
      const width = base + (isFirst ? leadWidth : 0) + extra;
      if (!isFirst && used + width > contentW) {
        rows.push(cur);
        cur = [{ m, width: base + leadWidth, firstInRow: true }];
        used = base + leadWidth;
      } else {
        cur.push({ m, width, firstInRow: isFirst });
        used += width;
      }
      firstMeasure = false;
    }
    if (cur.length) rows.push(cur);

    // Justify each row to a uniform width, like engraved music: stretch its measures so every row
    // ends at the same right margin instead of a ragged edge. Scaling is proportional, so the
    // first measure (which carries the clef/sig) stays a touch wider — as in real scores. The
    // LAST row is left natural: short final systems are normal, and justifying a near-empty last
    // line would blow its spacing apart. Uniform rows matter for Phase-2 synthetic data realism.
    rows.forEach((cells, r) => {
      const sum = cells.reduce((s, c) => s + c.width, 0);
      if (sum <= 0) return;
      // ⚠ `justify` is what the measure card turns on. On the page the final system stays ragged —
      // that is real engraving, and stretching a near-empty last line blows its spacing apart — but
      // a card's ONE row is always the last row, and a bar drawn at its natural width would sit in
      // a box it does not fill.
      //
      // ⚠ **RAGGED MEANS SHORTER THAN THE PAGE, NEVER WIDER** (2026-09-26). Skipping the last row
      // outright let it keep a natural width that can EXCEED the content area, and then it is not
      // ragged, it is off the page: measured on a phone at 393px, `meltem_notes`'s final system was
      // **470px of stave inside a 324px drawing**, its notes running 139px past the edge and
      // clipped, because the SVG is only as wide as the content area. The skip now applies only
      // while the row actually fits; past that it is scaled down like any other.
      if (!justify && r === rows.length - 1 && sum <= contentW) return;
      for (const c of cells) c.width *= contentW / sum;
    });

    const height = rows.length * ROW_HEIGHT + 20;
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(svgW, height);
    const ctx = renderer.getContext();
    // The SVG backend's group API, used to wrap a VexFlow-drawn triplet bracket so it can be
    // measured. Typed narrowly and optional rather than cast to SVGContext: the backend is fixed
    // above, but a render context that cannot open a group should cost a click target, not a page.
    const svgCtx = ctx as unknown as
      | { openGroup(cls?: string, id?: string): SVGGElement; closeGroup(): void }
      | undefined;
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    svg?.setAttribute("data-omr", svgMarker); // stable selector for the Playwright strip exporter

    const collected: MeasureBox[] = [];
    const positions: NotePos[] = [];
    const noteRects: NoteBox[] = [];
    // Every triplet mark drawn on the page, with the element wrapping its ink — a <g> we created for
    // a curved mark, one the render context opened for a VexFlow bracket. Both are measured the same
    // way below. `closes` separates a real triplet from a broken mark; both are holdable.
    const markSlots: { evIndex: number; el: SVGGraphicsElement; closes: boolean }[] = [];
    const lyricItems: LyricItem[] = []; // collected across all staves, drawn in one pass below
    let tMs = 0; // running playback clock, matches buildTimeline's accumulation order
    rows.forEach((cells, r) => {
      const y = STAVE_TOP_PAD + r * ROW_HEIGHT;
      let x = LEFT;
      for (const cell of cells) {
        const stave = new Stave(x, y, cell.width);
        if (cell.firstInRow) stave.addClef("treble");
        // Lay out the leading symbols left→right: clef, then the makam key signature, then the
        // meter (clef → flats → 9/8, matching engraved Turkish scores). We draw the key sig and
        // meter as Bravura glyphs ourselves (VexFlow's native versions don't fit either case),
        // so we just reserve horizontal space here and remember each one's start x.
        const clefEnd = stave.getNoteStartX();
        const drawSig = showSignature && cell.firstInRow && signature.length > 0;
        const drawTime = r === 0 && cell.firstInRow && timeSig != null;
        const sigStartX = clefEnd;
        const timeStartX = clefEnd + (drawSig ? sigWidth : 0);
        const reserved = (drawSig ? sigWidth : 0) + (drawTime ? timeSigWidth : 0);
        // Phase-2: fold-detected repeat signs. Barline types are stave modifiers; setting one
        // invalidates the stave's layout, so they must go BEFORE setNoteStartX — otherwise the
        // re-format on draw() recomputes the note start and the notes overlap the hand-drawn
        // signature/meter glyphs. (The volta brackets are hand-drawn SVG — see drawVolta — added
        // after the stave exists.)
        const repMarks = repeatMarksAt(cell.m.index, repeatSpans);
        if (repMarks.repStart) stave.setBegBarType(Barline.type.REPEAT_BEGIN);
        if (repMarks.repEnd) stave.setEndBarType(Barline.type.REPEAT_END);
        if (reserved > 0) {
          // getNoteStartX re-formats first, so this includes any begin-repeat barline's width.
          stave.setNoteStartX(stave.getNoteStartX() + reserved);
          // VexFlow places a begin-repeat `‖:` directly after the clef; push it past the reserved
          // glyph space so the engraved order stays clef → flats → meter → ‖: → notes.
          if (repMarks.repStart) {
            const bar = stave.getModifiers(StaveModifierPosition.BEGIN, Barline.CATEGORY)[0];
            bar?.setX(bar.getX() + reserved);
          }
        }
        // drawWithStyle (not draw) so the seeded staff-line weight is applied and then restored;
        // it also reaches the barlines, which thicken with the staff in real print.
        if (staffLineWidth != null) {
          stave.setStyle({ lineWidth: staffLineWidth });
          stave.setContext(ctx).drawWithStyle();
        } else {
          stave.setContext(ctx).draw();
        }
        if (svg && repMarks.volta1) drawVolta(svg, stave, "1.");
        if (svg && repMarks.volta2) drawVolta(svg, stave, "2.");
        if (svg && navMarks?.length) drawNavMarks(svg, stave, navMarksAt(cell.m.index, navMarks));
        // Playhead extent for this row, from the actual staff-line positions (the Stave's y
        // param is its bounding-box top, which sits well above the first staff line).
        const barTop = stave.getYForLine(0) - CURSOR_MARGIN;
        const barHeight = stave.getYForLine(4) - stave.getYForLine(0) + 2 * CURSOR_MARGIN;
        try {
          const { notes, slots, tuplets, tupletGroups, ties } = buildStaveNotes(cell.m, accidentalMode, signatureMap, sigTolerant);
          if (notes.length > 0) {
            // Beaming: a triplet's members must beam TOGETHER (one beam under the "3" bracket,
            // as engraved) — auto-beam groups by quarter-note beat and would split or absorb
            // them. So beams are built explicitly: one per tuplet group (over its beamable
            // notes), auto-generated groups for every stretch between tuplets. Beams must
            // exist BEFORE FormatAndDraw (they set the stems) and draw after it.
            const inTuplet = new Set(tuplets.flat());
            const beams: Beam[] = [];
            let run: StaveNote[] = [];
            const flushRun = () => {
              // A fresh config object per call: generateBeams writes its default groups into the
              // object it is handed, so a shared literal would leak one run's fallback into the next.
              if (run.length > 0) beams.push(...Beam.generateBeams(run, { ...beamConfig }));
              run = [];
            };
            for (const n of notes) {
              if (inTuplet.has(n)) flushRun();
              else run.push(n);
            }
            flushRun();
            const beamable = (n: StaveNote) => !n.isRest() && ["8", "16", "32", "64"].includes(n.getDuration());
            for (const group of tuplets) {
              let sub: StaveNote[] = [];
              const flushSub = () => {
                // autoStem=true: derive the group's stem direction from pitch (like
                // Beam.generateBeams does for plain runs) instead of VexFlow's default forced-up.
                // Forced-up made EVERY tuplet render stems-up → beam-above → "3" below; real
                // engravings (and printed Turkish scores) stem high passages down → "3" above.
                if (sub.length >= 2) beams.push(new Beam(sub, true));
                sub = [];
              };
              for (const n of group) {
                if (beamable(n)) sub.push(n);
                else flushSub();
              }
              flushSub();
            }
            // alignRests OFF: it shifts rests vertically toward the surrounding melody (a
            // multi-voice collision feature), floating them near the top line in this high
            // repertoire. Real single-voice engraving — and the printed sheets the OMR must
            // read — keeps rests centered at their standard staff position (b/4).
            Formatter.FormatAndDraw(ctx, stave, notes, { autoBeam: false, alignRests: false });
            beams.forEach((b) => b.setContext(ctx).draw());
            attachTitles(notes, slots.map((s) => s.ev));
            // Rhythm signs draw AFTER FormatAndDraw so the notes have positions: the "3" mark
            // over/under each triplet group (curved arc or square bracket per the piece style,
            // on the notehead side — see tupletAbove/drawTupletArc), and the tie arcs of split
            // long values. The mark always shows "3" (numNotes 3 / notesOccupied 2 = the 3:2
            // ratio) even for a mixed-value group, matching the `\tup3` label.
            tuplets.forEach((group, gi) => {
              const above = tupletAbove(group);
              // Which event this mark belongs to, and whether it is a REAL triplet or a broken one.
              // ⚠ Both are holdable (owner, 2026-08-30). A mark over one or two notes is a run that
              // never summed plain — the model's misread, drawn on purpose so a person can see it —
              // and being able to grab that one is the whole point of the ask. It is flagged rather
              // than hidden, so the page says which marks need attention.
              const pos = tupletGroups[gi]!;
              const closes = closedTupletAt(cell.m.events, pos.from) != null;
              const first = cell.m.events[memberPositions(cell.m.events, pos)[0]!]?.index ?? null;
              if (tupletCurved && svg) {
                // Drawn INTO a <g> so the mark can be measured with `getBBox()` — the same trick
                // `g[data-omr="aeu-sharp"]` already uses, and the only way the click target can sit
                // on the real ink rather than on a second copy of the mark's geometry. The wrapper
                // changes no pixels: the arc drawers only ever `appendChild`.
                const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                g.setAttribute("data-omr", "tuplet-mark");
                svg.appendChild(g);
                (legacyTupletMark
                  ? drawTupletArcLegacy
                  : tupletConcave
                    ? drawTupletArcConcave
                    : drawTupletArc)(g, group, above);
                if (first != null) markSlots.push({ evIndex: first, el: g, closes });
              } else {
                // The square bracket goes into a group WE open, so it is measured exactly like the
                // curved mark. ⚠ Not found by its `.vf-tuplet` class and not by document order:
                // every bundled score hashes to the arc, so a bracket page is code no check on this
                // machine has ever executed — the fewer of VexFlow's private conventions it leans
                // on, the better. `openGroup` is the render context's own API and applies no
                // transform, so the box comes back in the same space as everything else here.
                const g = svgCtx?.openGroup("tuplet-mark") ?? null;
                new Tuplet(group, {
                  numNotes: 3,
                  notesOccupied: 2,
                  bracketed: true,
                  ratioed: false,
                  location: above ? 1 : -1,
                })
                  .setContext(ctx)
                  .draw();
                svgCtx?.closeGroup();
                if (first != null && g) markSlots.push({ evIndex: first, el: g, closes });
              }
            });
            // Phrase-slur distractors: label-free arcs over runs of ≥3 consecutive non-tuplet,
            // non-rest notes (≥3 so they never resemble a 2-note tie), on a seeded ~35% of runs.
            // Teaches "arc without a '3' ≠ triplet" — the tup3-precision fix. Within one measure,
            // so a barline crop never bisects a slur. Never touches the label (pixels only).
            if (slurRng && svg) {
              let run: StaveNote[] = [];
              const trySlur = () => {
                if (run.length >= 3 && slurRng() < 0.35) {
                  const maxLen = Math.min(5, run.length);
                  const len = 3 + Math.floor(slurRng() * (maxLen - 2)); // 3..maxLen
                  const start = Math.floor(slurRng() * (run.length - len + 1));
                  const grp = run.slice(start, start + len);
                  drawSlurArc(svg, grp, tupletAbove(grp));
                }
                run = [];
              };
              for (const n of notes) {
                if (inTuplet.has(n) || n.isRest()) trySlur();
                else run.push(n);
              }
              trySlur();
            }
            // Dotted (usul) barlines: label-free rules on the usul's beat-group boundaries.
            // Onsets are counted off the DOCUMENT's own events (eventBeats, the arithmetic the
            // off-meter check uses), never off VexFlow ticks — a tuplet's written ticks do not sum
            // to the bar. A tie-split event keeps ONE onset, so a rule can never land between the
            // two halves of a single note.
            if (usulBarGroups && svg) {
              const onsets: number[] = [];
              let acc = 0;
              let seen: (typeof slots)[number]["ev"] | null = null;
              for (const slot of slots) {
                if (slot.ev !== seen) {
                  onsets.push(acc);
                  acc += eventBeats(slot.ev);
                  seen = slot.ev;
                } else {
                  onsets.push(onsets[onsets.length - 1] ?? 0);
                }
              }
              drawUsulBars(svg, stave, notes, onsets, usulBarGroups);
            }
            // Staccato distractors: label-free dots on the notehead side (see drawStaccatoDot).
            // Two passes, because they teach two different halves of the same rule.
            if (staccatoRng && svg) {
              const marked = new Set<StaveNote>();
              const mark = (n: StaveNote) => {
                if (marked.has(n) || n.isRest()) return;
                marked.add(n);
                drawStaccatoDot(svg, n);
              };
              // PASS 1 — the both-dots case, and the reason this distractor can work at all. A
              // notehead carrying an augmentation dot BESIDE it and a staccato ABOVE it is the only
              // example that isolates position from everything else: same ink, same note, one dot
              // lengthens and one does not. Deliberately sought out rather than left to chance,
              // because a run-based draw would hit dotted notes only occasionally and the contrast
              // is the whole lesson. Real editions print this constantly.
              for (const n of notes) {
                if (n.isRest()) continue;
                const dotted = n.getModifiers().some((m) => m instanceof Dot);
                if (dotted && staccatoRng() < STACCATO_RATE.dotted) mark(n);
              }
              // PASS 2 — ordinary phrase staccato, in RUNS, because real editions mark a phrase and
              // not a scattering of single notes. Within one measure, so a barline crop never cuts
              // a marked phrase in half (the same care drawSlurArc takes).
              let run: StaveNote[] = [];
              const tryStaccato = () => {
                if (run.length >= 2 && staccatoRng() < STACCATO_RATE.run) {
                  const maxLen = Math.min(4, run.length);
                  const len = 2 + Math.floor(staccatoRng() * (maxLen - 1)); // 2..maxLen
                  const start = Math.floor(staccatoRng() * (run.length - len + 1));
                  for (const n of run.slice(start, start + len)) mark(n);
                }
                run = [];
              };
              for (const n of notes) {
                if (n.isRest()) tryStaccato();
                else run.push(n);
              }
              tryStaccato();
            }
            for (const [a, b] of ties) {
              new StaveTie({ firstNote: a, lastNote: b, firstIndexes: [0], lastIndexes: [0] })
                .setContext(ctx)
                .draw();
            }
            // Record each event's drawn x + row so the playhead can follow it. getAbsoluteX is
            // only valid after FormatAndDraw has positioned the notes.
            const lyricY = stave.getYForLine(4) + LYRIC_DY;
            notes.forEach((n, i) => {
              const slot = slots[i]!;
              positions.push({ startMs: tMs, endMs: tMs + slot.durationMs, evIndex: slot.ev.index, x: n.getAbsoluteX(), top: barTop, height: barHeight });
              // The same walk records each note's clickable box for edit mode. VexFlow's own
              // bounding box covers notehead + stem + accidental; when it isn't available (the
              // try/catch in attachTitles shows some notes have no element) fall back to a small
              // box on the stave, which is still a usable click target.
              noteRects.push(noteBoxOf(n, slot.ev.index, barTop, barHeight));
              tMs += slot.durationMs;
              // Collect each note's lyric slot; the connectors (hyphens / melisma lines) need the
              // neighbours, so the actual drawing happens in one pass after the whole score is laid out.
              if (showLyrics) {
                const syl = slot.lyric?.trim() ?? "";
                const hold = syl === "" || syl === ".";
                lyricItems.push({ x: n.getAbsoluteX(), baseY: lyricY, row: r, text: hold ? "" : syl, hold, wordEnd: !!slot.ev.lyricWordEnd });
              }
            });
          }
          if (drawSig && svg) drawSignature(svg, stave, signature, sigStartX + 2);
          if (drawTime && svg && timeSig) drawTimeSignature(svg, stave, timeStartX + timeSigWidth / 2, timeSig);
        } catch (e) {
          console.warn(`sheet: failed to render measure ${cell.m.index}`, e);
        }
        collected.push({ index: cell.m.index, measure: cell.m, x, y, width: cell.width, topLineY: stave.getYForLine(0) });
        x += cell.width;
      }
    });

    if (showLyrics && svg) drawLyrics(svg, lyricItems, lyricHyphens);

    // Rung-2 distractor text (render automation only): seeded fake header/footer strings inside
    // the SVG, positioned per staff row so the strip crops capture them. Labels are unaffected.
    if (textNoise && svg) {
      for (const it of buildTextNoise(textNoise.seed, rows.length, showLyrics)) {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
        el.setAttribute("x", String(LEFT + it.fx * contentW));
        el.setAttribute("y", String(STAVE_TOP_PAD + it.row * ROW_HEIGHT + it.dy));
        el.setAttribute("font-size", String(it.size));
        el.setAttribute("font-family", it.serif ? "Georgia, 'Times New Roman', serif" : "Helvetica, Arial, sans-serif");
        if (it.italic) el.setAttribute("font-style", "italic");
        el.setAttribute("text-anchor", it.anchor);
        el.setAttribute("fill", "#000");
        el.textContent = it.text;
        svg.appendChild(el);
      }
    }

    // Last, so it catches BOTH VexFlow's inline accidentals and our own key-signature glyphs.
    if (thinSharps && svg) drawThinSharps(svg, STAFF_SPACE);

    setSvgHeight(height);
    setBoxes(collected);
    setNoteBoxes(noteRects);

    // The triplet marks' click targets, measured off the STROKES that were actually drawn (see
    // `markBoxOf` — the group's own box is not the ink, and two of its children lie about theirs).
    // The target therefore sits on the mark a reader sees, never on a second copy of its geometry
    // that could drift from it. All of it is in the SVG's user space, which is the overlay's space
    // too (the container is never transformed; see the .kv-score rule in CLAUDE.md).
    const markRects: TupletMarkBox[] = [];
    for (const slot of markSlots) {
      const b = markBoxOf(slot.el);
      if (b) markRects.push({ evIndex: slot.evIndex, closes: slot.closes, ...b });
    }
    // ── Did the drawing need more room than it was given? ──────────────────────────────────────
    //
    // ⚠ `getBBox()` is the union of what was DRAWN, in user units — the one number that knows about
    // every glyph the row estimate did not. It is 0 in a hidden box (a tab that is not on screen),
    // and a measurement taken from that would be nonsense, so a zero is left alone.
    //
    // Two outcomes. If the drawing overran the layout, WIDEN the layout by exactly the overrun and
    // let the effect run again — that is the pass which puts the notes inside their own staves.
    // Once it fits, scale the finished picture down so the stave spans the box.
    //
    // ⚠ **The size goes on the inline STYLE, not only the attributes.** VexFlow's own `resize()`
    // writes `style="width: …; height: …"`, an attribute cannot beat it, and the mismatch is not
    // silent: the viewBox scaled the content while the box kept its old height, so
    // `preserveAspectRatio` centred a 1040px drawing inside a 1190px box and left 75px of blank
    // above the first stave — the gap the owner photographed.
    //
    // ⚠ **A viewBox, NEVER a CSS transform, and never on `.kv-score`.** That container is the
    // training-strip source and `tools/render/render.ts` crops it by rect (docs/APP-RULES.md).
    // Scaling the SVG's own coordinate system is accounted for by every `getBoundingClientRect()`,
    // so the edit overlay's ink-measured hit boxes and the playhead keep landing where they look.
    //
    // ⚠ Gated on `contentWidth`, so the corpus path never reaches any of this: `render.ts` draws at
    // the default width, where nothing overruns.
    let applied = 1;
    if (fitBoxW != null && svg) {
      let drawnRight = 0;
      try {
        const bb = svg.getBBox();
        drawnRight = bb.x + bb.width;
      } catch {
        drawnRight = 0;
      }
      const need = drawnRight > 0 ? Math.ceil(drawnRight - svgW) : 0;
      if (need > 1 && fitExtra + need <= boxContentW) {
        // ⚠ The cap is the loop's bound: the layout may at most double before we stop asking.
        setFit({ key: fitKey, extra: fitExtra + need });
      } else {
        // ⚠ Past `MIN_FIT_SCALE` it stops shrinking and leaves the SVG wider than its box, so that
        // page scrolls sideways instead. Unreadably small is worse than a drag.
        const scale = Math.min(1, Math.max(MIN_FIT_SCALE, fitBoxW / svgW));
        if (scale < 1) {
          svg.setAttribute("viewBox", `0 0 ${svgW} ${height}`);
          svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
          svg.style.width = `${Math.round(svgW * scale)}px`;
          svg.style.height = `${Math.round(height * scale)}px`;
        }
        applied = scale;
        setFitScale(scale);
      }
    } else {
      setFitScale(1);
    }

    // ── ONE PLACE WHERE LOGICAL BECOMES RENDERED ───────────────────────────────────────────────
    //
    // ⭐ **EVERYTHING THE DRAW PUBLISHES IS IN RENDERED UNITS FROM HERE ON.** VexFlow works in the
    // layout's coordinates, and once a dense page is drawn smaller than its layout those are not
    // where the ink is. The overlay is built from these four arrays and nothing else, so this is
    // the only conversion — and it exists as one block on purpose: the same drift was fixed twice
    // in two days, once for the playhead and once for the note targets, because each consumer was
    // scaled where it was read instead of where it was made. A fifth consumer added later inherits
    // the fix by doing nothing.
    //
    // ⚠ Measured before it, at 393px on `meltem_notes` (87%): the click targets sat an average of
    // **55px** from their own noteheads and the worst **159px**, so tapping a note selected one up
    // and to the left of it. At scale 1 — every wide window, and `render.ts` — this loop does not
    // run at all.
    if (applied !== 1) {
      for (const b of collected) {
        b.x *= applied;
        b.y *= applied;
        b.width *= applied;
        b.topLineY *= applied;
      }
      for (const r of noteRects) {
        r.x *= applied;
        r.y *= applied;
        r.width *= applied;
        r.height *= applied;
      }
      for (const r of markRects) {
        r.x *= applied;
        r.y *= applied;
        r.width *= applied;
        r.height *= applied;
      }
      for (const q of positions) {
        q.x *= applied;
        q.top *= applied;
        q.height *= applied;
      }
    }

    setTupletMarks(markRects);
    positionsRef.current = positions;
    // Drawn position BY EVENT, for the folded score's playhead: it follows the performance, so it
    // asks "where is written note 42 drawn?", not "what did we draw 42nd?". Built here rather than
    // per frame — the draw is the only thing that can move a note.
    // ⚠ FIRST box wins: one event can be drawn as two noteheads, and the note starts at the first.
    posByEvRef.current = new Map();
    for (const p of positions) if (!posByEvRef.current.has(p.evIndex)) posByEvRef.current.set(p.evIndex, p);
    onLayout?.({
      boxes: collected.map((b) => ({ index: b.index, x: b.x, y: b.y, width: b.width })),
      // ⚠ The boxes above are in rendered units, so these are too — at scale 1 (the strip
      // exporter's only case) both are the logical numbers they always were.
      svgWidth: svgW * applied,
      svgHeight: height * applied,
      rowHeight: ROW_HEIGHT,
    });

    return () => {
      host.innerHTML = "";
    };
}
