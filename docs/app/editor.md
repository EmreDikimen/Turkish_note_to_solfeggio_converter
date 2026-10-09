# The editor — a Mus2-style palette, replacing the measure modal

purpose: the design brief for reworking note editing into an armed-tool palette over the whole score
audience: whoever builds it next — start here, then CODE_TOUR rows 16–18
updated: 2026-08-18

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

It is a defensible deletion: the labelling loop's **primary** path is `scripts/rung3/review_ui.py`
(per-strip verdicts, its own queues), not the web app. What goes is the unused *page-level* export.

So the honest rationale is now simply: **a friend whose page has a wrong note should be able to fix
it.** That is a product feature, and it is enough.

Removed 2026-08-30: `onDownload` + `#save-json`, and the two `app-smoke.ts` checks that drove it
now read `window.__omrDoc` instead. Also updated then: the references in
[../PIPELINE.md](../PIPELINE.md) (lines 22 and 232).
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
for each: [editor-built.md](editor-built.md#step-5--çal-from-the-last-edited-bar).

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

✅ **Built 2026-08-08 (step 7)** — one tool, both directions: click a note and the note two on to
make a triplet, or click any member of one to take it apart. What it accepts and why (the
plain-value rule, dimming from the moment it is armed, and why an unclosed run is not
removable): [editor-built.md](editor-built.md#step-7--the-tuplet-tool).

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
[editor-built.md](editor-built.md#step-7b--holding-a-triplet-select-slide-remove).

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
found: [editor-built.md](editor-built.md#step-6--insert-on-empty-space).

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
is no longer gated on it. Detail: [editor-built.md](editor-built.md#step-8--the-off-meter-mark).

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
> (`tools/vision/page-structure.ts`): [../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md).

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
| **Undo/redo** | ✅ **built 2026-08-07** | `../../apps/web/src/useDocHistory.ts` |
| **The armed palette** | ✅ **built 2026-08-08** | `../../apps/web/src/ui/EditPalette.tsx` + `ui/accidentals.ts` |
| **Which notes can be a triplet** | ✅ **built 2026-08-08** | `plainTupletBase` / `tupletRunFrom` / `closedTupletAt` in `../../tools/render/rhythm.ts`, beside the functions that DRAW the bracket |
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
  the bundled scores carry e.g. `noteName "Si4b2"` beside `noteAE "B4b1"`); `tools/render/stitch.ts`
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
3. ✅ **DONE 2026-08-07 — undo/redo** (`apps/web/src/useDocHistory.ts`), with same-gesture
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

Five so far, all in [editor-built.md](editor-built.md#traps): a Bravura glyph painting outside
its em box so a click armed the neighbouring tool, the same glyph's ink sitting nowhere near its
baseline, the palette costing horizontal room the page did not have, an absolute alteration not
being transpose-safe, and a preview that cannot check the mapping it shares.
