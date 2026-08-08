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
 * It also carries its own Çal/Dur, which plays from the LAST EDITED BAR. That is not a duplicate of
 * the transport above: in edit mode a click on the sheet selects or inserts, so click-a-bar-to-play
 * is switched off, and this is what replaces it — fix a note, press Çal, hear the bar.
 *
 * The deploy checks read state, never copy (CLAUDE.md): `#edit-palette` carries `data-armed` with
 * the armed tool's id and `data-play-from` with the bar Çal would start from, and every button
 * carries `data-tool` + `aria-pressed`.
 * ⚠ `#palette-play` carries `data-play-state`, which the transport's `#play` ALSO carries — the
 * same two-elements trap `data-edit-mode` has. A check must name the one it means by id.
 */

import { useEffect } from "react";
import { ACCIDENTAL_VALUES, accidentalCp, accidentalLongLabel } from "./accidentals";
import { TR } from "./strings";

/** What a click on a note does while this tool is armed.
 *
 *  A REST is the same tool as a note value with `rest: true`, not a separate kind: it inserts and
 *  re-values through exactly the same paths, and the only difference is which shape of event comes
 *  out. That keeps "arm a thing, click a target" true of the whole palette. */
export type Tool =
  | { kind: "duration"; num: number; den: number; rest?: boolean }
  | { kind: "accidental"; alter: number }
  | { kind: "tuplet" };

/** The tool's stable id — what `data-tool` carries and what the smoke check arms by name. */
export function toolId(t: Tool): string {
  if (t.kind === "duration") return `${t.rest ? "rest" : "dur"}:${t.num}/${t.den}`;
  if (t.kind === "accidental") return `acc:${t.alter}`;
  return "tuplet";
}

/** SMuFL `tuplet3` — the same italic 3 the engraver draws over a triplet, so the button shows
 *  exactly what the tool produces. */
const TUPLET_CP = 0xe883;

/**
 * Note values, longest → shortest, with the SMuFL codepoint each is drawn with (Bravura's
 * "individual notes" range: noteWhole, noteHalfUp, noteQuarterUp, note8thUp, note16thUp,
 * note32ndUp). The glyph is the label — a musician reads the notehead faster than "1/8".
 */
const DURATIONS: { num: number; den: number; cp: number; rest: number }[] = [
  { num: 1, den: 1, cp: 0xe1d2, rest: 0xe4e3 },
  { num: 1, den: 2, cp: 0xe1d3, rest: 0xe4e4 },
  { num: 1, den: 4, cp: 0xe1d5, rest: 0xe4e5 },
  { num: 1, den: 8, cp: 0xe1d7, rest: 0xe4e6 },
  { num: 1, den: 16, cp: 0xe1d9, rest: 0xe4e7 },
  { num: 1, den: 32, cp: 0xe1db, rest: 0xe4e8 },
];

/**
 * How far each glyph's INK sits above its baseline, and how far below — measured from the shipped
 * Bravura with `TextMetrics.actualBoundingBox*` at `font-size: 100px`.
 *
 * Why this table exists: centring a glyph the ordinary way centres its *line box*, and a music
 * glyph's ink is nowhere near its baseline. A stemmed note draws **87–102 units up and 14 down**,
 * so flex-centring pushed the stems clean out through the top of the button while the space under
 * the notehead sat empty. (The ink itself is small enough to fit: ~30 px inside a 38 px box.) With
 * `line-height: 0` the baseline lands at the button's centre, so shifting the glyph down by half
 * its ink imbalance centres what you can actually see. Codepoints not listed fall back to no shift.
 */
const INK: Record<number, { up: number; down: number }> = {
  0xe1d2: { up: 13.6, down: 13.7 },   // noteWhole — an oval on the line, already balanced
  0xe1d3: { up: 87.5, down: 14.5 },   // noteHalfUp
  0xe1d5: { up: 87.5, down: 14.1 },   // noteQuarterUp
  0xe1d7: { up: 87.3, down: 13.8 },   // note8thUp
  0xe1d9: { up: 87.3, down: 13.8 },   // note16thUp
  0xe1db: { up: 102.3, down: 13.8 },  // note32ndUp — the tallest, and the one that broke out first
  0xe260: { up: 43.9, down: 17.5 },   // accidentalFlat
  0xe261: { up: 34.1, down: 33.5 },   // accidentalNatural
  0xe440: { up: 43.8, down: 17.4 },   // accidentalBuyukMucennebFlat
  0xe441: { up: 43.9, down: 17.5 },   // accidentalKucukMucennebFlat
  0xe442: { up: 43.9, down: 17.5 },   // accidentalBakiyeFlat
  0xe443: { up: 43.9, down: 17.5 },   // accidentalKomaFlat
  0xe444: { up: 32.2, down: 33.7 },   // accidentalKomaSharp
  0xe445: { up: 35.0, down: 34.8 },   // accidentalBakiyeSharp
  0xe446: { up: 32.1, down: 33.8 },   // accidentalKucukMucennebSharp
  0xe447: { up: 34.8, down: 35.0 },   // accidentalBuyukMucennebSharp
  0xe451: { up: 51.8, down: 34.8 },   // accidental2CommaSharp — the widest sign in the row, too
  0xe452: { up: 51.1, down: 34.8 },   // accidental3CommaSharp
  0xe455: { up: 48.7, down: 17.5 },   // accidental2CommaFlat
  0xe456: { up: 47.8, down: 17.5 },   // accidental3CommaFlat
  0xe4e3: { up: 0.9, down: 13.5 },    // restWhole — a bar hanging UNDER the line, all ink down
  0xe4e4: { up: 14.2, down: 0.2 },    // restHalf — the same bar sitting ON it
  0xe4e5: { up: 37.3, down: 37.5 },   // restQuarter
  0xe4e6: { up: 17.4, down: 25.1 },   // rest8th
  0xe4e7: { up: 17.9, down: 50.0 },   // rest16th
  0xe4e8: { up: 42.6, down: 50.0 },   // rest32nd — the tallest rest
  0xe883: { up: 37.5, down: 0.8 },    // tuplet3 — a digit sits ON the baseline, so it is all ink up
};

/** Centre a glyph on its INK rather than on its baseline. `size` is the font-size in px. */
function inkCentred(cp: number, size: number): React.CSSProperties {
  const ink = INK[cp];
  const dy = ink ? ((ink.up - ink.down) / 2) * (size / 100) : 0;
  return { fontSize: size, lineHeight: 0, display: "block", transform: `translateY(${dy.toFixed(1)}px)` };
}

export function EditPalette({
  armed,
  onArm,
  canPlay,
  playState,
  fromMeasure,
  anchored,
  onPlay,
  onStop,
}: {
  armed: Tool | null;
  onArm: (t: Tool | null) => void;
  canPlay: boolean;
  playState: "stopped" | "playing" | "paused";
  /** The bar Çal starts from, or null before anything has been edited (→ the top of the piece). */
  fromMeasure: number | null;
  /** Tuplet tool only: the first note of the run has been picked and the end is awaited. Changes
   *  nothing but the hint — the sheet owns the gesture. */
  anchored: boolean;
  onPlay: () => void;
  onStop: () => void;
}) {
  // Esc disarms. Bound while the palette is mounted, i.e. only in edit mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onArm(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onArm]);

  const armedId = armed ? toolId(armed) : null;
  const tool = (t: Tool, cp: number, title: string, fontSize: number) => {
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
        <span className="kv-glyph" style={inkCentred(cp, fontSize)}>{String.fromCodePoint(cp)}</span>
      </button>
    );
  };

  return (
    <aside
      id="edit-palette"
      data-armed={armedId ?? undefined}
      data-play-from={fromMeasure ?? undefined}
      className="kv-palette"
    >
      {/* Çal starts at the last edited bar (the top of the piece before any edit), and pressing it
          again while playing replays that same bar. Pause/resume is not duplicated here — the
          transport above is still on screen in edit mode (owner, 2026-08-08). */}
      <div className="kv-palette__group">
        <span className="kv-palette__label">{TR.palette.playback}</span>
        <div className="kv-palette__transport">
          <button
            id="palette-play"
            type="button"
            data-play-state={playState}
            className="kv-btn kv-btn--primary"
            onClick={onPlay}
            disabled={!canPlay}
            title={fromMeasure == null ? TR.palette.playFromTopTitle : TR.palette.playFromTitle(fromMeasure)}
          >
            {TR.palette.play}
          </button>
          <button
            id="palette-stop"
            type="button"
            className="kv-btn"
            onClick={onStop}
            disabled={playState === "stopped"}
            title={TR.palette.stopTitle}
          >
            {TR.palette.stop}
          </button>
        </div>
      </div>

      <div className="kv-palette__group">
        <span className="kv-palette__label">{TR.palette.durations}</span>
        <div className="kv-palette__row">
          {DURATIONS.map((d) =>
            tool({ kind: "duration", num: d.num, den: d.den }, d.cp, TR.palette.durationTitle(`${d.num}/${d.den}`), 26),
          )}
        </div>
      </div>

      {/* Rests, mirroring the note values above. Same tool, `rest: true` — arm one and click blank
          staff to put a rest there, or click a note to turn it into one. */}
      <div className="kv-palette__group">
        <span className="kv-palette__label">{TR.palette.rests}</span>
        <div className="kv-palette__row">
          {DURATIONS.map((d) =>
            tool(
              { kind: "duration", num: d.num, den: d.den, rest: true },
              d.rest,
              TR.palette.restTitle(`${d.num}/${d.den}`),
              26,
            ),
          )}
        </div>
      </div>

      {/* Every alteration the editor can store, each with its own Bravura sign — including the
          numbered ±2/±3, which used to be reachable only from the deleted measure modal. */}
      <div className="kv-palette__group">
        <span className="kv-palette__label">{TR.palette.accidentals}</span>
        <div className="kv-palette__row">
          {ACCIDENTAL_VALUES.map((a) =>
            tool({ kind: "accidental", alter: a }, accidentalCp(a), TR.palette.accidentalTitle(accidentalLongLabel(a)), 24),
          )}
        </div>
      </div>

      {/* One tool, both directions (owner, 2026-08-08): click a note then the note two on to make
          a triplet, or click any member of one to take it apart again. */}
      <div className="kv-palette__group">
        <span className="kv-palette__label">{TR.palette.tuplets}</span>
        <div className="kv-palette__row">
          {tool({ kind: "tuplet" }, TUPLET_CP, TR.palette.tupletTitle, 24)}
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

      {/* The hint splits by KIND, because the tools do different things off a note: a note value
          also inserts on empty staff (step 6), an accidental has nothing to attach to, and the
          tuplet is the only two-click gesture — so it says which click is next. */}
      <p className="kv-palette__hint">
        {armed == null
          ? TR.palette.hintIdle
          : armed.kind === "duration"
            ? armed.rest
              ? TR.palette.hintArmedRest
              : TR.palette.hintArmedDuration
            : armed.kind === "accidental"
              ? TR.palette.hintArmedAccidental
              : anchored
                ? TR.palette.hintTupletEnd
                : TR.palette.hintTupletStart}
      </p>
    </aside>
  );
}
