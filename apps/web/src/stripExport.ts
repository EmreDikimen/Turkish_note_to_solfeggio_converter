/**
 * Step-2c strip exporter (browser side). Turns SheetView's per-measure layout geometry into
 * **crop rectangles + matching LilyPond labels** for training strips — reusing the verified engraving
 * (we crop the real render) and the serializer/decoder in `tools/render`.
 *
 * Modes (labels are FAITHFUL — they mark exactly what each mode draws; see lilypond.ts):
 *  - `"every"`  — score drawn with every accidental inline (no signature) → a crop anywhere is
 *                 self-contained, so we emit every chunk of every row. Labels mark every alteration.
 *  - `"keysig"` — score drawn with the makam signature at each row start → only a crop that includes
 *                 the row start has the signature in frame, so we emit just the first chunk of each
 *                 row. Labels mark deviations/`\natural` only and are prefixed with the printed
 *                 signature (`\sig … \sigend`), so the model learns to READ the signature.
 */

import { deriveKeySignature, groupMeasures, type Measure, type NoteModelDocument } from "@turkish-omr/core";
// tools/render lives at the repo root; Vite (dev fs.allow = workspace root) + the bundler resolve it.
import {
  serializeMeasure,
  serializeMeasures,
  serializeSignature,
  type SignatureMap,
} from "../../../tools/render/lilypond";
import { decodePretty } from "../../../tools/render/decode";
import { repeatMarksAt, type RepeatSpan } from "../../../tools/render/repeats";

/** One measure's on-screen rectangle, as reported by SheetView's `onLayout`. */
export interface LayoutBox {
  index: number;
  x: number;
  y: number;
  width: number;
}

export interface StripMode {
  mode: "every" | "keysig";
}

/** A strip ready to crop + label. `rect` is in the SVG's coordinate space (= CSS px within the SVG). */
export interface ExportStrip {
  id: string;
  fromMeasure: number;
  toMeasure: number;
  label: string;
  decoded: string;
  rect: { x: number; y: number; width: number; height: number };
}

// Vertical crop window around a row's stave top (`box.y`), capturing staff lines + stems/beams.
// SheetView's `box.y` sits above the first staff line (STAVE_TOP_PAD headroom), so we start a touch
// above it and take enough height for high/low notes without bleeding into the next row.
const PAD_TOP = 6;
const STAFF_H = 112;

/** Group consecutive same-row measures into strips, with crop rect + label + decoded notes. */
export function buildStrips(
  doc: NoteModelDocument,
  boxes: LayoutBox[],
  mode: "every" | "keysig",
  // Fold-detected repeat spans (must be the SAME ones SheetView draws): the labels then carry the
  // repeat tokens at the drawn positions. Undefined/empty = no repeat signs on the sheet.
  repeatSpans?: RepeatSpan[],
  { maxMeasures = 3, maxTokens = 46 }: { maxMeasures?: number; maxTokens?: number } = {},
): ExportStrip[] {
  const byIndex = new Map(groupMeasures(doc).map((m) => [m.index, m]));

  // keysig mode: the signature drawn at each row start — must be derived from the SAME doc
  // SheetView renders, so the label decisions equal the draw decisions (faithful scheme).
  const sigEntries = mode === "keysig" ? deriveKeySignature(doc) : [];
  const sigMap: SignatureMap =
    mode === "keysig" ? new Map(sigEntries.map((e) => [e.letter, e.alterCommas])) : undefined;
  const sigPrefix = mode === "keysig" ? serializeSignature(sigEntries) : null;

  // Split the (index-ordered) boxes into rows by their y coordinate.
  const ordered = [...boxes].sort((a, b) => a.index - b.index);
  const rows: LayoutBox[][] = [];
  let curRow: LayoutBox[] = [];
  let curY: number | null = null;
  for (const b of ordered) {
    if (curY !== null && Math.abs(b.y - curY) > 1) {
      rows.push(curRow);
      curRow = [];
    }
    curRow.push(b);
    curY = b.y;
  }
  if (curRow.length) rows.push(curRow);

  const out: ExportStrip[] = [];
  for (const row of rows) {
    // Pack the row's measures into chunks under the measure/token budget. In keysig mode the first
    // chunk (the only one kept) also carries the `\sig … \sigend` prefix, so seed its token count
    // with the prefix cost — the whole label must fit the decoder budget.
    const chunks: LayoutBox[][] = [];
    let chunk: LayoutBox[] = [];
    let tokens = sigPrefix ? sigPrefix.tokens : 0;
    for (const b of row) {
      const m = byIndex.get(b.index);
      // Measure cost = its notes + any repeat tokens drawn on it (begin/end barline, volta).
      const marks = repeatMarksAt(b.index, repeatSpans);
      const repCost = (marks.repStart ? 1 : 0) + (marks.repEnd ? 1 : 0) + (marks.volta1 ? 1 : 0) + (marks.volta2 ? 1 : 0);
      const t = (m ? serializeMeasure(m, sigMap).tokens : 0) + repCost;
      if (chunk.length > 0 && (chunk.length >= maxMeasures || tokens + t + 1 > maxTokens)) {
        chunks.push(chunk);
        chunk = [];
        tokens = 0; // later chunks have no sig prefix (and are dropped in keysig mode anyway)
      }
      chunk.push(b);
      tokens += chunk.length === 1 ? t : t + 1;
    }
    if (chunk.length) chunks.push(chunk);

    // keysig strips must include the row start → keep only the first chunk of each row.
    const keep = mode === "keysig" ? chunks.slice(0, 1) : chunks;
    for (const [ci, c] of keep.entries()) {
      const ms = c.map((b) => byIndex.get(b.index)).filter((m): m is Measure => !!m);
      if (ms.length === 0) continue;
      const body = serializeMeasures(ms, sigMap, repeatSpans).label;
      // Row-start crop (first chunk) in keysig mode shows the printed signature → prefix it.
      const label = sigPrefix && ci === 0 ? `${sigPrefix.label} ${body}` : body;
      const first = c[0]!;
      const last = c[c.length - 1]!;
      out.push({
        id: `m${first.index}-${last.index}`,
        fromMeasure: first.index,
        toMeasure: last.index,
        label,
        decoded: decodePretty(label),
        rect: {
          x: first.x,
          y: first.y - PAD_TOP,
          width: last.x + last.width - first.x,
          height: STAFF_H,
        },
      });
    }
  }
  return out;
}
