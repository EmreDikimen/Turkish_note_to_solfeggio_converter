# The editor — replacing the measure modal with direct editing

purpose: the design brief for reworking note editing into a MuseScore/Mus2-style direct-manipulation editor
audience: whoever builds it next — start here, then CODE_TOUR rows 16–19
updated: 2026-08-07

> Owner decision, 2026-08-07: **the per-measure modal goes.** Editing should feel like MuseScore or
> Mus2 — click a note on the staff, change it in place, keep moving. Current state:
> [../STATUS.md](../STATUS.md). Why the modal exists at all: it was the cheapest thing that could
> possibly work when the editor was a Rung-4 stage, and it was never revisited.

---

## Why this matters more than it looks

The editor is not only a product feature. **It is the Rung-3 labeling loop's tool.** A decoded page
is loaded, corrected on screen, and saved with `Save JSON` — and that corrected file serializes to
training labels through the *same* serializer that made the synthetic set
(`tools/render/lilypond.ts`). So **seconds per correction is labelling throughput**, and the model
track is rate-limited by it. A faster editor is a faster Round 4.

It is also the honest answer to the friends release. The model gets things wrong; a person who can
fix a wrong note in one keystroke experiences a useful tool, and a person who must open a dialog,
find a row in a table, and satisfy a duration invariant before the Save button un-greys experiences
a form.

---

## What is wrong with the modal, concretely

`apps/web/src/MeasureEditModal.tsx` (285 lines) opens on a measure click in edit mode and shows the
measure as a **table of rows** — kind, letter+octave, accidental, duration, lyric, plus koma/Hz in
the Advanced tab.

1. **It edits a measure, but a mistake is a note.** The unit of work is wrong, so every single-note
   fix costs: enter edit mode → click the measure → find the row → change → Save → modal closes.
2. **You cannot see what you are doing.** The staff is behind the modal. In a microtonal score the
   *thing being judged* is a glyph on a line — hiding it is precisely backwards.
3. **The duration invariant blocks the save, not the edit.** `isMeasureValid`
   (`packages/core/src/measures.ts:145`) requires the rows to total the measure's original length or
   Save is disabled. Correcting a misread duration therefore requires fixing a second note in the
   same breath, before anything can be committed.
4. **No keyboard path and no undo.** Every change is a mouse round-trip through a `<select>`.

---

## The target

Direct manipulation, the pattern both reference editors share: **select a note, then act on it.**
No dialog on the common path.

- Click a note → it is selected and visibly so.
- **↑ / ↓** move it by staff position (letter+octave), carrying its accidental.
- **Alt+↑ / Alt+↓** move it by **one koma** — this is the microtonal app, so the comma nudge is a
  first-class binding, not a menu. ⚠ Do NOT copy MuseScore's ↑/↓ = one semitone; that binding
  encodes a 12-TET assumption this project exists to reject.
- **1–6** set the duration (whole → 32nd), MuseScore-style.
- The AEU accidentals get a **palette plus shortcuts**; the glyphs and Turkish names already exist
  in `AccidentalSelect.tsx` and can be lifted wholesale.
- **Del** removes, **Space** plays from the selection, **Esc** deselects.
- **⌘Z / ⌘⇧Z** undo/redo. Direct editing without undo is worse than the modal, not better — the
  modal at least has Cancel. Treat undo as part of the first shippable slice, not a follow-up.

⚠ The owner named **Mus2** as a reference; it is the established makam-notation editor and shares
the AEU/53-comma world this app lives in. Its exact key map has not been verified here — check it
against the real application before copying specific bindings, rather than trusting this page.

---

## What already exists (and what does not)

| Piece | State | Where |
|---|---|---|
| Measure hit-testing | ✅ works | `SheetView.tsx:1218` `measureAt()` against recorded `boxes` |
| Measure boxes reported to App | ✅ works | `onLayout` → `SheetView.tsx:1174` |
| **Per-NOTE positions** | ❌ **does not exist — the main structural gap** | see below |
| Hover highlight | ✅ measure-level | `SheetView.tsx:1279` |
| Click-to-seek | ✅ works, and collides with click-to-select | `SheetView.tsx:1256` |
| Accidental glyphs + Turkish names | ✅ reusable as-is | `AccidentalSelect.tsx` |
| Pitch/duration edit primitives | ✅ already in App | `updateEvent` (the piano-roll drags this today) |
| Measure-total validation | ✅ exists, needs a new role | `isMeasureValid`, `measures.ts:145` |
| Undo/redo | ❌ nothing | — |

**The one real finding:** per-note rects are *cheap* to add, because the loop that needs them is
already written. `attachTitles` (`SheetView.tsx:285`) walks every drawn note and calls
`n.getSVGElement()` to hang a `<title>` on it. The same walk can record
`el.getBoundingClientRect()` per event index and hand it to App through `onLayout` beside `boxes`.
No new engraving pass, no second layout model.

---

## The hard question: what happens to the measure's duration

This is the decision the rework turns on, and it should be made deliberately rather than discovered.
When a note's duration changes, the bar no longer adds up. Three options:

1. **Block it** (what the modal does). Wrong for direct editing — it makes the common single-note
   fix impossible without a second edit.
2. **Ripple**: shift the following notes, pushing the overflow into later bars. Musically what a
   sequencer does; destructive across a page, and a decoded page's bar lines are exactly what a
   labeller is trying to preserve.
3. **Allow the bar to be temporarily wrong, and SHOW it.** ⬅ **Recommended.** Mark the offending
   measure (a tinted bar number, a count in the margin) and let the person carry on. The score stays
   editable, nothing is silently rewritten, and the invariant becomes information rather than a
   locked door.

If (3) is taken, `isMeasureValid` stops gating a Save button and starts feeding a per-measure
indicator — and **`Save JSON` must keep working on an imperfect score**, because a half-corrected
page is still worth saving in the labeling loop.

---

## Constraints — things that must not break

- **The engraving may not move.** `tools/render/render.ts` screenshots the VexFlow SVG by rect to
  cut training strips; selection and hover must be overlays or attributes, never changes to what is
  drawn. Same rule as the style pass: no CSS reaching into `.kv-score svg`, no transform on it.
- **`Save JSON` must still emit `schemaVersion: 1`** with events that round-trip through
  `stripExport.ts` / `lilypond.ts`. `npm test`'s 217/217 round-trip is the guard.
- **Grace notes (çarpma) belong to the note that follows them** and occupy no time. The modal
  handles this by setting them aside and re-inserting on save (`MeasureEditModal.tsx:56`). Direct
  editing has to solve it again — deleting a host note must do something defined with its graces.
- **The DOM contract holds.** Ids and `data-*` per `apps/web/src/ui/status.ts` and the CLAUDE.md
  rule; `app-smoke` still drives `#save-json`. If the editor gains its own testable state, give it
  attributes rather than making a test read Turkish labels.
- **All new copy goes in `apps/web/src/ui/strings.ts`**, in Turkish, like everything else.
- **Edit mode vs play mode.** Click currently seeks; in edit mode it will select. Keep the two
  meanings separated by the existing `✎ Düzenle` toggle rather than by a modifier key, so a friend
  who never enters edit mode cannot select anything by accident.

---

## Suggested order

1. **Per-note rects out of `SheetView`** (extend `onLayout`), with nothing consuming them yet.
   Verify: `npm test`, `smoke:page` — the engraving must be byte-identical.
2. **Selection + the overlay**: click to select, Esc to clear, visible selected state.
3. **Keyboard: pitch (↑/↓), koma (Alt+↑/↓), duration (1–6), delete.** Reuse `updateEvent`.
4. **Undo/redo** over the doc, before any of this ships.
5. **The accidental palette**, lifted from `AccidentalSelect`.
6. **The invalid-measure indicator**, replacing the modal's Save gate.
7. **Delete `MeasureEditModal.tsx`** — and only then, so there is always a working way to edit.
8. Note entry (adding notes, not just fixing them) is a **later** slice; correcting a decoded page
   is the loop that pays, and it is nearly all edits.

Verification throughout: `npm run typecheck`, `npm test`, `npm run smoke:app`, `npm run smoke:page`,
and a real correction pass on a decoded page — time it against the modal, because "faster" is the
whole claim.
