import { useState } from "react";
import {
  ACCIDENTAL_VALUES as VALUES,
  accidentalChar,
  accidentalLongLabel as label,
  accidentalName,
} from "./ui/accidentals";

/**
 * Pitch-alteration picker: the user chooses how many commas sharp/flat, shown as the real
 * Bravura accidental symbol AND its Turkish name. A native <select> can't render the Bravura
 * glyph in its options, so this is a small custom dropdown.
 */
export function AccidentalSelect({ value, onChange }: { value: number; onChange: (commas: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="kv-btn" style={trigger}>
        <span className="kv-glyph" style={{ fontSize: 18, minWidth: 14, display: "inline-block" }}>{accidentalChar(value)}</span>
        <span>{accidentalName(value)}</span>
        <span style={{ color: "var(--ink-faint)", fontSize: 10, marginLeft: "auto" }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={overlay} />
          <ul style={menu}>
            {VALUES.map((commas) => (
              <li
                key={commas}
                onClick={() => { onChange(commas); setOpen(false); }}
                style={{ ...item, background: commas === value ? "var(--accent-soft)" : "transparent" }}
              >
                <span className="kv-glyph" style={{ fontSize: 18, width: 18, display: "inline-block", textAlign: "center" }}>{accidentalChar(commas)}</span>
                <span style={{ fontSize: "var(--text-sm)" }}>{label(commas)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const trigger: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, minWidth: 130, justifyContent: "flex-start",
};
const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 200 };
const menu: React.CSSProperties = {
  position: "absolute", top: "100%", left: 0, zIndex: 201, margin: "2px 0 0", padding: 4,
  listStyle: "none", background: "var(--paper-raised)", border: "1px solid var(--rule-strong)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow-card)", maxHeight: 280,
  overflowY: "auto", minWidth: 200,
};
const item: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "5px 8px",
  borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap",
};
