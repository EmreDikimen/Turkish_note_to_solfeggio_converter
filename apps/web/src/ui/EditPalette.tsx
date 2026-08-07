/**
 * The editor's armed-tool palette — Mus2's model, which is the one the owner already uses.
 *
 * You ARM a tool (a note value or an accidental) and then click the score; the click applies the
 * armed tool to the note it lands on. With nothing armed, a click selects and a drag moves the
 * pitch, exactly as before the palette existed. `Esc` disarms, and so does the Seçim button.
 *
 * ⚠ This renders BESIDE the score, never inside `.kv-score`: that container is screenshotted by
 * rect to cut training strips, so nothing of ours may set a font inside it or transform it.
 *
 * The deploy checks read state, never copy (CLAUDE.md): `#edit-palette` carries `data-armed` with
 * the armed tool's id, and every button carries `data-tool` + `aria-pressed`.
 */

import { useEffect } from "react";
import { PALETTE_ACCIDENTALS, accidentalChar, accidentalName } from "./accidentals";
import { TR } from "./strings";

/** What a click on a note does while this tool is armed. */
export type Tool =
  | { kind: "duration"; num: number; den: number }
  | { kind: "accidental"; alter: number };

/** The tool's stable id — what `data-tool` carries and what the smoke check arms by name. */
export function toolId(t: Tool): string {
  return t.kind === "duration" ? `dur:${t.num}/${t.den}` : `acc:${t.alter}`;
}

/**
 * Note values, longest → shortest, with the SMuFL codepoint each is drawn with (Bravura's
 * "individual notes" range: noteWhole, noteHalfUp, noteQuarterUp, note8thUp, note16thUp,
 * note32ndUp). The glyph is the label — a musician reads the notehead faster than "1/8".
 */
const DURATIONS: { num: number; den: number; cp: number }[] = [
  { num: 1, den: 1, cp: 0xe1d2 },
  { num: 1, den: 2, cp: 0xe1d3 },
  { num: 1, den: 4, cp: 0xe1d5 },
  { num: 1, den: 8, cp: 0xe1d7 },
  { num: 1, den: 16, cp: 0xe1d9 },
  { num: 1, den: 32, cp: 0xe1db },
];

export function EditPalette({ armed, onArm }: { armed: Tool | null; onArm: (t: Tool | null) => void }) {
  // Esc disarms. Bound while the palette is mounted, i.e. only in edit mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onArm(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onArm]);

  const armedId = armed ? toolId(armed) : null;
  const tool = (t: Tool, glyph: string, title: string, fontSize: number) => {
    const id = toolId(t);
    const on = id === armedId;
    return (
      <button
        key={id}
        type="button"
        data-tool={id}
        aria-pressed={on}
        title={title}
        className={`kv-tool${on ? " is-armed" : ""}`}
        // Toggle: clicking the armed tool disarms it, so there is always a way back to selection.
        onClick={() => onArm(on ? null : t)}
      >
        <span className="kv-glyph" style={{ fontSize }}>{glyph}</span>
      </button>
    );
  };

  return (
    <aside id="edit-palette" data-armed={armedId ?? undefined} className="kv-palette">
      <div className="kv-palette__group">
        <span className="kv-palette__label">{TR.palette.durations}</span>
        <div className="kv-palette__row">
          {DURATIONS.map((d) =>
            tool(
              { kind: "duration", num: d.num, den: d.den },
              String.fromCodePoint(d.cp),
              TR.palette.durationTitle(`${d.num}/${d.den}`),
              26,
            ),
          )}
        </div>
      </div>

      <div className="kv-palette__group">
        <span className="kv-palette__label">{TR.palette.accidentals}</span>
        <div className="kv-palette__row">
          {PALETTE_ACCIDENTALS.map((a) =>
            tool({ kind: "accidental", alter: a }, accidentalChar(a), TR.palette.accidentalTitle(accidentalName(a)), 22),
          )}
        </div>
      </div>

      <button
        id="palette-select"
        type="button"
        data-tool="none"
        aria-pressed={armed === null}
        className={`kv-tool kv-tool--wide${armed === null ? " is-armed" : ""}`}
        title={TR.palette.selectTitle}
        onClick={() => onArm(null)}
      >
        {TR.palette.select}
      </button>

      <p className="kv-palette__hint">{armed ? TR.palette.hintArmed : TR.palette.hintIdle}</p>
    </aside>
  );
}
