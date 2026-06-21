# Code Tour — how to read this codebase

A learning-oriented map of the code. Every function also has a detailed comment at its top
(what it does, why, how, what's important) — this file is the **reading order** and a
one-line index so you know where to start and how the pieces connect.

## The big picture

The project is **two halves joined by one JSON file**:

```
SymbTr .txt ──(Python)──► Score/Event ──► note-model JSON ──(TypeScript)──► piano-roll + sound
            parse           tuning/synth     export             core              web app
```

- **Python side** (`src/`, `scripts/`) = the reference + data/training tooling. Parses the
  dataset, proves the tuning/synthesis, and exports JSON. Not shipped in the app.
- **The JSON file** = the contract. Python writes it (`export_json.py`), TypeScript reads it
  (`types.ts`). They describe the same shape on two sides of the wire.
- **TypeScript side** (`packages/core`, `apps/web`) = the actual app logic + web test
  harness. The `core` is reused unchanged by the future mobile app.

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
| 2 | [tuning.py](../src/audio/tuning.py) · `koma53_to_freq` | The heart: comma number → frequency in Hz. |
| 3 | [synth.py](../src/audio/synth.py) · `render_score` → `_render_tone` → `_envelope` → `write_wav` | Notes → audio samples → WAV. |
| 4 | [symbtr_to_audio.py](../scripts/symbtr_to_audio.py) · `main` | Ties 1–3 together (the whole Python flow on one screen). |
| 5 | [export_json.py](../src/symbtr/export_json.py) · `score_to_dict` | **The bridge.** `Score` → JSON for the TS side. |

### Part B — TypeScript (the app)

| # | File · function | One line |
|---|---|---|
| 6 | [types.ts](../packages/core/src/types.ts) · `NoteEvent`, `NoteModelDocument` | Same shape as `Event`/`Score`, in TS. Compare to step 5. |
| 7 | [tuning.ts](../packages/core/src/tuning.ts) · `koma53ToFreq` | Line-for-line port of step 2 (verified to match). |
| 8 | [scheduling.ts](../packages/core/src/scheduling.ts) · `buildTimeline`, `AudioBackend` | Events → timed notes; the audio *contract* (interface). |
| 9 | [webAudioBackend.ts](../apps/web/src/webAudioBackend.ts) · `play`, `stop`, `buildPeriodicWave` | The browser's *implementation* of `AudioBackend` (web's synth.py). |
| 10 | [App.tsx](../apps/web/src/App.tsx) · `App`, `onPlay`/`onStop`/`onFile` | The glue: holds the score, wires buttons to core + backend. |
| 11 | [PianoRoll.tsx](../apps/web/src/PianoRoll.tsx) · `xOf`/`yOf`, draw effect, `onMove` | Draws the roll; read last, only if you care about rendering. |

[main.tsx](../apps/web/src/main.tsx) just mounts React — you can ignore it.

## The 15-minute path (the spine)

If you only have a little time, read just these five and you'll understand the whole flow:

1. `parser.py` → `Event`
2. `tuning.py` → `koma53_to_freq`
3. `symbtr_to_audio.py` → `main`
4. `types.ts` → `NoteModelDocument`
5. `scheduling.ts` → `buildTimeline`

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
npm install && npm run dev:web   # open the URL, hit ▶ Play, watch steps 8–11 run
```
