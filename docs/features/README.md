# Feature track — what to build after the beta

purpose: the feature track — voices, usul percussion, the instrument views — plus the stored pages and the visit counter
audience: agents and the owner working the product side
updated: 2026-11-20

> Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
> Decisions: [../DECISIONS.md](../DECISIONS.md). Licences: [../THIRD-PARTY.md](../THIRD-PARTY.md).
> The MVP ladder that produced the beta: [archive/phases.md](../archive/phases.md#mvp-track--the-in-browser-pipeline-and-a-release-to-friends-closed).

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
| **F3** | Instrument tab — where to put your finger / where the mandals stand / how far the lip relaxes, in time | medium | no | calibration + a string-choice rule (violin); an instrument data table (kanun); a fingering table + the lip-bend bound (clarinet) | ✅ **VIOLIN DONE 2026-08-16** (finger numbers 2026-10-01), ✅ **KANUN DONE 2026-08-29**, ✅ **SOL KLARNET DONE 2026-09-04** (lip meter; altissimo Re♭6–Sol6 in the table). All deployed; none has been **judged by a person's eye** yet (MANUAL_CHECKS-FEATURES checks 25–26) |
| **F5** | Remember the pages this browser has already read | **small** | no | none — it is browser storage, not a database | ✅ **DONE 2026-09-05** — a decoded page and its edits survive a refresh; 30 pages, oldest dropped |
| **F6** | Count the visits to the deployed site, anonymously, and show the owner a dashboard | **small** | Netlify Functions | none — no new service and no new bill; the privacy contract is the design | ✅ **BUILT 2026-09-05** — anonymous, no IP stored, dashboard never published. Needs `STATS_SALT` + `STATS_TOKEN` set on the site: [README.md § F6 — the visit counter, and the owner's private dashboard](#f6--the-visit-counter-and-the-owners-private-dashboard) |
| **F4** | Listening mirror — a live microtonal tuner drawn on F3's fingerboard | medium | no | pitch-tracker steadiness at 22.6 cents/koma, unmeasured | ⏸ **PARKED 2026-08-25** (owner) — after the public launch; **not** audio-to-score. Reasoning and what was ruled out: [../BACKLOG.md](../BACKLOG.md) |

**The other product docs in this folder** — app-wide, not numbered features:

| | Doc | State |
|---|---|---|
| The phone | [phone.md](phone.md) | ✅ rebuilt 2026-09-26..28 and deployed; the phone shell's own component tree is still owed ([../STATUS.md](../STATUS.md)) |
| The look (Tezhip) | [phone.md § The look — Tezhip palette, the stylesheet's layers, and the render pin](phone.md#the-look--tezhip-palette-the-stylesheets-layers-and-the-render-pin) | ✅ built 2026-09-30, deployed 2026-10-05 with the logo and the backdrop |
| Closed-test feedback: every problem found, and its state | [play-store.md § Closed-test feedback — every problem found since the Play test…](play-store.md#closed-test-feedback--every-problem-found-since-the-play-test-began-and-what-happened-to-it) | 🚧 started 2026-10-14 — the source for Play's production questionnaire |
| The Play Store app | [play-store.md](play-store.md) | 🚧 package built 2026-10-05; closed test not started ([../STATUS.md](../STATUS.md)) |
| Saving the score (PNG / PDF) | [../DECISIONS.md](../DECISIONS.md) (2026-09-27) | ✅ deployed 2026-09-28 |

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
are visible from a licence table. See [THIRD-PARTY.md § Audio sources — the verified files, and what each one still needs](../THIRD-PARTY.md#audio-sources--the-verified-files-and-what-each-one-still-needs).

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
[THIRD-PARTY.md § Audio sources — the verified files, and what each one still needs](../THIRD-PARTY.md#audio-sources--the-verified-files-and-what-each-one-still-needs). The account, including what the measurement caught that
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

## Audio assets — what may be used → [THIRD-PARTY.md § Audio policy — what may be used, and the rules every file obeys](../THIRD-PARTY.md#audio-policy--what-may-be-used-and-the-rules-every-file-obeys)

Moved 2026-08-11, when this file hit its 400-line cap. That section is *policy* — which licence
categories may be used, the swap discipline every file must obey, and why recording your own is
more viable than it sounds — while this file is the feature briefs. The per-file shopping list
stays in [THIRD-PARTY.md § Audio sources — the verified files, and what each one still needs](../THIRD-PARTY.md#audio-sources--the-verified-files-and-what-each-one-still-needs).

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
([THIRD-PARTY.md § Audio sources — the verified files, and what each one still needs](../THIRD-PARTY.md#audio-sources--the-verified-files-and-what-each-one-still-needs)), so that one can be decided by ear rather than by necessity.

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

Where each instrument's audio may come from: **[THIRD-PARTY.md § Audio policy — what may be used, and the rules every file obeys](../THIRD-PARTY.md#audio-policy--what-may-be-used-and-the-rules-every-file-obeys)** below.

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

1. **`ml/prep/prepare_strokes.py`** downloads the VCSL originals, **measures** them to pick which
   articulation is a düm, then trims, mono-downmixes and levels them into `public/audio/<kit>/`.
   Freesound's bendir take was **not** needed and stays deferred — VCSL is on GitHub, so no account
   and no manual step. See [THIRD-PARTY.md § Audio sources — the verified files, and what each one still needs](../THIRD-PARTY.md#audio-sources--the-verified-files-and-what-each-one-still-needs).
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
player was needed. Files and licences: **[THIRD-PARTY.md § Audio sources — the verified files, and what each one still needs](../THIRD-PARTY.md#audio-sources--the-verified-files-and-what-each-one-still-needs)**.

⚠ **The risk here is data, not code.** Düyek, Aksak, Curcuna and the rest have canonical stroke
patterns, and a wrong one is immediately obvious to anyone who knows the repertoire. Keep them as
plain reviewable data next to `USULS`, cite the source, and have the owner check them. A score
already carries a `usul` field, so the right pattern can be selected without asking.

This is pure data + scheduling maths, so it stays in `packages/core` and ports to mobile unchanged —
the same reasoning that put `usul.ts` there.

---

## F3 — the instrument tab → [instruments.md § F3 — the fingerboard tab](instruments.md#f3--the-fingerboard-tab) · [kanun.md § F3 — the kanun view](kanun.md#f3--the-kanun-view) · [instruments.md § F3 — the clarinet view](instruments.md#f3--the-clarinet-view) · [instruments.md § F3 — the bar beside the instrument](instruments.md#f3--the-bar-beside-the-instrument)

Show the instrument, and show what the player does on it as the piece plays. **Three instruments,
three chapters**, because each turned out to be a different problem — behind **one tab**.

⭐ **"Enstrüman üzerinde" is one page with a dropdown** (owner, 2026-08-29), and picking an
instrument there **sets the sound too**. That is the point rather than tidiness: you see and hear
the same instrument without having to know that two separate controls existed. ⚠ The split stays
real *inside* the code — two maths modules, two views — because they are two different problems; it
was never a reason to make the user choose between two tabs. ⛔ **The piano roll was deleted the
same day** (owner: *"ona ihtiyacımız yok"*); `PitchRangeNote` survives it and is unrelated.

**Violin** (built 2026-08-16, rebuilt upright 2026-08-27) → **[instruments.md § F3 — the fingerboard tab](instruments.md#f3--the-fingerboard-tab)**: the
licensed photo and what it does and does not buy, the calibration, the open strings, the
string-choice rule, and why a position line is tape rather than a fret.

**Kanun** (built 2026-08-29) → **[kanun.md § F3 — the kanun view](kanun.md#f3--the-kanun-view)**: the 26 courses, the mandal
research, the two-pass plan, and why the instrument is drawn rather than photographed.

**Sol klarnet** (built 2026-08-29..09-04) → **[instruments.md § F3 — the clarinet view](instruments.md#f3--the-clarinet-view)**: the licensed
photograph of a German-system clarinet (the CC0 schematic was withdrawn the day it was taken), the
fingering table, and ⭐ the **lip meter** — the owner's answer to the thing that blocked winds all
along, that a koma on a clarinet is made by relaxing the lip and not by a fingering.

**The bar being played** (built 2026-09-04, edit path revised 2026-09-05) →
**[instruments.md § F3 — the bar beside the instrument](instruments.md#f3--the-bar-beside-the-instrument)**: the fourth chapter, and the one that is not an instrument.
Every instrument view answers *where do I put my fingers*; none of them answers *what am I playing*.
So the tab carries the sounding bar beside the drawing, with arrows, a play-this-bar button, and the
usual toolbox for editing it **without leaving the tab**. ⭐ **The card IS `SheetView`, mounted a
second time with `onlyMeasure`** — same component, same document, same undo stack, so there is still
exactly ONE editor and it is now in two places rather than one.

⚠ **The 2026-08-15 "violin only" scope was reopened by the owner on 2026-08-29**, after the violin
view stood up. That is a scope change, not an overturned argument: the reasoning that made the
violin first still holds, and the kanun and the clarinet qualified on the same ground — each is
already a shipped F1 voice, so a user can hear and see the same instrument. The **ney** and the
tanbur's fret table stay in [instruments.md § F3 — the fingerboard tab](instruments.md#f3--the-fingerboard-tab) as *design*, not as a queue.

⭐ **The most useful thing this pair taught is that the two views are not the same view twice.** A
violin position is a fact about one note; a kanun mandal is a lever that stays where it is put, so
its view is a state machine over the whole piece. Anyone adding a third instrument should ask which
of the two kinds it is **before** writing anything.


---

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

**Merged into this file on 2026-11-20:**

- [F5 — the pages this browser has already read](#f5--the-pages-this-browser-has-already-read) — was `docs/features/README.md`
- [F6 — the visit counter, and the owner's private dashboard](#f6--the-visit-counter-and-the-owners-private-dashboard) — was `docs/features/README.md`


## F5 — the pages this browser has already read

*Was `docs/features/README.md` (last updated 2026-09-05).*

> Current state is in [../STATUS.md](../STATUS.md). The decisions are one line each in
> [../DECISIONS.md](../DECISIONS.md); the track index is [README.md](README.md). The editor whose
> edits this remembers is [app/editor.md](../app/editor.md).

Keep a decoded page on the reader's own machine, so a refresh does not throw it away.

### Why it exists

A read costs **35–55 seconds** and, since 2026-09-04, a round trip to Cloud Run. Before this, a page
refresh — or a phone putting the tab to sleep, or a mis-tapped back gesture — lost every one of
those seconds and every edit made afterwards, and the only recovery was to upload the photograph
and read it again.

The owner asked on **2026-09-05**, and framed the constraint in the same sentence: *"database
bağlamak maliyetli olabilir ama tarayıcıda tutabiliriz"* — a database would cost money, the browser
would not. That is the whole shape of the feature. **No server, no account, no bill.**

### What it is

Three files:

* `apps/web/src/recentPages.ts` — the store. Two IndexedDB object stores, the limits, the eviction.
* `apps/web/src/ui/RecentPages.tsx` — `#recent`, the list between the upload box and the score.
* `App.tsx` — three moving parts: read the list on arrival, write the score back after the edits
  stop, install a row when it is clicked.

### The four decisions the owner made

| | Decision | Why |
|---|---|---|
| **Notes only** | The score is stored; **the uploaded image never is.** | A phone photograph is 2–5 MB against the ~60–125 KB of the score it produced — fifty times the space for a picture the reader already has on their phone. |
| **The edited state** | Not the raw decode: whatever the score is now, corrections included. | The decode is the cheap half of the reader's investment. Losing the corrections would lose the expensive half. |
| **30 pages** | The 31st read drops the least recently opened. | Not a storage limit — 30 scores is ~3.6 MB. It is a **list** limit: a list of 200 pages is not a list anybody reads. One constant, `MAX_PAGES`. |
| **No download button** | Offered and declined. | — |
| **Renameable** | The page on screen **and** any older one. | A file stem like `IMG_20260905_142233` tells you nothing about which piece it is (owner, same day: *"kullanıcı sayfalarını rename edebilsin. hem current olanı hem de eskileri"*). |
| **The makam rides along** | Drawn **beside** the name, never inside it (owner: *"makamı da isme dahil olsun"*). | It is re-read from the score on every save, so it survives a rename and follows the reader changing the makam later. Baked into the name string it would go stale on any of those, and a rename would delete it. |

### How it works

**Where.** IndexedDB, not `localStorage`, and size is **not** the reason. Two reasons that are:

1. *"The edited state"* means writing on every edit (debounced two seconds). `localStorage` is
   **synchronous** — a ~100 KB write blocks the main thread while someone is dragging a note.
2. `localStorage`'s ~5 MB is **one budget shared** with the three settings the app already keeps
   there (the follow toggle, the toolbox's spot, the decode-URL override). Filling it would break
   those and not this.

**Two object stores, and the split is the design.** `pageMeta` holds the few facts the list draws
(name, dates, note and bar counts, size); `pageBody` holds the score as a JSON string. Listing 30
pages therefore reads ~3 KB and not ~3.6 MB — IndexedDB has no way to read half a record.

**One save path.** There is deliberately **no explicit save call after a decode.** A decode opens a
record (`saved` in `App.tsx`); an effect writes whatever document is on screen back to that record
two seconds after it last changed. The first write and the thousandth edit are the same line of
code, so no future load path can install a page the store never hears about — and undo/redo are
remembered for free, because `history.doc` is a new object per edit and the effect sees exactly
those.

**Only a decode opens a record.** A `?score=` page, a bundled sample and a hand-loaded JSON all
clear it. The list is *pages you have read*, not *scores you have opened* — which is also what stops
the browser checks' own fixtures filling a reader's list.

**Eviction is a true LRU.** `readPage` touches `updatedAt`, so the page you came back to yesterday
outlives one decoded last week and never looked at since.

### Renaming

Two places, one box. `ui/RenameField.tsx` owns the keyboard rules — **Enter commits, Esc cancels,
blur commits**, an empty name is a cancel, and the contents are selected on mount because a rename
is usually a replacement. Each caller owns only whether it is editing:

* **a row in `#recent`** — ✎ swaps the row for the box;
* **the score card's heading** — `#score-rename` swaps the title for the box, which is how the page
  you are *looking at* is renamed without opening the list.

⚠ **The heading shows the STORED name (`pageName`), not `doc.name`, and that is what stops a rename
drifting.** Renaming through the document was the other option and is a trap: `doc.name` seeds a
per-piece hash that decides whether `SheetView` draws a tuplet as a bracket or as a curved arc, so
renaming a page would silently re-engrave its triplets. The document keeps its identity; the record
carries the label. A score that is not a stored page passes `pageId: null` and the heading falls back
to `doc.title || doc.name` exactly as before, with no pencil — absent, not disabled.

⚠ **`renamePage` writes `pageMeta` only** (~100 bytes, cannot fail on quota) and deliberately does
**not** bump `updatedAt`. Everywhere else a touch means *the reader used this page* and decides
eviction; here it would re-sort the list under the cursor at the moment someone is looking at the row
they just typed into. Renaming is labelling, not use.

### The traps, all of them paid for

⚠ **`Date.now()` alone is not a clock.** Two records written in the same millisecond share an
`updatedAt`, and `sort` then falls back to what `getAll` returned — IndexedDB **key order**, i.e.
alphabetical by id. The list comes out wrong and eviction drops the wrong page. Measured: storing 30
pages in a loop kept `page-30 … page-4` instead of `page-31 … page-2`. The fix is a counter that
forces the stamp to move (`stamp()`).

⚠ **Everything in `recentPages.ts` swallows and returns a safe value** — the same rule the
`localStorage` readers already follow. Storage is not merely empty in a private window; it can
**throw**, and a browser that cannot remember pages must still read them. A caller may treat every
result as *there is nothing*, never as an error to show.

⚠ **The model's raw tokens are NOT stored**, so `openRecent` clears `rawDecode`. Without that, the
decode inspector shows the *previous* page's tokens underneath this page's notes.

⚠ **A restored page must not raise the makam modal again.** The makam was answered for when the page
was first read and `loadDoc` wrote it into the document, so `openRecent` hands in no fresh guess and
`resolveMakam` recovers the answer. A second modal would also block every later click.

⚠ **The ✕ leaves the score on screen.** It says *drop this from the list*; closing someone's open
page because they tidied a list is not that. Dropping `saved` is what makes it stick.

⚠ **A stored page's bar count is real only because the document is post-`assignBars`.** A raw score
JSON carries no `bar` field — `loadDoc` assigns them — so anything written to the store must come
from `history.doc` and never from a fetched file. Verified: 8 bars, not 0.

⚠ **A rename must move `saved` as well as the store, or the next keystroke undoes it.** The save
effect writes `saved.name` back with the document, so a rename that reached only IndexedDB would be
silently REVERTED two seconds after the reader's next edit. `renameRecent` sets both. The check for
it is deliberately *rename → edit → wait past the debounce → re-read*, because every assertion made
before that edit passes either way.

⚠ **A grid item's `min-width` is `auto`, and that killed every truncation below it** (measured). The
row is a grid item; it refused to shrink below its longest page name and pushed the whole document
wider — **623 px of page in a 390 px phone**, with the name running off the right edge and no
ellipsis anywhere. `min-width: 0` on `.kv-recent__item` is what makes `.kv-recent__stem`'s ellipsis
fire at all. ⚠ It was invisible to `smoke:phone`, which loads its fixture through `?score=` and
therefore never draws this list.

⚠ **The rename box is a text input, so it needs the phone's 16px rule.** It is listed inside the
`(pointer: coarse)` block beside `.kv-field`'s inputs: under 16px iOS Safari zooms the whole app in
on focus and never back.

### What it is NOT

⛔ **It is a cache, not a save, and the interface says so** (`TR.recent.note`). No browser storage
can promise otherwise: Safari clears a site untouched for seven days, every engine clears under disk
pressure, a private window keeps nothing. It also belongs to **one browser on one device** — a page
read on the phone is not there on the laptop.

⛔ **A restored page cannot be re-decoded or re-sliced.** The crops are gone with the image.

⚠ **The footer's `privacy` line is untouched and still literally true** — it speaks about the
server, and nothing here reaches the server. But the reason there is nothing to qualify is the
notes-only decision above: **put an image in this store and that line needs re-reading.**

### Where the checks are

`smoke:app` is the **only** check that can see this at all, because the store is written for a
decode and for nothing else — `smoke:editor` loads its fixture through `?score=` and is blind to it
by design. Its arm decodes a page, reloads the browser, and asserts the page is listed, reopens with
the same note count, is marked `data-current`, and raises no makam modal — then renames it from the
score card's heading and **reloads a second time**, because a rename that reached only React state
or only the store would pass everything asserted before that line.

The DOM contract, which is what those assertions read (never the copy):
`#recent[data-omr="recent"][data-count][data-open][data-current]`, one
`[data-omr="recent-item"][data-page-id][data-page-name][data-page-makam]` per row carrying
`[data-omr="recent-open"]`, `[data-omr="recent-rename"]` and `[data-omr="recent-remove"]`, plus
`#recent-toggle`, `#recent-clear`, `#score-rename`, `[data-omr="score-name"]` and the box itself,
`[data-omr="rename-input"][data-page-id]`. **`data-count` is the load-bearing one** — it is the only
proof a page was stored at all — and **`data-page-name` is what a rename is asserted on**: a page
name is user DATA, not copy, so reading it off an attribute is the standing rule rather than an
exception to it.


## F6 — the visit counter, and the owner's private dashboard

*Was `docs/features/README.md` (last updated 2026-10-14).*

> Current state is in [../STATUS.md](../STATUS.md). The decision is one line in
> [../DECISIONS.md](../DECISIONS.md); the track index is [README.md](README.md). What the OLD
> request-log estimates said, and why they were so hard to sharpen: [METRICS.md § Metrics — who actually uses the deployed app](../METRICS.md#metrics--who-actually-uses-the-deployed-app).

Answer "kaç kişi girdi?" with a counter built for the question, instead of reading tea leaves in a
request log — and answer it without learning anything about anybody.

### Why it exists

The question was already being asked, and it was being answered badly. The app pings Cloud Run's
`/health` when it opens, so that service's ordinary request log became an accidental visit counter
([METRICS.md § Metrics — who actually uses the deployed app](../METRICS.md#metrics--who-actually-uses-the-deployed-app)). It could not do the job. Robots dominate it. It has no
session, no cookie and no client id, so it cannot tell one phone visiting twice from two phones
visiting once — the standing answer there is literally *"≥1 stranger, ≤2, the log cannot say which"*.
Every sharpening of its numbers came from the owner supplying by hand what the log could not: that
nobody in this circle runs Linux, that one of the phones was the owner's own.

This replaces the guessing. It counts two events, it separates robots from people, and it counts
devices rather than requests.

### What was decided, and what was turned down (owner, 2026-09-05)

| Question | Answer | Why |
|---|---|---|
| **Names?** | **No.** Anonymous counting only | Named invite links (`?k=ahmet`) and a real login were both offered and declined. There is no account system to build and no name to leak |
| **Where?** | **Netlify Functions + Blobs** | The site is already deployed there ([server.md § Running and deploying the decode server — the commands](../app/server.md#running-and-deploying-the-decode-server--the-commands)); no new service, no new bill, and the Cloud Run decoder stays a pure function of pixels |
| **Who may read it?** | **The owner only, and the page is never published** | See "Two locks" below |
| **What is stored?** | **Daily totals only** — no IP, no location, no identifier (since 2026-10-14; a salted daily hash and a country before) | Owner, 2026-10-14: neither was needed, and the Play Data safety form can then declare app interactions only |

### The privacy contract

This is the part to read before changing anything.

- ⭐ **No identifier and no location, since 2026-10-14** (owner: *"konum ve cihaz kimliğinin
  tutulmasına çok gerek yok"*). `visit.mts` never reads the request's IP or its geo. A row is a
  **bucket** — every visit on one day from one kind of browser (device type · OS · browser · robot),
  summed. The price, accepted: **"how many different people came" cannot be answered**, only
  openings and reads. ⚠ The Play Store's **Data safety** form declares app interactions only, and is
  true only while this holds — add an id or a country back and that form must change the same day.
  Until 2026-10-14 the key was a salted, nightly-expiring hash of the IP and the row held a country;
  `stats.mts` deletes every such `d/` row on its next read.
- **No cookie, no `localStorage`, no fingerprint.** Nothing is written on the visitor's machine by
  the counter at all. The one exception is the owner's own opt-out flag, below.
- **The referrer keeps its host and loses its path**, which is where a search query would hide.
- **Uploads are untouched by all of this.** No image, no score, no filename ever reaches the counter.
- **Rows are deleted after `RETAIN_DAYS` (180)**, swept lazily whenever the dashboard is opened — so
  the retention period is code that runs, not a promise in a document.
- **The visitor is told.** `TR.footer.counting` says so on the page: *"Ziyaretler anonim sayılır:
  çerez yok, IP adresi saklanmaz."*, and `privacy.html` lists exactly what a bucket holds. ⚠ Both are
  statements of fact about the code and move with it.

⚠ **`STATS_SALT` is only the on-switch now.** Its value is never used; with it unset `visit.mts`
records nothing and the dashboard says so in a yellow box.

### Two locks, and why there are two

**The dashboard is never published.** `apps/web/admin-stats.html` is not an entry in the build:
vite builds `index.html` and nothing else, so no route, no bundle and no file in `dist/` comes from
it. It is served by the dev server (`npm run stats:ui`) and nowhere else. ⛔ Do not add it to
`build.rollupOptions.input`, and do not move its logic under a path `index.html` can reach.

**The data needs the token wherever it is asked for.** `stats.mts` demands
`Authorization: Bearer <STATS_TOKEN>` and answers **503, not 200,** when no token is configured —
because the failure mode worth engineering against is an endpoint that serves everyone while the
owner believes it is private. This is also what lets the CORS allowlist open for `localhost` without
opening the data.

Neither lock depends on the other. Hiding the page is not security; requiring the token is.

### What is counted

Two events, and the difference between them is the whole point.

| Event | Fired when | What it means |
|---|---|---|
| `open` | the app mounts | somebody, or something, loaded the page |
| `read` | a page has been decoded into notes | **a human used the product** |

⭐ **`read` is the number to trust.** A robot loads a page constantly; it does not photograph sheet
music and upload it. `../METRICS-USAGE.md` spent its whole length on this distinction.

**Who is not counted**, each for its own reason: the dev server (no function behind it), anything
under `navigator.webdriver` (⚠ **load-bearing** — `smoke:live` and `smoke:build` drive the real
deployed site and would otherwise be most of the traffic), `localhost`, and any device that has
opted out.

⭐ **The owner's own devices should opt out: open the site once as `?nostats=1`.** This is not a
nicety. `../METRICS-USAGE.md` records three page reads counted as visitors, one of which turned out
to be the owner's own phone and had to be subtracted by hand afterwards. `?nostats=0` undoes it.

### What a row is, and what it cannot tell you

One row is **one day, for one kind of browser**: `opens`, `reads`, the first and last visit's time
(restored the same day, owner), device type, browser with its major version, OS, a robot flag, and up
to ten referrer hosts with a count each.

⚠ **A row is not a device and not a person.** Ten friends on the same Chrome on Android are one row.

⚠ **The browser VERSION is the only evidence here that two visits came from two machines** — it is
how `../METRICS-USAGE.md` established "at least one real stranger" (Chrome/150 and Chrome/151, and
browsers never downgrade). Android's user-agent is frozen to `Android 10; K`, so nothing else in the
string discriminates. Never drop it to tidy the column.

⚠ **An `X11; Linux x86_64` user-agent is not a Linux machine.** It is what Chrome for Android sends
under "Request desktop site", and mistaking it already cost one wrong entry in
`../METRICS-USAGE.md`. The dashboard labels the column as the browser's own claim rather than
pretending otherwise; the counter cannot fix this and does not try.

⚠ **Robot detection is one-way.** What it catches really is automated; plenty of automation says
nothing at all and lands in the human column. Hence `read` over `open`, again.

⚠ **Two visits from the SAME device in the same instant can lose one count.** A row is a
read-modify-write of one blob and Netlify Blobs has no transaction. Different devices are different
keys and never collide. Against single-digit daily traffic this costs at most one opening; it is a
counter, not a ledger. If the site ever gets real traffic, that is the line to revisit first.

### Setting it up

Two secrets on the site, once. Any long random string works; `openssl` is just a convenient source.

```bash
netlify env:set STATS_SALT  "$(openssl rand -hex 32)"   # only its presence matters: the on-switch
netlify env:set STATS_TOKEN "$(openssl rand -hex 24)"   # this is what the dashboard asks for
npm run deploy:app                                      # the functions ship with the site
npm run stats:ui                                        # → http://localhost:5173/admin-stats.html
```

⚠ **`npm run deploy:app` now carries `--functions netlify/functions`.** Without that flag the site
deploys fine and the counter is simply not there — the dashboard reports the 404 in plain Turkish
rather than an empty chart, which is the failure this is easiest to miss.

Rotating `STATS_SALT` changes nothing since 2026-10-14 — its value is unused.

### Where the code is

| Part | File |
|---|---|
| What a visit is; the hash, the user-agent reading, the folding | `netlify/shared/visits.ts` |
| Write side — one event in, one row out | `netlify/functions/visit.mts` |
| Read side — the token, the window, the retention sweep | `netlify/functions/stats.mts` |
| The browser's beacon, and everyone it refuses to count | `apps/web/src/analytics/visits.ts` |
| The dashboard (never published) | `apps/web/admin-stats.html` · `apps/web/src/admin/statsPage.ts` |
| The arithmetic, pinned | `tools/tests/visits-test.ts` (`npm test`) |
