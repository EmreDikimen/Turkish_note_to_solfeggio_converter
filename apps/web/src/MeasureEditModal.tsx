import { useMemo, useRef, useState } from "react";
import {
  freqFromTuning,
  isMeasureValid,
  komaOf,
  komaToName,
  parseNoteName,
  spellNote,
  withDurationBeats,
  withPitch,
  type Measure,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { AccidentalSelect } from "./AccidentalSelect";
import { Segmented } from "./ui/Segmented";
import { TR } from "./ui/strings";

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
  // Grace notes (çarpma) aren't editable rows — they occupy no time and belong to the note that
  // follows them. Keep each one aside with its host's original index and re-insert on save, so an
  // edit round-trip can't corrupt them into zero-length real notes. A grace whose host note gets
  // deleted is dropped with it.
  const graces = useMemo(() => {
    const out: { grace: NoteEvent; hostIndex: number | null }[] = [];
    measure.events.forEach((ev, i) => {
      if (ev.kind !== "grace") return;
      const host = measure.events.slice(i + 1).find((e) => e.kind !== "grace");
      out.push({ grace: ev, hostIndex: host?.index ?? null });
    });
    return out;
  }, [measure]);
  const [rows, setRows] = useState<DraftRow[]>(() =>
    measure.events
      .filter((ev) => ev.kind !== "grace")
      .map((ev, i) => {
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
    // Every event in this measure keeps the measure's bar number, so the edited (and any new)
    // notes stay grouped in this bar even though their `offset` is now stale/unset.
    const bar = measure.events.find((e) => e.bar != null)?.bar;
    const events: NoteEvent[] = rows.map((r) => {
      // Pitch and duration go through core's shared edit primitives, so a note edited here and a
      // note edited on the sheet come out byte-identical (see packages/core/src/edits.ts).
      const base: NoteEvent = {
        index: r.origIndex ?? -1, kind: r.kind, koma53: -1, noteName: "Es", noteAE: "Es",
        durationMs: 0, durationBeats: { num: r.num, den: r.den }, freqHz: null,
        lyric: r.lyric, offset: 0, bar,
      };
      const timed = withDurationBeats(base, { num: r.num, den: r.den }, doc);
      if (r.kind === "rest") return timed;
      return withPitch(timed, { letter: r.letter, octave: r.octave, alter: r.alter }, doc.tuning);
    });
    // Re-insert the preserved grace notes, each right before its (surviving) host note.
    const withGraces: NoteEvent[] = [];
    for (const e of events) {
      for (const g of graces) {
        if (g.hostIndex != null && g.hostIndex === e.index) withGraces.push({ ...g.grace, bar });
      }
      withGraces.push(e);
    }
    onSave(withGraces);
  }

  return (
    <div onClick={onCancel} className="kv-modal">
      <div onClick={(e) => e.stopPropagation()} className="kv-modal__panel kv-modal__panel--wide" role="dialog">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="kv-modal__title">{TR.measureModal.title(measure.index)}</h3>
          <Segmented
            value={advanced ? "advanced" : "basic"}
            onChange={(v) => setAdvanced(v === "advanced")}
            items={[
              { value: "basic", label: TR.measureModal.basic },
              { value: "advanced", label: TR.measureModal.advanced },
            ]}
          />
        </div>
        <p className="kv-modal__lead">
          {TR.measureModal.leadBasic}
          {advanced ? ` ${TR.measureModal.leadAdvanced}` : ""}
          {graces.length > 0 ? ` ${TR.measureModal.leadGrace}` : ""}
        </p>

        <table className="kv-table">
          <thead>
            <tr>
              <th>{TR.measureModal.colType}</th><th>{TR.measureModal.colNote}</th><th>{TR.measureModal.colAccidental}</th>
              {advanced && <th>{TR.measureModal.colKoma}</th>}
              {advanced && <th>{TR.measureModal.colHz}</th>}
              <th>{TR.measureModal.colName}</th><th>{TR.measureModal.colDuration}</th><th>{TR.measureModal.colLyric}</th><th></th>
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
                  <td>
                    <select value={r.kind} onChange={(e) => patch(r.id, { kind: e.target.value as "note" | "rest" })}>
                      <option value="note">{TR.measureModal.note}</option>
                      <option value="rest">{TR.measureModal.rest}</option>
                    </select>
                  </td>
                  <td>
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
                  <td>
                    {isNote ? <AccidentalSelect value={r.alter} onChange={(commas) => patch(r.id, { alter: commas })} /> : "—"}
                  </td>
                  {advanced && (
                    <td>
                      <input type="number" value={koma} disabled={!isNote} style={{ width: 60 }}
                        onChange={(e) => setFromKoma(r.id, parseInt(e.target.value, 10) || koma)} />
                    </td>
                  )}
                  {advanced && (
                    <td>
                      <input type="number" value={Math.round(freqFromTuning(koma, doc.tuning))} disabled={!isNote} style={{ width: 74 }}
                        onChange={(e) => setFromKoma(r.id, komaFromHz(parseFloat(e.target.value) || freqFromTuning(koma, doc.tuning)))} />
                    </td>
                  )}
                  <td style={{ fontFamily: "var(--font-mono)" }}>{isNote ? spellNote(r.letter, r.octave, r.alter) : "—"}</td>
                  <td>
                    <select value={durValue} onChange={(e) => { const [, n, d] = presets.find(([label]) => label === e.target.value)!; patch(r.id, { num: n, den: d }); }}>
                      {presets.map(([label]) => <option key={label} value={label}>{label}</option>)}
                    </select>
                  </td>
                  <td>
                    <input value={r.lyric} style={{ width: 70 }} onChange={(e) => patch(r.id, { lyric: e.target.value })} />
                  </td>
                  <td>
                    <button type="button" className="kv-btn kv-btn--tiny" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} title={TR.measureModal.remove}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <button type="button" className="kv-btn" onClick={addNote}>{TR.measureModal.add}</button>
          <span style={{ color: valid ? "var(--ok)" : "var(--danger)", fontSize: "var(--text-sm)" }}>
            {TR.measureModal.total(fmt(totalBeats), fmt(measure.lengthBeats))}
          </span>
        </div>

        {!valid && (
          <div style={{ color: "var(--danger)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
            {TR.measureModal.invalid}
          </div>
        )}

        <div className="kv-modal__actions">
          <button type="button" className="kv-btn" onClick={onCancel}>{TR.measureModal.cancel}</button>
          <button type="button" className="kv-btn kv-btn--primary" onClick={save} disabled={!valid}>
            {TR.measureModal.save}
          </button>
        </div>
      </div>
    </div>
  );
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

