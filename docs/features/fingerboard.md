# F3 — the fingerboard tab

purpose: the design, the calibration and the decisions behind the violin fingerboard view
audience: agents and the owner working on F3, before changing the artwork, the geometry or the marks
updated: 2026-08-27

> This is the F3 chapter of the feature track — [README.md](README.md) is the track index, and
> current state is in [../STATUS.md](../STATUS.md). It was split out on 2026-08-27, when the track
> file crossed the 400-line cap.

Show the instrument, and show where the finger goes as the piece plays.

### Scope: VIOLIN ONLY (owner, 2026-08-15)

Not "one instrument first, then the rest" as a plan to work down — **violin, and nothing else is
committed**. Three reasons it is the right one: it is fretless, so the position is a formula rather
than a table; **Keman is already a shipped F1 voice**, so the same instrument can be heard and seen
at once; and the friends have just said they liked the voices, which is the closest thing to a signal
this track has. The winds' lookup tables and the tanbur's fret table below stay written down as
*design*, not as a queue.

### The artwork: a licensed photo, not a drawing (owner, 2026-08-15)

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

### Where the marker goes

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

**The one genuinely tricky part:** a pitch is playable in several places. ⚠ **The answer written
here — a greedy *stay nearest to where the hand just was* rule — was built, shipped, and turned out
to be wrong.** It is replaced by the hand-position model described at the end of this file. It is
still a small pure function with unit tests rather than a smoke check; that part held.

### House rules this must follow

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


### ✅ The open strings — ANSWERED 2026-08-16, and the table stays open

**Standard Sol–Re–La–Mi** (owner). It was the one input the code could not default, so it was asked
rather than guessed: Turkish violinists do not universally use the Western tuning, and that is a
repertoire question. The four frequencies live in `VIOLIN_TUNINGS` as **data**, so a Turkish
scordatura is a row and touches no geometry — the picker is written and hides itself while there is
only one entry. [../DECISIONS.md](../DECISIONS.md)

⚠ **They are on this project's 53-TET grid, not on a tuner's.** A fifth here is 31 commas =
701.89 cents, so open Sol is 195.571 Hz against twelve-tone's 196.00. Four cents is a fifth of a
koma — the scale of thing this view exists to show — and it is what makes an open string land at
ratio 0 *exactly* for the note that should be played open.

⚠ **Notes below the open Sol are a normal case, not an edge case.** Turkish notation transposes down
a fourth, so a written G3 sounds D3 ≈ 147 Hz, under a standard violin's 195.6. Those notes draw **no
dot** and report `out-of-range` rather than being clamped somewhere they are not. It is also the
strongest practical argument for adding a lower Turkish tuning later.

### What was built, and the three things the photo corrected

The maths is `packages/core/src/fingering.ts` (portable, unit-tested); every pixel is
`apps/web/src/ui/fingerboardGeometry.ts`; `apps/web/src/Fingerboard.tsx` does only the drawing and
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

### The view stands up, and the marks became tape (owner, 2026-08-27)

The owner opened the deployed tab and rejected how it looked: *"I want this in vertical position
and half of the violin's body should be visible, it looks very bad right now."* Two changes, both
in [../../apps/web/src/ui/fingerboardGeometry.ts](../../apps/web/src/ui/fingerboardGeometry.ts) and
[../../apps/web/src/Fingerboard.tsx](../../apps/web/src/Fingerboard.tsx):

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

### The chart is FIXED: standard violin notes, not this piece's komas (owner, 2026-08-27)

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

### The neck zoom, and why it is fitted to the piece (owner, 2026-08-27)

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

### The string choice: a hand that sits on the neck (owner, 2026-08-27)

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
not by the suite. Section 4b of `tools/core/fingering-test.ts` now pins the climb, the forced-low
start that trapped the old rule, and the opposite failure — a note above first position on the Mi
string, where there is nothing to cross to, must still shift.
