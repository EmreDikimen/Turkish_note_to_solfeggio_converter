# History — detailed log of completed phases

> Moved verbatim from `ROADMAP.md` §7 (2026-07-04) to keep the status section short. This is the
> **full dated record** of what was built in each completed phase and how. **Current** status and
> next action live in `ROADMAP.md` §7 — not here. The code map is `docs/CODE_TOUR.md`.

## Phase 0: DONE (2026-06-20)

Symbolic → microtonal audio pipeline works with no ML.
- SymbTr dataset lives at `~/Downloads/SymbTr-2.0.0/` (txt, MusicXML, midi, mu2; 2200 pieces).
- `src/symbtr/parser.py` — parses SymbTr `.txt` → `Score`/`Event` model. Verified on all 2200 files.
- `src/audio/tuning.py` — `koma53_to_freq()`; 53-TET, concert anchor 440 Hz at comma 327 (written
  pitch sounds a fourth below — Turkish transposing convention). Validated
  against 12-TET (E5 → 659.97 Hz).
- `src/audio/synth.py` — additive synth + WAV writer (numpy + stdlib `wave`, no heavy deps).
- `scripts/symbtr_to_audio.py` — CLI: `python scripts/symbtr_to_audio.py <file.txt> -o out.wav --info`.
- Sample input in `data/raw/`, sample output in `data/processed/`.

## Phase 1: DONE (2026-06-22; polish through 2026-06-28)

Shared TS core + web harness; load → view → edit → playback all working.
- ✅ Python `SymbTr → note-model JSON` exporter — `src/symbtr/export_json.py` +
  `scripts/symbtr_to_json.py` (schemaVersion 1; notes/rests/meta tagged; carries tuning params).
- ✅ npm-workspaces monorepo: root `package.json` (workspaces `packages/*`, `apps/*`).
- ✅ `packages/core` (TypeScript): `types.ts` (note model), `tuning.ts` (`koma53ToFreq`,
  verified parity with Python to 4e-5 Hz), `scheduling.ts` (`buildTimeline` + `AudioBackend`
  interface). Type-checks clean.
- ✅ `apps/web` (React + Vite): loads note-model JSON, **piano-roll** view (pitch = 53-TET
  comma, hover for note details), Web Audio `AudioBackend` playback at 53-TET. Builds + serves.
- ✅ **Transport + playhead** (added 2026-06-22): Play / **Pause / Resume** (via
  `AudioContext.suspend/resume` — no rescheduling) + Stop. A teal **playhead** bar tracks the
  currently-sounding note on the sheet, driven by `requestAnimationFrame` reading the audio
  clock (`WebAudioBackend.getPositionMs()` = `currentTime − originTime`), so it's
  sample-accurate and freezes correctly while paused. **Click-to-seek**: in the sheet's
  non-edit mode, clicking a measure plays from there (`play(timeline, fromMs)` re-schedules
  from an offset). End-of-piece is detected by polling the audio clock (pause-aware), not a
  wall-clock timer. The `AudioBackend.play` signature is now `play(timeline, fromMs?)`.
- ✅ **Drag-to-edit** (the core editing feature): drag a note vertically to change pitch
  (snaps to nearest comma, frequency + playback update live); drag its right edge to change
  duration (following notes reflow). Edits flow up to App → rebuild doc → re-render + replay.
  Inverse pitch-mapping math verified (zero round-trip error).
- ✅ **Sheet-music view + measure editor** (instructive mode): Piano-roll | Sheet toggle. The
  staff is engraved with **VexFlow 5** (real stems, flags, beams, dots, duration-correct
  noteheads/rests), with real **Turkish AEU accidentals via the Bravura font**. Trick: VexFlow's
  built-in accidental table lacks most Turkish glyphs, but `Accidental` renders an unknown code
  verbatim in the music font — so we pass the **raw SMuFL codepoint char** (from the verified
  `accidentalGlyph` map in `notation.ts`) and VexFlow still reserves layout space. Durations come
  from `durationBeats` via a fraction→VexFlow-code+dots mapper. Measure interaction: in edit mode
  an HTML overlay makes measures clickable (open editor); in non-edit mode a click seeks/plays
  from that measure (see Transport above). Top-right **Edit** button → click a
  measure → modal. Modal **Basic** tab: pick base note + how many commas sharp/flat (custom
  dropdown showing the Bravura **symbol + Turkish name**), duration, add/delete; **Advanced**
  tab adds absolute koma + frequency editing. **Save disabled + warning** unless the measure's
  total duration is preserved. Pitch stored as explicit spelling (letter+octave+alter), so
  names never enharmonically flip — verified: all 266 sample notes round-trip name & koma
  exactly. Measures come from SymbTr's `offset` column: an integer `offset` is one printed
  barline (one usul cycle), so `assignBars` tags each event with a stable 1-based `bar` and
  `groupMeasures` groups by it — correct for any usul, whole-note (düyek 8/8) or not
  (aksak 9/8, curcuna 5/4). The `bar` is assigned at load and carried through edits, with a
  whole-note fallback for data lacking a usable `offset`. New core (`notation.ts`,
  `measures.ts`, `tempo.ts`) is mobile-reusable; tempo derived in TS so no Python/schema change.
- ✅ **Key-signature mode** (added 2026-06-22): a sheet-view toggle (the **♯♭ Key sig** button)
  that draws the score's prevailing accidentals once after the clef on every row (makam-style
  signature) and suppresses inline accidentals on notes that match — deviating notes still show
  one (a natural sign when the note is natural under an altered signature). Signature is derived
  in core (`deriveKeySignature` in `notation.ts` = most-frequent accidental per pitch letter).
  Drawn by reserving width via `Stave.setNoteStartX` and appending Bravura SVG glyphs (VexFlow's
  native `KeySignature` only supports standard Western keys). This is the button-only slice of the
  README's deferred "settings modal" idea; the full modal (view/theme/this toggle) is still TODO.
  (Now generalized into a three-way **Accidentals** selector: every-note / key-signature /
  standard per-measure accidental-carry.)
- ✅ **Tempo control + usul-aware metronome** (added 2026-06-27): a **BPM** input that defaults
  to each piece's natural tempo (`estimateBpm`) and re-times playback live (`speed = chosenBpm /
  naturalBpm`); a **metronome** toggle; and a **usul selector**. New core `usul.ts` carries each
  usul's meter + beat **grouping** (e.g. aksak 9/8 = 2+2+2+3 eighths) and `buildMetronomeTrack`
  walks the bars (`groupMeasures`) to place clicks on the felt beats with the downbeat accented —
  so non-integer usuls click correctly, aligned to the bars, at any tempo. The selector defaults
  to the piece's own usul (else the usul whose meter matches the derived time signature). Pure
  data + scheduling math, mobile-reusable. (This is the click-track slice of the usul-rhythm idea;
  a real darbuka pattern + OMR-driven usul detection is still later — see below.)
- ✅ **Notation realism for synthetic data** (added 2026-06-28, toward Phase-2 image quality):
  - **AEU accidentals only on the engraved staff** — `toAeuAlter` (in `notation.ts`) snaps every
    alteration to the four standard signs (koma/bakiye/küçük·büyük mücennep); no numbered ±2/±3
    "folk" signs. The koma (pitch/audio) is untouched and the **editor keeps the exact alteration**;
    the decoder resolves sign → koma per makam later (Phase 4). So the model trains on CTM signs.
  - **Justified rows** — each system stretched to a uniform width (last line ragged), for realistic
    note spacing.
  - **Lyrics under the staff** — syllables, melisma underscores, optional hyphens; the parser now
    keeps SymbTr's word boundary (`lyric_word_end`/`lyricWordEnd`).
  - **Engraved header** (`metadata.ts` `scoreHeader`: makam+form, title, usul+tempo, composer) —
    the block Phase 2 draws into the images so the model learns to read makam/usul/tempo.
- ✅ **Transpose / ahenk in the harness** (added 2026-06-28): a **Transpose** dropdown over the
  core `transpose()` (defined for Phase 2), plus a **Keep sheet (sound only)** toggle for
  transposing instruments (kız/mansur ney — the sound shifts, the notation stays). Decoupled from
  the stored doc (display + timeline derive it; edits map back to base). Pairs with the concert-pitch
  anchor (Phase 0).
- ⏳ Optional later: feed OMR output into this harness (Phase 4).
- ⏳ Later: **usul-based rhythm playback (full).** Upgrade the usul-aware metronome above into the
  piece's usul played as a real rhythmic cycle on a traditional percussion sound (darbuka), so
  non-integer usuls sound idiomatic, not just clicked. The usul is auto-detected by OMR and stays
  user-editable (OMR can misread it); wire the automatic detection in with the OMR model (Phase 3–4).

**Phase 1 is complete** (piano-roll editor + sheet/notation editor + tempo/usul metronome +
transpose/ahenk + art-music-faithful engraving with header & lyrics). The ML track (Phase 2) has
started — **[PHASE2.md](PHASE2.md)** is the kickoff/hand-off doc (goal, de-risk ladder).
