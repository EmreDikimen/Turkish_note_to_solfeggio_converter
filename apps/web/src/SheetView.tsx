import { useMemo, useState } from "react";
import {
  accidentalGlyph,
  accidentalLabel,
  groupMeasures,
  parseNoteName,
  type Measure,
  type NoteModelDocument,
} from "@turkish-omr/core";

// --- layout constants -------------------------------------------------------
const STAFF_SPACE = 12; // distance between two staff lines
const GLYPH_SIZE = 4 * STAFF_SPACE; // Bravura glyphs are designed on a 4-space em
const LEFT_MARGIN = 56; // room for the clef
const CONTENT_WIDTH = 980;
const ROW_HEIGHT = 200;
const BOTTOM_LINE_D = 30; // diatonic value of E4 = treble-clef bottom line
const BOTTOM_LINE_Y = 150; // y of that line within a row
const TOP_LINE_D = 38; // F5 = top line

// SMuFL code points used directly here (clef). Accidentals come from notation.accidentalGlyph.
const G_CLEF = 0xe050;
const char = (cp: number) => String.fromCodePoint(cp);

// Diatonic value -> y within a row (higher pitch = smaller y).
const yOfD = (d: number) => BOTTOM_LINE_Y - (d - BOTTOM_LINE_D) * (STAFF_SPACE / 2);

// Ledger-line diatonic positions needed for a note outside the staff.
function ledgerDs(d: number): number[] {
  const out: number[] = [];
  for (let L = TOP_LINE_D + 2; L <= d; L += 2) out.push(L); // above staff
  for (let L = BOTTOM_LINE_D - 2; L >= d; L -= 2) out.push(L); // below staff
  return out;
}

interface Placed {
  measure: Measure;
  row: number;
  x: number;
  width: number;
}

/**
 * Sheet-music (notation) view. Renders the score as wrapped 5-line staves with real Turkish
 * accidental glyphs from the Bravura font. In edit mode, each measure is clickable to open the
 * per-measure editor. Staff layout is custom; accidental/clef glyphs come from Bravura.
 */
export function SheetView({
  doc,
  editMode,
  onMeasureClick,
}: {
  doc: NoteModelDocument;
  editMode: boolean;
  onMeasureClick: (m: Measure) => void;
}) {
  const [hoverMeasure, setHoverMeasure] = useState<number | null>(null);

  // Pack measures into rows (greedy wrap). measureWidth grows with note count.
  const { placed, rowCount, rowEndX } = useMemo(() => {
    const measures = groupMeasures(doc);
    const placed: Placed[] = [];
    const rowEndX: number[] = [];
    let row = 0;
    let x = LEFT_MARGIN;
    for (const m of measures) {
      const width = Math.max(90, Math.min(360, m.events.length * 24 + 20));
      if (x + width > LEFT_MARGIN + CONTENT_WIDTH && x > LEFT_MARGIN) {
        rowEndX[row] = x;
        row += 1;
        x = LEFT_MARGIN;
      }
      placed.push({ measure: m, row, x, width });
      x += width;
      rowEndX[row] = x;
    }
    return { placed, rowCount: row + 1, rowEndX };
  }, [doc]);

  // Distinct accidentals used, for the legend.
  const usedAccidentals = useMemo(() => {
    const set = new Set<number>();
    for (const ev of doc.events) {
      if (ev.kind !== "note") continue;
      const p = parseNoteName(ev.noteName);
      if (p && p.alterCommas !== 0) set.add(p.alterCommas);
    }
    return [...set].sort((a, b) => a - b);
  }, [doc]);

  const totalHeight = rowCount * ROW_HEIGHT + 16;
  const svgWidth = LEFT_MARGIN + CONTENT_WIDTH + 24;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, overflowX: "auto", background: "#fff" }}>
      <svg width={svgWidth} height={totalHeight} style={{ display: "block" }}>
        {Array.from({ length: rowCount }, (_, r) => {
          const top = r * ROW_HEIGHT + 8;
          const endX = rowEndX[r] ?? LEFT_MARGIN;
          return (
            <g key={r} transform={`translate(0, ${top})`}>
              {/* staff lines */}
              {[30, 32, 34, 36, 38].map((d) => (
                <line key={d} x1={LEFT_MARGIN} y1={yOfD(d)} x2={endX} y2={yOfD(d)} stroke="#333" strokeWidth={1} />
              ))}
              {/* clef */}
              <text x={10} y={yOfD(32)} fontFamily="Bravura" fontSize={GLYPH_SIZE} fill="#222">
                {char(G_CLEF)}
              </text>
              {placed
                .filter((p) => p.row === r)
                .map((p) => (
                  <Measure
                    key={p.measure.index}
                    p={p}
                    editMode={editMode}
                    hovered={hoverMeasure === p.measure.index}
                    onEnter={() => setHoverMeasure(p.measure.index)}
                    onLeave={() => setHoverMeasure(null)}
                    onClick={() => editMode && onMeasureClick(p.measure)}
                  />
                ))}
            </g>
          );
        })}
      </svg>

      <Legend used={usedAccidentals} />
    </div>
  );
}

function Measure({
  p,
  editMode,
  hovered,
  onEnter,
  onLeave,
  onClick,
}: {
  p: Placed;
  editMode: boolean;
  hovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const { measure, x, width } = p;
  const count = measure.events.length || 1;
  const slot = (width - 20) / count;
  const staffTop = yOfD(38) - 4;
  const staffBottom = yOfD(30) + 4;

  return (
    <g>
      {/* clickable / hover region (edit mode) */}
      {editMode && (
        <rect
          x={x}
          y={4}
          width={width}
          height={ROW_HEIGHT - 24}
          fill={hovered ? "rgba(59,130,246,0.08)" : "transparent"}
          stroke={hovered ? "#3b82f6" : "transparent"}
          style={{ cursor: "pointer" }}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onClick={onClick}
        />
      )}

      {measure.events.map((ev, i) => {
        const cx = x + 14 + i * slot + slot / 2;
        if (ev.kind === "rest") {
          return (
            <g key={ev.index} pointerEvents="none">
              <rect x={cx - 4} y={yOfD(34) - 3} width={8} height={6} fill="#999" />
              <title>rest · {ev.durationMs} ms</title>
            </g>
          );
        }
        const parsed = parseNoteName(ev.noteName);
        if (!parsed) return null;
        const ny = yOfD(parsed.diatonic);
        const acc = parsed.alterCommas !== 0 ? accidentalGlyph(parsed.alterCommas) : null;
        return (
          <g key={ev.index} pointerEvents="none">
            {ledgerDs(parsed.diatonic).map((L) => (
              <line key={L} x1={cx - 9} y1={yOfD(L)} x2={cx + 9} y2={yOfD(L)} stroke="#333" strokeWidth={1} />
            ))}
            {acc && (
              <text
                x={cx - 13}
                y={ny}
                fontFamily="Bravura"
                fontSize={GLYPH_SIZE}
                fill="#222"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {char(acc.codepoint)}
              </text>
            )}
            <ellipse cx={cx} cy={ny} rx={5.5} ry={4.2} fill="#1f2937" />
            <title>
              {ev.noteName} · {(ev.freqHz ?? 0).toFixed(1)} Hz · {ev.durationMs} ms
              {parsed.alterCommas !== 0 ? ` · ${accidentalLabel(parsed.alterCommas)}` : ""}
            </title>
          </g>
        );
      })}

      {/* barline at measure end */}
      <line x1={x + width} y1={staffTop} x2={x + width} y2={staffBottom} stroke="#333" strokeWidth={1} />
    </g>
  );
}

function Legend({ used }: { used: number[] }) {
  if (used.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "8px 12px", borderTop: "1px solid #eee", color: "#555", fontSize: 13 }}>
      <span style={{ color: "#999" }}>Accidentals:</span>
      {used.map((commas) => {
        const g = accidentalGlyph(commas);
        return (
          <span key={commas} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {g && <span style={{ fontFamily: "Bravura", fontSize: 22, lineHeight: 1 }}>{char(g.codepoint)}</span>}
            {accidentalLabel(commas)} ({commas > 0 ? `+${commas}` : commas} koma)
          </span>
        );
      })}
    </div>
  );
}
