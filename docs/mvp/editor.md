# The editor — a Mus2-style palette, replacing the measure modal

purpose: the design brief for reworking note editing into a zoomed sheet with a side palette and click-to-delete
audience: whoever builds it next — start here, then CODE_TOUR rows 16–19
updated: 2026-08-07

> Owner decision, 2026-08-07: **the per-measure modal goes.** Pressing **Düzenle** should zoom the
> sheet and open a **palette beside it** — note values, accidentals, `\repstart` / `\repend` /
> `\tup3` — and clicking a note should offer an **✕ to delete it in place**. Mus2 works this way and
> the owner finds it useful. Current state: [../STATUS.md](../STATUS.md).

---

## Why this matters more than it looks

The editor is not only a product feature. **It is the Rung-3 labeling loop's tool.** A decoded page
is loaded, corrected on screen, and saved with `Save JSON` — and that corrected file serializes to
training labels through the *same* serializer that made the synthetic set
(`../../tools/render/lilypond.ts`). So **seconds per correction is labelling throughput**, and the
model track is rate-limited by it. A faster editor is a faster Round 4.

It is also the honest answer to the friends release. The model gets things wrong; a person who can
fix a wrong note in two clicks experiences a useful tool, and a person who must open a dialog, find
a row in a table, and satisfy a duration invariant before Save un-greys experiences a form.

---

## What is wrong with the modal, concretely

`apps/web/src/MeasureEditModal.tsx` (285 lines) opens on a measure click in edit mode and shows the
measure as a **table of rows** — kind, letter+octave, accidental, duration, lyric, plus koma/Hz in
the Advanced tab.

1. **It edits a measure, but a mistake is a note.**
2. **You cannot see what you are doing** — the staff is behind the modal, and in a microtonal score
   the thing being judged is a glyph on a line.
3. **The duration invariant blocks the Save, not the edit.** `isMeasureValid`
   (`../../packages/core/src/measures.ts:145`) requires the rows to total the measure's original
   length, so a single wrong duration cannot be fixed on its own.
4. **No undo.**

---

## The target

Press **Düzenle** →

1. **the sheet zooms in** (see the zoom trap below — it is not a CSS transform);
2. **a palette appears beside the sheet**, holding: note values (**2nd / 4th / 8th / 16th**…),
   the AEU **accidentals**, and the structural marks **`\repstart`, `\repend`, `\tup3`**;
3. **click a note → it is selected, and an ✕ appears on it** → click the ✕ to delete. The same
   click-then-✕ applies to the structural marks.

Interaction model — **select first, then apply.** Click a note to select it, then click a palette
item to change it. This beats arming the palette and then clicking the score: the selection is
visible, one wrong click is undone by clicking elsewhere, and there is no invisible mode. (Arming
can be added later for runs of the same edit; it should not be the only way in.)

Keyboard is a **later** slice, not this one — but when it comes, note that **↑/↓ must not be a
semitone** the way MuseScore binds it. That encodes a 12-TET assumption this project exists to
reject. Staff position on ↑/↓, **one koma on Alt+↑/↓**.

**Undo/redo ships with the first slice, not after it.** Direct editing without undo is worse than a
modal, which at least has Cancel.

⚠ Mus2 is the owner's reference and the source of this shape. Its exact palette layout and
shortcuts have **not** been verified here — check the real application before copying details,
rather than trusting this page.

---

## The three findings that decide the work

### 1. `\tup3` is not an object. It is arithmetic.

`isTupletMember` (`../../tools/render/rhythm.ts:70`) is simply **"the duration's denominator is
divisible by 3"**, and `tupletGroupsIn` closes a group the moment a run of such notes **sums to a
plain value**. Nothing is stored. There is no tuplet field on `NoteEvent`.

So the palette's `\tup3` button is **a duration operation on a selection**, not an insertion:

- **apply** `\tup3` to three selected notes → multiply each duration by **⅔** (a 1/8 becomes 1/12);
  the bracket and the italic 3 then appear *because the arithmetic says so*.
- **delete** a `\tup3` → multiply its members back by **³⁄₂**.
- `\tupend` needs no button at all — it is implied by the sum landing on a plain value.

This is good news: it needs **no schema change**, and it keeps one source of truth for rhythm.

### 2. `\repstart` / `\repend` are DERIVED too — and this one is a real fork

`detectRepeats` (`../../tools/render/repeats.ts:63`) fingerprints measures and finds runs that
repeat **exactly**, because SymbTr writes a repeated passage out twice. The signs are a *reading* of
the music, not data in it. Today they are display-only and off by default (`Tekrarlar`, in
Gelişmiş); CLAUDE.md records them as "visual + strip-label tokens only".

So "insert a `\repstart`" has no home in the current schema, and there are two honest answers:

- **(a) Store an explicit repeat span** on the document — a new optional field, so
  `schemaVersion` stays 1 for old files but gains meaning. `detectRepeats` becomes the *default*
  that a user override replaces. ⬅ **Recommended**, and the smaller change of the two.
- **(b) Leave repeats derived** and let the palette only *remove* a wrongly-detected span (an
  override list of "not a repeat here"). Cheaper, but it cannot express a repeat the detector
  missed — which is exactly the case a labeller hits.

⚠ Decide this **before** building the palette, because it changes what the button does. Whichever
is taken, `Save JSON` must keep round-tripping — `npm test`'s 217/217 is the guard.

### 3. Zoom must RE-ENGRAVE, not CSS-transform — and it collides with the strip exporter

Two facts that meet badly:

- `.kv-score` **may not carry a `transform`/`zoom`/`scale`**: `../../tools/render/render.ts`
  screenshots the VexFlow SVG **by rect** to cut training strips, and rects do not survive a
  transform.
- `onLayout` (`SheetView.tsx:1174`) reports measure boxes in **engraved coordinates**, and those
  boxes feed `buildStrips` — the exporter's crop rectangles.

So zoom is `renderer.resize(SVG_WIDTH * z, height * z)` plus a context scale (`SheetView.tsx:973`),
i.e. a **real re-engrave at a larger size** — not CSS. And then: ⚠ **if the reported layout boxes
are multiplied by `z`, every exported crop rect silently changes.** Guard it explicitly — either
report unscaled boxes plus a separate `zoom` factor, or do not report layout at all while zoomed.
In practice the two never overlap (the batch renderer drives the app by URL params and never enters
edit mode) but "in practice" is exactly how the Round-1 label bug happened.

---

## What already exists

| Piece | State | Where |
|---|---|---|
| Measure hit-testing | ✅ | `SheetView.tsx:1218` `measureAt()` |
| **Per-NOTE positions** | ❌ **needed — but cheap** | `attachTitles` (`SheetView.tsx:285`) already walks every drawn note calling `getSVGElement()`; the same walk can record `getBoundingClientRect()` per event index |
| Accidental glyphs + Turkish names | ✅ lift wholesale for the palette | `AccidentalSelect.tsx` |
| Pitch/duration edit primitives | ✅ the piano-roll already drags these | `updateEvent` in `App.tsx` |
| Measure-total validation | ✅ exists, needs a new role | `isMeasureValid` |
| Undo/redo | ❌ nothing | — |
| Zoom | ❌ nothing | `SVG_WIDTH` is a module const (`SheetView.tsx:30`) |

---

## The other design question: what happens when a bar no longer adds up

Deletion is a **primary gesture** in this design, so this comes up constantly — delete a note and
the bar is short. Three options:

1. **Block it** (what the modal does). Wrong here: it would make the ✕ refuse to work.
2. **Ripple** — shift following notes across bar lines. Destructive, and a decoded page's bar lines
   are exactly what a labeller is preserving.
3. **Let the bar be temporarily wrong, and SHOW it.** ⬅ **Recommended.** Tint the bar or mark its
   number, and carry on. `isMeasureValid` stops gating a button and starts feeding an indicator.

If (3) is taken, **`Save JSON` must still work on an imperfect score** — a half-corrected page is
worth saving in the labeling loop.

---

## Constraints — things that must not break

- **The engraving may not move.** Selection, the ✕ and hover are overlays or attributes, never
  changes to what is drawn. No selector reaching into `.kv-score svg`.
- **`Save JSON` keeps emitting `schemaVersion: 1`** and round-tripping through `stripExport.ts` /
  `lilypond.ts`. `npm test` (217/217) is the guard.
- **Grace notes (çarpma)** belong to the note that follows them and take no time; the modal sets
  them aside and re-inserts on save (`MeasureEditModal.tsx:56`). Deleting a host note must do
  something *defined* with its graces.
- **The DOM contract holds** — ids and `data-*` per `apps/web/src/ui/status.ts` and the CLAUDE.md
  rule; `app-smoke` still drives `#save-json`. Give the editor's own state `data-*` attributes
  rather than making a test read Turkish labels.
- **All new copy goes in `apps/web/src/ui/strings.ts`**, in Turkish.
- **Edit mode stays behind the `✎ Düzenle` toggle**, so a friend who never enters it cannot select
  or delete anything by accident. Click means *seek* outside edit mode and *select* inside it.

---

## Suggested order

1. **Decide the repeat question** (§2 above). It is a schema call and everything else is cheaper.
2. **Per-note rects out of `SheetView`** (extend `onLayout`), nothing consuming them yet.
   Verify: `npm test`, `smoke:page` — the engraving must be byte-identical.
3. **Zoom on entering edit mode**, re-engraved, with the layout-box guard from §3.
4. **Selection + the ✕**: click to select, ✕ to delete, click-away to clear.
5. **Undo/redo** over the doc — before any of this is called done.
6. **The palette**: note values first (the most common fix), then accidentals from
   `AccidentalSelect`, then `\tup3` as the ⅔ / ³⁄₂ operation.
7. **`\repstart` / `\repend`**, per the §2 decision.
8. **The invalid-measure indicator**, replacing the modal's Save gate.
9. **Delete `MeasureEditModal.tsx`** — last, so there is always a working way to edit.
10. Note *entry* (adding notes, not just fixing them) and the keyboard map are **later** slices;
    correcting a decoded page is the loop that pays, and it is nearly all edits and deletions.

Verification throughout: `npm run typecheck`, `npm test`, `npm run smoke:app`, `npm run smoke:page`,
and a real correction pass on a decoded page — timed against the modal, because "faster" is the
whole claim.
