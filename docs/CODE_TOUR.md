# Code Tour — how to read this codebase

A learning-oriented map of the code. Every function also has a detailed comment at its top
(what it does, why, how, what's important) — this file is the **reading order** and a
one-line index so you know where to start and how the pieces connect.

## The big picture

The project is **two halves joined by one JSON file**:

```
SymbTr .txt ──(Python)──► Score/Event ──► note-model JSON ──(TypeScript)──► view + edit + sound
            parse           tuning/synth     export            shared core         web harness
```

- **Python side** (`src/`, `scripts/`) = the reference + data/training tooling. Parses the
  dataset, proves the tuning/synthesis, and exports JSON. Not shipped in the app.
- **The JSON file** = the contract. Python writes it (`export_json.py`), TypeScript reads it
  (`types.ts`). They describe the same shape on two sides of the wire.
- **TypeScript side** = the actual app logic, split deliberately:
  - `packages/core` — **portable logic, no platform APIs** (note model, tuning, scheduling,
    notation, measures, tempo). Reused *unchanged* by the future mobile app.
  - `apps/web` — a **throwaway React harness**: it renders the core's output (piano-roll +
    VexFlow sheet) and supplies the *platform adapter* (`webAudioBackend.ts` implements the
    core's `AudioBackend` interface). The mobile app will swap this layer, keep the core.

**Golden rule for reading:** read the *data shape* before the *functions* (nouns before
verbs). Once you know what an `Event` / `NoteEvent` is, the transforms make sense.

## Reading order

### Part A — Python (the reference + the bridge)

| # | File · function | One line |
|---|---|---|
| 1 | [parser.py](../src/symbtr/parser.py) · `EventKind`, `Event`, `Score` | The data shapes. Read these first. |
| 1 | `Event.kind` / `Event.duration_s` | Is a row a note/rest/meta? How long is it? |
| 1 | `Score.notes` / `Score.sounding_events` | Notes only vs. notes+rests (why rests matter for timing). |
| 1 | `parse_file` | **Entry point.** File → `Score`. |
| 2 | [tuning.py](../src/audio/tuning.py) · `koma53_to_freq` | The heart: comma number → frequency in Hz. (`cents_above_ref` = a UI/sanity unit.) |
| 3 | [synth.py](../src/audio/synth.py) · `render_score` → `_render_tone` → `_envelope` → `write_wav` | Notes → audio samples → WAV. |
| 4 | [symbtr_to_audio.py](../scripts/symbtr_to_audio.py) · `main` | Ties 1–3 together (the whole Phase-0 flow on one screen). |
| 5 | [export_json.py](../src/symbtr/export_json.py) · `score_to_dict` → `export_file` | **The bridge.** `Score` → note-model JSON for the TS side. |
| 5 | [symbtr_to_json.py](../scripts/symbtr_to_json.py) · `main` | CLI wrapper around the bridge. |

### Part B — TypeScript core (`packages/core`, the portable logic)

[index.ts](../packages/core/src/index.ts) is just a barrel that re-exports every module below;
the web app imports everything from `@turkish-omr/core`.

| # | File · function | One line |
|---|---|---|
| 6 | [types.ts](../packages/core/src/types.ts) · `NoteEvent`, `NoteModelDocument`, `TuningParams` | Same shape as `Event`/`Score`, in TS. Compare to step 5. |
| 7 | [tuning.ts](../packages/core/src/tuning.ts) · `koma53ToFreq`, `freqFromTuning` | Line-for-line port of step 2 (verified to match). `freqFromTuning` uses a doc's own anchor. |
| 8 | [scheduling.ts](../packages/core/src/scheduling.ts) · `buildTimeline`, `AudioBackend` | Events → flat timeline of timed notes; and the audio *contract* (interface). |
| 9 | [tempo.ts](../packages/core/src/tempo.ts) · `estimateWholeNoteMs`, `beatsToMs`, `estimateBpm` | SymbTr stores no tempo — estimate one (median ms÷beats) to convert note-values ↔ ms. |
| 10 | [measures.ts](../packages/core/src/measures.ts) · `assignBars` → `groupMeasures` | Split a score into bars. `assignBars` reads SymbTr's `offset` (integer = a printed barline); `groupMeasures` groups by the resulting `bar`. `isMeasureValid` drives the editor's Save gate. |
| 11 | [notation.ts](../packages/core/src/notation.ts) · `parseNoteName`, `komaOf`/`spellNote`/`komaToName`, `accidentalGlyph`, `deriveKeySignature` | Note name ⇄ staff position + comma + Turkish (AEU) accidental glyph. The sheet view's brain. |

### Part C — Web harness (`apps/web`, throwaway UI + the platform adapter)

| # | File · function | One line |
|---|---|---|
| 12 | [webAudioBackend.ts](../apps/web/src/webAudioBackend.ts) · `play(timeline, fromMs?, opts?)`, `pause`/`resume`/`stop`, `getPositionMs`, `buildPeriodicWave` | The browser's *implementation* of `AudioBackend` (web's synth.py): schedules notes, seeks, metronome, exposes the audio clock for the playhead. |
| 13 | [App.tsx](../apps/web/src/App.tsx) · `App`, `loadDoc`, `updateEvent`, `onSaveMeasure`, `onPlayPause`, `applyPlayback` | The glue: owns the loaded score, derives the timeline, wires transport/tempo/edit to core + backend. |
| 14 | [PianoRoll.tsx](../apps/web/src/PianoRoll.tsx) · `xOf`/`yOf`/`yToKoma`, draw effect, pointer handlers | Canvas piano-roll: x=time, y=comma. Drag a note to change pitch; drag its right edge for duration. |
| 15 | [SheetView.tsx](../apps/web/src/SheetView.tsx) · `SheetView`, `vexDuration`, `buildStaveNotes`, `drawSignature` | VexFlow-engraved staff: real stems/beams/dots + AEU accidentals, a playhead cursor, click-to-seek, and (edit mode) clickable measures. |
| 16 | [MeasureEditModal.tsx](../apps/web/src/MeasureEditModal.tsx) · `MeasureEditModal`, `save` | Per-measure editor: pick pitch/accidental/duration, add/delete; Save only when the bar's total duration is preserved. |
| 16 | [AccidentalSelect.tsx](../apps/web/src/AccidentalSelect.tsx) · `AccidentalSelect` | Custom dropdown showing each accidental's real Bravura glyph + Turkish name. |

[main.tsx](../apps/web/src/main.tsx) just mounts React — you can ignore it.

## The 15-minute path (the spine)

If you only have a little time, read just these and you'll understand the whole flow:

1. `parser.py` → `Event` (what a row is)
2. `tuning.py` → `koma53_to_freq` (comma → Hz)
3. `symbtr_to_audio.py` → `main` (Phase-0 flow end to end)
4. `types.ts` → `NoteModelDocument` (the JSON contract in TS)
5. `scheduling.ts` → `buildTimeline` (data → timed notes)
6. `App.tsx` → `App` (how the harness ties core + backend together)

## Two ideas worth pausing on

- **The `AudioBackend` boundary** ([scheduling.ts](../packages/core/src/scheduling.ts) defines
  it, [webAudioBackend.ts](../apps/web/src/webAudioBackend.ts) implements it). Everything that
  touches a real audio API lives behind this interface — that's what lets the mobile app reuse
  the core verbatim and only rewrite the backend.
- **Bars come from `offset`, not from counting beats** ([measures.ts](../packages/core/src/measures.ts)).
  SymbTr's `offset` column already marks barlines (an integer = one usul cycle), so this works
  for non-whole-note usuls like aksak (9/8), not just düyek (8/8). The `bar` is assigned once at
  load and travels with each event so editing can't scramble the grouping.

## How to read actively (not just stare)

Run this with files 1–4 open:

```bash
python3 scripts/symbtr_to_audio.py data/raw/<score>.txt --info
```

The `--info` table (note name → koma → Hz) **is** the data flowing through steps 1→2.
Then open the exported JSON next to `types.ts` (steps 5–6) and you'll literally see the
bridge: the same fields, Python on one side, TypeScript on the other.

```bash
python3 scripts/symbtr_to_json.py data/raw/<score>.txt -o apps/web/public/sample.json
npm install && npm run dev:web   # open the URL: ▶ Play, toggle Sheet, ✎ Edit a measure
```
