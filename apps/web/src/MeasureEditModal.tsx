import { useMemo, useRef, useState } from "react";
import {
  beatsToMs,
  freqFromTuning,
  isMeasureValid,
  komaOf,
  komaToName,
  parseNoteName,
  spellNote,
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { AccidentalSelect } from "./AccidentalSelect";

// Common note-values offered in the duration dropdown.
const DURATIONS: Array<[string, number, number]> = [
  ["1/1", 1, 1], ["1/2", 1, 2], ["1/4", 1, 4],
  ["1/8", 1, 8], ["1/16", 1, 16], ["1/32", 1, 32],
];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

interface DraftRow {
  id: number;
  kind: "note" | "rest";
  // Pitch as an explicit spelling (notes only): base letter + octave + comma alteration.
  // Storing the spelling (not the absolute koma) means the user's choice of accidental is
  // preserved exactly, and the displayed/saved name never enharmonically flips.
  letter: string;
  octave: number;
  alter: number;
  num: number;
  den: number;
  lyric: string;
  origIndex: number | null;
}

/**
 * Per-measure editor. Basic tab: pick each note's base pitch and how many commas sharp/flat
 * (shown with the real Bravura symbol + Turkish name), its duration, and add/delete rows.
 * Advanced tab additionally exposes the absolute koma and frequency (Hz). The measure's total
 * duration must equal its original length or Save is disabled and a warning shows.
 */
export function MeasureEditModal({
  measure,
  doc,
  onSave,
  onCancel,
}: {
  measure: Measure;
  doc: NoteModelDocument;
  onSave: (events: NoteEvent[]) => void;
  onCancel: () => void;
}) {
  const nextId = useRef(measure.events.length + 1);
  const [advanced, setAdvanced] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>(() =>
    measure.events.map((ev, i) => {
      const p = ev.kind === "note" ? parseNoteName(ev.noteName) : null;
      return {
        id: i,
        kind: ev.kind === "rest" ? "rest" : "note",
        letter: p?.letter ?? "A",
        octave: p?.octave ?? 4,
        alter: p?.alterCommas ?? 0,
        num: ev.durationBeats.num,
        den: ev.durationBeats.den || 1,
        lyric: ev.lyric,
        origIndex: ev.index,
      };
    }),
  );

  // Octave range for the base-note dropdown, derived from the piece (padded a bit).
  const octaves = useMemo(() => {
    const os = doc.events
      .filter((e) => e.kind === "note")
      .map((e) => parseNoteName(e.noteName)?.octave)
      .filter((o): o is number => o != null);
    const lo = Math.min(4, ...os) - 1;
    const hi = Math.max(5, ...os) + 1;
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [doc]);

  const totalBeats = useMemo(() => rows.reduce((s, r) => s + r.num / r.den, 0), [rows]);
  const valid = isMeasureValid(
    rows.map((r) => ({ durationBeats: { num: r.num, den: r.den } }) as NoteEvent),
    measure.lengthBeats,
  );

  const patch = (id: number, p: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  // Advanced edits set an absolute koma (from a koma field or a Hz field); we derive a
  // reasonable spelling so the Basic-tab pickers and the staff stay consistent.
  function setFromKoma(id: number, koma: number) {
    const p = parseNoteName(komaToName(koma, "solfege"));
    if (p) patch(id, { letter: p.letter, octave: p.octave, alter: p.alterCommas });
  }
  const komaFromHz = (hz: number) =>
    Math.round(doc.tuning.refKoma + doc.tuning.commasPerOctave * Math.log2(hz / doc.tuning.refFreqHz));

  function addNote() {
    const last = rows[rows.length - 1];
    setRows((rs) => [
      ...rs,
      { id: nextId.current++, kind: "note", letter: last?.letter ?? "A", octave: last?.octave ?? 4, alter: 0, num: 1, den: 16, lyric: "", origIndex: null },
    ]);
  }

  function save() {
    const events: NoteEvent[] = rows.map((r) => {
      const durationMs = beatsToMs(r.num, r.den, doc);
      const durationBeats = { num: r.num, den: r.den };
      if (r.kind === "rest") {
        return { index: r.origIndex ?? -1, kind: "rest", koma53: -1, noteName: "Es", noteAE: "Es", durationMs, durationBeats, freqHz: null, lyric: r.lyric, offset: 0 };
      }
      const koma = komaOf(r.letter, r.octave, r.alter);
      return {
        index: r.origIndex ?? -1, kind: "note", koma53: koma,
        noteName: spellNote(r.letter, r.octave, r.alter, "solfege"),
        noteAE: spellNote(r.letter, r.octave, r.alter, "western"),
        durationMs, durationBeats,
        freqHz: Math.round(freqFromTuning(koma, doc.tuning) * 1e4) / 1e4,
        lyric: r.lyric, offset: 0,
      };
    });
    onSave(events);
  }

  return (
    <div onClick={onCancel} style={backdrop}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: "0 0 4px" }}>Edit measure {measure.index}</h3>
          <span style={{ display: "inline-flex", border: "1px solid #ccc", borderRadius: 6, overflow: "hidden" }}>
            <TabButton active={!advanced} onClick={() => setAdvanced(false)}>Basic</TabButton>
            <TabButton active={advanced} onClick={() => setAdvanced(true)}>Advanced</TabButton>
          </span>
        </div>
        <div style={{ color: "#666", fontSize: 13, margin: "4px 0 12px" }}>
          Choose each note's pitch and how many commas sharp/flat. Total duration must equal the
          measure length.{advanced ? " Advanced: edit absolute koma / frequency directly." : ""}
        </div>

        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888" }}>
              <th style={th}>Type</th><th style={th}>Note</th><th style={th}>Accidental</th>
              {advanced && <th style={th}>Koma</th>}
              {advanced && <th style={th}>Hz</th>}
              <th style={th}>Name</th><th style={th}>Duration</th><th style={th}>Lyric</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isNote = r.kind === "note";
              const koma = komaOf(r.letter, r.octave, r.alter);
              const durValue = `${r.num}/${r.den}`;
              const presets = DURATIONS.some(([, n, d]) => n === r.num && d === r.den)
                ? DURATIONS : [[durValue, r.num, r.den] as [string, number, number], ...DURATIONS];
              return (
                <tr key={r.id}>
                  <td style={td}>
                    <select value={r.kind} onChange={(e) => patch(r.id, { kind: e.target.value as "note" | "rest" })}>
                      <option value="note">note</option>
                      <option value="rest">rest</option>
                    </select>
                  </td>
                  <td style={td}>
                    {isNote ? (
                      <select
                        value={`${r.letter}_${r.octave}`}
                        onChange={(e) => { const [L, o] = e.target.value.split("_"); patch(r.id, { letter: L!, octave: parseInt(o!, 10) }); }}
                      >
                        {octaves.flatMap((o) => LETTERS.map((L) => (
                          <option key={`${L}_${o}`} value={`${L}_${o}`}>{spellNote(L, o, 0, "solfege")}</option>
                        )))}
                      </select>
                    ) : "—"}
                  </td>
                  <td style={td}>
                    {isNote ? <AccidentalSelect value={r.alter} onChange={(commas) => patch(r.id, { alter: commas })} /> : "—"}
                  </td>
                  {advanced && (
                    <td style={td}>
                      <input type="number" value={koma} disabled={!isNote} style={{ width: 60 }}
                        onChange={(e) => setFromKoma(r.id, parseInt(e.target.value, 10) || koma)} />
                    </td>
                  )}
                  {advanced && (
                    <td style={td}>
                      <input type="number" value={Math.round(freqFromTuning(koma, doc.tuning))} disabled={!isNote} style={{ width: 74 }}
                        onChange={(e) => setFromKoma(r.id, komaFromHz(parseFloat(e.target.value) || freqFromTuning(koma, doc.tuning)))} />
                    </td>
                  )}
                  <td style={{ ...td, fontFamily: "monospace" }}>{isNote ? spellNote(r.letter, r.octave, r.alter) : "—"}</td>
                  <td style={td}>
                    <select value={durValue} onChange={(e) => { const [, n, d] = presets.find(([label]) => label === e.target.value)!; patch(r.id, { num: n, den: d }); }}>
                      {presets.map(([label]) => <option key={label} value={label}>{label}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <input value={r.lyric} style={{ width: 70 }} onChange={(e) => patch(r.id, { lyric: e.target.value })} />
                  </td>
                  <td style={td}>
                    <button onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} title="delete">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <button onClick={addNote}>+ Add note</button>
          <span style={{ color: valid ? "#16a34a" : "#dc2626", fontSize: 13 }}>
            Total {fmt(totalBeats)} / required {fmt(measure.lengthBeats)} whole-notes
          </span>
        </div>

        {!valid && (
          <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>
            ⚠ The notes don't fill the measure exactly — adjust durations (or add/remove notes)
            so the total matches before saving.
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={save} disabled={!valid} style={{ fontWeight: 600 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ border: "none", padding: "5px 12px", background: active ? "#3b82f6" : "#fff", color: active ? "#fff" : "#333", cursor: "pointer", fontSize: 13 }}>
      {children}
    </button>
  );
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};
const panel: React.CSSProperties = {
  background: "#fff", borderRadius: 8, padding: 20, width: 720, maxWidth: "94vw",
  maxHeight: "85vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
  fontFamily: "system-ui, sans-serif",
};
const th: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid #f4f4f4" };
