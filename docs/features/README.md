# Feature track — what to build after the beta

purpose: the plan for the post-beta feature ideas (instrument voices, usul percussion, the fingerboard tab)
audience: agents and the owner working the product side, once W10 is out
updated: 2026-08-11

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
| **F1** | Instrument voices (ney, oud, kemençe, clarinet, …) | medium | no | CC0 hunting + one ney recording | not started |
| **F2** | Usul percussion (darbuka, tef) | **smallest** | no | correct stroke patterns | ✅ **BUILT 2026-08-11**, synthesised; stroke tables await the owner's ear |
| **F3** | Fingerboard tab — where to put your finger, in time | medium | no | own artwork + a string-choice rule | not started |

Order: **F0 → F2 → F1 → F3**. The first two are built (owner, 2026-08-10 — the two tracks were
re-confirmed as parallel and this one was opened on `main`, since it shares no file with Round 3).
F2 came first among the visible ones because it has the best payoff per hour.

⚠ **F2 shipped SYNTHESISED, not sampled** (owner decision 2026-08-10). Düm/tek/ka are made with an
oscillator and a noise burst in `webAudioBackend.ts`, so the feature works end to end with **no
download, no licence question and nothing to keep out of `dist/`** — the same "Level 0 first"
reasoning F1 argues for itself below. The CC0 files in [audio-sources.md](audio-sources.md) are
still the plan; they swap in behind `scheduleStroke` without touching core or the UI, and only then
does the swap discipline start to apply.

⚠ **The stroke tables are drafted, not verified.** All 10 usuls in `USULS` have a `strokes` array;
six are the standard simple forms and four (marked `[derived]` in the source) are our reduction of
that usul's own beat grouping. `npm test` checks that they are well-formed — inside the cycle,
ascending, opening on a düm — and **cannot check that they are musically right**. That is the ears
check in [../MANUAL_CHECKS.md](../MANUAL_CHECKS.md) and it is owed.

---

## Audio assets — what may be used

F1 and F2 both need sound files, and the owner asked (2026-08-08) whether audio can be taken from the
internet while the app is free, and replaced with own recordings if it is ever monetised. **Yes —
that plan is legal and it works.** But "non-profit" is not what makes an asset safe, and the rule
that actually rules things out is a different one.

### Five categories — three usable, two not

| Category | Usable now? | The condition |
|---|---|---|
| **CC0 / public domain** | Yes | **None.** Any use, forever, including commercial |
| **CC BY** (attribution) | Yes | **One line in `/THIRD-PARTY.txt`**, and it is then safe commercially forever — no future swap owed |
| **CC BY-NC** | **Yes**, while the app is free | Must be removed before charging for anything |
| **Unknown licence** ("found on the internet") | **No** | There is no permission to rely on, free app or not |
| **"No redistribution" packs** (most commercial libraries, paid included) | **No** | See below |

⚠ **CC BY was missing from the first version of this table** (added 2026-08-09) and the omission
mattered: it is not a lesser NC, it is a *cleared* category that costs an attribution line, and it
is where the only free ney material lives. ⚠ **CC BY-SA is a different thing** — ShareAlike raises
the same open question as the SymbTr weights ([../THIRD-PARTY.md](../THIRD-PARTY.md)); treat it as
unresolved, not as CC BY.

NC is the *safe* one of the restricted options — it simply carries a bill if the app is ever
monetised. The two that block outright are the last two.

⚠ **The non-obvious one: "no redistribution".** Most sample packs — **including ones you pay for** —
permit using the sounds *inside a musical work* but forbid distributing the sample files themselves
("…in any form where they can be extracted"). A web app serves the raw file to every visitor, who
can save it straight out of the network tab. **That is precisely the forbidden act**, so a normal
commercial library cannot be used here even after paying for it. Buying a better library is not the
escape hatch it looks like.

### What CC0 actually covers — and where it runs out

**Well covered:** hand percussion, and the Western orchestra/band via community CC0 libraries
(Versilian's VCSL and VSCO 2 Community Edition are the usual starting points — verify the licence on
the project's own page, licences change).

**Thin to nonexistent:** ney, oud, tanbur, kemençe, zurna. Nobody has built a free public-domain
Turkish instrument library, which is the same gap that gives this app a reason to exist.

**Measured on 2026-08-09** rather than assumed — the per-file shortlist, with every licence read on
its own source page, is **[audio-sources.md](audio-sources.md)**. Two corrections came out of it:
**kanun is covered after all** (a CC0 chromatic set of isolated notes exists, from the CompMusic
project), and **ney is confirmed empty** under CC0, with one CC BY scale recording as a stopgap.

⚠ **"A recording exists" is not "a sample set exists."** A sampler needs notes at matched tone,
level and room, with clean starts. What turns up on upload sites is usually one person's phrase in
one room — unusable as an instrument even when the licence is perfect. And CC0 means free of
conditions, **not good**; quality ranges from excellent to unusable.

### The plan this leads to

| Instrument | Source | Cost |
|---|---|---|
| Darbuka, tef, bendir, zil | **CC0** — VCSL, plus a CompMusic düm/tek take | ~1 hour |
| Clarinet, violin | **CC0** — VSCO 2 Community Edition | ~1 hour |
| **Kanun** | **CC0** — a chromatic isolated-note recording (found 2026-08-09); A/B it against Karplus–Strong | ~1 hour |
| **Oud, tanbur** | **Karplus–Strong — no files at all** | code, not hunting |
| **Ney** | **Own recording** (one CC BY scale exists as a stopgap) | one evening |

Which file, from where, and what each still needs before it plays:
**[audio-sources.md](audio-sources.md)**.

This needs **no NC content anywhere**, which is why it is the recommended path: for percussion and
clarinet, CC0 is no harder to find than NC, so taking NC would buy a future obligation for nothing.
Where CC0 is genuinely thin (ney above all), **taking an NC file is a reasonable trade** rather than
stalling the feature — under the swap discipline below.

⚠ Note what NC would partly undo. On 2026-08-08 the owner chose **removal over attribution** for the
scores specifically to keep the app commercially unencumbered ([../DECISIONS.md](../DECISIONS.md),
[../THIRD-PARTY.md](../THIRD-PARTY.md)). NC audio re-introduces that bind in a different corner of
the same app. That is a defensible call to make differently for audio than for scores — but it
should be made on purpose, not by accident.

### Recording your own is more viable than it sounds

The owner plays ney and clarinet, is self-described amateur, and has no good microphone. For a
**sampler** that mostly does not matter:

- A sampler needs **one steady sustained note per pitch, ~2 seconds**. No phrasing, no tempo, no
  expression. Sounding good across a phrase is a performing skill; holding one clean tone is not the
  same skill, and the bar is far lower. Every note can be retaken twenty times.
- For single held notes **the room matters more than the microphone**. A phone at arm's length in a
  quiet room at night is adequate; steady background hum is the enemy, and steady hum against a
  steady note is the easy case to clean up.
- Ney is the instrument with no CC0 coverage *and* the one this app is most likely to be used with,
  so the owner is plausibly the cheapest available source of ney samples. Worth one evening before
  concluding otherwise.

### The swap discipline — required whatever is chosen

These three rules are what keep "replace it later" a one-evening job instead of impossible. They
apply to CC0 files too, because the audit question is asked of every file, not just the restricted
ones.

1. **Never bundle audio into the app.** Every sample stays a separate file loaded by URL — the way
   weights come from `VITE_WEIGHTS_URL` and never from `dist/`.
2. **A manifest with `source` and `license` on every file, from the first one.** This is the rule
   that matters. These things do not fail as lawsuits; they fail as *"I no longer know where four of
   these came from"*, which makes the set unauditable and the swap impossible.
3. **Add each file to the third-party notices as it lands**, extending the existing
   `/THIRD-PARTY.txt`, never starting a second system.

⚠ Two cautions when downloading: verify the licence **on the source's own page**, not on a blog or an
aggregator that says "free" (free-to-download is not a licence); and on user-upload sites **CC0 is a
claim by the uploader**, who cannot grant rights they never held — an obviously ripped commercial
recording tagged CC0 is still unusable.

---

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

**Level 1 — recorded samples.**
~25–35 notes per instrument (one per semitone over ~2.5 octaves), mono, compressed. Order of
**0.5–1 MB per instrument** — an estimate, not a measurement; measure before promising it. Rules:

- Load **only on selection**. Never in the main bundle.
- Serve from the same place the weights come from (the Hub) behind an env URL, mirroring
  `VITE_WEIGHTS_URL`; cache in the browser.
- Add a guard so audio assets cannot leak into `dist/`, the way `prune-dist.mjs` guards scores.

⚠ **A first version does not need 25–35 notes.** One good note per instrument, stretched by
`playbackRate`, covers roughly ±5–6 semitones before it starts sounding thin or chipmunky. That is
enough to hear an instrument choice working, and it turns the asset problem from "build a sample
set" into "find one usable note". Add notes later, only where it sounds worst.

Where each instrument's audio may come from: **[Audio assets](#audio-assets--what-may-be-used)**
below.

### Where the code goes

Instrument choice is a **play option**, like `clicks` in `PlayOptions` — so the timeline, the core
and a future native backend are untouched. Sound-making stays in the web backend; nothing about
instruments belongs in `packages/core`.

---

## F2 — usul percussion ✅ BUILT 2026-08-11

**Built as designed**, with the asset half deferred (synthesised strokes — see the ⚠ above). The
brief below stands as the description of what was made; the three numbered steps all landed.

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
   thing you drag.

⚠ **Loudness was not the whole problem, and the first fix would have been the wrong one** (owner:
*"I barely can hear the rhythms"*, 2026-08-11). The düm was a sine sweeping 115 → 55 Hz — the right
musical shape, numerically the loudest thing in the mix, and nearly inaudible on a laptop, because a
MacBook speaker rolls off hard below ~200 Hz. Turning the gain up would have made an inaudible thing
inaudible and distorted. It now carries a short ~400 Hz attack on top of the low body, so the small
speaker gets the hit and headphones still get the weight. Worth remembering before reaching for a
level to solve a balance.

Assets: **three sounds per instrument** (düm / tek / ka), well under a second each — the easiest
asset hunt in this track, and the licence work is **done**: VCSL's darbuka (5 hit types × 2
velocities × 2 round-robins) and frame drum, plus a CC0 CompMusic take of düm and tek on a real
bendir. Files and licences: **[audio-sources.md](audio-sources.md)**. No drum, mic or player is
needed. ⚠ **Nothing is downloaded yet** — what shipped synthesises the three strokes instead, so
this is the next move on F2 rather than a finished step.

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
