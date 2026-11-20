# The violin, the clarinet and the measure card

purpose: the violin fingerboard view, the sol klarnet view, and the single-measure card beside them
audience: anyone touching the instrument tab
updated: 2026-11-20

**Merged into this file on 2026-11-20:**

- [F3 — the fingerboard tab](#f3--the-fingerboard-tab) — was `docs/features/fingerboard.md`
- [F3 — the clarinet view](#f3--the-clarinet-view) — was `docs/features/clarinet-view.md`
- [F3 — the bar beside the instrument](#f3--the-bar-beside-the-instrument) — was `docs/features/measure-card.md`


## F3 — the fingerboard tab

*Was `docs/features/fingerboard.md` (last updated 2026-10-01).*

> This is the F3 chapter of the feature track — [README.md](README.md) is the track index, and
> current state is in [../STATUS.md](../STATUS.md). It was split out on 2026-08-27, when the track
> file crossed the 400-line cap.

Show the instrument, and show where the finger goes as the piece plays.

#### Scope: VIOLIN ONLY (owner, 2026-08-15) — ⚠ REOPENED 2026-08-29, kanun added

⚠ **This section's decision was reopened by the owner on 2026-08-29 and the kanun was built**
([kanun.md § F3 — the kanun view](kanun.md#f3--the-kanun-view)). The *reasoning* below was not overturned and is left as written:
the violin was the right first instrument, and nothing past it was committed until the owner said
so. The kanun then qualified on the same ground — it is already a shipped F1 voice. Everything else
in this section still describes the violin.

Not "one instrument first, then the rest" as a plan to work down — **violin, and nothing else is
committed**. Three reasons it is the right one: it is fretless, so the position is a formula rather
than a table; **Keman is already a shipped F1 voice**, so the same instrument can be heard and seen
at once; and the friends have just said they liked the voices, which is the closest thing to a signal
this track has. The winds' lookup tables and the tanbur's fret table below stay written down as
*design*, not as a queue.

#### The artwork: a licensed photo, not a drawing (owner, 2026-08-15)

The original rule here was **own artwork** — draw it as SVG or photograph your own — and it was read,
reasonably, as *you must draw a violin*. That was the whole reason F3 looked expensive, and it is a
misreading of what the rule protects. What the 2026-08-08 copyright pass was defending against is
**unknown provenance**, not third-party pixels. A CC0 file whose chain has been read satisfies it.

✅ **The asset has landed**: `apps/web/public/instruments/violin-vl100.png` — Wikimedia Commons
`File:Violin VL100.png`, **CC0 1.0**, 700×951, 356 KB, front and side views on a transparent
background. Licence, the checked derivation chain, and the guard that does *not* exist for images:
[../THIRD-PARTY.md](../THIRD-PARTY.md).

⚠ **What that file does and does not buy.** Measured on the file itself, not guessed: the front view
is **straight on**, and **both the nut and the bridge are in frame** — so the calibration is the easy
two-points-per-string case, not the projective one that a cropped neck close-up would have forced. The
full nut→bridge run is ~580 px, which puts a koma at roughly **7 px near the nut** and less further
up. That is workable for a first version and **thin in the high positions**, which is the known limit
to design against rather than discover. A higher-resolution bare-neck photo is the upgrade if one
turns up; because the calibration is *data*, swapping the image costs no code.

⚠ **A tutorial photo is the wrong photo even when its licence is fine**: a violin-lesson still
carries a hand and a bow across the neck, and coloured tapes marking **12-tone** finger positions —
and fixed tapes contradict the entire feature. What is wanted is a bare fingerboard.

**Draw the markers in SVG over the photo.** The instrument is a picture; the moving dot and the koma
ticks are vector, so they stay sharp and follow the theme.

#### Where the marker goes

The tab itself is cheap: `ViewMode` in `apps/web/src/App.tsx` was `"roll" | "sheet"`; this added a
third. ⚠ It is now `"sheet" | "instrument"` — the roll is gone and both instruments share one tab
(2026-08-29). The interesting part is *where to draw the marker*, and it splits by instrument family.

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

**The one genuinely tricky part:** a pitch is playable in several places. ⚠ **The answer written
here — a greedy *stay nearest to where the hand just was* rule — was built, shipped, and turned out
to be wrong.** It is replaced by the hand-position model described at the end of this file. It is
still a small pure function with unit tests rather than a smoke check; that part held.

#### House rules this must follow

- **Artwork with a READ licence** — amended 2026-08-15, was "own artwork". A CC0 or public-domain
  image counts, provided its licence was read on the source's own page and its provenance recorded in
  [../THIRD-PARTY.md](../THIRD-PARTY.md) and `/THIRD-PARTY.txt`. Still forbidden, unchanged: lifting a
  photo with no licence, which is the class of mistake the 2026-08-08 copyright pass exists to stop.
  ⚠ On a user-upload site CC0 is the *uploader's* claim — follow the derivation chain before trusting
  it, the way the shipped violin's was. **Markers stay SVG** whatever the background is, so they
  scale and can be placed exactly.
- **DOM state, never copy.** The marker exposes `data-*` attributes for the checks to read, per the
  contract in [../../CLAUDE.md](../../CLAUDE.md) and `apps/web/src/ui/status.ts`. No text matching.
- **All strings in `apps/web/src/ui/strings.ts`.**
- **One clock.** Drive the animation from `getPositionMs()` — the source the playhead already uses —
  so the marker cannot drift from the sound.


#### ✅ The open strings — ANSWERED 2026-08-16, and the table stays open

**Standard Sol–Re–La–Mi** (owner) is what it OPENS on. It was the one input the code could not
default, so it was asked rather than guessed: Turkish violinists do not universally use the Western
tuning, and that is a repertoire question. The four frequencies live in `VIOLIN_TUNINGS` as **data**,
so a tuning is a row and touches no geometry. [../DECISIONS.md](../DECISIONS.md)

⭐ **AND SINCE 2026-09-27 THE PLAYER TURNS THE PEGS THEMSELVES**, which is what made the repertoire
question stop blocking anything: `#tuning-open` → a modal with one dropdown per string. Nobody has to
name a scordatura for a person to play in one. ⚠ **The dropdown offers the twelve WESTERN note
names, not the fifty-three commas** (owner: *"tuning by koma is much too advanced a feature,
beginners will use this app"*) — a chromatic tuner is what a learner has in their hand. The four
standard strings are four points of that same twelve-tone table, so tuning back lands on ratio 0
exactly. `tuningChoices` and `retuneString` in `fingering.ts` own every comma; nothing in the UI does
pitch arithmetic. ⛔ **Do not add koma-altered open strings to that list** — that is the advanced
feature the owner declined.

⚠ **They are on this project's 53-TET grid, not on a tuner's.** A fifth here is 31 commas =
701.89 cents, so open Sol is 195.571 Hz against twelve-tone's 196.00. Four cents is a fifth of a
koma — the scale of thing this view exists to show — and it is what makes an open string land at
ratio 0 *exactly* for the note that should be played open.

⚠ **Notes below the open Sol are a normal case, not an edge case.** Turkish notation transposes down
a fourth, so a written G3 sounds D3 ≈ 147 Hz, under a standard violin's 195.6. Those notes draw **no
dot** and report `out-of-range` rather than being clamped somewhere they are not. It is also the
strongest practical argument for adding a lower Turkish tuning later.

#### What was built, and the three things the photo corrected

The maths is `packages/core/src/fingering.ts` (portable, unit-tested); every pixel is
`apps/web/src/instruments/fingerboardGeometry.ts`; `apps/web/src/instruments/Fingerboard.tsx` does only the drawing and
the clock. Numbers and the account: [../log/status-log.md](../log/status-log.md).

The calibration was **measured, then sanity-checked against a real instrument** — the nut→bridge run
scales to 328.1 mm and the string spread to 17.2/34.2 mm, which is a 4/4 violin. That check matters
more than the fit residuals: a line fit is self-consistent whether or not it found the strings.

Three things only became visible once the image was rendered rather than reasoned about:

1. **The neck is a 6:1 vertical sliver**, unreadable on a phone — so it was rotated a quarter turn,
   nut on the left. ⚠ **This was reversed on 2026-08-27** by the owner, who saw it: see the section
   below. The observation stands; the conclusion drawn from it did not.
2. **A tuning peg pokes into frame just past the nut** and read as a smudge under the Sol string.
   The photo was masked to the fingerboard's own tapered outline, which removed it. ⚠ Also gone
   with the rotation — the pegs are now part of the picture on purpose.
3. **The fingerboard's edges cannot be found by "darker than the belly"** below the neck — f-holes
   and shadows pass the same test. Two clean rows near the neck, extrapolated. **This one still
   carries the view**: it is what places the position lines across the ebony.

#### The view stands up, and the marks became tape (owner, 2026-08-27)

The owner opened the deployed tab and rejected how it looked: *"I want this in vertical position
and half of the violin's body should be visible, it looks very bad right now."* Two changes, both
in [../../apps/web/src/instruments/fingerboardGeometry.ts](../../apps/web/src/instruments/fingerboardGeometry.ts) and
[../../apps/web/src/instruments/Fingerboard.tsx](../../apps/web/src/instruments/Fingerboard.tsx):

**The crop is the instrument, not the neck.** Upright, scroll to just past the bridge — 60% of the
body. The rotation's own reasoning was about fitting a *neck* into a wide card, and it was answered
by turning the picture instead of widening it; a sliver of ebony lying on its side does not read as
a violin to the person holding one. Bounds were measured off the file's alpha channel (the front
view occupies x 72..367, y 34..700), so nothing is clipped, and the side view in the same file is
cropped away. Height is what is bounded in CSS now, not width, so the whole instrument fits a phone
screen without pushing the hint text off it.

**A position is one line across all four strings, like a learner's tape** — not a notch on the one
string that used it. A ratio is a fraction of *each* string's own length, so one line genuinely is
the same place on every string; what differs is the pitch it produces there. ⚠ **The first version
built the lines from the loaded score's own pitches, and that was reversed the same day** — see
"the chart is fixed" below. They are coloured by the first-position finger they fall on
(`firstPositionFinger`, unit-tested against m2/M2/m3/M3/P4/tritone/P5).

⚠ **The lines are a reference, never a fret.** The moving dot is placed at its own exact ratio and
falls between two lines whenever the music does, which on koma-heavy makam music is often and is
the whole point of the view. Nothing may snap the dot to a line. The owner asked for the lines to
be hideable and they are — `#fingerboard-lines`, with `#fingerboard[data-lines]` for the checks.

#### The chart is FIXED: standard violin notes, not this piece's komas (owner, 2026-08-27)

*"The lines will show standard violin notes, they will not be arranged by koma. Only the cursor does
not have to be on the lines — for koma sounds it can be in between."* This reverses the first
version, where the lines were the positions the loaded score used.

**Why the first version was wrong, in one sentence:** a reference that changes with the music is not
a reference. If the lines move to wherever this piece plays, the dot sits on a line almost always,
and there is nothing left to see.

**What is drawn now** is `FIRST_POSITION_NOTES` in `packages/core/src/fingering.ts` — the seven
places a first-position hand stops a string, in commas above the open string:

| commas | 4 | 9 | 13 | 18 | 22 | 26 | 31 |
|---|---|---|---|---|---|---|---|
| interval | m2 | M2 | m3 | M3 | P4 | tritone | P5 |
| finger | 1 | 1 | 2 | 2 | 3 | 3 | 4 |

The same seven for every score, on every string, which is what makes the picture a chart.

⚠ **They are on THIS project's 53-TET grid, not in twelve-tone**, and that is not pedantry. The
app's own natural notes are spaced by tanini (9) and bakiye (4) commas — `PC_COMMA` in
`notation.ts` — so an **unaltered note lands exactly on its line**. On a 12-TET chart an ordinary
natural would sit a few cents off its own line and read as a drawing error, which is the one thing a
reference may not do.

⭐ **Everything a makam adds then falls visibly between two lines.** A koma-flattened third sounds at
17 commas, one comma below the M3 line — about 5 px of string on the shipped photo, and more under
the zoom. That gap is the feature.

⚠ **One spelling ambiguity, stated rather than hidden**: AEU distinguishes a raised note from a
lowered one, so D♯ is 13 commas above C while E♭ is 14. The chart takes the **raised** spelling, so
a flat-spelled note sits one comma above its nearest line. That is correct, not an error.

⚠ The browser check does not assert "some lines exist" — it asserts the **same seven lines, at the
same places, on a different piece**. A chart that quietly started following the music again would
pass any weaker check.

#### The neck zoom, and why it is fitted to the piece (owner, 2026-08-27)

**Klavyeyi yakınlaştır** (`#fingerboard-zoom`, `#fingerboard[data-zoom="full|neck"]`) drops the
body and the scroll and shows the fingerboard alone, at about **2.2–3.6×** depending on the piece.
The zoom IS the viewBox: because the picture is sized by height, a narrower window fills the same
vertical space, so nothing about the layout has to move.

**The window is fitted to the loaded piece, not fixed**, and that is the part worth keeping. A fixed
close-up has to choose between two failures: cut off a piece that climbs the neck — and a note drawn
outside the viewBox is simply **invisible**, which reads as a bug rather than as a crop — or waste
half the frame on empty ebony for a piece that never leaves first position. So the window runs from
just above the nut (leaving room for the string names) down to the highest position the piece
actually uses, plus a margin, with a floor so a low piece cannot zoom absurdly close.

⚠ **Every mark keeps its size on SCREEN, not in the viewBox.** The dot's radius and the string names
are multiplied by the zoom's scale in `Fingerboard.tsx`; the lines, the nut and the outlines use
`vector-effect: non-scaling-stroke`. It is not polish: a dot that grew 2.2× with the picture would
be wider than the string spacing it points at.

⚠ **The photo is the limit, and the zoom is where you see it.** The neck is only ~70 px wide in the
source image, so a close-up magnifies real pixels and the wood goes soft — the marks stay vector and
stay sharp. This is the same known limit as the ~7 px per koma near the nut, and the same fix: a
higher-resolution bare-neck photo, which is a data change and costs no code.

⚠ **The upgrade path is unchanged and costs no code**: a higher-resolution bare-neck photo. The
shipped one gives ~7 px per koma near the nut and less further up, which is thin in the high
positions.

#### The string choice: a hand that sits on the neck (owner, 2026-08-27)

The owner asked whether the position lines were spaced correctly. They were — a whole tone measures
51.2 px near the nut and 15.1 px high up on Meltem, which is the compression a real string has — but
checking it turned up a different fault, in **which string each note was put on**.

**What was wrong.** The old rule minimised `|Δratio|` from the last note, with a small cost for
changing string and a small pull towards the nut. It had no notion of a hand. For an ASCENDING line
that is a trap: sliding one more note up the string you are on is always a small Δratio, while
crossing to a higher string means dropping back down the neck — a *large* one. So the hand climbed
and never came back. Measured on the shipped scores:

| piece | notes placed above the octave | past first position | highest placement |
|---|---|---|---|
| `meltem_notes` | 22 of 83 | 42 of 83 | **0.778 of the Sol string** (La5, 115 commas up) |
| `beyati-delisin` | 17 of 415 | 65 of 415 | 0.625 of the Re string |
| `safalar-getirdiniz` | **378 of 816** | 591 of 816 | — |

La5 is 880 Hz. The La string offers it at 0.5 and the Mi string at 0.25. Nobody plays it two octaves
up the Sol string.

**What replaced it.** A hand that *sits* somewhere on the neck and reaches a fixed frame from there —
first finger to fourth is a perfect fourth (22 commas), the fourth extends a semitone past it and the
first reaches a semitone back. The hand's place is written in **commas above the open string**, which
is the musician's own unit and is the same on all four strings. Two things then fall out, and they
are the entire fix: **crossing strings with the hand where it is costs almost nothing**, while
**leaving the frame is a shift** and is priced by how far the hand travels. After it:

| piece | above the octave | past first position | string changes |
|---|---|---|---|
| `meltem_notes` | 22 → **0** | 42 → **6** | 9 → 12 |
| `gamzedeyim-deva` | 0 → 0 | 68 → **0** | 50 → 64 |
| `beyati-delisin` | 17 → **0** | 65 → **3** | 39 → 41 |
| `safalar-getirdiniz` | 378 → **0** | 591 → **24** | 52 → **35** |

⚠ `safalar` gets *fewer* string changes as well as fewer high positions — the old rule was not
trading one for the other, it was simply wrong. A two-octave climb from the open Sol now walks
`g g g g g · d d d d · a a a a · e e`, which is what a violinist does.

⚠ **What is still simplified**, stated rather than hidden: the frame is a constant number of commas,
where a real hand's frame widens a little in high positions; a shift is priced in commas rather than
in millimetres, which slightly over-prices shifts high on the neck; and the walk is still greedy, so
it cannot plan a crossing several notes ahead the way a player reading ahead would. None of the three
can bring the climbing back — all three price climbing *higher*, not lower.

⚠ **The old tests passed at every setting of the old knob**, which is why this was found by eye and
not by the suite. Section 4b of `tools/tests/fingering-test.ts` now pins the climb, the forced-low
start that trapped the old rule, and the opposite failure — a note above first position on the Mi
string, where there is nothing to cross to, must still shift.

#### The finger number in the dot (owner, 2026-10-01)

The owner asked for the dot to say **which finger**, not only where — the 0–4 a printed violin part
writes over a note. **0 is the open string, 1 the index finger, 4 the little finger.**

**It costs no new model.** The string-choice walk above already carries a hand: the place of the
first finger, in commas above the open string. The finger is how far the note is from that place
(`fingerInHand` in `packages/core/src/fingering.ts`), and it rides out on `FingerPos.finger`. So the
number cannot disagree with the string and place chosen beside it.

The bands, measured from the first finger: up to 2 commas above it (and the reach back below it) is
**1**, the next 9 commas **2**, the next 8 **3**, past that **4**. ⚠ They are chosen so that with the
hand in first position the number is **exactly** the colour of the line under the dot — pinned comma
by comma in `tools/tests/fingering-test.ts`, section 6, with the textbook `0 1 2 3 4` climb on every
string.

⚠ **What is a guess, stated rather than hidden:**

- **A koma note gets the finger of its band** — the same finger, a comma higher or lower. That is
  how a Western part would finger it. Whether makam violinists always do so is **not checked**
  against a teacher or a method book.
- **Open string vs. fourth finger** is decided by the string rule, not the finger rule: in the
  tested La-string octave the Mi comes out as **4 on La**, not open Mi, because changing string has
  a small cost. Both are ordinary violin choices.
- After a shift DOWN the first finger lands on the low note, so two notes a whole tone apart can both
  read **1**. A player might use 1–2 there. The greedy walk cannot see ahead to prefer it — the same
  limit as above, and the reason a Viterbi (whole-piece) walk is the named next step.

**Size (owner, same day):** the first dot was ~9 CSS px on a phone and the digit could not be read.
`DOT_R` 5.5 → **10**, `FINGER_SIZE` **13** — about 16 px on a phone. At full zoom the dot is now wider
than the string spacing near the nut; accepted, because its **centre** is what sits on the string.

#### TODO — step 2: a whole-piece (Viterbi) walk — DEFERRED, not started (owner, 2026-10-01)

**What.** Replace the greedy walk in `assignFingering` with one that plans the whole piece: dynamic
programming over states *(string, hand place, finger)*, the same three costs (shift, string change,
pull to the nut), cheapest **total** path kept — the standard method in the literature (rule costs +
Viterbi; e.g. github.com/Tsung-Ping/Violin-Fingering-Generation). It would let the walk choose a
crossing several notes ahead, and fix the "1 then 1 again after a shift down" case above.

**Why it is deferred and not built.** Not because it is hard (the code is a day). Because **nobody
on this project can judge the result**: the owner does not play the violin, and no fingered
reference exists to score against. It would change which string **every** note of **every** piece
is shown on, and the last change of that size was caught only by eye, against shipped pieces. A
whole-piece optimiser with the same costs could also trade differently — e.g. take a shift to save
two string changes — and nothing here would notice. Green tests are not enough: the old rule passed
every test too.

**What would restart it** — any one of:

- a violinist willing to look at a few pieces and say which fingering is wrong;
- a fingered reference (a printed violin method, or a part with fingerings) to score both walks on;
- a visible fault in the greedy walk that a player reports.

**How to do it when it restarts.** Keep `FingerPos` and the bands unchanged, so nothing downstream
moves. Section 4b and 6 of `tools/tests/fingering-test.ts` must still pass. Re-measure the four-piece
table above (above the octave, past first position, string changes) for both walks and show the
differences to the reviewer **before** shipping.


## F3 — the clarinet view

*Was `docs/features/clarinet-view.md` (last updated 2026-10-08).*

> This is the clarinet chapter of F3. The violin chapter is [instruments.md § F3 — the fingerboard tab](#f3--the-fingerboard-tab), the
> kanun chapter is [kanun.md § F3 — the kanun view](kanun.md#f3--the-kanun-view), and the track index is [README.md](README.md).
> Current state is in [../STATUS.md](../STATUS.md). ⚠ Not to be confused with F1's clarinet
> **sound**, which shipped 2026-08-14 — [THIRD-PARTY.md § Audio sources — the verified files, and what each one still needs](../THIRD-PARTY.md#audio-sources--the-verified-files-and-what-each-one-still-needs).

Show which holes are covered, and how tightly the lip is held, as the piece plays.

### The scope decision (owner, 2026-08-29)

The third instrument, decided the same day the kanun view was accepted: *"Şimdi klarnet ekleyelim.
Sol klarnet olsun."* It qualifies on the same ground the violin and the kanun did — **it is already
a shipped F1 voice**, so it can be heard and seen at once.

**Sol klarnet specifically** — the G clarinet, which is *the* Turkish clarinet. It uses **Albert
(simple) system** keywork, not the Boehm keywork of a Western orchestral clarinet, and that matters
for the picture: the two instruments do not have the same keys in the same places.

### Why this is not the violin view with a different picture

[instruments.md § F3 — the fingerboard tab](#f3--the-fingerboard-tab) predicted this split before either was built, and it holds:

**A violin position is a number.** Distance along the string is a formula, so the marker has to land
on an exact pixel of the photograph. The photo is load-bearing geometry.

**A clarinet fingering is a list.** What you show is *which holes are covered* — filled circle
closed, empty circle open. Nothing needs pixel-exact placement, and a photograph is actively worse
at it: silver keys on dark wood, all overlapping, is the hardest possible way to read open-vs-closed.

So the clarinet's artwork is a **schematic**, and the violin's is a photograph, and that is a
consequence of the instruments rather than a style choice.

### The artwork — a PHOTOGRAPH (owner, 2026-08-29)

`apps/web/public/instruments/clarinet-ycl457-oehler.png` — a Yamaha YCL-457II-22, **German system
(Original Oehler)**, 244×1560, 453 KB, **CC BY-SA 4.0**. Licence, the duty it carries and the chain:
[../THIRD-PARTY.md](../THIRD-PARTY.md).

**It took three tries and each failure is worth keeping.**

1. ⛔ **A CC0 third-party schematic.** Vector, 24 named layers, ideal on paper. The owner looked at
   the keywork: *"sanırım sen fransız tipi sol klarneti yapıyosun. Alman tipi olmalı."* It was
   **Boehm**. Withdrawn, and its licence rows removed.
2. ⛔ **Our own drawing.** Correct system, correct key set, no licence question at all — and rejected
   on sight: *"çizim pek olmamış."* ⭐ **The lesson: a schematic suits an instrument whose parts are
   abstract shapes** — a kanun's mandals are boxes — **and fails one you recognise by its keywork.**
   A clarinet without its real silver does not read as a clarinet.
3. ✅ **The photograph**, which meant amending the image rule to allow attribution licences, because
   **there is no CC0 photograph of a German-system clarinet anywhere on Commons**.

#### The table is the OWNER'S, placed note by note (2026-08-30)

`tools/dev/clarinet-editor.ts` builds a standalone page where each note's points are clicked on
the photograph: click empty space to add, click a point to delete, near a known position it snaps.
The owner worked through all nineteen base fingerings and sent the JSON back.

⭐ **Six of nineteen changed, and every single one was a KEY. No hole moved, and no note moved.**
That is the result worth keeping, because it separates two things that had been failing together:

| | verdict |
|---|---|
| The **notes** — which holes make which pitch, from the Oehler/Albert chart | **survived contact with a real sol klarnet** |
| The **key positions** — my by-eye placements | **five of the six that any fingering used were wrong** |

| note | I had | the owner placed |
|---|---|---|
| Mi3 | `lh_e` | a key at (188.8, 478.6) |
| Sol♭3 | `lh_gb` | a key at (219.4, 478.6) |
| Si♭3 | `sliver_rh`, beside the tube | (128.9, 674.9) — **on** the tube, between rh2 and rh3 |
| Re♭4 | `lh_db`, near the barrel | (170.8, 428.2) — 200 px lower |
| Fa4 | `side3` | the key at (67, 454.6) |
| La♭4 | `throat_ab`, upper left | (184.4, 136.1) — the other side of the instrument |

⛔ **The comment my guesses carried was too generous.** It said each marker was "inside the right
cluster" and only which member was uncertain. `key_cis` is 200 px from where I put `lh_db`, and
`key_gis4` is on the opposite side of the body from `throat_ab`. Being in the right region was not
the same as being nearly right.

⚠ **The key ids therefore changed meaning, and the names now say less on purpose.** They are
`key_e`, `key_fis`, `key_bes`, `key_cis`, `key_dis`, `key_f4`, `key_gis3`, `key_gis4`, `key_a4` and
`key_low` — **named for the note each is pressed on**, because that is the only thing about them
anyone verified. The old names (`lh_gb`, `side3`, `throat_ab`, `sliver_rh`) claimed to know the
Albert mechanism and were confidently wrong. ⭐ Nine of the ten are pressed on **exactly one note**;
`key_low` is the only shared one, down for all three of the bottom notes. `clarinet-test.ts` pins
that, so a future edit cannot quietly make an id mean two things.

⚠ Seven markers I had invented are **gone**, not kept as ghosts: no fingering pressed them, and a
ring over unused metal is noise on a photograph that already carries twenty-two pieces of silver.

#### The altissimo — collected, and it broke an assumption (owner, 2026-08-30)

*"Do6 dan sonra biraz daha farklı parmak pozisyonlarıyla daha incelere çıkabiliyoruz."* The table
stopped at **Do6**, where the source chart's clarion page stops. ⚠ **Above it nothing is derivable**
— a clarinet's third register is not a further overblowing, so each note is its own fingering and no
arithmetic produces one. The owner filled in seven, **Re♭6 to Sol6**, through the editor.

⭐ **They needed no new calibration at all.** Every point the owner placed landed on a position the owner's earlier
pass had already fixed — `ALTISSIMO_FINGERINGS` uses not one key the lower registers do not, which
is asserted rather than observed.

⛔ **AND ONE OF THEM BREAKS THE ASSUMPTION UNDER THE WHOLE VIEW: a fingering does not identify a
note.** *"Sol6 Re6 ile aynı oldu ama aradaki fark dudağını daha sert sıkmak oluyor zaten."* Sol6 and
Re6 are the **same seven keys**, **22 commas — a perfect fourth — apart**: the next partial of the
same tube, reached by tightening the embouchure and not by moving a finger.

⭐ **The design already survives it, by luck rather than foresight.** The view labels by the note
that **sounds**, so the two rows read correctly even though their pictures are identical; had the
label still been the fingering's name — as it was until 2026-08-30 — these two notes would have been
indistinguishable on screen. ⚠ Anything that indexes fingerings by key set is wrong on this
instrument. `fingeredAs` carries the relationship, and `clarinet-test.ts` pins all three facts.

⚠ **Structural, not incidental:** `CLARION` maps over `BASE_FINGERINGS` alone, so an altissimo row
**cannot** be overblown a second time. The previous version excluded them with a koma cutoff, which
would have worked and would have been an accident. There is a test for it.

⚠ **Only Re♭6 uses the register key or the thumb** in what the owner gave, which is unusual enough
to deserve a second look with the instrument in hand. It is recorded as the owner's data rather than quietly
"corrected": every time this table has been argued with from theory, the theory lost.

#### What is measured, and what the owner placed

⭐ **The six tone holes are MEASURED**, by detecting near-black round blobs on the body. Exactly six
come back, all on one axis, all the same size. They carry the view, because a fingering is mostly
*which of these six is covered* — and the owner's pass confirmed them by not moving one.

⚠ Everything else is `source: "owner"`. There is deliberately **no "guess" value left in the type**.

#### The head is cut off

Owner, same message: *"klarnetin baş tarafını çıkarabilirsin, yani parmak pozisyonu görünmeyen
kısmı çıkarabilirsin."* The mouthpiece, barrel and the top of the upper joint carry no finger
position and were spending a third of the card on nothing. ⚠ The cut stops **just above the highest
key the view ever lights**, which the same message required — the La key has to stay in frame.
⚠ Re-cropped from the 1000×7050 original rather than from the earlier crop, so nothing is scaled
twice.

⚠ **The thumb hole and register key are drawn beside the instrument**, marked *arka*. They are on
the back and no front photograph can show them; every printed clarinet chart solves it the same way.

⚠ The card is bounded by **HEIGHT, never width** — 244×1560 is a 1:6.4 sliver.

### ⭐ The lip meter (owner, 2026-08-29; how it READS was revised 2026-09-04)

*"Klarnette koma sesleri vermek için dudağımızı salıyoruz bir miktar. Dudağını ne kadar salması
gerektiğini gösteren ekstra bir bar gibi bir şey kullanabiliriz."*

This answers the one thing that genuinely blocked the feature. **There is no fingering table for
komas** — a published chart gives twelve notes per octave, and makam music does not live on twelve.
A clarinettist reaches a koma by **relaxing the lip**, which lowers the pitch continuously.

So the view splits in two, and the split is the design:

1. **The schematic shows the nearest standard fingering.** Discrete, from a table, exactly what a
   printed chart gives.
2. **A separate bar shows how far to relax the lip**, in komas. Continuous, computed from the note's
   actual 53-TET pitch.

⭐ **This is the same shape as the violin's answer, arrived at independently.** There, a fixed
seven-line chart is drawn and the dot falls *between* the lines whenever the music is microtonal —
"that gap is the feature" ([instruments.md § F3 — the fingerboard tab](#f3--the-fingerboard-tab)). Here the fingering is the chart and
the bar is the gap. Neither view snaps the microtone onto the twelve-tone grid, which is the whole
reason this project can show something a Western app cannot.

#### ⭐ It shows the GRIP, not the bend (owner, 2026-09-04)

*"Ne kadar gevşetmemiz gerektiğini değil ne kadar dudağımızı sıkmamız gerektiğini söylesin. Normal
çalarken orta derecede sıkıyoruz dudağımızı."*

The number underneath is unchanged: `fingerClarinet` still returns `bendKoma`, how far below its
fingering the note sits. What the meter draws is no longer that number but **where the lip is**.

- **The scale is tightness**, loose on the left, tight on the right.
- **An ordinary note sits at the MIDDLE** (`NORMAL_AT = 0.5` in `Clarinet.tsx`, and every position
  in the meter is computed from it, so no percentage is written into the CSS to drift away).
- **A comma is a step to the left of that middle**, five of them at most.

⭐ Why this beats what it replaced: the old bar read **zero** for an ordinary note, which says the
player is holding nothing until the music asks for something. A wind player is already holding an
embouchure. The meter now starts where the player is, and a koma is a distance from there.

⛔ **The right half is drawn and never fills** (owner, asked directly: *"daha fazla sıkarak hiçbir
komayı vermeyelim, sadece dudağı gevşeterek koma verelim"*). It exists so that *normal* can be seen
to be the middle of a grip rather than the end of a scale. It carries **no comma ticks**, and it must
never get any: lipping a clarinet **up** is worth a fraction of lipping it down, so a symmetric ±5
would teach the instrument wrong — the one thing an instrument view may not do.

⚠ **Horizontal, above the picture, and HTML rather than SVG.** The drawing is a 356×1560 sliver
bounded by HEIGHT, about 150 px wide on a laptop; a horizontal scale inside it would get ~15 px per
comma and no room for a word. So the meter is `.kv-clarinet__lip*` in `app.css`, above the photo,
`min(420px, 100%)` wide. `LIP_BAR` is **deleted** from `clarinetArt.ts` — it was the one number in
that file never measured against the photograph, so nothing was recalibrated by moving it out.

⚠ The old bar's argument for VERTICAL — a bend is a *pitch*, and every pitch in this app runs up the
page — died with the meaning. A grip is not a pitch.

⚠ **The fill is hidden while nothing is sounding.** An empty meter is a real reading (the lip fully
relaxed, five komas down) and must not double as "no note". `app.css` keys that off the root's
`data-note-state`.

#### What had to be decided before it was built — all four are answered in code

⚠ **None of these are guesses to make in code.** They are data or owner input, held the way
`VIOLIN_TUNINGS` and `MANDAL_LAYOUTS` are.

**1. Which direction, and therefore which fingering to pick.** ✅ **Answered — downward only**
(owner, 2026-09-04: *"sadece dudağı gevşeterek koma verelim"*). The chart shows the fingering
**above** the target note and the lip only ever comes down from it. Nothing in this app is played by
biting above normal, which is why the meter's tighter half carries no commas.

**2. How far the lip can go.** This bounds the bar and decides when the view must say *change the
fingering* instead. One koma is **22.6 cents**. Teaching sources put embouchure-only bending at
roughly **30–60 cents ≈ 1.5–2.5 komas**, with half-holing or venting adding a similar amount again
and the two together reaching about a semitone. ⚠ **This is a read from teaching material, not a
measurement of ours, and it is player- and register-dependent** — the owner plays clarinet and is
the better source. The physics reference, if it is ever needed, is
[Chen, Smith & Wolfe, JASA 2009](https://www.phys.unsw.edu.au/jw/reprints/ChenetalJASA09.pdf).

**3. The out-of-reach state.** Past that bound the view must not keep growing the bar — it needs the
violin's `out-of-range` honesty, saying plainly that this note wants a different fingering or a
half-hole. Drawing an impossible bend would teach the wrong thing.

✅ **2 answered by the owner (2026-08-29)**: `LIP_REACH_KOMA = 5` in `packages/core/src/clarinet.ts`
— *"nothing needs to have more than 4-5 koma"*. ✅ **3 dissolves because of it**: every step in the
table is 4 or 5 commas (pinned by `clarinet-test.ts`), so every pitch between two fingerings is
inside one lip; `fingerClarinet` returns `null` only for a note below or above the whole table.
✅ **4 answered**: the table is keyed to WRITTEN commas — the G instrument's fourth and Turkish
notation's fourth cancel in practice (owner; the reasoning is the header of `clarinet.ts`).

**4. The transposition.** A sol klarnet sounds a **fourth below** what is written, and Turkish
notation is **already** written a fourth below concert pitch. Which of the two the fingering table is
keyed to is a decision, not a default, and getting it wrong moves every fingering by four scale
steps while looking entirely plausible.

### House rules this must follow

Unchanged from [instruments.md § F3 — the fingerboard tab](#f3--the-fingerboard-tab), and all of them apply:

- **DOM state, never copy** — `data-*` attributes per the contract in
  [../../CLAUDE.md](../../CLAUDE.md) and `apps/web/src/ui/status.ts`. No text matching.
- **All strings in `apps/web/src/ui/strings.ts`.**
- **One clock** — drive from `getPositionMs()`, the source the playhead and both other views use.
- **The arithmetic is a pure function with unit tests**, like `tools/tests/fingering-test.ts` and
  `tools/tests/kanun-test.ts`. The fingering table and the lip-bend maths belong in `packages/core/`,
  not in the component.
- **Artwork with a READ licence**, chain checked and recorded in [../THIRD-PARTY.md](../THIRD-PARTY.md)
  and `/THIRD-PARTY.txt`. ✅ Done for this file.


## F3 — the bar beside the instrument

*Was `docs/features/measure-card.md` (last updated 2026-09-05).*

> This is the fourth chapter of F3 — the one that is not an instrument. The three instruments are
> [instruments.md § F3 — the fingerboard tab](#f3--the-fingerboard-tab), [kanun.md § F3 — the kanun view](kanun.md#f3--the-kanun-view) and
> [instruments.md § F3 — the clarinet view](#f3--the-clarinet-view); the track index is [README.md](README.md). Current state is
> in [../STATUS.md](../STATUS.md). The editor itself is [app/editor.md](../app/editor.md).

Draw the ONE bar that is sounding, beside the instrument — and let it be edited there.

### Why it exists

The three instrument views all answer the same question: **where do I put my fingers now.** None of
them answers **what am I playing now.** A player watching a clarinet photograph has to carry the
music in their head, or keep switching to the Nota tab and losing the fingering — and the page
already knows the answer.

The owner asked for it on 2026-09-04, in one sentence: *"sol tarafta enstrüman sağ tarafta nota
ölçüsü"* — instrument on the left, the bar on the right, arrows beside it, a play button above it,
and a way to edit it.

### What it is

`apps/web/src/instruments/MeasureCard.tsx`, one card on the instrument tab:

* **the bar**, engraved on its own stave with its clef, the makam signature and the meter;
* **‹ ›**, one bar back and one bar forward;
* **Ölçüyü çal**, which plays that bar and stops at its barline;
* **Ölçüyü düzenle**, which turns edit mode on *here*, with the usual toolbox;
* **Çalınanı izle**, which decides whether the card follows the music or stays where it was put.

### The five decisions

#### 1. ⭐ The card IS `SheetView`, mounted a second time

The bar is drawn by the same component the Nota page mounts, with `onlyMeasure` set. That is the
whole design, and it is what makes the owner's *"ikisi ayrı olmasın"* literally true rather than a
promise: the note targets, the pitch drag, the insert ghost, the tuplet handles, the sign targets,
the off-meter badge, the playhead and the undo stack are not *equivalent to* the page's — they **are**
the page's. An edit made in the card goes through the same App callbacks onto the same document.

`MeasureCard.tsx` therefore **engraves nothing**. It owns three things: which bar is on screen, how
wide the drawing may be, and the card around it. If you find yourself writing VexFlow there, the
answer is a prop on `SheetView`.

Six optional props were added to `SheetView` for this, and **every default reproduces the page
exactly** — a caller that passes none of them gets byte-identical output, so the render harness, the
strip exporter and every existing check are untouched:

| Prop | What the card asks for |
|---|---|
| `onlyMeasure` | draw just this bar |
| `contentWidth` | the staff area this column can give |
| `justify` | fill it (the page leaves its last row ragged, as real engraving does) |
| `chrome` | off — no title block, no accidental legend |
| `surfaceId`, `svgMarker` | `measure-surface` / `measure-svg` |

⚠ **`onlyMeasure` FILTERS, it does not renumber.** Bar numbers are the currency between the view and
App: `repeatSpans`, `navMarks`, `signTargets`, `openRepeat`, `repeatAnchor` and the insert tool's
`measureIndex` are all bar-indexed. Handing in a one-bar document instead would have needed six
mappings that must agree, in the one place where being wrong means an edit lands on another bar.
Filtering keeps bar 7 called seven on both sides, and App passes its own memoized props through
untouched.

⚠ **Every prop the card passes must be the SAME REFERENCE the sheet gets.** `SheetView` re-engraves
when `repeatSpans`, `navMarks`, `signature` or `onLayout` change identity, and an engrave in the
middle of a pointer drag would drop the note being dragged. That is why `renderBar` in `App.tsx`
filters and rebuilds nothing.

⚠ **Nothing scales.** The card resizes the ENGRAVING to its column (a `ResizeObserver` feeds
`contentWidth`); it does not scale a finished drawing. That is what keeps every coordinate in the
edit overlay 1:1 with the notes — a scaled surface would need the shared hit-testing to divide by a
factor for one of its two callers. `.kv-score`'s no-transform rule is untouched and gains no
exception.

#### 2. It draws the WRITTEN score, and reads the clock against the PERFORMANCE

The card is given `drawnDoc` — the same document the sheet draws — so a bar inside a repeat is one
bar here however many times it sounds. The playing position is mapped back through `playPlan`.

⚠ **The card gets the play plan ALWAYS, folded score or not** (`perf.steps`), unlike the sheet's own
optional copy. One drawn bar has no drawn order to read a clock against, so the cursor can only be
found by asking which *written* note is sounding. Without it the seventh bar would light its first
note whenever the piece's first bar played.

⚠ The nested view's `playing` is not the transport's — it is *the playhead belongs to the bar on
screen*. A pinned bar two systems away must not show a cursor frozen on its last note; `smoke:editor`
asserts exactly that, and it is also the only signal available while the card is pinned.

#### 3. `Ölçüyü çal` CUTS THE TIMELINE; it does not watch a clock and call stop

The bar's notes go to the backend with their **piece** times untouched and `totalMs` set to the
barline. Three things follow, and the first is why the obvious implementation was rejected:

* **nothing past the bar is ever scheduled.** A poll — rAF or interval — always overshoots by a
  frame, and one frame of the next bar is an audible blip, not a rounding error.
* **the natural end fires by itself** (`tick` → `setOnEnded` → `stopped`), including the existing
  wait for a plucked voice still ringing. There is no second stop path to keep in step.
* **`getPositionMs()` still reports piece ms**, which is what the instrument drawings, the card's
  playhead and the sheet's all read. Playing a slice from zero would have moved every one of them to
  the top of the score while the seventh bar sounded.

The metronome clicks and the usul strokes are passed whole; they stop at the same `totalMs`.
Measured in `smoke:editor`: **4.6 s** on a **123 s** piece.

#### 4. `Ölçüyü düzenle` edits the bar HERE — and it is the same edit

⚠ **This reverses the same feature's first version, one day old** (owner, 2026-09-05: *"ölçü
düzenlemesi için ayrı bir editör yapar mısın, nota tabına atmasın. Normal edit tool çantası çıksın
yine … Edit tabi nota tabına da yansısın ikisi ayrı olmasın"*). The first version sent the reader to
the Nota page with the bar selected, on the reasoning that there must be only one editor. **The
reasoning was right and the conclusion was wrong**: mounting the same view twice keeps the one
editor *and* keeps the reader where they are. See decision 1 — that is what made the reversal cheap.

What follows from it:

* the **toolbox is the same `EditPalette`**, no longer gated on the view. It arms a tool; whichever
  `SheetView` is mounted reads the armed tool from App.
* **Düzenle is one switch with two faces** — `#edit-toggle` in the card head and `#measure-edit` on
  the card — over one mode. The head's toggle and the undo pair moved out of the sheet-only block.
* `lastEditMeasure` is set from the bar you are looking at, so the toolbox's Çal plays it before you
  have edited anything. On the page that pointer only ever came from an actual edit, because the
  page had no notion of "which bar am I on".

#### 5. Following is the default and an arrow PINS

Opening the tab and pressing Çal has to need no further clicks, so the card follows the sounding
bar. But an arrow means the reader is looking at something, and music moving the page under them is
the thing that makes a page unusable — so an arrow, `Ölçüyü çal` and `Ölçüyü düzenle` all pin the
card. `Çalınanı izle` gives the follow back, and `data-follow` is what a check reads: a pinned card
and a following card are otherwise the same DOM.

### The layout

Two columns, the instrument left and the card right, **vertically centred on each other** (owner,
2026-09-04). The columns are wildly different heights — a clarinet is 74dvh of sliver against a
~200px card — and a card pinned to the top of that row reads as a caption hanging off the instrument
rather than as the other half of one answer.

⚠ **The kanun stacks instead, and that is an instrument rule rather than a screen-size one.** A
kanun is a wide trapezoid sized by WIDTH, so half a row is half an instrument. When it stacks, the
**card goes first**: the kanun fills 62dvh, so an instrument-first order would put the notation off
the bottom of the window. The phone stacks for the same reason and in the same order.

⚠ **The card is white — the same white as the score card around it** (owner). It was `--paper` with
the staff raised on white inside it, which read as a box within a box.

⚠ **Below `MIN_CONTENT_W` (320) the box scrolls sideways** instead of squeezing the bar further: a
phone gives the card ~250px of column, and a 13-note bar squeezed into that renders its staff ~17px
tall — small enough that koma and küçük stop being tellable apart, which is the one thing this app
exists to show.

### What is deliberately not here

* **A second engraver, or a second overlay.** See decision 1. This is the rule the file exists to
  protect.
* **A loop.** `Ölçüyü çal` plays the bar once (owner's choice over looping it for practice).
* **Güfte and İmleci takip et.** Both are about the SHEET on screen — the page's lyrics, the page's
  scrolling — so they stay sheet-only in the card head.

### How it is checked

`npm run smoke:editor`, section *"the bar beside the instrument (F3)"*. The load-bearing assertions
are the ones the picture cannot answer:

* the bar **moves** while the music runs, and an arrow **stops** it moving (asserted by waiting for
  the card's playhead to clear — the only signal a pinned card gives);
* `Ölçüyü çal` is **stopped again in seconds on a two-minute piece** — only a cut timeline makes
  that true;
* ⭐ an edit made in the card reaches **`window.__omrDoc`**, the Nota page then shows it, and **one
  undo** taken from the Nota page walks it back. A card with its own overlay could pass "a note is
  selected" and still be a second document;
* the card **does not claim the page's markers** — zero `#sheet-surface` and zero
  `data-omr="sheet-svg"` while the instrument tab is open.
