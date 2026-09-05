# Feature track — what to build after the beta

purpose: the plan for the post-beta feature ideas (instrument voices, usul percussion, the fingerboard tab)
audience: agents and the owner working the product side, once W10 is out
updated: 2026-08-29

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
| **F3** | Instrument tab — where to put your finger / where the mandals stand / how far the lip relaxes, in time | medium | no | calibration + a string-choice rule (violin); an instrument data table (kanun); a fingering table + the lip-bend bound (clarinet) | ✅ **VIOLIN DONE 2026-08-16**, ✅ **KANUN DONE 2026-08-29**; neither has been **seen by a person** yet. 🚧 **SOL KLARNET started 2026-08-29** — artwork landed, view not built |
| **F5** | Remember the pages this browser has already read | **small** | no | none — it is browser storage, not a database | ✅ **DONE 2026-09-05** — a decoded page and its edits survive a refresh; 30 pages, oldest dropped |
| **F4** | Listening mirror — a live microtonal tuner drawn on F3's fingerboard | medium | no | pitch-tracker steadiness at 22.6 cents/koma, unmeasured | ⏸ **PARKED 2026-08-25** (owner) — after the public launch; **not** audio-to-score. Reasoning and what was ruled out: [../BACKLOG.md](../BACKLOG.md) |

⚠ **F5 is out of order and that is not an oversight** — the owner raised it on 2026-09-05, after F3, and it is the first feature on this track that is not about sound or drawing. It answers a cost the reader pays and nobody had counted: a page read is 35–55 s, and a refresh used to spend it again.

Order: **F0 → F2 → F1 → F3**. All four are built. F0, F2 and F1 are deployed and **accepted by ear** —
F1 finished 2026-08-14 and the friends who asked for it liked the result. F2 came first among the
visible ones because it has the best payoff per hour. ⚠ **F3 is the one that has passed only machine
checks**: nothing about it has been judged by an eye yet (check 25 in
[../MANUAL_CHECKS-FEATURES.md](../MANUAL_CHECKS-FEATURES.md)).

⚠ **The artwork cost moved off this table on 2026-08-15.** It said "own artwork" for weeks, which read
as *you must draw a violin* and was the reason F3 looked expensive. It is not what the rule meant, and
it is no longer what F3 needs — see the section below.

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
what check 23 in [../MANUAL_CHECKS-FEATURES.md](../MANUAL_CHECKS-FEATURES.md) was for. ⚠ The standard here is one
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
  ⚠ **Amended 2026-09-04**: opening the *Enstrüman üzerinde* tab now counts as a selection and starts
  the download for the instrument its picker shows ([DECISIONS.md](../DECISIONS.md)). Nothing else
  changed — no voice loads on a bare visit, and the Nota tab still loads none.
- Serve from a **Hugging Face Hub repo** behind **`VITE_VOICES_URL`** — its own variable, *not* the
  drums' `VITE_AUDIO_URL` (owner, 2026-08-12: percussion is essential and stays on the app, and one
  base for both would 404 the drums). **Not committed to git**: ~50 MB of binaries in a public repo
  is permanent.
- **Cache in the browser like the weights do.** ⚠ `loadStrokeKit.ts` says Cache Storage is not worth
  a second invalidation path — that is **true for 660 KB of drums and false at 20 MB**. Copy
  `graphBytes` in `omr/session.ts` instead of inheriting the drum comment.
- `MAX_AUDIO_MB = 1` in `prune-dist.mjs` **stays at 1**. It is what forces all of the above.

⚠ **F1 was expected to inherit an answered hosting question and did not** (written 2026-08-11,
corrected 2026-08-12). Pointing `loadStrokeKit.ts`'s `VITE_AUDIO_URL` at a Hub fails: it is one base
for the whole `audio/` tree and would take the drums with it. F1 got `VITE_VOICES_URL` and its own
loader. At **~20 MB per instrument** the **first** voice trips `MAX_AUDIO_MB`, not the third.

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

Where each instrument's audio may come from: **[audio-policy.md](audio-policy.md)** below.

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

## F3 — the instrument tab → [fingerboard.md](fingerboard.md) · [kanun-view.md](kanun-view.md) · [clarinet-view.md](clarinet-view.md) · [measure-card.md](measure-card.md)

Show the instrument, and show what the player does on it as the piece plays. **Three instruments,
three chapters**, because each turned out to be a different problem — behind **one tab**.

⭐ **"Enstrüman üzerinde" is one page with a dropdown** (owner, 2026-08-29), and picking an
instrument there **sets the sound too**. That is the point rather than tidiness: you see and hear
the same instrument without having to know that two separate controls existed. ⚠ The split stays
real *inside* the code — two maths modules, two views — because they are two different problems; it
was never a reason to make the user choose between two tabs. ⛔ **The piano roll was deleted the
same day** (owner: *"ona ihtiyacımız yok"*); `PitchRangeNote` survives it and is unrelated.

**Violin** (built 2026-08-16, rebuilt upright 2026-08-27) → **[fingerboard.md](fingerboard.md)**: the
licensed photo and what it does and does not buy, the calibration, the open strings, the
string-choice rule, and why a position line is tape rather than a fret.

**Kanun** (built 2026-08-29) → **[kanun-view.md](kanun-view.md)**: the 26 courses, the mandal
research, the two-pass plan, and why the instrument is drawn rather than photographed.

**Sol klarnet** (artwork landed 2026-08-29, view NOT built) → **[clarinet-view.md](clarinet-view.md)**:
the CC0 layered schematic and why no photograph was taken, and ⭐ the **lip bar** — the owner's
answer to the thing that blocked winds all along, that a koma on a clarinet is made by relaxing the
lip and not by a fingering. Four inputs are still owed before it can be built; they are listed there.

**The bar being played** (built 2026-09-04, edit path revised 2026-09-05) →
**[measure-card.md](measure-card.md)**: the fourth chapter, and the one that is not an instrument.
Every instrument view answers *where do I put my fingers*; none of them answers *what am I playing*.
So the tab carries the sounding bar beside the drawing, with arrows, a play-this-bar button, and the
usual toolbox for editing it **without leaving the tab**. ⭐ **The card IS `SheetView`, mounted a
second time with `onlyMeasure`** — same component, same document, same undo stack, so there is still
exactly ONE editor and it is now in two places rather than one.

⚠ **The 2026-08-15 "violin only" scope was reopened by the owner on 2026-08-29**, after the violin
view stood up. That is a scope change, not an overturned argument: the reasoning that made the
violin first still holds, and the kanun and the clarinet qualified on the same ground — each is
already a shipped F1 voice, so a user can hear and see the same instrument. The **ney** and the
tanbur's fret table stay in [fingerboard.md](fingerboard.md) as *design*, not as a queue.

⭐ **The most useful thing this pair taught is that the two views are not the same view twice.** A
violin position is a fact about one note; a kanun mandal is a lever that stays where it is put, so
its view is a state machine over the whole piece. Anyone adding a third instrument should ask which
of the two kinds it is **before** writing anything.


---

---

## F5 — the pages this browser has already read → [recent-pages.md](recent-pages.md)

✅ **DONE 2026-09-05, the day it was asked for.** A decoded page — and every edit made to it
afterwards — is written to the reader's own browser store and offered back by name after a refresh.
**No server, no account, no bill**, which is the constraint the owner set in the asking: *"database
bağlamak maliyetli olabilir ama tarayıcıda tutabiliriz"*.

Four decisions, all the owner's: **notes only** (the uploaded photograph is never stored — 2–5 MB
against the ~60–125 KB of the score it produced), **the edited state** rather than the raw decode,
**30 pages** with the least recently opened dropped, and **no download button** (offered, declined).

⛔ **It is a CACHE and not a save, and the interface says so.** No browser storage can promise
otherwise, and it belongs to one browser on one device. The full design, the six traps and the DOM
contract: **[recent-pages.md](recent-pages.md)**.

---

## What this track does NOT change

- **Cloud Run cost is unchanged.** The server decodes images; none of these features call it.
- **The only new hosting need is static assets** (audio, artwork) — bandwidth, not compute.
- **Client CPU is a non-issue.** Sample playback is negligible beside the ONNX decode that was moved
  off the client in the first place.
- **The mobile split holds.** Stroke patterns, fingering maths and timing are pure data + maths and
  belong in `packages/core`; only sound-making stays in the web backend. `usul.ts` is the model.
- **The model track is untouched.** Nothing here reads or writes `apps/web/src/omr/`, the exam, or
  any corpus.

The real cost of this track is **assets and curation** — recordings, verified usul strokes, a
licence-checked photograph — not infrastructure. Budget time, not money.
