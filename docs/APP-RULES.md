# App rules — playback, the editor, the DOM and the stylesheet

purpose: the rules for anyone touching the web app; split out of CLAUDE.md at its 400-line cap, on the DOM-CONTRACT.md precedent
audience: agents and the owner working on apps/web, tools/render or tools/core
updated: 2026-09-06

> **These are hard rules, not background.** Each was paid for once by a live bug. CLAUDE.md keeps a
> one-line headline for the six that can be broken from anywhere in the repo and points here for the
> rest — read this file before changing anything under `apps/web/`, `tools/render/` or `tools/core/`.
> Current state and next action are NOT here: [STATUS.md](STATUS.md). The per-feature attribute list
> is its own file: [DOM-CONTRACT.md](DOM-CONTRACT.md).

---

## 1 · Playback: the page is written once, the performance is derived

- **THE APP KEEPS THE PAGE AS WRITTEN, AND THE REPEAT IS TAKEN WHEN IT PLAYS** (owner, 2026-08-30). A
  decoded page is stitched with **`expand: false`**, so `‖: … :‖`, the 1./2. brackets and 𝄋 / ⊕ /
  "D.C." / "Son" stay as SIGNS and repeated bars are drawn **once**. The performance is derived:
  `stitch.ts` returns `structure` (`bars` + `playBars`), core's **`unfoldDoc`** expands it,
  `buildTimeline` runs on that. ⚠ **Never make the app expand again** to "fix" something downstream;
  unfold at that point instead. ⚠ **`buildTimeline` must never be given the WRITTEN doc** when a
  structure exists — it would play the repeat once with the cursor still right, the silent version of
  this bug. Safety claim: `npm run check:fold` — **1,720 pages, 0 changed**.
- ⛔ **AND NEITHER MAY ANYTHING ELSE THE APP HANDS THE BACKEND IN MUSICAL MS.** The app's two other
  clock-aligned inputs were both keyed to the written page and both shipped broken from the unfold
  until **2026-09-05**: the makam's koma deltas landed on the wrong notes, and the metronome and usul
  builders ran out of bars, so **the usul stopped partway through a repeat and never came back**
  (`perf.doc` in `buildPlayOptions`). ⚠ **Neither threw and no browser check can reach either** — the
  smokes load a SymbTr sample, which is flat in the data and never folds, so the owner's EAR found
  both; `tools/core/makam-test.ts` and `usul-test.ts` pin them. **`doc` is what a person reads and
  edits, and nothing that must line up with a clock may be built from it.**
- ⚠ The playhead follows a **play plan** (`PlayStep[]`: one step per sounding event, naming the WRITTEN
  note drawn for it) and SheetView indexes drawn positions **by event index**; breaking that link
  desynchronises picture from sound silently.
- ⭐ **THE FIRST 𝄋 MARKS A SECTION; EVERY LATER 𝄋 PLAYS IT AGAIN AND COMES BACK** (owner, 2026-08-30) —
  a saz semâîsi writes its **teslim once** and plays it after every **hâne**. `expandSegnoJumps` owns
  it, and it needs no "D.C.". ⚠ **Where the section ends must come from the page**: a "Son", else the
  first `:‖` after the 𝄋; with neither, **nothing happens and a warning is written** — guessing an end
  replays arbitrary music, playing straight through is only incomplete. ⚠ A jump fires at the **END**
  of its bar, and a 𝄋 lands on the bar it is DRAWN on (`segnoAt`). ⚠ **A FIRST ENDING IS A RUN, NOT ONE
  BAR** — from the "1." to the `:‖`, skipped whole, capped at `MAX_FIRST_ENDING = 4`, and resolved
  **once** in `expandRepeats` → `ScoreStructure.firstEndings`; the drawn "1." reads that answer or the
  ink and the music drift apart (they did, on 37.9% of real first endings). Rules and counts:
  [docs/DECISIONS.md](DECISIONS.md).
- ⚠ **DECODED PAGES ONLY** — a SymbTr sample is flat in the data, so folding one means guessing from
  duplicate bars; `Tekrarlar` still only DRAWS there and the renderer path (`?repseed=`/`?navseed=`) is
  untouched, so the training corpus is byte-identical. ⚠ `Tekrarları açık yaz` is **view-only and
  closes edit mode**.
- **The makam bends the SOUND ONLY** (owner decision 2026-08-06, shipped 2026-08-07). Comma deltas go
  in on the way to `buildTimeline` — the engraving, `Save JSON` and `buildStrips` never move, and no
  key signature is redrawn. The table carries **documented deviations only**; `none` is the default.
  ⛔ **THE DELTAS ARE KEYED BY THE WRITTEN DOCUMENT AND `unfoldDoc` RENUMBERS — RE-KEY THEM WITH
  `remapKomaDeltas` OR THE BEND LANDS ON THE WRONG NOTE** (fixed 2026-09-05). Nothing throws, because
  every index still exists: the page simply plays out of tune, which is how it was found — by ear.
  ⚠ **It is not only a repeat that moves them**: the unfolder drops `meta` events, so an ordinary page
  with no repeat at all is already misaligned (`gamzedeyim-deva` under uşşak bent **19 wrong notes out
  of 22**). ⚠ **Re-key; do NOT bend before unfolding** — `perf.doc` is the instrument views' document
  and the kanun looks a course up by an exact WRITTEN koma, which a fractional one misses.
  ⚠ The picker's "how many notes of THIS score" count is derived by the same matcher the deltas use
  (`makamRuleUsage` / `eachRuleMatch`) — a hint quoting a constant passes every attribute check and is
  still a lie. ⛔ `MAKAM_INTONATION`'s empty arrays must not be deleted as clutter; they are what stops
  someone completing the table by symmetry. [docs/mvp/makam.md](mvp/makam.md).

## 2 · The editor and the drawn page

- **A TUPLET IS PICKED UP BY ITS DRAWN "3", NOT BY ITS NOTES; A REAL ONE SLIDES, A BROKEN ONE IS
  REPAIRED** (owner, 2026-08-30). The mark is the click target — in **Seçim as well as under ÜÇLEME**
  (`tupletPickable`), never with a note value or accidental armed. ⚠ **EVERY drawn mark is holdable,
  including one over a SINGLE note** — `tupletGroupsIn` brackets runs that never sum plain, the model's
  misreads. The ✕ clears any (each member ×³⁄₂, notes kept); the handles **slide** a real triplet but
  **repair** a broken one, only when the result CLOSES or has FEWER members, never merely broader.
  `tupletEdgeTo` owns both, `drawnTupletAt` finds a mark where `closedTupletAt` cannot, and its last
  check is a **simulation against `tupletGroupsIn`**, not a rule. ⛔ **Never widen a REAL triplet into a
  4/5/7-tuplet**: the digit is hardcoded `"3"` and the token `\tup3`, so it would draw AND label a
  rhythm nobody wrote — needs new tokens, deferred. ⚠ The style is a per-piece hash and all six bundled
  scores draw the arc, so the VexFlow-**bracket** branch has **no automated coverage**.
  [docs/mvp/editor-built.md](mvp/editor-built.md).
- **HIT-TESTING GEOMETRY IS MEASURED OFF REAL INK, NEVER OFF A GROUP'S `getBBox()`** — three live bugs
  came from this one mistake and it will recur with any new modifier or overlay.
  (1) `StaveNote.getBoundingBox()` merges over the note's MODIFIERS, and `GraceNoteGroup` never
  positions itself, so it reports its box at the SVG **origin**: merging that stretched a graced note's
  click box to 949×1805 px and stole **126 of 134 clicks** on the page. `noteBoxOf` in `SheetView.tsx`
  therefore rejects any box reaching x ≤ 0 or y ≤ 0 and falls back to `getNoteHeadBounds` /
  `getStemExtents` / `getGlyphWidth`. ⚠ **The default sample has no grace notes, so `smoke:editor`
  loads `beyati-delisin.json` for its geometry section** — keep it that way.
  (2) A tuplet's target comes from the mark's STROKES (`markBoxOf`): a `<text>` reports its FONT's em
  box (a bracket's "3" measured 12 × 160 px) and VexFlow leaves a zero-height `<rect>` at the origin.
  (3) The mark overlay paints **after** the note targets so it wins where they overlap; the bargain is
  `smoke:editor`'s **no note's CENTRE may fall inside a mark's box**.
  ⚠ If you add a modifier, verify it positions itself before trusting a merged box.
- ⭐ **THE SIGNS ARE EDITABLE SINCE 2026-09-03** (owner): arm one in the toolbox and click a bar; click
  a drawn sign in Seçim to delete it. ⚠ **`resolveStructure` in `stitch.ts` is the ONLY thing that says
  what a sign does** — the marks were split out of `MeasureRec` as `StructureMarks` so a hand edit runs
  the decoder's own `expandRepeats`/`expandSegnoJumps`/`expandDaCapo`; never write a second rulebook in
  the editor. ⚠ **A placement is refused by SIMULATION**: resolve it, reject it if it added a warning
  the page did not have, so a sign that would draw but not sound cannot be placed.
  ⭐ **THE REPEAT IS ONE TOOL AND TWO CLICKS, ON THE BARLINES** — arm **Tekrar**, click the opening
  line then the closing one, and `placeRepeat` writes both marks at once; the first click writes
  NOTHING, so the document can never hold half a repeat. Never split it back into two tools: an
  unmatched `‖:` is a sign `repeatSpansFromStructure` refuses to DRAW, so that click left no trace.
  ⚠ The `WARN_UNMATCHED_REPSTART` exemption and its dashed overlay marker stay anyway — a DECODE can
  still read a stray `‖:`, and edit mode must show it to let it be deleted. ⚠ **Armed places, Seçim
  removes**, and a delete takes its whole object from EITHER end. ⚠ Signs share the undo stack with the
  notes (`useDocHistory`'s `ScoreState`). `tools/render/structure-edit.ts` · `structure-edit-test.ts`.
- **THE PAGE GOES TO THE PLAYHEAD ONCE PER ROW, AND ONLY WHEN THE ROW IS OFF THE SCREEN** (owner,
  2026-09-03). `followPlayhead` is **the reader's setting, ON by default**, remembered in
  `localStorage` behind try/catch; `?follow=0|1` overrides without being written back. ⚠ **Two axes,
  two scrollers**: down the PAGE (`window`) and sideways in the sheet's own box, found by MEASUREMENT
  in `sideScrollerOf` — the box that reports hidden width is not always the box that scrolls, and
  `FOLLOW_SIDE_MIN` keeps the sideways axis off a box overrunning by its own padding. ⚠ **THE TRIGGER
  IS THE ROW CHANGING, NOT THE CLOCK** (owner's revision, same day: *"sadece row değiştiğinde
  tetiklensin"*) — inside a row the page never moves, so nothing shifts under a pointer mid-bar.
  ⚠ **It moves the page, so a check that measures a point and then clicks it must own the scroll**:
  `smoke:editor`'s B4 insert-mapping read turns following OFF for that block. ⚠ It obeys
  `prefers-reduced-motion`. The OFF arm of the check is the load-bearing one — a follow that ignored
  the setting passes every ON assertion. [docs/DECISIONS.md](DECISIONS.md).

## 3 · The DOM contract and the stylesheet

- **The deploy checks read DOM state, never the words on the page** (2026-08-07, the style pass).
  `apps/web/src/ui/status.ts` is the single producer of the contract, and the six
  `tools/browser/*-smoke.ts` assert on attributes — which is what leaves **all user-facing copy free to
  change**, and is how the UI became Turkish. ⛔ **Never reintroduce a text or regex matcher** for a
  status message or a button label; every user-visible string lives in `apps/web/src/ui/strings.ts`.
  ⚠ **THE FULL ATTRIBUTE LIST, PER FEATURE, AND THE TRAP IN EACH:
  [docs/DOM-CONTRACT.md](DOM-CONTRACT.md)** — read it before writing a check or changing a
  component one watches. The four most often got wrong: **`data-edit-mode` is on FOUR elements**
  (`#edit-toggle`, `#sheet-surface`, `#measure-surface`, `#measure-card`) and `data-play-state` on TWO
  (`#play`, `#palette-play`) — name the one you mean; **a refusal UNMOUNTS `#omr-status`**, so read
  `#omr-error` first or the locator detaches; **`data-ready` never appears on a bare visit** (it means
  a score is installed, and none ships); and **there is no `#save-json`** (owner, 2026-08-30) — read
  `window.__omrDoc`, with `window.__omrStructure` for a decoded page's signs and playing order, beside
  the older `__omrStrips` / `__omrMeta` / `__omrConfig`.
- **The score's SVG is also the training-strip source, so CSS must not reach it.** No selector under
  `.kv-score` may set a font, and no `transform`/`zoom`/`scale` may touch that container —
  `tools/render/render.ts` screenshots the VexFlow SVG by rect to cut strips, and rects do not survive
  a transform. The design system is `apps/web/src/styles/` (`tokens.css` → `base.css` → `app.css`);
  classes are `.kv-*`. ⚠ **`.kv-score` keeps `overflow-y: clip`, load-bearing** (owner, 2026-09-03: ONE
  scrollbar, not two) — `overflow-x` alone computes the other axis to `auto`, and Bravura's font
  metrics gave the box 17 px of phantom height. ⚠ Consequence: the sheet scrolls SIDEWAYS in its own
  box and up and down **not at all** — the page is the only vertical scroller, which the playhead
  follow depends on.
- ⭐ **THE MEASURE CARD IS THIS SAME `SheetView`, MOUNTED A SECOND TIME WITH `onlyMeasure`** (owner,
  2026-09-05: *"ikisi ayrı olmasın"*) — same component, same document, same callbacks, same undo stack,
  so the instrument tab edits its bar with the page's own editor and not a copy. ⚠ **`onlyMeasure`
  FILTERS the drawn bars and never renumbers them**: `repeatSpans` / `navMarks` / `signTargets` /
  `openRepeat` / `repeatAnchor` / the insert's `measureIndex` all stay bar-indexed — never hand it a
  one-bar document instead, that trades one filter for six mappings that must agree. ⚠ **Nothing
  scales**: the card resizes the ENGRAVING to its column (`contentWidth` + `justify`), which keeps the
  edit overlay 1:1 with the notes. ⚠ It takes its own `surfaceId` / `svgMarker`; `#sheet-surface` and
  `sheet-svg` must keep meaning THE PAGE'S score, since `render.ts` and `verify-labels.ts` take the
  first match. [docs/features/measure-card.md](features/measure-card.md).
- **THE PHONE IS FIXED IN CSS ONLY, IN TWO MEDIA QUERIES AT THE END OF `app.css`** (owner, 2026-09-04;
  there was no width-based media query at all before it). ⚠ **They answer different questions, never
  merge them**: `(pointer: coarse)` owns sizes — **16px on every form field**, the threshold under
  which iOS Safari zooms the page in on focus and never back, plus `--control-h: 44px`; `(max-width:
  700px)` owns layout (measured: the transpose group cannot shrink below 433px). ⚠ **At the END so
  ORDER wins**; the only `!important` is the docked toolbox's insets, which beat an inline style.
  ⚠ **That placement is what keeps every existing check valid** — they run at 1280×720 with a mouse.
  ⚠ No exemption from the `.kv-score` rule above, "only on small screens" included. ⚠ Height caps use
  `dvh`. Look with **`npm run smoke:phone`**, and ⛔ **never give that probe `fullPage: true`** — it
  resizes the viewport without restoring touch emulation, so fixed things report as broken.
  ⚠ A grid row needs `min-width: 0` or it will not ellipsis — `.kv-recent__item` pushed a 390 px phone
  to 623 px, and `smoke:phone` cannot see that list at all.

