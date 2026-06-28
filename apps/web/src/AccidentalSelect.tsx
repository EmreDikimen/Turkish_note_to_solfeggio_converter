import { useState } from "react";
import { accidentalGlyph, accidentalLabel } from "@turkish-omr/core";

// Accidentals offered in the EDITOR, low pitch → high pitch — the full range incl. the numbered
// ±2/±3, so the user can see and set the exact comma they want. (The engraved staff snaps these to
// the standard AEU signs; the editor does not.) Natural = 0.
const VALUES = [-8, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 8];
const NATURAL_CP = 0xe261;
const char = (cp: number) => String.fromCodePoint(cp);

function glyphCp(commas: number): number {
  if (commas === 0) return NATURAL_CP;
  return accidentalGlyph(commas)?.codepoint ?? NATURAL_CP;
}
function label(commas: number): string {
  return commas === 0 ? "doğal (natural)" : `${accidentalLabel(commas)} (${commas > 0 ? `+${commas}` : commas})`;
}

/**
 * Pitch-alteration picker: the user chooses how many commas sharp/flat, shown as the real
 * Bravura accidental symbol AND its Turkish name. A native <select> can't render the Bravura
 * glyph in its options, so this is a small custom dropdown.
 */
export function AccidentalSelect({ value, onChange }: { value: number; onChange: (commas: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((o) => !o)} style={trigger}>
        <span style={{ fontFamily: "Bravura", fontSize: 18, minWidth: 14, display: "inline-block" }}>{char(glyphCp(value))}</span>
        <span style={{ fontSize: 12 }}>{value === 0 ? "doğal" : accidentalLabel(value)}</span>
        <span style={{ color: "#999", fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={overlay} />
          <ul style={menu}>
            {VALUES.map((commas) => (
              <li
                key={commas}
                onClick={() => { onChange(commas); setOpen(false); }}
                style={{ ...item, background: commas === value ? "#eef4ff" : "transparent" }}
              >
                <span style={{ fontFamily: "Bravura", fontSize: 18, width: 18, display: "inline-block", textAlign: "center" }}>{char(glyphCp(commas))}</span>
                <span style={{ fontSize: 13 }}>{label(commas)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const trigger: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px",
  border: "1px solid #ccc", borderRadius: 4, background: "#fff", cursor: "pointer", minWidth: 130, justifyContent: "flex-start",
};
const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 200 };
const menu: React.CSSProperties = {
  position: "absolute", top: "100%", left: 0, zIndex: 201, margin: "2px 0 0", padding: 4,
  listStyle: "none", background: "#fff", border: "1px solid #ccc", borderRadius: 6,
  boxShadow: "0 6px 20px rgba(0,0,0,0.15)", maxHeight: 280, overflowY: "auto", minWidth: 200,
};
const item: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "5px 8px", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
};
