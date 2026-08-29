# F3 — the clarinet view

purpose: the design, the artwork and the decisions behind the sol klarnet half of the instrument tab
audience: agents and the owner working on the clarinet view, before changing the schematic, the fingering table or the lip bar
updated: 2026-08-29

> This is the clarinet chapter of F3. The violin chapter is [fingerboard.md](fingerboard.md), the
> kanun chapter is [kanun-view.md](kanun-view.md), and the track index is [README.md](README.md).
> Current state is in [../STATUS.md](../STATUS.md). ⚠ Not to be confused with F1's clarinet
> **sound**, which shipped 2026-08-14 — [audio-sources.md](audio-sources.md).

Show which holes are covered, and how far the lip has to relax, as the piece plays.

## The scope decision (owner, 2026-08-29)

The third instrument, decided the same day the kanun view was accepted: *"Şimdi klarnet ekleyelim.
Sol klarnet olsun."* It qualifies on the same ground the violin and the kanun did — **it is already
a shipped F1 voice**, so it can be heard and seen at once.

**Sol klarnet specifically** — the G clarinet, which is *the* Turkish clarinet. It uses **Albert
(simple) system** keywork, not the Boehm keywork of a Western orchestral clarinet, and that matters
for the picture: the two instruments do not have the same keys in the same places.

## Why this is not the violin view with a different picture

[fingerboard.md](fingerboard.md) predicted this split before either was built, and it holds:

**A violin position is a number.** Distance along the string is a formula, so the marker has to land
on an exact pixel of the photograph. The photo is load-bearing geometry.

**A clarinet fingering is a list.** What you show is *which holes are covered* — filled circle
closed, empty circle open. Nothing needs pixel-exact placement, and a photograph is actively worse
at it: silver keys on dark wood, all overlapping, is the hardest possible way to read open-vs-closed.

So the clarinet's artwork is a **schematic**, and the violin's is a photograph, and that is a
consequence of the instruments rather than a style choice.

## The artwork — a PHOTOGRAPH (owner, 2026-08-29)

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

### The table is the OWNER'S, placed note by note (2026-08-30)

`tools/core/clarinet-editor.ts` builds a standalone page where each note's points are clicked on
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

### What is measured, and what the owner placed

⭐ **The six tone holes are MEASURED**, by detecting near-black round blobs on the body. Exactly six
come back, all on one axis, all the same size. They carry the view, because a fingering is mostly
*which of these six is covered* — and the owner's pass confirmed them by not moving one.

⚠ Everything else is `source: "owner"`. There is deliberately **no "guess" value left in the type**.

### The head is cut off

Owner, same message: *"klarnetin baş tarafını çıkarabilirsin, yani parmak pozisyonu görünmeyen
kısmı çıkarabilirsin."* The mouthpiece, barrel and the top of the upper joint carry no finger
position and were spending a third of the card on nothing. ⚠ The cut stops **just above the highest
key the view ever lights**, which the same message required — the La key has to stay in frame.
⚠ Re-cropped from the 1000×7050 original rather than from the earlier crop, so nothing is scaled
twice.

⚠ **The thumb hole and register key are drawn beside the instrument**, marked *arka*. They are on
the back and no front photograph can show them; every printed clarinet chart solves it the same way.

⚠ The card is bounded by **HEIGHT, never width** — 244×1560 is a 1:6.4 sliver.

## ⭐ The lip bar (owner, 2026-08-29)

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
"that gap is the feature" ([fingerboard.md](fingerboard.md)). Here the fingering is the chart and
the bar is the gap. Neither view snaps the microtone onto the twelve-tone grid, which is the whole
reason this project can show something a Western app cannot.

### What has to be decided before it can be built

⚠ **None of these are guesses to make in code.** They are data or owner input, held the way
`VIOLIN_TUNINGS` and `MANDAL_LAYOUTS` are.

**1. Which direction, and therefore which fingering to pick.** Relaxing the lip lowers the pitch.
So the chart should show the fingering **above** the target note and the bar should always read
*downward* — otherwise it would ask for a technique that does not exist. This needs the owner's
confirmation: whether tightening upward is used in practice, or whether it is downward only.

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

**4. The transposition.** A sol klarnet sounds a **fourth below** what is written, and Turkish
notation is **already** written a fourth below concert pitch. Which of the two the fingering table is
keyed to is a decision, not a default, and getting it wrong moves every fingering by four scale
steps while looking entirely plausible.

## House rules this must follow

Unchanged from [fingerboard.md](fingerboard.md), and all of them apply:

- **DOM state, never copy** — `data-*` attributes per the contract in
  [../../CLAUDE.md](../../CLAUDE.md) and `apps/web/src/ui/status.ts`. No text matching.
- **All strings in `apps/web/src/ui/strings.ts`.**
- **One clock** — drive from `getPositionMs()`, the source the playhead and both other views use.
- **The arithmetic is a pure function with unit tests**, like `tools/core/fingering-test.ts` and
  `tools/core/kanun-test.ts`. The fingering table and the lip-bend maths belong in `packages/core/`,
  not in the component.
- **Artwork with a READ licence**, chain checked and recorded in [../THIRD-PARTY.md](../THIRD-PARTY.md)
  and `/THIRD-PARTY.txt`. ✅ Done for this file.
