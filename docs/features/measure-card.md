# F3 — the bar beside the instrument

purpose: the design and the decisions behind the single-measure card on the instrument tab, and how it edits its bar
audience: agents and the owner working on the measure card, before changing what it draws, how it plays a bar, or how it edits one
updated: 2026-09-05

> This is the fourth chapter of F3 — the one that is not an instrument. The three instruments are
> [fingerboard.md](fingerboard.md), [kanun-view.md](kanun-view.md) and
> [clarinet-view.md](clarinet-view.md); the track index is [README.md](README.md). Current state is
> in [../STATUS.md](../STATUS.md). The editor itself is [../mvp/editor.md](../mvp/editor.md).

Draw the ONE bar that is sounding, beside the instrument — and let it be edited there.

## Why it exists

The three instrument views all answer the same question: **where do I put my fingers now.** None of
them answers **what am I playing now.** A player watching a clarinet photograph has to carry the
music in their head, or keep switching to the Nota tab and losing the fingering — and the page
already knows the answer.

The owner asked for it on 2026-09-04, in one sentence: *"sol tarafta enstrüman sağ tarafta nota
ölçüsü"* — instrument on the left, the bar on the right, arrows beside it, a play button above it,
and a way to edit it.

## What it is

`apps/web/src/MeasureCard.tsx`, one card on the instrument tab:

* **the bar**, engraved on its own stave with its clef, the makam signature and the meter;
* **‹ ›**, one bar back and one bar forward;
* **Ölçüyü çal**, which plays that bar and stops at its barline;
* **Ölçüyü düzenle**, which turns edit mode on *here*, with the usual toolbox;
* **Çalınanı izle**, which decides whether the card follows the music or stays where it was put.

## The five decisions

### 1. ⭐ The card IS `SheetView`, mounted a second time

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

### 2. It draws the WRITTEN score, and reads the clock against the PERFORMANCE

The card is given `drawnDoc` — the same document the sheet draws — so a bar inside a repeat is one
bar here however many times it sounds. The playing position is mapped back through `playPlan`.

⚠ **The card gets the play plan ALWAYS, folded score or not** (`perf.steps`), unlike the sheet's own
optional copy. One drawn bar has no drawn order to read a clock against, so the cursor can only be
found by asking which *written* note is sounding. Without it the seventh bar would light its first
note whenever the piece's first bar played.

⚠ The nested view's `playing` is not the transport's — it is *the playhead belongs to the bar on
screen*. A pinned bar two systems away must not show a cursor frozen on its last note; `smoke:editor`
asserts exactly that, and it is also the only signal available while the card is pinned.

### 3. `Ölçüyü çal` CUTS THE TIMELINE; it does not watch a clock and call stop

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

### 4. `Ölçüyü düzenle` edits the bar HERE — and it is the same edit

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

### 5. Following is the default and an arrow PINS

Opening the tab and pressing Çal has to need no further clicks, so the card follows the sounding
bar. But an arrow means the reader is looking at something, and music moving the page under them is
the thing that makes a page unusable — so an arrow, `Ölçüyü çal` and `Ölçüyü düzenle` all pin the
card. `Çalınanı izle` gives the follow back, and `data-follow` is what a check reads: a pinned card
and a following card are otherwise the same DOM.

## The layout

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

## What is deliberately not here

* **A second engraver, or a second overlay.** See decision 1. This is the rule the file exists to
  protect.
* **A loop.** `Ölçüyü çal` plays the bar once (owner's choice over looping it for practice).
* **Güfte and İmleci takip et.** Both are about the SHEET on screen — the page's lyrics, the page's
  scrolling — so they stay sheet-only in the card head.

## How it is checked

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
