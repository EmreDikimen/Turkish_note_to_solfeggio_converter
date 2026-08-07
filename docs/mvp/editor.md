# The editor — a Mus2-style palette, replacing the measure modal

purpose: the design brief for reworking note editing into a zoomed sheet with an armed-tool palette
audience: whoever builds it next — start here, then CODE_TOUR rows 16–19
updated: 2026-08-07

> Owner decision, 2026-08-07. Pressing **Düzenle** zooms the sheet and opens a **palette beside
> it**; you **arm a tool** (a note value, an accidental, the tuplet sign) and **click the score** to
> apply it. Clicking a note selects it, shows an **✕** to delete, and lets you **scroll it up and
> down** to change its pitch. Mus2 works this way and the owner uses it.
> Current state: [../STATUS.md](../STATUS.md).

---

## Settled, 2026-08-07 — read these before designing anything

| Decision | Consequence |
|---|---|
| **`Save JSON` goes.** It will not be used | See "what this costs" below — it changes *why* this work is worth doing |
| **Playback must work WHILE editing** | The transport stays live in edit mode; the playhead runs over the score being edited |
| **Tokens are NOT the edit surface** | Editing the decoded `\tup3`/`\repstart` tokens and re-stitching was considered and dropped — playback needs the flattened doc, and the doc is what every other feature already consumes |
| **`\repstart` / `\repend` are NOT editable** | Repeats are **unfolded** by the stitcher (the music is written out twice), so inserting a repeat barline into flattened music would corrupt it. No repeat marks in the palette. This also removes the schema fork an earlier draft of this page raised |
| **Tuplets ARE editable** | Because `\tup3` is not an object — it is arithmetic. See below |

### ⚠ What deleting `Save JSON` costs, said out loud

Earlier drafts of this page justified the rework as *"the editor is the Rung-3 labeling loop's tool,
so seconds per correction is labelling throughput."* **With `Save JSON` gone that is no longer
true**, and the claim must not survive in the docs.

It is a defensible deletion: the labelling loop's **primary** path is
`scripts/rung3/review_ui.py` (per-strip verdicts, its own queues), not the web app. What goes is the
*page-level* export — load a decoded page, correct it, save a note-model JSON that serializes to
training labels. Nobody used it.

So the honest rationale is now simply: **a friend whose page has a wrong note should be able to fix
it.** That is a product feature, and it is enough.

Downstream, when it is removed: `onDownload` + `#save-json` (`App.tsx:507`, `ScoreCard.tsx:94`),
the two `app-smoke.ts` checks that drive it ("saved schemaVersion 1", "saved doc has notes"), and
the references in [../PIPELINE.md](../PIPELINE.md) (lines 22 and 232).
⚠ **Assumption to confirm:** *Load* JSON stays in Gelişmiş as a development input — only *Save* goes.

---

## The interaction, as specified

**Arm a tool, then click a target.** (This replaces an earlier draft's "select first, then apply" —
the owner's model is the armed palette, which is what Mus2 does.)

| Tool | Gesture | Result |
|---|---|---|
| **Note value** (2nd / 4th / 8th / 16th…) | arm it, click **empty space** on the sheet | a new note is inserted; **pitch comes from the click's height** on the staff, duration from the armed value |
| **Note value** | arm it, click an **existing note** | that note's duration changes |
| **Accidental** (the AEU set) | arm it, click a **note** | the accidental is applied to that note |
| **Tuplet** | arm it, then **select a run of notes** | the run becomes a triplet — *see the two rules below* |
| *(none)* | click a note | it is selected; an **✕** appears; **scroll wheel** moves its pitch |
| *(none)* | click the **✕** | the note is deleted |

**Scrolling a selected note carries its accidental.** The doc already stores pitch as
letter + octave + `alter` separately (this is how `MeasureEditModal` works today), so moving the
staff position while keeping the alteration is the natural operation, not a special case.
⚠ The wheel handler must `preventDefault` or the page scrolls underneath it.

---

## The tuplet rules

`\tup3` is **not an object — it is arithmetic.** `isTupletMember`
(`../../tools/render/rhythm.ts:70`) is literally *"the duration's denominator is divisible by 3"*,
and `tupletGroupsIn` closes a group the moment a run of such notes **sums to a plain value**.
Nothing is stored; the bracket and the italic 3 are drawn because the arithmetic says so.

So applying the tuplet tool means **multiplying each member's duration by ⅔** (a 1/8 becomes 1/12),
and removing one means multiplying back by ³⁄₂. `\tupend` needs no button — it is implied.
**No schema change, and one source of truth for rhythm.**

Two rules the owner specified, both enforced before the tool applies:

1. **All members must have the same duration.** Refuse (and say why) otherwise.
2. **The selection must be a contiguous run** — a tuplet cannot skip notes.

⚠ **Open — confirm before building:** the owner wrote *"we select two notes"*. A `\tup3` has
**three** members, and the arithmetic only closes a group when the run sums to a plain value (three
1/12s make a 1/4; two do not). This brief assumes **click the first and last note of the run**, so
for a triplet that run contains three notes. If two notes were meant literally, the group will never
close and the bracket will not draw — so this needs settling first.

---

## The two traps found while reading the code

### 1. Zoom must RE-ENGRAVE, not CSS-transform

`.kv-score` **may not carry a `transform`/`zoom`/`scale`**: `../../tools/render/render.ts`
screenshots the VexFlow SVG **by rect** to cut training strips, and rects do not survive a
transform. So zoom is `renderer.resize(SVG_WIDTH * z, height * z)` plus a context scale
(`SheetView.tsx:973`) — a real re-engrave.

⚠ And then the sharper edge: `onLayout` (`SheetView.tsx:1174`) reports measure boxes in **engraved
coordinates**, and those boxes **are** `buildStrips`' crop rectangles. Multiply them by `z` and
every exported crop silently changes. Report unscaled boxes plus a separate `zoom`, or do not report
layout while zoomed. The two paths never overlap in practice — the batch renderer drives the app by
URL and never enters edit mode — but "in practice" is how the Round-1 label bug happened.

### 2. Per-note rects are nearly free

`attachTitles` (`SheetView.tsx:285`) already walks every drawn note calling `getSVGElement()` to
hang a `<title>` on it. The same walk records `getBoundingClientRect()` per event index. No new
engraving pass, no second layout model — this is the hit-testing for select, ✕, and click-to-apply.

---

## Playing while editing

The transport stays live, so an edit lands **while a timeline is running**. Two consequences:

- **The timeline must be rebuilt after an edit** — it is a `useMemo` over `doc`, so this already
  happens; what does not happen today is telling the running backend about it. Recommended
  behaviour: rebuild, then resume from the same millisecond. A duration edit shifts everything
  after the edited note, which is honest and expected.
- **Click-to-seek is gone in edit mode**, because click now means select/insert. Seeking during an
  edit session happens from the transport only. ⚠ This is a real loss — "play from this bar" is how
  you *find* the wrong note. Consider a modifier (⌥-click to seek) or keeping the playhead
  draggable.

---

## Where an inserted note lands in time — open

Clicking "empty space" gives a **pitch** (the click's height) but the time position is not obvious:
the sheet is justified, so there is no true empty space *inside* a measure, and the doc is a
sequential event list where inserting shifts everything after.

Recommendation: **append to the clicked measure** at the clicked pitch, let the bar go over-full,
and show it (below). The alternative — inserting at the nearest slot and rippling — rewrites bar
lines, which is the thing a corrected page most needs to keep.

---

## When a bar no longer adds up

Deletion and insertion are **primary gestures** here, so this happens constantly. Three options:

1. **Block it** (what the modal does — `isMeasureValid` greys out Save). Wrong here: it would make
   the ✕ refuse to work.
2. **Ripple** — shift following notes across bar lines. Destructive, and bar lines are what a
   corrected page needs to preserve.
3. **Let the bar be temporarily wrong, and SHOW it.** ⬅ **Recommended.** Tint the bar or mark its
   number and carry on. `isMeasureValid` stops gating a button and starts feeding an indicator.

---

## What already exists

| Piece | State | Where |
|---|---|---|
| Measure hit-testing | ✅ | `SheetView.tsx:1218` `measureAt()` |
| **Per-note positions** | ❌ needed — but cheap (above) | `SheetView.tsx:285` |
| Accidental glyphs + Turkish names | ✅ lift wholesale for the palette | `AccidentalSelect.tsx` |
| Pitch/duration edit primitives | ✅ the piano-roll already drags these | `updateEvent` in `App.tsx` |
| Pitch stored as letter+octave+alter | ✅ makes "scroll carries the accidental" natural | `MeasureEditModal.tsx` |
| Measure-total validation | ✅ exists, needs a new role | `../../packages/core/src/measures.ts:145` |
| Undo/redo | ❌ nothing | — |
| Zoom | ❌ nothing | `SVG_WIDTH` is a module const (`SheetView.tsx:30`) |

**Undo/redo ships in the first slice, not after it.** Direct editing without undo is worse than a
modal, which at least has Cancel.

---

## Constraints — things that must not break

- **The engraving may not move.** Selection, the ✕, hover and the invalid-bar mark are overlays or
  attributes, never changes to what is drawn. No selector reaching into `.kv-score svg`.
- **Grace notes (çarpma)** belong to the note that follows them and take no time; the modal sets
  them aside and re-inserts on save (`MeasureEditModal.tsx:56`). Deleting a host note must do
  something *defined* with its graces.
- **The DOM contract holds** — ids and `data-*` per `apps/web/src/ui/status.ts` and the CLAUDE.md
  rule. Give the editor's own state `data-*` attributes rather than making a test read Turkish.
- **All new copy goes in `apps/web/src/ui/strings.ts`**, in Turkish.
- **Edit mode stays behind the `✎ Düzenle` toggle**, so a friend who never enters it cannot select,
  insert or delete anything by accident.

---

## Suggested order

1. **Settle the two open questions**: the tuplet run (two notes or three?) and where an inserted
   note lands.
2. **Per-note rects out of `SheetView`** (extend `onLayout`), nothing consuming them yet.
   Verify: `npm test`, `smoke:page` — the engraving must be byte-identical.
3. **Zoom on entering edit mode**, re-engraved, with the layout-box guard.
4. **Selection, the ✕, and scroll-to-change-pitch.** The smallest useful editor on its own.
5. **Undo/redo** — before any of this is called done.
6. **The palette, armed-tool model**: note values first (the most common fix), then accidentals
   from `AccidentalSelect`, then the tuplet tool with its two rules.
7. **Insert-on-empty-space**, per (1).
8. **The invalid-bar indicator**, replacing the modal's Save gate.
9. **Playback during editing** — rebuild-and-resume, plus whatever replaces click-to-seek.
10. **Remove `Save JSON`** and its two `app-smoke` checks; update `PIPELINE.md`.
11. **Delete `MeasureEditModal.tsx`** — last, so there is always a working way to edit.

Verification throughout: `npm run typecheck`, `npm test`, `npm run smoke:app`, `npm run smoke:page`,
and a real correction pass on a decoded page.
