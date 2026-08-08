# The editor — what each step BUILT, and the traps it found

purpose: the build notes behind the editor rework — decisions taken while writing the code, and the bugs each step found the expensive way
audience: whoever touches the editor next, after reading the brief
updated: 2026-08-08

> The **brief** — what the editor is, what is settled, and what is still owed — is
> [editor.md](editor.md). This file is the other half: what actually got built, and the things that
> were only learnable by building it. Current state: [../STATUS.md](../STATUS.md).

---

## Step 5 — Çal from the last edited bar

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

## Step 6 — insert on empty space

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
([editor.md](editor.md#-what-the-modal-took-with-it-deleted-2026-08-08)). The newly inserted note is **selected**, so the ✕ and the accidentals land on it without hunting
for it, and the **tool stays armed**, because inserting several notes in a row is the point.

⚠ **The pitch mapping's ORIGIN needs its own check, and the ghost cannot give it.** The preview and
the insert come out of the same function, so "they agree" proves only self-consistency — a mapping
off by a whole line would agree with itself all day and put every note a third out. `smoke:editor`
pins the origin instead against the **playhead**, which spans the staff symmetrically (line 0 minus a
margin to line 4 plus the same margin): its vertical centre is the middle staff line, which in treble
is **B4**, and that is asserted with no constant of the test's own.

---

## Step 7 — the tuplet tool

✅ **Built 2026-08-08 (step 7).** One tool, both directions: arm it, click a note and the note two on
to make a triplet — or click **any member of an existing one** to take it apart again (owner call;
it needs no second click, because a note already inside a triplet cannot mean "start a new run").
Three things it settled, each of which changes what the tool accepts:

1. **A member must be a PLAIN `1/2^k` value** — not dotted, not a tie-split, not already a tuplet.
   This is arithmetic, not taste: three equal members at ×⅔ sum to `2v`, and `tupletGroupsIn` closes
   a group only when its sum lands on a plain value, so `2v` is plain exactly when `v` is. Three
   dotted 8ths would sum to 9/16, never close, and draw the *incomplete-group* bracket — the mark
   that exists to flag a MODEL mistake. Refusing them up front is what keeps that mark meaningful.
   `plainTupletBase` in [../../tools/render/rhythm.ts](../../tools/render/rhythm.ts).
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

## Step 8 — the off-meter mark

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

## Traps

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

3. **The palette costs horizontal room the page did not have.** `--page-max` (1100 px) was sized so
   the **1020 px** engraved sheet fits exactly, and the palette's footprint is **164 px** (136 wide
   + gap + margin), so edit mode needs **~1250 px of window** to show a whole system. The engraved
   width cannot shrink to make room — it is `SVG_WIDTH` in `SheetView`, and it is also the
   training-strip geometry. So the **page** grows by exactly the footprint while editing
   (`.kv-page:has(.kv-card--editing)`), keyed off a class `ScoreCard` sets when a palette is passed.
   Measured cut-off while editing: **1090 px window → 160 px still cut · 1280 px → 0 · 1470 px → 0**.
   Below ~1250 px the sheet scrolls sideways inside `.kv-score`, exactly as it did before edit mode
   existed — **owner's call, 2026-08-08**: keep the palette beside the sheet and widen the window,
   rather than floating it over the paper or moving it above the score.

Also settled while building it: **re-applying the accidental a note already carries is not an undo
entry** (`withAlter` returns the event unchanged, and `useDocHistory.apply` drops no-op edits), and
the palette's accidental row carried the **AEU signs only** — the numbered ±2/±3 stayed in the
modal's dropdown. ⚠ Overtaken on 2026-08-08: the modal was deleted and the row now carries **all
thirteen** alterations, ±8 included. It turned out every one of them has its own Bravura sign
(`accidental2CommaSharp` and friends), so the row that "would not read" as text buttons reads fine
as glyphs — the original reason for the split did not survive checking.
