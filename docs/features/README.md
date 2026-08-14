# Feature track — what to build after the beta

purpose: the plan for the post-beta feature ideas (instrument voices, usul percussion, the fingerboard tab)
audience: agents and the owner working the product side, once W10 is out
updated: 2026-08-13

> Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
> Decisions: [../DECISIONS.md](../DECISIONS.md). Licences: [../THIRD-PARTY.md](../THIRD-PARTY.md).
> The MVP ladder that produced the beta: [../mvp/README.md](../mvp/README.md).

## Why this track exists

The owner raised four ideas on **2026-08-08**, after the beta went live. One of them — a better model
— is not a feature and already has a home ([../rung3/README.md](../rung3/README.md), Round 3). The
other three are **product** work, and they share a property worth stating up front:

**None of them needs the server, a GPU, or any new machine learning.** They are client-side, they
touch playback and the view layer only, and they can be built in parallel with Round 3 without
touching `apps/web/src/omr/`, `apps/server/`, or any training data.

## The features

| | Feature | Effort | Server? | The real cost | State |
|---|---|---|---|---|---|
| **F0** | Look-ahead scheduler + one long-lived `AudioContext` | small | no | none — enabling refactor for F1/F2 | ✅ **DONE 2026-08-10** |
| **F1** | Instrument voices (violin, clarinet, kanun first) | medium | no | asset measurement, not licences | ✅ **DONE 2026-08-14** — clarinet, violin and kanun; uploaded, deployed, heard |
| **F2** | Usul percussion (darbuka, tef) | **smallest** | no | correct stroke patterns | ✅ **DONE 2026-08-11** — real CC0 darbuka and bendir, picker included, stroke tables verified by ear. Nothing open |
| **F3** | Fingerboard tab — where to put your finger, in time | medium | no | own artwork + a string-choice rule | not started |

Order: **F0 → F2 → F1 → F3**. F0, F2 and F1 are built and deployed, **F1 is done as of 2026-08-14 and awaiting its
upload and its ear check**; only F3 has not started. F2 came first among the visible ones because it
has the best payoff per hour.

⚠ **"The real cost is compression" was wrong**, and it is worth recording because it steered the
planning for two weeks. Compression was withdrawn as a problem when the files left the app, and what
actually cost the time was **asset measurement** — an octave-wrong labelling convention, a
semitone-wrong file, a URL-hostile filename and a rounding error in the level clamp. None of those
are visible from a licence table. See [audio-sources.md](audio-sources.md).

✅ **F1 is no longer a guess about what the owner might want — W10's friends asked for it**
(2026-08-11). The link went out, they liked it, and said more instrument sounds would be good; the
owner named **violin, clarinet and kanun**. ⚠ This is worth stating because the opposite was written
in this file twice: F0 and F2 *were* built before anyone was asked, which was a real tension. It
resolved the pleasant way — the friends pointed where the owner's list already pointed — but that is
**evidence the guess was good, not that asking was unnecessary**. F3 and any instrument past these
three should still wait on what the friends say next.

✅ **THE SAMPLES ARE IN** (2026-08-11, the same day the synthesis was rejected). F2 plays CC0
recordings of a **darbuka** and a **bendir**, chosen with a picker; the synthesis survives only as
the fallback for a kit that has not downloaded yet. What was taken and how it was prepared:
[audio-sources.md](audio-sources.md). The account, including what the measurement caught that
listening by file name would not have: [../log/status-log.md](../log/status-log.md).

⚠ **The instructive part is the BAR, not the code.** The plan wrote one down — *"düm and tek must be
unmistakable from each other, that is the whole bar for the synthesised version"* — and the
synthesis met it, twice: the strokes are tellable apart, and after the 2026-08-11 attack fix they
are clearly audible. It was still not something to play along with. **A distinguishability bar was
the wrong proxy for a musical one, and it was passed on the way to failing.** Percussion is a timbre
problem; two oscillators can be *identifiable* without being a drum.

✅ **What the bet did buy, so it is not read as wasted.** Everything except the sound is correct and
survives untouched: `buildPercussionTrack` and the stroke tables in core, the separate toggle, the
volume stage, `usul-test.ts`, and the browser checks. The swap reaches **one method**
(`scheduleStroke`) plus a loader — the seam this was designed around is exactly where the change
lands. F0 is what makes it possible at all, since a decoded `AudioBuffer` now survives a Stop.

✅ **The stroke tables are VERIFIED** (owner, by ear, 2026-08-11: *"they sound really nice"*). All 10
usuls in `USULS` have a `strokes` array; six are the standard simple forms and four (marked
`[derived]` in the source) are our reduction of that usul's own beat grouping — and **all ten are
accepted**, the `[derived]` four included. `npm test` checks they are well-formed — inside the
cycle, ascending, opening on a düm — and never could check that they are musically right; that is
what check 23 in [../MANUAL_CHECKS.md](../MANUAL_CHECKS.md) was for. ⚠ The standard here is one
musician's ear, not a cited source. If a pattern is ever disputed, re-open the `[derived]` four
first and settle it with a source rather than re-deriving it.

---

## Audio assets — what may be used → [audio-policy.md](audio-policy.md)

Moved 2026-08-11, when this file hit its 400-line cap. That section is *policy* — which licence
categories may be used, the swap discipline every file must obey, and why recording your own is
more viable than it sounds — while this file is the feature briefs. The per-file shopping list
stays in [audio-sources.md](audio-sources.md).

## F0 — the enabling refactor ✅ DONE 2026-08-10

**Built as designed.** What follows is the brief; what it cost and the one thing that was harder
than it reads are in [../log/status-log.md](../log/status-log.md).

`apps/web/src/webAudioBackend.ts` used to do two things that are fine for oscillators and awkward
for anything else:

1. `play()` schedules **the entire piece up front** — every note gets its own `OscillatorNode` in one
   pass.
2. `stop()` **closes the `AudioContext`**, so every playback creates a new one.

Change to a **look-ahead scheduler** (schedule the next ~1 s every ~100 ms) against **one long-lived
context**. Two reasons, both concrete:

- Decoded `AudioBuffer`s belong to the context that decoded them. Closing it per playback throws away
  the sample cache F1 depends on.
- Mobile Safari limits how many `AudioContext`s a page may create — repeated `new AudioContext()` is
  a known way to run a page out of audio.

What must not change: `getPositionMs()` derives the playhead from the audio clock and is what makes
pausing correct and drift-free. Keep that property — the fingerboard tab (F3) reads the same clock,
so a second timing source would be a bug factory.

---

## F1 — instrument voices

### The constraint that rules out most of the shelf

Every ready-made sound library — SoundFont, `.sf2`, General MIDI, most commercial sample packs — is
built around **12 pitches per octave**. This project has **53**. A library cannot be dropped in.

The fix is standard sampler practice: play the nearest recorded note back **slightly faster or
slower** to land on the exact frequency (`AudioBufferSourceNode.playbackRate`). With one recording
per semitone the largest shift needed is a quarter-tone, which is inaudible.

The architecture already suits this. `Timeline` notes carry an exact `freqHz`
([`packages/core/src/scheduling.ts`](../../packages/core/src/scheduling.ts)), so an instrument only
ever has to answer *"sound this frequency, this long"*. Tuning stays where it is
(`packages/core/src/tuning.ts`) and no instrument code may recompute a pitch.

### Three levels, in increasing cost

**Level 0 — synthesised timbres. No assets, no licence risk.**
The backend has one fixed harmonic mix (`HARMONIC_GAINS`) for everything. Instrument character is
mostly harmonics + envelope: clarinet ≈ odd harmonics with a soft attack; ney ≈ few harmonics plus
breath noise, slow attack; oud/tanbur ≈ sharp attack, fast decay; kemençe/violin ≈ rich harmonics,
slow attack, slight vibrato. Small, and enough to make instruments *distinguishable*. Ship this
first and find out whether more is wanted.

**Level 0.5 — physical modelling for the plucked instruments.**
Oud, tanbur and kanun are well served by **Karplus–Strong** (noise burst into a short delay loop).
No sample files, no licence question, and it is **natively microtonal** — the delay length *is* the
period, so 53-TET costs nothing. For this project's instruments this is a better fit than sampling
and should be tried before any recording is commissioned. ⚠ For **kanun** it is no longer the only
option: a CC0 chromatic recording of the real instrument turned up on 2026-08-09
([audio-sources.md](audio-sources.md)), so that one can be decided by ear rather than by necessity.

**Level 1 — recorded samples. THIS IS WHAT F1 IS BUILDING** (owner, 2026-08-11).
Uncompressed, untrimmed, as recorded: full length, stereo, original bit depth. **Measured, not
estimated**: VSCO 2's clarinet `susLong` is 33 files averaging ~1.8 MB, so one velocity across its
11 pitches is **~20 MB**, and three instruments come to **40–60 MB**. ⚠ The old figure here was
"0.5–1 MB per instrument, mono, compressed" — wrong by ~20× and written before anyone looked.
Rules:

- Load **only on selection** — at ~20 MB an instrument this is a requirement, not an optimisation.
- Serve from a **Hugging Face Hub repo** behind **`VITE_VOICES_URL`** — its own variable, *not* the
  drums' `VITE_AUDIO_URL` (owner, 2026-08-12: percussion is essential and stays on the app, and one
  base for both would 404 the drums). **Not committed to git**: ~50 MB of binaries in a public repo
  is permanent.
- **Cache in the browser like the weights do.** ⚠ `loadStrokeKit.ts` says Cache Storage is not worth
  a second invalidation path — that is **true for 660 KB of drums and false at 20 MB**. Copy
  `graphBytes` in `omr/session.ts` instead of inheriting the drum comment.
- `MAX_AUDIO_MB = 1` in `prune-dist.mjs` **stays at 1**. It is what forces all of the above.

⚠ **F1 was expected to inherit an answered hosting question and did not** (written 2026-08-11,
corrected 2026-08-12). The plan was to point `loadStrokeKit.ts`'s existing `VITE_AUDIO_URL` at a Hub
— no call-site changes. That fails, because it is one base for the whole `audio/` tree and would take
the drums with it. F1 got `VITE_VOICES_URL` and its own loader instead. The indirection work was not
wasted: it proved the cross-origin path under COEP. Expect to need
it: measured at **~20 MB per instrument**, the **first** voice trips `MAX_AUDIO_MB`, not the third.

✅ **The compression problem is WITHDRAWN, not solved** (owner, 2026-08-11). It was real only while
size was a constraint, and taking the files off the app removed that premise — so no encoder is
needed and nothing is trimmed. ⚠ One finding from measuring it is worth keeping: the sustains are
**7–10 seconds long**, longer than almost any notated note, so **no sample needs looping**. Trimming
to ~3 s to save space would have *introduced* that problem — the expensive-looking option was also
the simpler one.

⚠ **F1's levels are a harder problem than F2's, not an easier one.** A drum sits *beside* the notes;
an instrument voice **replaces** them, so a sample lands where the synthesised note's gain of 1.0
used to be, and `MASTER_GAIN` (0.72) plus the limiter were retuned around exactly that 1.0. Get this
wrong and it clips the way the darbuka did — the "patlamış" bug was arithmetic, and the arithmetic
is different here. Check the mix, not the file.

⚠ **A first version does not need 25–35 notes.** One good note per instrument, stretched by
`playbackRate`, covers roughly ±5–6 semitones before it starts sounding thin or chipmunky. That is
enough to hear an instrument choice working, and it turns the asset problem from "build a sample
set" into "find one usable note". Add notes later, only where it sounds worst.

Where each instrument's audio may come from: **[audio-policy.md](audio-policy.md)**
below.

### Where the code goes

Instrument choice is a **play option**, like `clicks` in `PlayOptions` — so the timeline, the core
and a future native backend are untouched. Sound-making stays in the web backend; nothing about
instruments belongs in `packages/core`.

---

## F2 — usul percussion ✅ DONE 2026-08-11

**Built as designed, samples and all.** The brief below stands as the description of what was made.

The nearest of the three, because half of it exists. `packages/core/src/usul.ts` already carries
each usul's meter and beat grouping, and `buildMetronomeTrack` already walks the bars, places clicks
in musical ms, accents downbeats and handles short/partial bars. Its own header comment names a real
darbuka pattern as future work — this is that.

What is missing: a usul is not a list of beats, it is a sequence of **named strokes** — *düm, tek,
ke*. So:

1. Add `strokes` to the `Usul` type: positions in `den` units, each with a stroke name.
2. `buildPercussionTrack(doc, usul, wholeNoteMs)` — a near-copy of `buildMetronomeTrack`, same shape,
   same bar walking, same partial-bar rule.
3. The backend plays a short sample per stroke instead of the metronome blip.
4. A **`Vuruş sesi` slider** balances the strokes against the notes. It rides a gain node between
   the strokes and the master, so dragging it applies live — every other playback control
   re-schedules from the current position, which is fine for a thing you set once and wrong for a
   thing you drag. **Keep this when the samples land**: a real drum needs balancing against the
   notes just as much, and the gain stage is where a sample would be routed anyway.

⚠ **Loudness was not the whole problem, and the first fix would have been the wrong one** (owner:
*"I barely can hear the rhythms"*, 2026-08-11). The düm was a sine sweeping 115 → 55 Hz — the right
musical shape, numerically the loudest thing in the mix, and nearly inaudible on a laptop, because a
MacBook speaker rolls off hard below ~200 Hz. Turning the gain up would have made an inaudible thing
inaudible and distorted. It now carries a short ~400 Hz attack on top of the low body, so the small
speaker gets the hit and headphones still get the weight. Worth remembering before reaching for a
level to solve a balance. ⚠ **It is also the check that a real sample must pass**: whatever is
recorded has to read on a laptop speaker, so prefer takes with a defined attack over ones that are
all low body, and audition on the built-in speaker rather than headphones.

### What the swap cost — done, and it was the estimate

Not a rewrite; the seam held. What landed, in the order it was planned:

1. **`scripts/prepare_strokes.py`** downloads the VCSL originals, **measures** them to pick which
   articulation is a düm, then trims, mono-downmixes and levels them into `public/audio/<kit>/`.
   Freesound's bendir take was **not** needed and stays deferred — VCSL is on GitHub, so no account
   and no manual step. See [audio-sources.md](audio-sources.md).
2. **They ship from the app**, not from a Hub — 660 KB does not justify a second host — behind
   `VITE_AUDIO_URL`, which now stays **unset for good**: F1's voices got their own variable, and the
   drums are essential enough that moving them off the app is not on the table
   ([../DECISIONS.md](../DECISIONS.md), 2026-08-12). `prune-dist.mjs` enforces both halves.
3. **A loader** (`src/audio/loadStrokeKit.ts`) — fetch and `decodeAudioData` once, cached for the
   life of the page. This is what F0 made possible; on the old backend the cache died with a Stop.
4. **`scheduleStroke` plays a buffer**, alternating two round-robins so a repeated stroke does not
   machine-gun. One method. Core, the toggle, the volume stage and the tables are untouched.
5. **The synthesis stays as the fallback** rather than dropping an unloaded stroke — silence would
   look like the feature being broken, the same reasoning that keeps the in-browser decode fallback
   alive.

Assets: **three sounds per kit** (düm / tek / ka) × two round-robins, ~110 KB a kit. No drum, mic or
player was needed. Files and licences: **[audio-sources.md](audio-sources.md)**.

⚠ **The risk here is data, not code.** Düyek, Aksak, Curcuna and the rest have canonical stroke
patterns, and a wrong one is immediately obvious to anyone who knows the repertoire. Keep them as
plain reviewable data next to `USULS`, cite the source, and have the owner check them. A score
already carries a `usul` field, so the right pattern can be selected without asking.

This is pure data + scheduling maths, so it stays in `packages/core` and ports to mobile unchanged —
the same reasoning that put `usul.ts` there.

---

## F3 — the fingerboard tab

Show the instrument, and show where the finger goes as the piece plays.

The tab itself is cheap: `ViewMode` in `apps/web/src/App.tsx` is `"roll" | "sheet"`; this adds a
third. The interesting part is *where to draw the marker*, and it splits by instrument family.

**Fretless strings (kemençe, violin, oud) — a formula, and the reason this feature is worth
building.** Distance along the string is `length × (1 − openStringFreq / noteFreq)`. It accepts *any*
frequency, so all 53 komas are exact. A 12-tone app **cannot** draw a koma position, because it only
knows twelve frets; this one can show that koma sharp and küçük sharp sit millimetres apart. That is
a teaching tool no general OMR app can copy, and it falls straight out of the tuning work already
done.

**Winds (ney, clarinet) — a lookup table.** Fingering charts are fixed and documented: pitch → which
holes are covered → filled/empty circles. Ney fingerings map onto perde names, which the project
already speaks.

**Tanbur — a fret table**, since its tied frets are the komas.

**The one genuinely tricky part:** a pitch is playable in several places. A greedy *stay nearest to
where the hand just was* rule is enough, and it is a small pure function that should get unit tests
rather than a smoke check.

### House rules this must follow

- **Own artwork.** Draw the instrument as SVG, or photograph your own. Do not lift an instrument
  photo off the web — the 2026-08-08 copyright pass exists precisely to stop that class of mistake
  ([../THIRD-PARTY.md](../THIRD-PARTY.md)). SVG also scales and lets markers be placed exactly.
- **DOM state, never copy.** The marker exposes `data-*` attributes for the checks to read, per the
  contract in [../../CLAUDE.md](../../CLAUDE.md) and `apps/web/src/ui/status.ts`. No text matching.
- **All strings in `apps/web/src/ui/strings.ts`.**
- **One clock.** Drive the animation from `getPositionMs()` — the source the playhead already uses —
  so the marker cannot drift from the sound.

**Scope advice:** ship **one** instrument first, and make it a fretless one, because the formula is
exact and it demonstrates the microtones. The rest is then mostly data.

---

## What this track does NOT change

- **Cloud Run cost is unchanged.** The server decodes images; none of these features call it.
- **The only new hosting need is static assets** (audio, artwork) — bandwidth, not compute. Lazy
  loaded, browser cached, kept out of `dist/`.
- **Client CPU is a non-issue.** Sample playback is negligible beside the ONNX decode that was moved
  off the client in the first place.
- **The mobile split holds.** Stroke patterns, fingering maths and timing are pure data + maths and
  belong in `packages/core`; only sound-making stays in the web backend. `usul.ts` is the model.
- **The model track is untouched.** Nothing here reads or writes `apps/web/src/omr/`, the exam, or
  any corpus.

The real cost of this track is **assets and curation** — recordings, verified usul strokes, instrument
drawings — not infrastructure. Budget time, not money.
