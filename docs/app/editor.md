# The editor — a Mus2-style palette, replacing the measure modal

purpose: the editor: the design brief for the armed-tool palette, and the build notes and traps from writing it
audience: whoever builds it next — start here, then CODE_TOUR rows 16–18
updated: 2026-11-20

> Owner decision, 2026-08-07. Pressing **Düzenle** opens a **palette beside the sheet**; you **arm a
> tool** (a note value, an accidental, the tuplet sign) and **click the score** to apply it. Clicking
> a note selects it, shows an **✕** to delete, and lets you **drag it up and down** to change its
> pitch. The palette carries its own **Çal / Dur**, and **Çal starts from the last edited measure**.
> Mus2 works this way and the owner uses it. Current state: [../STATUS.md](../STATUS.md).

---

## Settled — do not re-open these

| Decision | Consequence |
|---|---|
| **Editing covers the WHOLE score, not one measure at a time** | The modal's per-measure scope is the thing being removed. There is one edit surface: the engraved page |
| **No zoom** | An earlier draft had the sheet zoom on entering edit mode; dropped as unnecessary. This also removes the re-engrave trap that came with it |
| **`Save JSON` goes.** It will not be used | ✅ removed 2026-08-30 (dropped 2026-08-15, then asked for again). It changes *why* this work is worth doing — see below |
| **The per-measure modal goes** | ✅ deleted 2026-08-08. Rests and the numbered koma signs were rebuilt into the palette the same day; **lyric editing** and exact **koma/Hz** entry went with it — see below |
| **Playback works WHILE editing**, from the palette's own Çal/Dur | And Çal resumes from the **last edited measure**, not from the top |
| **Tokens are NOT the edit surface** | Editing the decoded `\tup3`/`\repstart` tokens and re-stitching was considered and dropped: playback needs the flattened doc, and a repeated passage renders **twice** from one token, so a click cannot be attributed to a pass |
| **`\repstart` / `\repend` are NOT editable** | ⚠ **The reason changed on 2026-08-30 and the rule did not.** It used to be that the stitcher unfolded repeats, so a repeat barline inserted into flattened music would corrupt it. Now the app keeps the page AS WRITTEN and the signs are real — but they are held in `structure`, beside the document, and editing one would mean rewriting the playing order. Still no repeat marks in the palette. [../DECISIONS.md](../DECISIONS.md) |
| **Tuplets ARE editable** | `\tup3` is arithmetic, not an object — see the rules below |

### ⚠ What deleting `Save JSON` costs, said out loud

Earlier drafts justified the rework as *"the editor is the Rung-3 labeling loop's tool, so seconds
per correction is labelling throughput."* **With `Save JSON` gone that is no longer true**, and the
claim must not survive in the docs.

It is a defensible deletion: the labelling loop's **primary** path is `ml/labels/review_ui.py`
(per-strip verdicts, its own queues), not the web app. What goes is the unused *page-level* export.

So the honest rationale is now simply: **a friend whose page has a wrong note should be able to fix
it.** That is a product feature, and it is enough.

Removed 2026-08-30: `onDownload` + `#save-json`, and the two `app-smoke.ts` checks that drove it
now read `window.__omrDoc` instead. Also updated then: the references in
[CODE_TOUR.md § Inference pipeline — from a full uploaded image to editable notes](../CODE_TOUR.md#inference-pipeline--from-a-full-uploaded-image-to-editable-notes) (lines 22 and 232).
⚠ **Assumption to confirm:** *Load* JSON stays in Gelişmiş as a development input — only *Save* goes.

### What the modal took with it (deleted 2026-08-08), and what came back

The modal was the last holder of four things. **Two were rebuilt into the palette the same day**
(owner's call); two are still gone:

| Was in the modal | State |
|---|---|
| **Rests** | ✅ **back, 2026-08-08** — an **Es** row of six rest values beside the note values. Arm one and click blank staff to insert a rest, or click a note to turn it into one; a note value clicked on a rest turns it back |
| **The numbered ±2/±3 alterations** | ✅ **back, 2026-08-08** — the accidental row now carries **all thirteen**, ±8 included (it had been missing from the palette too). Every one has its own Bravura sign, so none of them needs a text label |
| **Lyrics (güfte)** | ⛔ gone. The `Hece` column was the app's only lyric editor. Worth rebuilding only if a friend asks — the decode reads lyrics and the sheet draws them, so what is missing is editing, not reading |
| **Exact koma / Hz** | ⛔ gone. Probably fine: the thirteen signs cover every alteration the corpus uses, and the piano roll still drags pitch |

⚠ **A ±2/±3 is stored exactly and DRAWN SNAPPED.** The engraver prints the nearest standard AEU sign
(`toAeuAlter`), because that is what a Turkish edition prints — so those two tools change the sound
exactly and the printed sign only approximately. The tooltip names the comma count for that reason.

Two things about the rest tools, both deliberate:

- **A rest is the same tool as a note value with `rest: true`,** not a separate kind — it inserts
  and re-values through exactly the same paths, so "arm a thing, click a target" stays true of the
  whole palette and there is no second insert path to keep in step.
- **Turning a rest back into a note takes the pitch from the CLICK'S HEIGHT** (`toNote` in core),
  the same mapping the insert ghost uses. A rest carries no pitch to keep, so the height is the only
  honest source — and it means a rest the model read where a note belongs is one click to fix.
- **The rest's preview does not follow the pointer up and down.** A rest goes where the engraver
  puts it, mid-staff, so the ghost parks there and carries `data-insert-pitch="es"` rather than
  promising a pitch it will not use.

---

## The interaction

**Arm a tool, then click a target.**

| Tool | Gesture | Result |
|---|---|---|
| **Note value** (2nd / 4th / 8th / 16th…) | arm it, click **anywhere empty** | a note is inserted at that point — **pitch from the click's height**, duration from the armed value. ✅ step 6, with a ghost notehead previewing it |
| **Note value** | arm it, click an **existing note** | that note's duration changes |
| **Accidental** (all thirteen: the AEU signs, natural, and the numbered ±2/±3) | arm it, click a **note** | the alteration is applied. ⚠ ±2/±3 are stored exactly and drawn snapped to the nearest AEU sign |
| **Rest** (six values) | arm it, click **empty staff** | a rest is inserted there. ✅ 2026-08-08 |
| **Rest** | arm it, click a **note** | that note becomes a rest — its pitch and lyric are cleared |
| **Note value** | arm it, click a **rest** | the rest becomes a note, pitched by the click's **height** |
| **Tuplet** | arm it, click the **first** note, then the **last** | the run becomes a triplet — rules below |
| *(none)* | click a note | selected; an **✕** appears |
| *(none)* | **drag a note up/down** | its pitch moves by staff step, accidental carried. ⚠ A drag, not the wheel — see below |
| *(none)* | hover a note | a teal outline — **the only hover edit mode has.** ⚠ Measures do **not** highlight on hover (owner, 2026-08-07): editing is whole-score, so framing a bar says the wrong thing about what a click does |
| *(none)* | click the **✕** | the note is deleted |
| **Çal / Dur** | in the palette | plays from the **last edited measure** |

**"Empty" means anywhere** — between two notes, before the first, after the last. Not just the slack
at the end of a bar.

**Dragging a selected note carries its accidental.** The doc stores pitch as letter + octave +
`alter` separately (this is how the note model has always stored pitch), so moving the staff
position while keeping the alteration is the natural operation, not a special case.

⚠ **It is a DRAG, not the scroll wheel** (owner, 2026-08-07, revising the line above this section).
A wheel version was built first and thrown away: it fights the page's own scrolling, and it moves
the note in jumps rather than under your finger. Grab the note and pull it up or down;
`DRAG_PX_PER_STEP` is **half a staff space**, so the notehead tracks the pointer exactly.

Three details carry the gesture, and each was a bug first:
1. **`setPointerCapture` on pointerdown.** The note's hit box is ~20 px wide and the note moves out
   from under the pointer on the first step; without capture the drag dies immediately.
2. **Steps are measured from where the pointer went down**, never from the previous event, so
   rounding cannot accumulate drift across a long drag. `applied` remembers how far the note has
   already moved and only the difference is sent, because `onNudgePitch` is relative.
3. **`preventDefault` + `touch-action: none`**, or the browser text-selects on desktop and pans the
   page on a touchscreen instead of dragging.

⚠ A **plain click must not move the pitch** — it only selects. Pinned by `smoke:editor`.

**Çal-from-last-edit is what replaces click-to-seek.** In edit mode a click means select or insert,
so "play from this bar" would otherwise be lost — and that is exactly how you check a fix. Starting
playback from the last edited measure answers it directly: fix a note, press Çal, hear the bar.
Track one number (the measure index of the most recent edit); before any edit, Çal starts from the
top.

✅ **Built 2026-08-08 (step 5)** — Çal always restarts from the last edited bar, an edit still
stops playback, and undo does not move the remembered bar. The three decisions and the reason
for each: [editor.md § Step 5 — Çal from the last edited bar](#step-5--çal-from-the-last-edited-bar).

---

## The tuplet rules

`\tup3` is **not an object — it is arithmetic.** `isTupletMember`
(`../../packages/core/src/labels/rhythm.ts:70`) is literally *"the duration's denominator is divisible by 3"*,
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

✅ **Built 2026-08-08 (step 7)** — one tool, both directions: click a note and the note two on to
make a triplet, or click any member of one to take it apart. What it accepts and why (the
plain-value rule, dimming from the moment it is armed, and why an unclosed run is not
removable): [editor.md § Step 7 — the tuplet tool](#step-7--the-tuplet-tool).

**A tuplet is picked up by its drawn "3", and its handles move it** (owner, 2026-08-30). Clicking
the SIGN selects the whole group — a frame, a handle at each end, and a ✕ that removes the bracket
and keeps the notes. It works **with nothing armed (Seçim) as well as under ÜÇLEME**, but not with a
note value or an accidental armed: those apply to a note, and a mark is not one. ⚠ Under ÜÇLEME
**its notes are not targets** — `pointer-events: none`, though they keep their `member` state so the
page still says where the triplets are; in Seçim a note and a mark are **mutually exclusive**
selections, because each carries its own ✕. Dragging a handle on a REAL triplet moves the group
along its bar — the first member hands its plain value back and the neighbour joins — so it stays
**exactly three notes** and the bar length does not change.

⚠ **Widening a triplet into a real 4-, 5- or 7-tuplet is NOT built, and it is not a UI problem.** It
needs the drawn digit derived from the group size (it is a hardcoded `"3"`, above) **and** a label
token that does not exist — there is no `\tup5`. New tokens go at the end of `ADDED_TOKENS` and
change what the corpus can express, so that is a corpus decision for the owner, not an editor
change. Until it is taken, three is the only honest length in both directions.

✅ **Built 2026-08-30 (step 7b)** — select, slide from either end, remove the bracket. The three
decisions behind it, and the simulation that stops a handle drawing a bracket over the wrong notes:
[editor.md § Step 7b — holding a triplet: select, slide, remove](#step-7b--holding-a-triplet-select-slide-remove).

---

## Inserting and deleting: the bar ABSORBS, and says when it does not add up

**Settled 2026-08-07 (owner): absorb, never ripple.** An inserted note goes into its bar, which
becomes over-full; a deletion leaves its bar short. **Bar lines never move.** The alternative —
rippling the following events so bar lines re-flow down the page — was rejected because on a decoded
page the bar lines came from the model's own `|` tokens, and re-flowing rewrites the one piece of
structure a corrected page most wants to keep.

**A bar that is over OR under its length warns.** Both directions, and the warning is an indicator,
never a block: `isMeasureValid` (`../../packages/core/src/measures.ts:145`) used to grey out the
modal's **Save**, and that behaviour could not survive — it would make the ✕ refuse to work. ✅ The
gate is gone as of step 8; the warning stays.

✅ **Built 2026-08-08 (step 6).** `insertInMeasure` (`../../packages/core/src/edits.ts`) is the
delete primitive's mirror: it splices into the bar, stamps the bar's own number on the new event
and renumbers, and **checks no total** — the bar comes out over its length, exactly as a delete
leaves one short. The three rules that keep the splice honest, the two owner calls it settled
(the ghost notehead, and an inserted note taking the key signature's alteration) and the trap it
found: [editor.md § Step 6 — insert on empty space](#step-6--insert-on-empty-space).

### ⚠ The warning needs a reference length, and the obvious one is circular

`Measure.lengthBeats` is computed **from the bar's own contents**
(`measureBeats(current)`, `../../packages/core/src/measures.ts:123`). So
`isMeasureValid(m.events, m.lengthBeats)` is **true by construction** for any freshly loaded score —
it can only ever mean *"you have changed this bar's total since it was measured"*. That is how the
modal used it (it froze `lengthBeats` when it opened), and it is **not** what "this bar is over its
duration" means to a musician.

The reference must come from outside the bar. Use **the derived meter** —
`deriveTimeSignature(doc)` → `num/den` in whole-note units — and compare each bar's
`measureBeats` against it.

✅ **Built 2026-08-08 (step 8), alongside step 7** — a badge at the bar's top-right in the edit
overlay, `[data-omr="bar-warning"]` with `data-bar-fill="over|under"`. ⚠ Edit mode only, and the
first and last bar warn only when OVER (a pickup and a closing bar are legitimately short — so a
triplet in bar 1 produces no mark, which reads exactly like a broken indicator). The modal's Save
is no longer gated on it. Detail: [editor.md § Step 8 — the off-meter mark](#step-8--the-off-meter-mark).

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

> ✅ **VERIFIED AT CORPUS SCALE 2026-08-18, and the caution above was right.** Over **1,670** real
> decoded pages: **37.8%** of interior bars are off-meter (median 40% per page; only 7.2% of pages
> clean). So the mark is a **~2.6× narrowing** of a duration hunt, not a spotlight — and it cannot
> see pitch, which is 40% of the edit budget. The "silent on correct music" half still holds: the
> three clean scores above stay at 0. ⚠ The second false-positive source is now quantified too —
> where the modal bar length has <25% support the derived meter is a coin flip, which was producing
> **2/8 and 3/8** meters that no Turkish usul uses. Numbers and the re-runnable probe
> (`tools/dev/page-structure.ts`): [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

## What already exists

| Piece | State | Where |
|---|---|---|
| Measure hit-testing | ✅ | `SheetView.tsx` `measureAt()` |
| **Per-note positions** | ✅ **built 2026-08-07** | `NoteBox[]` state in `SheetView.tsx`, filled in the same walk that records the playhead's `NotePos` |
| Accidental glyphs + Turkish names | ✅ **lifted 2026-08-08** into `ui/accidentals.ts` | shared by `AccidentalSelect.tsx` and the palette |
| **Pitch/duration edit primitives** | ✅ **extracted 2026-08-07** | `../../packages/core/src/edits.ts` — `withPitch`, `withKoma`, `withDurationBeats`, `nudgePitch`, `deleteEvent`, `renumber` |
| Pitch as letter+octave+alter | ✅ makes "scroll carries the accidental" natural | `spellingOf` / `nudgePitch` in `edits.ts` |
| Transport (play/stop/seek-to-ms) | ✅ **reused as-is 2026-08-08** — the palette's Çal is one call to `onSeekMs`, no new backend code | `webAudioBackend.ts`, `onSeekMs` in `App.tsx` |
| **Which bar an event is in** | ✅ **built 2026-08-08** | `measureOfEvent` in `../../packages/core/src/measures.ts`, over the same `groupMeasures` the sheet and the modal use |
| Measure-total validation | ✅ exists, needs a new role | `../../packages/core/src/measures.ts:145` |
| **Undo/redo** | ✅ **built 2026-08-07** | `../../apps/web/src/score/useDocHistory.ts` |
| **The armed palette** | ✅ **built 2026-08-08** | `../../apps/web/src/ui/EditPalette.tsx` + `ui/accidentals.ts` |
| **Which notes can be a triplet** | ✅ **built 2026-08-08** | `plainTupletBase` / `tupletRunFrom` / `closedTupletAt` in `../../packages/core/src/labels/rhythm.ts`, beside the functions that DRAW the bracket |
| **Where a held mark's handles may land** | ✅ **built 2026-08-30** | `tupletEdgeTo` in the same file — a real triplet slides, a broken one is repaired, and its last check is a simulation against `tupletGroupsIn`, not a rule |
| **Finding a mark the arithmetic never closed** | ✅ **built 2026-08-30** | `drawnTupletAt` — the counterpart of `closedTupletAt`: *"is a bracket drawn here"*, not *"is this a real triplet"* |
| **Scaling durations (make/remove a triplet)** | ✅ **built 2026-08-08** | `scaleDurations` in `../../packages/core/src/edits.ts` |
| **Inserting into a bar** | ✅ **built 2026-08-08** | `insertInMeasure` / `insertIndexIn` in `../../packages/core/src/edits.ts` |
| **Pitch from a click's height** | ✅ **built 2026-08-08** | `pitchAtHeight` + `MeasureBox.topLineY` in `SheetView.tsx`, over core's `nudgePitch` |

**Undo/redo shipped in the first slice, not after it.** Direct editing without undo is worse than a
modal, which at least has Cancel.

### ⚠ The extraction found a live bug, and fixed it

`updateEvent` patched `koma53` + `freqHz` and left `noteName` alone — and the sheet reads its staff
position from `parseNoteName(ev.noteName)`. **So dragging a note in the piano roll moved the SOUND
and left the notehead where it was.** Both edit paths now go through `edits.ts`, so a pitch edit
cannot half-apply. Two notes on what was deliberately *not* changed:

- **The roll's DURATION drag still writes `durationMs` alone**, leaving `durationBeats` (what the
  sheet engraves) stale — the same bug shape. Fixing it means snapping a continuous drag to a note
  value, which is the palette's job (step 4), not the extraction's.
- **`noteAE` is left exact, not AEU-snapped.** The Python exporter snaps it (152 of 2,297 notes in
  the bundled scores carry e.g. `noteName "Si4b2"` beside `noteAE "B4b1"`); `packages/core/src/labels/stitch.ts`
  and the modal never did. `withPitch` matches the two TS producers. Nothing reads `noteAE` but the
  piano-roll's hover label, so this is cosmetic — but it is real, and unifying it is its own call.

---

## Constraints — things that must not break

- **The engraving may not move.** Selection, the ✕, hover, dimmed-invalid targets and the
  invalid-bar mark are **overlays or attributes**, never changes to what is drawn. No selector
  reaching into `.kv-score svg`, and no `transform` on that container — `../../tools/render/render.ts`
  crops training strips from the SVG **by rect**, and `onLayout`'s boxes *are* those crop rects.
  (Dropping zoom removes the only reason this was going to come up. Keep the rule.)
- **Editing while playing rebuilds the timeline.** It is a `useMemo` over `doc`, so the rebuild is
  automatic; what is not automatic is telling the running backend. Rebuild, then resume from the
  same millisecond. ⚠ **NOT BUILT, on purpose (step 5, 2026-08-08):** every edit still calls
  `onStop()`, as it always has. `applyPlayback` in `App.tsx` already has the reschedule-from-here
  pattern if this is picked up, but a pitch drag emits an edit per animation frame, so it would need
  to fire on gesture end only — and the drag path does not currently signal one.
- **Grace notes (çarpma)** belong to the note that follows them and take no time. ✅ **Settled
  2026-08-07: deleting a host deletes its leading graces with it** (`deleteEvent` in
  `../../packages/core/src/edits.ts`). That was already the modal's de-facto behaviour — a grace
  whose host row was gone matched nothing on save and was silently dropped — so this makes the
  existing rule explicit and unit-tested rather than inventing a new one. ⚠ Graces get **no
  `NoteBox`** (they are VexFlow modifiers on the following note, never entries in `notes[]`), so
  they cannot be selected or deleted on their own.
- **The DOM contract holds** — ids and `data-*` per `apps/web/src/ui/status.ts` and the CLAUDE.md
  rule. Give the editor's own state `data-*` attributes rather than making a test read Turkish.
  Shipped in slice 1: `#edit-toggle[data-edit-mode]`, `#sheet-surface[data-edit-mode]` +
  `[data-selected-note]`, `[data-omr-note]` / `[data-selected]` per note, and
  `#note-delete` / `#undo` / `#redo`. Added since: `#edit-palette[data-armed]` + `[data-tool]` per
  tool (step 4), `#edit-palette[data-play-from]` + `#palette-play[data-play-state]` /
  `#palette-stop` (step 5), and `[data-omr="insert-ghost"]` carrying `data-insert-pitch` — the
  pitch an empty click would insert (step 6). ⚠ **Two attributes now sit on two elements each**, so a check must name
  the one it means **by id**: `data-edit-mode` (the toggle button and the sheet — matching the
  attribute alone picks the button) and `data-play-state` (the transport's `#play` and the
  palette's `#palette-play`). `npm run smoke:editor` drives all of it.
  ⚠ An attribute naming a bar cannot prove playback *began* there, so `smoke:editor` measures the
  **playhead's position down the sheet** (`[data-omr="playhead"]`) instead: aimed at bar 1 it sits
  0.05 down, aimed at bar 31 of the sample it sits 0.95 down.
- **All new copy goes in `apps/web/src/ui/strings.ts`**, in Turkish.
- **Edit mode stays behind the `✎ Düzenle` toggle**, so a friend who never enters it cannot select,
  insert or delete anything by accident.

---

## Suggested order

1. ✅ **DONE 2026-08-07 — per-note rects out of `SheetView`.** ⚠ **NOT through `onLayout`**, as
   this line originally said. They are `NoteBox[]` state local to `SheetView`: `onLayout`'s payload
   is a contract shared with `stripExport.ts` and `tools/render/render.ts` (which crops training
   strips by those measure rects), the only consumer is the overlay in the same file, and `onLayout`
   is an engrave dependency — a second, non-stable callback prop would re-engrave forever. Filled in
   the walk that already records `NotePos` for the playhead.
2. ✅ **DONE 2026-08-07 — selection, the ✕, and drag-to-change-pitch.**
3. ✅ **DONE 2026-08-07 — undo/redo** (`apps/web/src/score/useDocHistory.ts`), with same-gesture
   coalescing so one drag (on the sheet or in the piano roll) is one undo entry.
4. ✅ **DONE 2026-08-08 — the palette, armed-tool model.** `apps/web/src/ui/EditPalette.tsx`: six
   note values as Bravura glyphs (SMuFL `U+E1D2/E1D3/E1D5/E1D7/E1D9/E1DB`) and the AEU signs, armed
   one at a time; a click on a note applies the armed tool instead of starting a pitch drag. `Esc`
   or `↖ Seçim` disarms, and leaving edit mode does too. The accidental list now lives once in
   `apps/web/src/ui/accidentals.ts`, read by both the palette and (until step 10) the modal's picker. New core
   primitive: `withAlter` (the mirror of `nudgePitch` — the alteration moves, the staff position
   does not). See the two traps recorded below.
5. ✅ **DONE 2026-08-08 — Çal / Dur in the palette**, playing from the last edited measure. One new
   core primitive (`measureOfEvent`), one number in `App` (`lastEditMeasure`), and two buttons that
   reuse the existing `onSeekMs` / `onStop` — no new backend or transport code. The three decisions
   it settled are in *The interaction* above.
6. ✅ **DONE 2026-08-08 — insert-on-empty-space**, absorbing into the bar. One new core primitive
   (`insertInMeasure`, plus `insertIndexIn` so the caller can select what it added), the staff
   geometry and a **ghost notehead** in `SheetView`, and `onInsertNote` in `App` built on the same
   display→stored round trip the accidental tool uses. The two owner calls it settled, and the trap
   it found, are in *Inserting and deleting* below.
7b. ✅ **DONE 2026-08-30 — holding a triplet**: click its drawn **3** to select (never its notes),
   drag either end — a real triplet slides, a broken mark is repaired — and ✕ to remove the bracket and keep the notes. `drawnTupletAt` / `tupletEdgeTo` in `rhythm.ts` decide which notes;
   `scaleDurations` twice does the rewrite, in one undo entry.
7. ✅ **DONE 2026-08-08 — the tuplet tool**, with the three-note rule and non-clickable invalid
   targets. Selection arithmetic in `rhythm.ts` (`plainTupletBase`, `tupletRunFrom`,
   `closedTupletAt`), one core primitive (`scaleDurations`), and a `data-tuplet` state per note
   target. Built with step 8, because it makes a short bar every time.
8. ✅ **DONE 2026-08-08 — the invalid-bar indicator**, against the derived meter, and the modal's
   Save gate is gone.
9. ✅ **DONE 2026-08-30 — `Save JSON` is removed.** Dropped on 2026-08-15 because `smoke:editor` had
   no other way to read an edited document; the owner asked for it again on 2026-08-30 and the
   objection was paid off instead of overruled — `window.__omrDoc` exposes the live document beside
   the existing `__omrStrips`/`__omrConfig` hooks, `save()` and the two `app-smoke` checks read it,
   and both suites pass unchanged.
10. ✅ **DONE 2026-08-08 — `MeasureEditModal.tsx` is deleted**, and `AccidentalSelect.tsx` with it
    (the modal was its only caller; the palette's accidentals come from `ui/accidentals.ts`). A
    click on blank staff with nothing armed now just clears the selection — no window can appear
    over the score any more. ⚠ Taken **out of order**, before step 9, at the owner's request. What
    went with it is listed below.

Verification throughout: `npm run typecheck`, `npm test`, `npm run smoke:app`, `npm run smoke:page`,
and a real correction pass on a decoded page.

### ⚠ The traps this rework found

Five so far, all in [editor.md § Traps](#traps): a Bravura glyph painting outside
its em box so a click armed the neighbouring tool, the same glyph's ink sitting nowhere near its
baseline, the palette costing horizontal room the page did not have, an absolute alteration not
being transpose-safe, and a preview that cannot check the mapping it shares.

**Merged into this file on 2026-11-20:**

- [The editor — what each step BUILT, and the traps it found](#the-editor--what-each-step-built-and-the-traps-it-found) — was `docs/app/editor.md`


## The editor — what each step BUILT, and the traps it found

*Was `docs/app/editor.md` (last updated 2026-08-08).*

> The **brief** — what the editor is, what is settled, and what is still owed — is
> [editor.md](editor.md). This file is the other half: what actually got built, and the things that
> were only learnable by building it. Current state: [../STATUS.md](../STATUS.md).

---

### Step 5 — Çal from the last edited bar

✅ **Built 2026-08-08 (step 5).** Three decisions were taken while building it, all owner-approved:

1. **Çal always (re)starts from the last edited bar; Dur stops.** No pause/resume in the palette —
   the transport bar above stays on screen in edit mode and already carries Çal/Duraklat/Devam.
   Pressing Çal again mid-playback replays the same bar, which is what checking a fix by ear
   actually looks like.
2. **An edit still stops playback**, exactly as before this step. The constraint below — "editing
   while playing rebuilds the timeline, then resumes from the same millisecond" — is therefore
   **NOT built**, and is deliberately deferred rather than quietly done. It is also what makes
   Çal-from-last-edit the thing you press: you stop, you fix, you press Çal.
3. **Undo/redo do NOT move the remembered bar**, unlike the selection (which they clear). The bar
   you were working in is still the bar you want to hear, and threading a measure through
   `useDocHistory`'s two stacks would buy nothing. Pinned by `smoke:editor`.

The remembered value is a **measure number, not an event index** — a delete renumbers every event.
It is set from the doc as it stood *before* each edit (`markEdited` in `App.tsx`, via core's new
`measureOfEvent`), cleared on load, and resolved to a position through
`groupMeasures(doc).find(…)?.startMs ?? 0` at Çal time. ⚠ That `?? 0` is a real case, not
defensiveness: deleting a bar's last note removes the measure, so a remembered index can outrun the
score; falling back to the top is the safe read.

---

### Step 6 — insert on empty space

✅ **Built 2026-08-08 (step 6).** `insertInMeasure` (`../../packages/core/src/edits.ts`) is the
delete primitive's mirror: it splices into the bar, stamps the bar's own number on the new event and
renumbers, and **checks no total** — the bar comes out over its length, exactly as a delete leaves
one short. Three rules keep the splice honest, and each is a way it could have gone quietly wrong:

1. **The position is resolved inside the target measure only.** `groupMeasures` starts a new measure
   whenever the `bar` number CHANGES, so a note stamped bar 7 spliced anywhere outside bar 7's own
   run would cut one bar in two on the page — bar lines moving, which is the whole thing this rule
   exists to prevent.
2. **A leading grace run belongs to the note that follows it**, so inserting before a note inserts
   before its graces as well (`deleteEvent`'s walk-back, run the other way) — but never past the
   measure's own first event, or rule 1 breaks. When the run reaches the bar's head the new note
   simply becomes the bar's first event.
3. **A document with no `bar` numbers yet is run through `assignBars` first.** `groupMeasures`
   derives bars on the fly and throws the copies away, so stamping only the new event would leave
   one numbered event in an unnumbered array — and grouping would cut a bar at the insert. The app
   assigns bars at load; this makes the primitive safe on its own.

Two owner decisions taken while building it:

- **A ghost notehead previews the insert.** A teal oval follows the pointer while a note value is
  armed, snapped to the staff step the click will use, and it carries `data-insert-pitch` — so
  `smoke:editor` can assert *the preview said F5 and the saved note is F5* with no pixel arithmetic
  of its own. It is moved by mutating the element (like the playhead), never through state: a
  preview that re-rendered the overlay per mouse-move is the exact cost that got the measure hover
  highlight removed in slice 1.
- **An inserted note takes the KEY SIGNATURE's alteration** for its letter, not natural. A note put
  on Si under a koma-bemol-Si signature is born koma-flat, so the engraver prints nothing on it and
  the note looks like the place that was clicked. Natural would have printed an explicit ♮ nobody
  asked for. The accidental tool changes it afterwards.

Settled while building, and cheap to keep: an **accidental armed** over blank staff does **nothing**
(it has nothing to attach to, and falling through to the measure modal would be a surprise), while
**nothing armed** still opened the modal — the only way to add a REST. ⚠ Both halves of that
sentence were overtaken on 2026-08-08, when step 10 deleted the modal: an unarmed click on blank
staff now just clears the selection, and there is no way to add a rest at all
([editor.md](#-what-the-modal-took-with-it-deleted-2026-08-08)). The newly inserted note is **selected**, so the ✕ and the accidentals land on it without hunting
for it, and the **tool stays armed**, because inserting several notes in a row is the point.

⚠ **The pitch mapping's ORIGIN needs its own check, and the ghost cannot give it.** The preview and
the insert come out of the same function, so "they agree" proves only self-consistency — a mapping
off by a whole line would agree with itself all day and put every note a third out. `smoke:editor`
pins the origin instead against the **playhead**, which spans the staff symmetrically (line 0 minus a
margin to line 4 plus the same margin): its vertical centre is the middle staff line, which in treble
is **B4**, and that is asserted with no constant of the test's own.

---

### Step 7 — the tuplet tool

✅ **Built 2026-08-08 (step 7).** One tool, both directions: arm it, click a note and the note two on
to make a triplet — or click **any member of an existing one**, which since 2026-08-30 **holds** the
group rather than taking it apart (step 7b below; a note already inside a triplet still cannot mean
"start a new run", so the click is unambiguous either way).
Three things it settled, each of which changes what the tool accepts:

1. **A member must be a PLAIN `1/2^k` value** — not dotted, not a tie-split, not already a tuplet.
   This is arithmetic, not taste: three equal members at ×⅔ sum to `2v`, and `tupletGroupsIn` closes
   a group only when its sum lands on a plain value, so `2v` is plain exactly when `v` is. Three
   dotted 8ths would sum to 9/16, never close, and draw the *incomplete-group* bracket — the mark
   that exists to flag a MODEL mistake. Refusing them up front is what keeps that mark meaningful.
   `plainTupletBase` in [../../packages/core/src/labels/rhythm.ts](../../packages/core/src/labels/rhythm.ts).
2. **Dimming starts the moment the tool is armed**, not after the first click (owner). Notes that
   cannot begin a run are dim and `pointer-events: none` from the outset, so the page refuses them
   instead of absorbing a click that does nothing. Once a run is open, only its **anchor** and its
   one legal **end** stay live — an existing triplet elsewhere on the page would otherwise silently
   abandon the anchor when clicked.
3. **Only a CLOSED three-member group can be removed.** `tupletGroupsIn` also yields runs that never
   sum plain: those are the model's unclosed `\tup3`s, drawn with a bracket precisely because they
   are wrong. Multiplying one back by ³⁄₂ would not restore anything, it would invent a rhythm
   nobody read, so `closedTupletAt` refuses them.

Where the code went, and why it is split: **"which notes" lives in `rhythm.ts`**
(`plainTupletBase`, `tupletRunFrom`, `closedTupletAt`), beside the functions that draw the bracket
and write the `\tup3` label, so the tool cannot offer a triplet the engraver would refuse — a second
copy in the app is exactly the divergence CLAUDE.md's one-code-path rule exists to prevent. **The
rewrite is one core primitive**, `scaleDurations` in
[../../packages/core/src/edits.ts](../../packages/core/src/edits.ts): ×⅔ to make one, ×³⁄₂ to remove
one, reduced (2/24 → 1/12) and with `durationMs` following `durationBeats` through
`withDurationBeats`. Nothing is stored — no schema change — which is also why `smoke:editor` proves
the edit by counting the **triplet marks the engraver actually drew**, not by reading an attribute.
⚠ Both mark styles are counted: the per-piece coin picks VexFlow's bracket (`.vf-tuplet`) or the
curved arc with an italic "3", and which one the sample happens to get must not decide whether the
check works — the first version of it counted only the arc and read 0 on a bracket page.

---

### Step 7b — holding a triplet: select, slide, remove

✅ **Built 2026-08-30** (owner: *"tupletlere tıklayarak onları seçebilmemi, solundan ve sağından
tutarak genişletebilmemi veya daraltabilmemi, aynı zamanda silebilmemi sağlayan bir mantık ekle"*).
A triplet became something you can **hold**: click its drawn **3** and the group is selected — a frame
round its three notes, a **handle at each end**, and a **✕**.

⚠ **The click target is the SIGN, not the notes** (owner, second pass the same day: *"direkt olarak
3'leme işaretinin tıklanabilir olmasını istiyorum. notalarına tıklamak istemiyorum"*). The first
build selected by clicking a member; that is gone. A note inside a triplet keeps its
`data-tuplet="member"` state — so the DOM still says where the triplets are — but under ÜÇLEME it is
`pointer-events: none`, exactly like every other target the tool refuses.

⚠ **And ÜÇLEME is not a precondition** (owner, fourth pass: *"tupletleri seçmek için toolkitten ille
de tupleti seçmem gerekmesin. Seçim seçiliyken de tupletleri seçip silebileyim"*). A mark is a target
in plain **Seçim** too (`tupletPickable`) — but not with a note value or an accidental armed, because
those apply to a note and a mark is not one. In Seçim a note and a mark are **mutually exclusive
selections**: each carries its own ✕, and two delete buttons on the page at once could only be a trap.

**That change had a real consequence, and it is a paint-order one.** Under ÜÇLEME the member notes are
pointer-transparent, so the mark was reachable however the overlays were stacked. In Seçim the notes
are live, and a note's box **swallowed the mark outright** — VexFlow's box reaches along the *stem*,
well past the noteheads, into the strip of staff the mark is drawn in. The mark overlay now paints
**after** the note targets, so it wins where they overlap. That is the right way round: the mark is
the smaller, more specific target, and it is drawn on the **notehead side, opposite the stems**, so
the region the two fight over is stem, never notehead. `smoke:editor` holds the other half of the
bargain — **no note's CENTRE may fall inside a mark's box** — in both modes.

#### Two kinds of mark, and the handles mean different things on each

⚠ **Not every drawn "3" covers three notes** (owner, third pass the same day: *"bazı tupletler 3
notayı kapsamıyor, 1 notayı kapsayan tupletler vesaire de olabiliyor onları silebilmek veya
genişletebilmek istiyorum"*). `tupletGroupsIn` brackets a run that never sums to a plain value —
the model's misread, drawn on purpose so a person can see it. On a real decoded page these are the
majority: `decoded.json` carries **five broken marks against two real triplets**, of one, two and
three members.

**Every drawn mark is holdable**, and `drawnTupletAt` is what finds one where `closedTupletAt`
cannot. The two shapes then behave differently:

| | a REAL triplet (closes) | a BROKEN mark |
|---|---|---|
| **handles** | **slide** — three members always | **repair** — the grabbed end moves, the other stays |
| **may grow?** | never (the digit is a hardcoded "3") | yes, but only to a move that **CLOSES** it |
| **may shrink?** | never — that would spoil a correct mark | yes, always (the retreat toward ✕) |
| **✕** | notes back to plain values | the same, and this is the commonest fix |
| **drawn** | orange frame | **red**, from the moment the tool is armed |

The growth rule is the whole policy in one line: **a broken mark may be repaired or retreat, never
made merely broader.** So a two-note mark whose neighbour is the right plain value can be pulled out
to a real triplet, and the sheet marks that landing green (`data-tuplet-fix`) because on a decoded
page it is the move you want. ⚠ Some broken marks have **no legal move at all** — two of
`decoded.json`'s five, whose neighbours are not plain values of the matching length. Those are
cleared with the ✕, or the neighbour is re-valued first with the note tools. That is honest rather
than limiting: offering a drag that could not produce a triplet would only move the lie.

⚠ The ✕ on a broken mark reverses the old rule that only a closed group could be removed, whose
argument was that ×³⁄₂ "would invent a rhythm nobody read". That was an argument about what the page
TRULY says — and the person looking at the page is the one answering it. ⚠ The arithmetic is exact
for the ordinary cases (1/12 → 1/8); a member on an unusual fraction can land on a value no single
notehead draws, and the engraver then falls back to its nearest-value snap, as it does for any other
odd duration.

#### On a REAL triplet, the handle SLIDES the group

**It does not stretch it** — and that is arithmetic, not a shortcut in the UI. The drawn digit is a hardcoded `"3"` and the label token is `\tup3`, so a four- or
five-member group would draw and label a rhythm nobody wrote. Dragging the right handle one note to
the right therefore hands the **first** member its plain value back (×³⁄₂) and pulls the **next**
note in (×⅔); the left handle does the mirror. The group is always exactly three notes, and the bar
length never changes — one member gives back exactly what the newcomer takes.

Three decisions, each of which the owner was asked about before any of it was written:

1. **Slide, not a real n-tuplet** (owner, 2026-08-30). Widening to a genuine 5- or 7-tuplet needs a
   digit derived from the group size **and** new label tokens (`\tup5`, `\tup7` do not exist), which
   is a corpus decision, not an editor one. It is written down as a possible later step rather than
   guessed at — see [editor.md](#the-tuplet-rules).
2. **The ✕ removes the BRACKET, not the notes** (owner, 2026-08-30). The three notes stay and get
   their plain values back. This is the second half of what a click on a member used to do in one
   go; splitting it means a mis-aimed click no longer rewrites three durations. The bar it is in
   becomes longer, and the off-meter mark (step 8) says so — exactly as making the triplet made it
   short.
3. **A landing is shown but not clickable.** Every note either handle could be dragged onto is
   marked (`data-tuplet-landing="start|end|both"`), and it stays pointer-transparent: a click that
   also moved the group would leave "which end?" ambiguous.

#### Measuring the mark, which is where the real bug was

The target has to sit on the ink a reader sees, so it is measured off the mark that was engraved
rather than computed a second time from the notes — a second copy of the geometry is exactly what
this project's one-code-path rule exists to prevent. Both styles are wrapped in a `<g>` for that: the
curved mark is drawn into one we create, and VexFlow's square bracket into one the render context
opens (`openGroup`), so neither depends on VexFlow's class names or on document order.

⚠ **`getBBox()` on that group is NOT the ink, and using it made a target four times too tall.**
Measured on a bracket page (2026-08-30): the group read **96 × 160 px** where the bracket is
**96 × 20**. A group's box is the union of its children's, and two children lie about theirs —

 - **a `<text>` reports its FONT's em box, not its glyph.** The bracket's "3" measured **12 × 160 px**:
   12 px of digit inside the em box of a music font whose ascent and descent are enormous. The digit
   always sits in the mark's own gap, between the strokes, so the strokes already bound it —
   `markBoxOf` skips text children entirely;
 - **VexFlow emits a zero-height `<rect>` at the SVG ORIGIN** inside its tuplet group (0, 0, 95, 0).
   Any box reaching x ≤ 0 or y ≤ 0 is rejected, the same rule and the same reason as `noteBoxOf`:
   a drawn mark is never at the origin, so only an unpositioned element can claim to be.

A slab that size over the staff would have swallowed the clicks meant for notes — the
`GraceNoteGroup` failure this codebase already paid for once. `smoke:editor` now asserts **no note's
centre falls inside a mark's target**.

⚠ **The bracket branch has no automated coverage.** The mark style is a per-piece hash and all six
bundled scores land on the arc, so a bracket page is code no suite on this machine executes. It was
verified **by hand** on a renamed score, both styles: target ~20 px tall, clicking it holds the group,
both handles appear. A permanent check needs a bracket-hashing score, and one cannot simply be added
to `public/` — `prune-dist.mjs` fails the build on any `.json` at the dist root.

⚠ **The last check inside `tupletEdgeTo` is a SIMULATION, not another rule.** The move is applied
to a copy and `closedTupletAt` — the function that decides what gets drawn — is asked whether the
group it now finds is exactly the intended one. A stray unclosed tuplet fraction sitting just before
the window opens the run early, and `tupletGroupsIn` would then close a bracket over the *wrong*
three notes. Asking the drawing code is the only way to be sure a handle cannot leave a bracket that
lies; `tools/tests/edits-test.ts` builds that exact bar and checks the slide is refused.

Where the code went is unchanged from step 7: **"which notes" is `tupletEdgeTo` in
[../../packages/core/src/labels/rhythm.ts](../../packages/core/src/labels/rhythm.ts)**, beside the functions that draw the
bracket, and **the rewrite is `scaleDurations` twice** — ×³⁄₂ on what leaves, ×⅔ on what joins, in
one `history.apply`, so a whole drag across four notes is **one undo entry** (`coalesce` keys on the
edge, not on the target). Nothing new is stored: the held group is one event index, and the three
members are re-derived with `closedTupletAt` on every render, so an undo simply makes the handles
disappear.

---

### Step 8 — the off-meter mark

✅ **Built 2026-08-08 (step 8), alongside step 7** — they belong together, because a triplet turns
3 × 1/8 into 3 × 1/12 and so leaves a short bar every single time. A small badge at the bar's
top-right in the **edit overlay** (never in the SVG): `+` over-full, `−` short, with the bar's own
total and the meter in its title. `[data-omr="bar-warning"]` carries `data-bar` and
`data-bar-fill="over|under"`.

Three decisions inside it:

- **Edit mode only.** A friend opening a decoded page should not meet eight warnings before
  touching anything; in edit mode they mark exactly where the corrections are. Showing them always
  is a later call and needs more evidence than the one decoded page measured below.
- **The first and last bar warn only when OVER.** A pickup and a closing bar are legitimately
  short; an overfull one never is. ⚠ This is load-bearing for anyone writing a check: a triplet
  applied in bar 1 produces **no** mark, which reads exactly like a broken indicator.
- **The modal's Save is no longer gated on it** (`MeasureEditModal`, itself deleted later the same
  day). The warning stays, the block goes: over- and under-full bars are now ordinary, reachable states of the document, so locking a
  user inside a modal over one would be wrong in the same way it would make the ✕ refuse to work.

---

### Traps

Three came out of the palette (2026-08-08); the other two are recorded with their steps above.

1. **A Bravura glyph paints outside its em box, and that made clicks land on the wrong tool.** The
   1/32 button's notehead+flag ink overhung the 1/8 button above it, so `elementFromPoint` in the
   middle of the 1/8 tool returned the 1/32 one — and a click there armed 1/32. It reproduced in
   Playwright *and* by hand, and it hit only *some* of the buttons, so `smoke:editor` now arms all
   14 and checks each one arms itself. The fix is one line in `styles/app.css`:
   `.kv-tool .kv-glyph { pointer-events: none }`, which makes a click resolve to the button that
   owns the pixel. ⚠ **Clipping the ink (`overflow: hidden`) was tried first and reverted** — it cut
   the stems and flags off the note glyphs, which is the only thing they are read by.

   **The same glyph then broke out of the top of its button, and the cause is worth knowing: a music
   glyph's ink is nowhere near its baseline.** Measured off the shipped Bravura with
   `TextMetrics.actualBoundingBox*`, a stemmed note draws **87–102 units up and ~14 down** per 100 of
   font-size, while an accidental is roughly balanced (34/34). Ordinary centring centres the *line
   box*, so the stems pushed out through the top while the space under the notehead sat empty — and
   the ink was never too big for the button (~30 px inside 38). `EditPalette`'s `INK` table carries
   the measurements and `inkCentred` shifts each glyph by half its own imbalance, with
   `line-height: 0` so the baseline lands at the button's centre. `smoke:editor` measures the result
   against the real font, so a font swap or a size change cannot quietly undo it.
2. **An absolute alteration is not transpose-safe, unlike a relative nudge.** The sheet draws
   `displayDoc`, so `onApplyTool` builds the accidental edit in DISPLAY space and maps the single
   event back with the same `transposeDoc(…, -transpose)` round-trip `onSaveMeasure` uses.
   `onNudgePitch` never needed this only because ±1 step means the same thing in both spaces.

3. ⚠ **OVERTURNED 2026-09-03 — the palette FLOATS now, and costs the page nothing.** What follows
   is why it used to cost something, kept because the arithmetic still explains the constraint.
   **The palette costs horizontal room the page did not have.** `--page-max` (1100 px) was sized so
   the **1020 px** engraved sheet fits exactly, and the palette's footprint was **164 px** (136 wide
   + gap + margin), so edit mode needed **~1250 px of window** to show a whole system. The engraved
   width cannot shrink to make room — it is `SVG_WIDTH` in `SheetView`, and it is also the
   training-strip geometry. So the **page** grew by exactly the footprint while editing
   (`.kv-page:has(.kv-card--editing)`), keyed off a class `ScoreCard` set when a palette was passed.
   Measured cut-off while editing: **1090 px window → 160 px still cut · 1280 px → 0 · 1470 px → 0**.
   Below ~1250 px the sheet scrolled sideways inside `.kv-score`, exactly as it did before edit mode
   existed — **owner's call, 2026-08-08**: keep the palette beside the sheet and widen the window,
   rather than floating it over the paper or moving it above the score.

   ⚠ **The owner reversed exactly that call on 2026-09-03** (*"bu toolun sayfaya yapışık olmasını
   istemiyorum… gerçekten bir alet çantası gibi"*). The palette is now `.kv-toolbox`: `position:
   fixed`, rendered from `App` **outside `.kv-card`**, dragged by its title bar and folded to that
   bar alone by the button on its right. It takes no width from the score row, so `.kv-score` is
   **1050 px in edit mode and out of it** and pressing Düzenle no longer moves the music; the
   cut-off numbers above and the ~1250 px window they priced no longer apply, and the
   `.kv-page:has(.kv-card--editing)` rule is deleted. The cost the 2026-08-08 call was avoiding is
   now accepted: a floating box **can** cover music, and the answer is that the user moves it.
   Where it opens (left of the card, clear of the music on a wide window), what is remembered and
   the two positioning traps are in [../DECISIONS.md](../DECISIONS.md).

Also settled while building it: **re-applying the accidental a note already carries is not an undo
entry** (`withAlter` returns the event unchanged, and `useDocHistory.apply` drops no-op edits), and
the palette's accidental row carried the **AEU signs only** — the numbered ±2/±3 stayed in the
modal's dropdown. ⚠ Overtaken on 2026-08-08: the modal was deleted and the row now carries **all
thirteen** alterations, ±8 included. It turned out every one of them has its own Bravura sign
(`accidental2CommaSharp` and friends), so the row that "would not read" as text buttons reads fine
as glyphs — the original reason for the split did not survive checking.
