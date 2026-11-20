/** The accidental legend under the score. Split out of SheetView.tsx on 2026-11-20, unchanged. */
import { accidentalGlyph, accidentalLabel } from "@turkish-omr/core";

export function Legend({ used }: { used: number[] }) {
  if (used.length === 0) return null;
  return (
    <div
      style={{
        display: "flex", gap: 16, flexWrap: "wrap", padding: "var(--space-3) var(--space-2) 0",
        marginTop: "var(--space-3)", borderTop: "1px solid var(--rule)",
        color: "var(--ink-soft)", fontSize: "var(--text-sm)",
      }}
    >
      <span style={{ color: "var(--ink-faint)" }}>Değiştirme işaretleri:</span>
      {used.map((commas) => {
        const g = accidentalGlyph(commas);
        return (
          <span key={commas} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {g && <span className="kv-glyph" style={{ fontSize: 22 }}>{String.fromCodePoint(g.codepoint)}</span>}
            {accidentalLabel(commas)} ({commas > 0 ? `+${commas}` : commas} koma)
          </span>
        );
      })}
    </div>
  );
}
