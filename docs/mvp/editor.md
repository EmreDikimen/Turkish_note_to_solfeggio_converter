# The editor — a Mus2-style palette, replacing the measure modal

purpose: the design brief for reworking note editing into an armed-tool palette over the whole score
audience: whoever builds it next — start here, then CODE_TOUR rows 16–19
updated: 2026-08-07

> Owner decision, 2026-08-07. Pressing **Düzenle** opens a **palette beside the sheet**; you **arm a
> tool** (a note value, an accidental, the tuplet sign) and **click the score** to apply it. Clicking
> a note selects it, shows an **✕** to delete, and lets you **scroll it up and down** to change its
> pitch. The palette carries its own **Çal / Dur**, and **Çal starts from the last edited measure**.
> Mus2 works this way and the owner uses it. Current state: [../STATUS.md](../STATUS.md).

---

## Settled — do not re-open these

| Decision | Consequence |
|---|---|
| **Editing covers the WHOLE score, not one measure at a time** | The modal's per-measure scope is the thing being removed. There is one edit surface: the engraved page |
| **No zoom** | An earlier draft had the sheet zoom on entering edit mode; dropped as unnecessary. This also removes the re-engrave trap that came with it |
| **`Save JSON` goes.** It will not be used | It changes *why* this work is worth doing — see below |
| **Playback works WHILE editing**, from the palette's own Çal/Dur | And Çal resumes from the **last edited measure**, not from the top |
| **Tokens are NOT the edit surface** | Editing the decoded `\tup3`/`\repstart` tokens and re-stitching was considered and dropped: playback needs the flattened doc, and a repeated passage renders **twice** from one token, so a click cannot be attributed to a pass |
| **`\repstart` / `\repend` are NOT editable** | The stitcher **unfolds** repeats (the music is written out twice), so inserting a repeat barline into flattened music would corrupt it. No repeat marks in the palette |
| **Tuplets ARE editable** | `\tup3` is arithmetic, not an object — see the rules below |

### ⚠ What deleting `Save JSON` costs, said out loud

Earlier drafts justified the rework as *"the editor is the Rung-3 labeling loop's tool, so seconds
per correction is labelling throughput."* **With `Save JSON` gone that is no longer true**, and the
claim must not survive in the docs.

It is a defensible deletion: the labelling loop's **primary** path is `scripts/rung3/review_ui.py`
(per-strip verdicts, its own queues), not the web app. What goes is the unused *page-level* export.

So the honest rationale is now simply: **a friend whose page has a wrong note should be able to fix
it.** That is a product feature, and it is enough.

To remove: `onDownload` + `#save-json` (`App.tsx:507`, `ScoreCard.tsx:94`), the two `app-smoke.ts`
checks that drive it ("saved schemaVersion 1", "saved doc has notes"), and the references in
[../PIPELINE.md](../PIPELINE.md) (lines 22 and 232).
⚠ **Assumption to confirm:** *Load* JSON stays in Gelişmiş as a development input — only *Save* goes.

---

## The interaction

**Arm a tool, then click a target.**

| Tool | Gesture | Result |
|---|---|---|
| **Note value** (2nd / 4th / 8th / 16th…) | arm it, click **anywhere empty** | a note is inserted at that point — **pitch from the click's height**, duration from the armed value |
| **Note value** | arm it, click an **existing note** | that note's duration changes |
| **Accidental** (the AEU set) | arm it, click a **note** | the accidental is applied |
| **Tuplet** | arm it, click the **first** note, then the **last** | the run becomes a triplet — rules below |
| *(none)* | click a note | selected; an **✕** appears; **scroll wheel** moves its pitch |
| *(none)* | click the **✕** | the note is deleted |
| **Çal / Dur** | in the palette | plays from the **last edited measure** |

**"Empty" means anywhere** — between two notes, before the first, after the last. Not just the slack
at the end of a bar.

**Scrolling a selected note carries its accidental.** The doc stores pitch as letter + octave +
`alter` separately (this is how `MeasureEditModal` works today), so moving the staff position while
keeping the alteration is the natural operation, not a special case.
⚠ The wheel handler must `preventDefault`, or the page scrolls underneath it.

**Çal-from-last-edit is what replaces click-to-seek.** In edit mode a click means select or insert,
so "play from this bar" would otherwise be lost — and that is exactly how you check a fix. Starting
playback from the last edited measure answers it directly: fix a note, press Çal, hear the bar.
Track one number (the measure index of the most recent edit); before any edit, Çal starts from the
top.

---

## The tuplet rules

`\tup3` is **not an object — it is arithmetic.** `isTupletMember`
(`../../tools/render/rhythm.ts:70`) is literally *"the duration's denominator is divisible by 3"*,
and `tupletGroupsIn` closes a group the moment a run of such notes **sums to a plain value**.
Nothing is stored; the bracket and the italic 3 are drawn because the arithmetic says so.

Applying the tool means **multiplying each member's duration by ⅔** (a 1/8 becomes 1/12); removing
one multiplies back by ³⁄₂. `\tupend` needs no button — it is implied. **No schema change.**

**Selection is first-note-then-last-note, and the page must refuse anything that would not make a
valid tuplet.** Invalid end notes are not clickable (dim them; do not pop an error). A candidate end
note is valid only when all three hold:

1. **The run is contiguous** — a tuplet cannot skip notes.
2. **Every member has the same duration.**
3. **The run is exactly three notes.** ⚠ This is not arbitrary: the drawn digit is **hardcoded
   `"3"`** (`SheetView.tsx:392`), so a six-member run — which *would* also sum to a plain value and
   so *would* satisfy `tupletGroupsIn` — draws a bracket that says 3 and lies about the rhythm.
   Until that digit is derived from the group size, three is the only honest length.

In practice that makes the rule cheap to implement: the only valid end note is **two positions after
the first**, if the durations match.

---

## Inserting and deleting: the bar ABSORBS, and says when it does not add up

**Settled 2026-08-07 (owner): absorb, never ripple.** An inserted note goes into its bar, which
becomes over-full; a deletion leaves its bar short. **Bar lines never move.** The alternative —
rippling the following events so bar lines re-flow down the page — was rejected because on a decoded
page the bar lines came from the model's own `|` tokens, and re-flowing rewrites the one piece of
structure a corrected page most wants to keep.

**A bar that is over OR under its length warns.** Both directions, and the warning is an indicator,
never a block: `isMeasureValid` (`../../packages/core/src/measures.ts:145`) currently greys out the
modal's **Save**, and that behaviour cannot survive — it would make the ✕ refuse to work.

### ⚠ The warning needs a reference length, and the obvious one is circular

`Measure.lengthBeats` is computed **from the bar's own contents**
(`measureBeats(current)`, `../../packages/core/src/measures.ts:123`). So
`isMeasureValid(m.events, m.lengthBeats)` is **true by construction** for any freshly loaded score —
it can only ever mean *"you have changed this bar's total since it was measured"*. That is how the
modal uses it (it freezes `lengthBeats` when it opens), and it is **not** what "this bar is over its
duration" means to a musician.

The reference must come from outside the bar. Use **the derived meter** —
`deriveTimeSignature(doc)` → `num/den` in whole-note units — and compare each bar's
`measureBeats` against it.

### That reference also localises the model's mistakes — measured

Comparing every bar against the derived meter, excluding bar 1 and the final bar (a pickup and a
closing bar are legitimately short):

| Score | Meter | Interior bars off-meter |
|---|---|---|
| `sample.json` (clean SymbTr) | 8/8 | **0** / 32 |
| `gamzedeyim-deva.json` (clean) | 4/4 | **0** / 60 |
| `safalar-getirdiniz.json` (clean) | 9/8 | **0** / 108 |
| `decoded.json` (**a real decoded page**) | 9/8 | **8** / 28 |

So the warning is **silent on correct music and lights up where the model misread a duration** —
which is error localisation, the half of the 2026-07-27 goal that W8 was dropped without delivering
([../DECISIONS.md](../DECISIONS.md)). Getting it as a side effect of a warning the editor needs
anyway is worth noticing.

⚠ **Do not over-read this yet.** It is **one** decoded page against three clean ones. The 8 bars are
*candidates*, not confirmed model errors — some may be legitimate. And two known sources of false
positives are not handled: a **usul change** mid-piece (SymbTr `Kod` 51 meta events) makes one
derived meter wrong for part of the score, and `deriveTimeSignature` is itself derived from the
data. Verify on more decoded pages before promising anything.

## What already exists

| Piece | State | Where |
|---|---|---|
| Measure hit-testing | ✅ | `SheetView.tsx:1218` `measureAt()` |
| **Per-note positions** | ❌ needed — but nearly free | `attachTitles` (`SheetView.tsx:285`) already walks every drawn note calling `getSVGElement()`; the same walk records `getBoundingClientRect()` per event index |
| Accidental glyphs + Turkish names | ✅ lift wholesale for the palette | `AccidentalSelect.tsx` |
| Pitch/duration edit primitives | ✅ the piano-roll already drags these | `updateEvent` in `App.tsx` |
| Pitch as letter+octave+alter | ✅ makes "scroll carries the accidental" natural | `MeasureEditModal.tsx` |
| Transport (play/stop/seek-to-ms) | ✅ reuse for the palette's Çal/Dur | `webAudioBackend.ts`, `onSeekMs` in `App.tsx` |
| Measure-total validation | ✅ exists, needs a new role | `../../packages/core/src/measures.ts:145` |
| Undo/redo | ❌ nothing | — |

**Undo/redo ships in the first slice, not after it.** Direct editing without undo is worse than a
modal, which at least has Cancel.

---

## Constraints — things that must not break

- **The engraving may not move.** Selection, the ✕, hover, dimmed-invalid targets and the
  invalid-bar mark are **overlays or attributes**, never changes to what is drawn. No selector
  reaching into `.kv-score svg`, and no `transform` on that container — `../../tools/render/render.ts`
  crops training strips from the SVG **by rect**, and `onLayout`'s boxes *are* those crop rects.
  (Dropping zoom removes the only reason this was going to come up. Keep the rule.)
- **Editing while playing rebuilds the timeline.** It is a `useMemo` over `doc`, so the rebuild is
  automatic; what is not automatic is telling the running backend. Rebuild, then resume from the
  same millisecond.
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

1. **Per-note rects out of `SheetView`** (extend `onLayout`), nothing consuming them yet.
   Verify: `npm test`, `smoke:page` — the engraving must be byte-identical.
2. **Selection, the ✕, and scroll-to-change-pitch.** The smallest useful editor on its own.
3. **Undo/redo** — before any of this is called done.
4. **The palette, armed-tool model**: note values first (the most common fix), then accidentals
   lifted from `AccidentalSelect`.
5. **Çal / Dur in the palette**, playing from the last edited measure.
6. **Insert-on-empty-space**, absorbing into the bar.
7. **The tuplet tool**, with the three-note rule and non-clickable invalid targets.
8. **The invalid-bar indicator**, replacing the modal's Save gate.
9. **Remove `Save JSON`** and its two `app-smoke` checks; update `PIPELINE.md`.
10. **Delete `MeasureEditModal.tsx`** — last, so there is always a working way to edit.

Verification throughout: `npm run typecheck`, `npm test`, `npm run smoke:app`, `npm run smoke:page`,
and a real correction pass on a decoded page.
