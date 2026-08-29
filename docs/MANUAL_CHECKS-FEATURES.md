# Manual checks — the feature track (F0–F3)

purpose: the see-it-yourself checks that need EARS or EYES, for the audio and instrument features
audience: the owner, verifying a feature before it ships
updated: 2026-08-16

Split out of [../MANUAL_CHECKS.md](MANUAL_CHECKS.md) on 2026-08-16, when that file hit its
400-line cap. The split is by genre, per [../MAINTAINING.md](MAINTAINING.md): everything here is
a judgement a person makes, and nothing here can be automated — that is what these checks are for.
The pipeline and model checks (9–14, 22) stayed where they were.

⚠ **Every one of these has found a defect that a fully green build had missed.** That is the case
for keeping them, and the reason a feature is not "done" when `npm test` passes. What this track
builds: [README.md](features/README.md).

## Check 23 — the usul plays its own strokes, and are they the RIGHT ones? (feature track F2, 2026-08-11)

Goal: the first ear check this track produced, and the first that is a **gate on shipping
something** (the makam check, 14, stayed in [../MANUAL_CHECKS.md](MANUAL_CHECKS.md)). `npm test` proves the stroke tables are well-formed; nothing automatable can
tell you a Düyek is wrong. Tables and their `[standard]`/`[derived]` marks:
[`packages/core/src/usul.ts`](../packages/core/src/usul.ts). Why it was built this way:
[features/README.md](features/README.md).

✅ **RUN AND PASSED 2026-08-11** — the owner listened after the real samples landed and accepted all
ten patterns (*"they sound really nice"*), the four `[derived]` ones included. **This check is no
longer owed.** Re-run it if `USULS` gains a usul or a `strokes` array is edited; the `[derived]`
four are the ones to listen to first, because they are ours rather than quoted.

1. `npm run dev:web` → open `http://localhost:5173/?score=/sample.json` (any score on disk; there is
   no Sample dropdown since 2026-08-08, so the score comes from the URL).
2. Set **Usul** to **Sofyan**, tick **Usul vuruşu**, ▶ Çal. You should hear a low **düm** on each
   downbeat and two brighter **tek**s after it, repeating every bar — on a real darbuka.
2a. **Switch `Vurmalı çalgı` between Darbuka and Bendir while it plays.** Both are real CC0
   recordings (VCSL); the bendir is deeper and woodier. ⚠ Also worth judging here: **is each kit's
   düm/tek/ka assignment right?** The darbuka's three were picked by *measurement*, not by ear —
   VCSL numbers its five articulations and never says which is which — so this is the first time a
   person hears the result. Detail: [features/audio-sources.md](features/audio-sources.md).
2b. **Drag `Vuruş sesi` while it is playing.** The strokes must get louder and quieter **smoothly,
   without the music restarting or clicking** — the slider rides a gain node rather than
   re-scheduling. ⚠ Audition on **the built-in speaker**, not only headphones: a MacBook speaker
   rolls off below ~200 Hz, which is what made the synthesised düm inaudible (owner report,
   2026-08-11) and is the bar the recordings had to pass too. A stroke that only works on
   headphones has not passed. ⚠ **Push the slider to its maximum and listen for distortion** — the
   first cut of these samples clipped ("patlamış") because a note and a düm summed past the
   destination's range. There is a limiter now; this is the step that would catch it coming back.
3. Tick **Metronom** as well. Both play; the clicks mark the beats, the strokes play the rhythm.
   They are separate controls on purpose, and where a stroke shares a beat they must sound
   **together**, not a hair apart.
4. Set **Usul** to **Düyek**. Listen for `düm — te-ke — düm — tek`: the *te-ke* is two strokes inside
   one beat, the second quieter (it is the weak hand). If düyek does not have that limp, the table is
   wrong, not the drum.
5. Take the tempo to **2×**. The strokes must stay locked to the barlines — they are built in musical
   ms from the same whole-note length the metronome uses, so drift here is a real bug.
6. **Now the part that matters.** Go through the usuls and say for each whether the pattern is right:
   Nîm Sofyan, Sofyan, Türk Aksağı, Yürük Semâi and Aksak are drafted as the standard simple forms;
   **Devr-i Hindî, Curcuna and Aksak Semâi are marked `[derived]`** — a reduction of the beat
   grouping rather than a quoted pattern — so start there. Ağır Aksak is Aksak at half speed.
7. A usul whose table were removed would show the checkbox **disabled**, saying so rather than
   playing nothing. All ten have one today, so this is a thing to know, not a step to perform.

⚠ These are the *sade* (simple) forms — the velvele, which subdivides the strokes for a fuller
sound, is deliberately not implemented. "It is too plain" is expected; "it is the wrong rhythm" is
the finding this check exists for. ⚠ If a stroke ever sounds like a synthesiser rather than a drum,
that means its **sample did not load** and the fallback is playing — check the network tab for
`/audio/`, do not report it as the sound being wrong.

## Check 24 — do the instrument voices sound like instruments? (feature track F1, 2026-08-13)

Goal: the second ear check here, and — like check 23 — **a gate on shipping**.
Everything automatable already passes: `npm test` pins the manifest and the pitch maths,
`smoke:editor` proves recordings decode and play, and the arithmetic guarantees no clipping. None of
that can tell you the clarinet sounds like a clarinet, or that it is loud enough to enjoy.

⚠ **RUN FOUR TIMES, AND EVERY PASS FOUND A REAL DEFECT THAT EVERY GREEN CHECK HAD MISSED.**
(1) The clarinet was breath on 16th notes and the violin creaked — notes were playing the attack
transient and never reaching the tone. (2) After that fix the trim was too deep: the first
measurement used amplitude where it should have used harmonic content. (3) The kanun's F♯ "did not
sound like a kanun" — its pitch was measured a whole **koma** sharp, because a period-based estimator
reads a stiff string sharp. (4) The kanun's F♯ *still* sounded wrong: `attackS` was landing 150 ms
before the pluck, on another sound entirely, so a 16th note ended before the instrument spoke. All
four are fixed, measured and guarded. ⚠ **Read that pattern before adding the ney**: the checks
assert shape (ordering, bounds, licences) and only the ear assays sound. Budget a listen per
instrument.

⚠ **Hear it BEFORE uploading.** `npm run serve:voices` + `npm run dev:voices:local` runs the app
against `data/audio_voices/` on this machine — a plain static server will not do, because dev sends
COEP `require-corp`. Upload (`hf upload`, see [features/audio-sources.md](features/audio-sources.md))
once it sounds right. Then:

1. `VITE_VOICES_URL=<base> npm run dev:web` → open a score (`?score=/sample.json`). Set **Çalgı
   sesi** to **Klarnet**. Watch the counter run to 11/11, then ▶ Çal.
2. **Switch back and forth with `Varsayılan ses` while it plays.** ⚠ **Expect the clarinet to be
   QUIETER than the beep.** That is peak-matching and it is deliberate — a recorded sustain has
   twice the crest factor of a synthesised tone, so matching peaks means losing a few dB of loudness
   ([DECISIONS.md](DECISIONS.md)). The question this step exists to answer is not "is it quieter"
   but **"is it too quiet to enjoy"**. If it is, that is one number (`gain` in
   `apps/web/src/audio/instruments.ts`), then a slider — never `MASTER_GAIN`.
3. **On the built-in speaker, not only headphones** — the same bar the drums had to pass.
3a. **Play something with 16th notes, then the same phrase in long notes** — the two cases the
   trimming has to satisfy at once. A 16th must speak as the instrument immediately, not as breath
   (clarinet) or a bow scratch (violin), and must not be noticeably quieter than a long note. A long
   note should keep some of the instrument's own swell rather than sounding spliced. ⚠ **Short notes
   are slurred by design** — they start mid-sustain, so no tonguing and no re-bowing. Two dials, both
   free to re-tune because the trim is a playback window and not a cut: `MAX_ATTACK_SHARE` in
   `webAudioBackend.ts` decides how long a note must be to keep its attack, and `TONE_DROP` in
   `scripts/prepare_voices.py` decides where the breath is judged to end. **No re-upload either way.**
4. **Play a piece that goes low, and one that goes high.** The clarinet's layer spans **13 dB**
   between its quietest and loudest file, so its bottom register is the most likely thing to
   disappoint, and one global gain cannot fix a spread. Listen also for notes that sound *thin* or
   chipmunky near the edges: the worst stretch inside the range is ±2.5 semitones.
5. **Tick `Usul vuruşu` and push `Vuruş sesi` to maximum.** Two things at once: distortion (the
   arithmetic says F1 adds nothing to the limiter's load — this is what would catch that being
   wrong), and that **the drum is still a real darbuka**, which proves the drums stayed on the app
   while the voices came from the Hub.
6. **Take the tempo to its slowest on a long note.** It should fade where the recording ends, not
   click off. (The samples are 7–16 s, so you may not reach it — that is the expected outcome.)
7. **Switch Klarnet → Keman mid-playback.** The swap should be clean, and the violin should arrive
   without the clarinet lingering.
7a. **Kanun: play a run of 16th notes, and check the microtones.** Two things only this voice can get
   wrong. ⚠ **Every note must speak AT the pluck** — if a short note sounds like nothing, or like
   something that is not a kanun, its `attackS` is landing before the pluck again (that is exactly
   what bug 4 above was, on `kanun_17_Cs5.wav`). ⚠ **Play a phrase with `komaSharp` and `kucukSharp`
   accidentals** and listen for whether the comma actually lands: this is the voice where a
   mismeasured pitch is audible as the *wrong note*, because a koma is 22.6 cents and the whole point
   of the instrument is that it plays them. ⚠ Expect a long kanun note to **decay and die** — it is
   plucked, so it cannot hold, and `truncated` counting up is correct here where it would be a fault
   for the clarinet.
7b. **Kanun: the strings must RING THROUGH each other.** Play a fast passage — each note should keep
   sounding under the ones after it and die on its own, the way a kanun's courses do; nothing should
   stop when the next note starts. Then three things that ride on it: a **repeated note** should
   sound like one string re-plucked, not two copies layered (that is `damp()`); the **last note of a
   piece** should ring out rather than being chopped when playback ends; and pressing **Stop** should
   still silence everything immediately. ⚠ If a dense passage sounds crowded or pumping, the limiter
   is engaging and it should not be — the measured headroom is ~6 dB ([features/kanun.md](features/kanun.md)).
8. ⚠ If it sounds like the beep, **the samples did not load** — look at the picker's state before
   reporting the sound as wrong.
9. **Check a makam that bends its perdes** (uşşak, sabâ, hüzzam) against `yok (yazıldığı gibi)`.
   The bent perdes must move by the same amount on Klarnet as on the default tone — the sampler
   resamples onto the exact 53-TET frequency, measured to 1/229,000 of a koma, so any audible
   difference is a bug rather than a limitation. ⚠ Judge this on the **clarinet**: the violin's
   vibrato swings about a koma, so it cannot show a koma-sized difference either way.
10. ⚠ **A violin is not a kemençe.** Confirm the label says **Keman**. It is a free stand-in for a
   bowed sound and must never claim to be the Turkish instrument.

---

**Reproducing any strip later:** its manifest row carries `piece`, `transpose`, `mode` (`measure`
= carry, the majority since `strips_v3`), `lyrics`,
`repseed`, `navseed`, `textseed`, `respellseed`, `slurseed` — paste them into the URL parameters above and you are looking
at the exact render that produced it (`respellseed` matters: the respell changes which accidental
glyphs are drawn, so omitting it can show different signs than the strip's PNG).

## Check 25 — does the fingerboard put the finger where a violinist would? (feature track F3, 2026-08-16; steps 3 and 5 rewritten 2026-08-27)

⚠ **Half of this check has now been done, and it changed the view.** On 2026-08-27 the owner looked
at the deployed tab and rejected the *look*: the violin now stands upright with half its body in
frame, and the per-string notches became lines across the neck that can be hidden. The rest of the
check — **is the dot in the right place** — is still owed, and it is the part no automated check can
answer.

Goal: the first check here that needs your **eyes** rather than your ears, and the only thing
standing between F3 and a claim nobody has verified. Everything automatable already passes —
`tools/core/fingering-test.ts` pins the formula and the string-choice rule, `smoke:editor` proves the
marker lands on a string and moves, and the calibration was checked against a real instrument's
dimensions. **None of that can tell you the dot is in the right place**, because every one of those
checks reads the same geometry the drawing does.

```bash
npm run dev:cloud       # NOT dev:web — keeps the decode off this Mac
```

1. Open a score (`?score=/gamzedeyim-deva.json`), pick **Keman** under **Çalgı sesi**, then the
   **Enstrüman üzerinde** tab beside Nota, and pick **Keman** from the dropdown. ⚠ Picking it also switches the SOUND to the violin (owner, 2026-08-29), so what you hear should change too — if it does not, that is a finding on its own. Press ▶ Çal and watch.
2. **The question this check exists for: does the dot sit where your finger would?** Open strings are
   the free calibration — when an open Sol/Re/La/Mi sounds, the dot must be **at the nut**, not near
   it. After that, judge first position by eye: the first finger should land about a tenth of the way
   down, not halfway. ⚠ **Since 2026-08-27 the string choice is a hand-position model**, so a second
   thing is now worth watching: the dot should mostly stay in the top third of the neck and cross
   between strings, not ride one string upwards. A note placed high on the Sol string that your hand
   would play on La or Mi is a finding.
3. **Look at the position lines, and decide whether they help.** Since 2026-08-27 each one is a
   coloured line laid **across all four strings**, like tape on a learner's violin, and the seven of
   them are a **fixed chart** — the standard first-position notes, the same on every piece. The
   colour is the finger that plays the line. Two things to judge, and only your eyes can:
   ⚠ **the dot is not supposed to sit on a line** — it keeps its exact position, so a koma-altered
   note lands between two, and that gap is the whole point; and **an unaltered note should land
   exactly on its line** (that is what putting the chart on the 53-TET grid buys, so a natural note
   sitting visibly off its line IS a finding). If the lines read as clutter, untick
   **Perde çizgileri** — and say so.
4. **Watch for the dot vanishing.** That is `out-of-range` and it is **expected on low pieces**, not a
   bug: Turkish notation transposes down a fourth, so a written G3 sounds D3, below a standard
   violin's open Sol. The finding worth reporting is if it disappears on notes that a violin clearly
   *can* play. If it vanishes often on ordinary repertoire, that is evidence for adding a lower
   Turkish tuning — one row in `VIOLIN_TUNINGS` ([features/fingerboard.md](features/fingerboard.md)).
5. **On a phone**, since that is what every human who has opened the deployed app has used. Since
   2026-08-27 the violin stands upright and is sized by **height** (72% of the screen, capped), so
   the whole instrument — scroll to mid-body — should fit above the hint text without sideways
   scrolling. Check that the four string names above the nut are still readable and that the dot is
   findable while it moves.
6. **Tick "Klavyeyi yakınlaştır"** and judge the close-up. The zoom is fitted to the piece, so the
   frame should end a little below the highest line and **no mark should be cut off** — if one is,
   that is a real finding. ⚠ The **wood going soft** is not: the neck is only ~70 px wide in the
   source photo, so magnifying it magnifies real pixels. What must stay sharp is the vector work —
   the dot, the lines and the names.

⚠ **The known limit, stated so it is not reported as a discovery**: the shipped photo gives about
**7 px per koma near the nut and less further up**, so the high positions are thin. A higher-resolution
bare-neck photo is the fix and costs no code — the calibration is data. What *would* be a finding is
the dot being wrong in **first** position, where there is plenty of resolution.

## Check 26 — does the kanun view show a mandal plan a kanuncu would recognise? (feature track F3, 2026-08-29)

**Why this one needs a person.** Everything measurable already passes: the course table is
re-derived from its own perde names, the plan places **1,825 of 1,825 notes with 0 respellings**,
and 20 browser checks hold the state machine's invariant across a whole playback
([features/kanun-view.md](features/kanun-view.md)). None of that can say whether the picture reads
as a kanun, or whether the mandal plan is one a player would actually set. Only a musician can.

**How.** `npm run dev:web`, open `?score=/beyati-delisin.json`, then the **Enstrüman üzerinde** tab, and pick **Kanun** from the dropdown. ⚠ That also switches the sound to the kanun; check that it does.

1. **Before pressing anything, read the line above the instrument.** It says which mandals to set
   before playing — the makam's setting. On `beyati-delisin` it says **Segâh −2**. Judge that as a
   kanuncu: *is that the mandal you would set for this piece?* ⚠ Expect it to disagree with the
   staff by a koma on some notes, and that is **not a bug** — the engraver prints the nearest
   standard AEU sign while the file stores the exact comma, so a note drawn with a koma-bemol can be
   stored two komas flat (36 of them in this piece). The view follows the **sound**. Say if that is
   confusing in practice; it is a presentation choice we can revisit, not an error.
2. **Look at the instrument itself and say whether it reads as a kanun.** It is **drawn**, not
   photographed, and the trapezoid is deliberately **schematic** — do not report the taper as wrong,
   that is a known and argued choice. What *is* worth reporting: the courses running the wrong way
   (low at the bottom is intentional, to match the sheet), the mandal band sitting oddly, or the
   whole thing simply not looking like the instrument.
3. **Press play and watch the red course.** It should be the note you hear. The interesting check is
   the **mandal flash** — on this piece the first one is at about **21 seconds** (Acem, natural →
   +3). Two things only an eye can judge: **did you catch it**, and **was 700 ms long enough**? If
   the flash is missable, say so — the rejected alternative (everything away from the opening
   setting stays red) is written down and can be brought back.
4. **Tick "Mandallara yaklaş".** This is the close-up, and it is the answer to 312 levers being four
   pixels wide. The frame is fitted to the piece, so **no row should be cut through the middle** — if
   one is, that is a real finding.
5. **On a phone.** ⚠ Stated so it is not reported as a discovery: **the full view is a texture on a
   handset**, and the close-up is the fix. The finding worth reporting is whether you find yourself
   turning the close-up on every single time — if so, the default should flip.
6. **Try `?score=/meltem_notes.json` too.** It is eleven seconds long and moves one mandal at 5.3 s,
   so it is the fastest way to see a change; and its opening setting is five courses at −5, which is
   a much heavier mandal plan. Judge whether that is really what the piece asks for.

⚠ **The known simplification, so it is not reported as a discovery**: a change is drawn at the note
that needs it, where a real player moves the lever slightly **before** it with the free hand.
Nothing models the anticipation.
