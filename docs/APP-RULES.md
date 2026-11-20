# App rules — playback, the editor, the DOM and the stylesheet

purpose: the rules for anyone touching the web app, and the DOM attributes every browser check may assert on
audience: agents and the owner working on apps/web, tools/render or tools/core
updated: 2026-11-20

> **These are hard rules, not background.** Each was paid for once by a live bug. CLAUDE.md keeps a
> one-line headline for the six that can be broken from anywhere in the repo and points here for the
> rest — read this file before changing anything under `apps/web/`, `tools/render/` or `tools/core/`.
> Current state and next action are NOT here: [STATUS.md](STATUS.md). The per-feature attribute list
> is its own file: [APP-RULES.md](#the-dom-contract--what-the-browser-checks-are-allowed-to-assert-on).

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
  both; `tools/tests/makam-test.ts` and `usul-test.ts` pin them. **`doc` is what a person reads and
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
  ink and the music drift apart (they did, on 37.9% of real first endings). ⚠ **A "2." IMPLIES A
  "1."** (2026-09-07): with a `\volta2` after the `:‖` and no "1." read anywhere in the span, the
  `:‖` bar becomes a one-bar first ending and the mark is WRITTEN onto it, so the bracket draws where
  the music is skipped — 12.9% of written second endings replayed their first ending without it.
  ⚠ **AND A "1." PAST THE `:‖` IS A "2."** — a first ending lies inside the repeat by definition, so a
  bracket after the closing barline is relabelled (58 spans), which corrects the drawing and feeds the
  rule above. ⚠ **The two repairs are ORDERED**: relabel, then infer. ⚠ Both leave a bar carrying a
  `‖:` and a one-bar span alone. Rules and counts: [docs/DECISIONS.md](DECISIONS.md).
- ⚠ **DECODED PAGES ONLY** — a SymbTr sample is flat in the data, so folding one means guessing from
  duplicate bars; `Tekrarlar` still only DRAWS there and the renderer path (`?repseed=`/`?navseed=`) is
  untouched, so the training corpus is byte-identical. ⚠ `Tekrarları açık yaz` is **view-only and
  closes edit mode**.
- **The makam bends the SOUND ONLY** (owner decision 2026-08-06, shipped 2026-08-07). Comma deltas go
  in on the way to `buildTimeline` — the engraving, the stored document and `buildStrips` never move, and no
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
  someone completing the table by symmetry. [docs/app/README.md](app/README.md#makam-selection--the-performed-intonation).

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
  [docs/app/editor.md](app/editor.md#the-editor--what-each-step-built-and-the-traps-it-found).
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
  notes (`useDocHistory`'s `ScoreState`). `packages/core/src/labels/structure-edit.ts` · `structure-edit-test.ts`.
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
  [docs/APP-RULES.md](#the-dom-contract--what-the-browser-checks-are-allowed-to-assert-on)** — read it before writing a check or changing a
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
  a transform. The design system is `apps/web/src/styles/` in CSS LAYERS since the 2026-09-30 Tezhip
  restyle (Tailwind v4 without preflight, a `components` kit under `app.css`, and an UNLAYERED
  `contract.css` that no utility can beat); classes are `.kv-*`. ⚠ **A render job is a pinned page**:
  `#app[data-render="1"]` (URL carries `mode`) hides all chrome and fixes the sheet's position in
  literal px, because a font change above the score had changed the antialiasing of 147 of 302 strips.
  ⛔ No `dark:` utility — the score is a light island in a dark page. All of it:
  [features/phone.md](features/phone.md#the-look--tezhip-palette-the-stylesheets-layers-and-the-render-pin). ⚠ **`.kv-score` keeps `overflow-y: clip`, load-bearing** (owner, 2026-09-03: ONE
  scrollbar, not two) — `overflow-x` alone computes the other axis to `auto`, and Bravura's font
  metrics gave the box 17 px of phantom height. ⚠ Consequence: the sheet scrolls SIDEWAYS in its own
  box and up and down **not at all** — the page is the only vertical scroller, which the playhead
  follow depends on.
- ⭐ **THE ONE SCALE THAT IS ALLOWED IS A `viewBox` ON THE SVG, AND ONLY WHEN `contentWidth` IS SET**
  (owner, 2026-09-26, with photos of notes running off a phone screen). A row's width is packed from an
  ESTIMATE — `events.length * 28 + 24` — which knows nothing about accidentals, dots, beams or tuplet
  marks, and VexFlow draws a measure at its own minimum spacing whatever stave width it is handed. On a
  phone a row already holds ONE measure, so that difference has nowhere to go and the notes were
  CLIPPED: measured at 393px, `meltem_notes` ran 38px past the edge and `beyati-delisin` 40px. It is
  fixed in three places — a ragged last system is clamped to the content area (it was skipped
  entirely, and kept a 470px stave inside a 324px drawing); the LAYOUT is then WIDENED by whatever
  the drawing overran, so the notes sit inside their own staves; and only then is the finished
  picture scaled down to the box. ⛔ **Scaling alone does not work and was the first attempt** —
  it shrinks the overrun along with everything else, so the stave ended 49px short of the box and
  its notes still hung 22px past the barline. ⚠ Two things must follow the scale or it shows: the
  size goes on the SVG's inline STYLE (VexFlow's own `resize()` writes one, and an attribute
  cannot beat it — the mismatch left `preserveAspectRatio` centring the drawing and 75px of blank
  above the first stave), and `#sheet-surface` is sized in DISPLAYED units (left logical it made
  the box 22px wider than the SVG inside it). The pocket-score answer: 89% and 87% on those two
  scores, 100% on the other four, staves filling 97% of the box everywhere. ⛔ **This is NOT a licence to scale `.kv-score`** —
  the rule above stands unchanged, a CSS transform still destroys the rects `render.ts` crops by, and
  this branch is gated on `contentWidth`, so the corpus path never reaches it (measured 100% on all six
  scores at 1280px). ⚠ Hit-testing survives because it is measured off real ink with
  `getBoundingClientRect()`, which already accounts for a viewBox — five notes tapped at 87%, five
  selected. ⚠ Past `MIN_FIT_SCALE` (0.65) it stops shrinking and lets the SVG be wider than its box, so
  that row scrolls instead: unreadably small is worse than a drag.
- ⭐ **EVERY GEOMETRY THE DRAW PUBLISHES IS IN RENDERED UNITS, CONVERTED IN ONE PLACE** (2026-09-26).
  VexFlow works in the layout's coordinates, and once a dense page is drawn smaller than its layout
  those are not where the ink is. `SheetView` publishes four — measure boxes, per-note click targets,
  tuplet marks and playhead positions — and all four are multiplied by the applied scale at the end
  of the draw, where they are MADE. ⛔ **Never scale a consumer where it is read.** That was the first
  shape and it cost the same bug twice in two days: the playhead was fixed alone, the click targets
  were still logical, and tapping a note selected one up and to the left of it — measured at 393px,
  an average of **55px** out and a worst of **159px**. A fifth consumer inherits the fix by doing
  nothing. ⚠ At scale 1 — every wide window, and `render.ts` — the conversion does not run.
- ⭐ **THE MEASURE CARD IS THIS SAME `SheetView`, MOUNTED A SECOND TIME WITH `onlyMeasure`** (owner,
  2026-09-05: *"ikisi ayrı olmasın"*) — same component, same document, same callbacks, same undo stack,
  so the instrument tab edits its bar with the page's own editor and not a copy. ⚠ **`onlyMeasure`
  FILTERS the drawn bars and never renumbers them**: `repeatSpans` / `navMarks` / `signTargets` /
  `openRepeat` / `repeatAnchor` / the insert's `measureIndex` all stay bar-indexed — never hand it a
  one-bar document instead, that trades one filter for six mappings that must agree. ⚠ **Nothing
  scales**: the card resizes the ENGRAVING to its column (`contentWidth` + `justify`), which keeps the
  edit overlay 1:1 with the notes. ⚠ It takes its own `surfaceId` / `svgMarker`; `#sheet-surface` and
  `sheet-svg` must keep meaning THE PAGE'S score, since `render.ts` and `verify-labels.ts` take the
  first match. [docs/features/instruments.md](features/instruments.md#f3--the-bar-beside-the-instrument).
- **THE PHONE ASKS THREE VIEWPORT QUESTIONS AND NEVER MERGES THEM.** `usePhone.ts` is the only place
  any of them is asked: **`isPhone`** (`max-width: 700px`) owns LAYOUT, **`coarse`**
  (`pointer: coarse`) owns SIZES at any width, and **`phoneShaped`** (either side ≤ 700px) owns the
  SCORE'S FIT. ⛔ Merging them breaks something measurable each time: a phone turned sideways is
  **844×390**, so a fit gated on width alone switched off in landscape (242px of the sheet hidden),
  while a tab bar gated on `phoneShaped` would take most of a 390px-tall screen. ⚠ 700px is measured
  — the transpose group is 433px and cannot shrink. ⚠ `index.html` carries `viewport-fit=cover`, or
  every `env(safe-area-inset-*)` resolves to 0. Everything else about the phone, and every number
  behind it, is [features/phone.md](features/phone.md).
- **A FINGER ACTS ON THE TAP, A MOUSE ON THE PRESS** (2026-09-28). On a phone the finger that
  scrolls lands on notes constantly, so anything that EDITS on `pointerdown` edits by accident. A
  note target decides a touch in `onNoteTap` (a `click`, which a scroll never fires) and blocks
  panning only on the note already selected. ⚠ **Any new edit target must follow the same split**,
  and give it `touch-action: manipulation` unless it is the one thing a finger may drag.
- **A `display: none` LIST AND AN `absolute` OVERLAY ARE ONE LAYOUT, AND NOTHING CHECKS THAT THEY
  AGREE.** The per-tab blocks in the `(max-width: 700px)` section hide whole ROWS of the card head;
  the corner group is positioned against that head. Hide the rows and the controls below them rise
  into the corner's band — measured 2026-09-27 at 375×667, `#export-toggle` sat over the CENTRE of
  `#view-instrument`, so a tap meant for the instrument view opened the save menu.
  ⚠ **Whenever you add something `position: absolute` to a shared container, re-read every hide-list
  that touches it** — the corner group was added one day and the Düzenle list was written before it,
  so nothing re-read that list. ⚠ **No assertion can catch this class**: the element is visible, has
  its size, and passes every attribute check. `elementFromPoint` at a control's centre is the only
  test that sees it, and `smoke:phone` found this one only because Playwright **refused to click**.
  [features/phone.md](features/phone.md).

**Merged into this file on 2026-11-20:**

- [The DOM contract — what the browser checks are allowed to assert on](#the-dom-contract--what-the-browser-checks-are-allowed-to-assert-on) — was `docs/APP-RULES.md`


## The DOM contract — what the browser checks are allowed to assert on

*Was `docs/APP-RULES.md` (last updated 2026-11-12).*

Split out of [../CLAUDE.md](../CLAUDE.md) on 2026-09-05, when that file crossed its 400-line cap for
the second time — the same genre split that produced [COMMANDS.md](COMMANDS.md). This block grows
with every feature, which is exactly why it does not belong in the orientation file. Nothing was
dropped in the move; CLAUDE.md keeps the rule and points here for the list.

> The rule itself is in [../CLAUDE.md](../CLAUDE.md) and is short: **the deploy checks read DOM
> state, never the words on the page** (2026-08-07, the style pass).

### Why the rule exists

`apps/web/src/ui/status.ts` is the single producer of the contract. Because the six
`tools/browser/*-smoke.ts` assert on attributes and never on text, **all user-facing copy is free to
change** — that is what let the UI become Turkish without touching a check. Every user-visible
string lives in `apps/web/src/ui/strings.ts`.

⛔ **Never reintroduce a text or regex matcher** for a status message or a button label.

### Status, errors, readiness

| Element | Carries |
|---|---|
| `#omr-status` | `data-state`, `data-kind`, `data-where` and the counts |
| `#omr-error` | `data-error-kind` |
| `#play` | `data-play-state` |
| `#app` | `data-ready`; `data-render="1"` on a render job (the URL carries `mode`) |
| `<html>` | `data-theme` = `light` \| `dark` — the light/dark switch is `#theme-switch[data-theme]`, a real checkbox (checked = dark). ⚠ Always `light` on a render job |

⚠ **`data-ready` never appears on a bare visit** — it means *a score is installed*, and none is
(no score ships; see [THIRD-PARTY.md](THIRD-PARTY.md)). Ask for `?score=` if you need one, or wait
on `#page-input` if you are uploading.

⚠ **`data-render="1"` HIDES EVERY PIECE OF CHROME** (2026-09-30) — only `.kv-card > .kv-score` is laid
out, at a position pinned in px, so a restyle can never move a training strip
([features/phone.md](features/phone.md#the-look--tezhip-palette-the-stylesheets-layers-and-the-render-pin)). A check that needs the transport or the upload box must
not put `mode` in its URL.

⚠ **A refusal UNMOUNTS `#omr-status`.** Look at `#omr-error` first, or the locator detaches and the
check times out while the app is behaving correctly — that cost the three page smokes a false
failure on 2026-09-05.

### The sheet and the follow

`#follow-playhead[data-follow]` **and** `#sheet-surface[data-follow]` — the setting on the control
AND on the thing that moves. ⚠ A checked box only proves it was clicked. ⚠ **Where it lives depends
on the width** (2026-09-28): inside `#transport-pinned` on a phone, in the card head on a wide
window — never both. Find it by id, never by its container.

The playhead carries `[data-omr="playhead"]`, because an attribute naming a bar cannot prove
playback actually began there.

### The editor

- `#edit-toggle[data-edit-mode]`, `#sheet-surface[data-edit-mode]` + `[data-selected-note]`
- `[data-omr-note]` / `[data-selected]` per note; `#note-delete` / `#undo` / `#redo`
- `#note-step-up` / `#note-step-down` (`[data-omr="note-step"][data-dir]`, 2026-09-28): one staff step
  each, present only while a NOTE (not a rest) is selected and nothing is armed. ⚠ Under a TOUCH
  pointer a note acts on `click`, not `pointerdown`, and only the selected note starts a drag — a
  check driving touch must tap, then press.
- the palette: `#edit-palette[data-armed]` + `[data-tool]` per tool — `[data-tool="dot"]` is the
  augmentation dot (2026-09-28); a value it cannot dot sets `.kv-toolbox__hint[data-refused="notDottable"]`
- its transport: `#edit-palette[data-play-from]` + `#palette-play[data-play-state]` / `#palette-stop`
- its undo pair: `#palette-undo` / `#palette-redo`, in the toolbox's FIXED foot beside
  `#palette-select` (2026-09-26). ⚠ **They share one stack with the card's `#undo` / `#redo`** and
  the same App handlers, so either road stops playback and clears the selection. ⚠ On the phone's
  Düzenle tab the CARD's pair is hidden (`.kv-card__undo`) — the toolbox carries them there — but
  it keeps its ids and is what every check at 1280px drives. ⚠ Folding the toolbox unmounts these
  along with the tools.
- its toolbox shell: `#edit-palette[data-collapsed]` + `#palette-fold[data-collapsed]` — ⚠ **`#palette-fold` does not exist on a phone** (2026-09-28), and there `data-collapsed` is always `0`
- the insert preview: `[data-omr="insert-ghost"][data-insert-pitch]`
- the off-meter mark: `[data-omr="bar-warning"]` + `[data-bar]` + `[data-bar-fill="over|under"]`

⚠ **A FLOATING, draggable, foldable toolbox since 2026-09-03** — `fixed`, rendered from `App`
OUTSIDE `.kv-card`, taking no width from the score row. **Folding UNMOUNTS every tool**, so unfold
before arming one.

⚠ **`data-edit-mode` is on FOUR elements** (`#edit-toggle`, `#sheet-surface`, `#measure-surface`,
`#measure-card`) and **`data-play-state` on TWO** (`#play`, `#palette-play`). Select the one you
mean by id.

⭐ **SAVING THE SCORE (2026-09-27).** `#export-toggle[aria-expanded][aria-haspopup]` in the card
head's corner opens `[data-omr="save-menu"]`, which holds `#export-png` and `#export-pdf`. ⚠ The two
both DOWNLOAD a file the app drew (since 2026-10-17 the PDF no longer calls `window.print()`), so a
check asserts a download for each; `window.__omrExportLeft` (0 = every music glyph outlined) says
the file needs no font. `npm run check:export` does both in three engines.
⚠ A failure shows `[data-omr="save-error"]` in the card head; the button is `disabled` while saving.
⚠ **Base UI's Menu since 2026-09-30**: the popup is PORTALLED to `<body>` (not inside the card head),
the items carry `role="menuitem"` and `data-highlighted`, and Esc or a tap outside closes it.
⛔ **Neither reads or writes `doc`** — export is a picture, and the note model's seam is still
`window.__omrDoc`.

⚠ **There is no `#save-json` any more** (owner, 2026-08-30). A check that needs the note model reads
**`window.__omrDoc`**; **`window.__omrStructure`** carries a decoded page's signs and playing order.
Both sit beside the older `__omrStrips` / `__omrMeta` / `__omrConfig` hooks.

#### The tuplet tool and the drawn mark

- `#sheet-surface[data-tuplet-anchor]` + `[data-tuplet="start|member|anchor|end|blocked"]` per note
- the mark's own target: `[data-omr="tuplet-mark-hit"][data-tuplet-group][data-tuplet-mark="closed|broken"]`
- a HELD mark: `#sheet-surface[data-tuplet-selected]` + `[data-tuplet-held]` per member +
  `[data-tuplet-landing="start|end|both"]` (plus `[data-tuplet-fix]` where the move would COMPLETE a
  broken mark) + `[data-omr="tuplet-handle"][data-edge]` + `[data-omr="tuplet-frame"]` + `#tuplet-remove`

⚠ **The SIGN selects a tuplet; its notes are `pointer-events: none`** (owner, 2026-08-30).

⚠ **A tuplet is not stored anywhere**, so no attribute can prove one was made. `smoke:editor` counts
the marks the engraver drew, in **both** styles — `.vf-tuplet` and the curved arc's italic "3", the
style being a per-piece coin.

#### The structure signs

`[data-tool="sign:repStart|repEnd|volta|segno|coda|dc|fine"]`, their delete targets
`[data-omr="sign-hit"][data-bar][data-sign]`, the unfinished `‖:`
`[data-omr="open-repeat"][data-bar]`, and a refusal's `.kv-toolbox__hint[data-refused]`.

### The stored-page list

`#recent[data-omr="recent"][data-count][data-open][data-current]`, one
`[data-omr="recent-item"][data-page-id]` per row (`[data-omr="recent-open"]` /
`[data-omr="recent-remove"]` inside), plus `#recent-toggle`, `#recent-clear`, the row's
`[data-omr="recent-rename"]`, the heading's `#score-rename` + `[data-omr="score-name"]`, and the
shared box `[data-omr="rename-input"][data-page-id]`.

⚠ **`data-count` is the load-bearing one** — it is the only proof a page was stored. `#recent`
renders NOTHING when the store is empty, so its **absence is an assertion too**.

⚠ **`data-page-name` / `data-page-makam` are what a rename and the makam are asserted on**: a page
name is user DATA, not copy, so an attribute is the standing rule there rather than an exception to
it. [features/README.md](features/README.md#f5--the-pages-this-browser-has-already-read)

### The instrument picker and the voice bridge

`#instrument[data-instrument][data-voice-state]` **plus `data-voice-sounding`**.

⚠ **`data-voice-sounding` is the only proof of the 2026-09-04 bridge.** A voice switch made while a
piece plays keeps the OLD recording sounding until the new one downloads — and from the DOM that is
the same notes, the same playhead and the same picker. `data-voice-sounding` disagreeing with
`data-instrument` **is** the evidence. (The same blind spot exists for `sampled` / `synth`.)

Its toast:
`#voice-notice[data-omr="voice-switch"][data-voice-to][data-voice-sounding][data-voice-state][data-voice-loaded][data-voice-total][data-voice-source]`
— ⚠ rendered from `App`, `position: fixed`, **click-through except its ✕**, and deliberately NOT
inside `#omr-status`, because its counter ticks. ⭐ `data-voice-source="cache|network"`
(2026-10-12) is what picks "hazırlanıyor" over "indiriliyor": `cache` only once `voiceCached` has
found EVERY sample on the device, so it starts as `network` for a moment on a cached voice — wait
for it, never read it once.

### The makam picker

`[data-omr="makam-intonation"][data-makam][data-rules][data-notes]` plus one
`[data-omr="makam-rule"][data-letter][data-alter][data-delta][data-notes]` per bent perde.

⚠ **`data-notes` is only worth anything RE-DERIVED.** It counts this score's matching notes, so a
check that reads it back off the element proves nothing — `smoke:editor` counts them off
`window.__omrDoc` instead.

⚠ It renders NOTHING with no makam chosen, so its **absence is an assertion too**, and a rule
matching no note reads **0** rather than vanishing. [app/README.md](app/README.md#makam-selection--the-performed-intonation)

### The transport

`#bpm`, its `−`/`+` pair `#bpm-down` / `#bpm-up`, and `#transport-pinned`.

⚠ **The ± pair exists at every width** (2026-09-26), and the OS spinner is hidden so there is one
set of arrows rather than two. ⭐ **They commit on RELEASE, not per step.** Held, they repeat about
nine times a second and move only the number on screen; the tempo that plays changes when the
pointer comes up — because `WebAudioBackend.play()` re-schedules the whole timeline and builds fresh
gain nodes on every call, so committing per tick would re-schedule playback nine times a second. A
check that steps and then reads `#bpm` has to let the pointer up first. Each button disables itself
at its end of the 20–400 range, so `#bpm-up` is `disabled` at 400.

⚠ **The ⟲ reset button is ALWAYS in the DOM** once the score has a natural tempo, and carries `data-idle="1"` plus `disabled` while there is nothing to reset — it is hidden with `visibility`, not unmounted, because giving its width back moved the whole tempo group onto a second line the moment the tempo was changed. A check must read `data-idle`, not presence.

⚠ **`#bpm` holds a DRAFT while it is being typed.** It is a controlled box that now accepts
half-typed values — `""`, `1`, `1802` — and commits only what is in range, so reading it mid-edit
can return something that is not the tempo. Blur drops the draft. Before 2026-09-26 it refused every
out-of-range keystroke and snapped back, which made it impossible to type in on a phone.

⚠ **The ÇALMA row is pinned to the top of the page since 2026-09-05 (`position: sticky`) and the
other two rows are not**, which takes TWO measurements to assert:

1. `#transport-pinned`'s box sits at `top ≈ 0` after a scroll to the bottom, **and**
2. `#transport-pinned + .kv-transport` (Ritim + Perde) is gone off the top.

A whole bar made sticky passes the first and fails the second.

⚠ **There is ONE Çal button again.** It replaced a corner-parked second pair (`#sticky-transport` /
`#play-sticky` / `#stop-sticky`), which is DELETED — so a check presses `#play` itself from wherever
it has scrolled to.

⭐ **TRANSPOSITION, STAFF AND SOUND (2026-10-27).** `#transpose[data-linked="1|0"]` moves both
together; `#transpose-advanced` opens `#transpose-modal[data-sheet][data-sound]` (commas), with
`#transpose-sheet` / `#transpose-sound` / `#transpose-reset` / `#transpose-done`. While the two are
apart the picker's value is a disabled `custom` option and `data-linked="0"`; picking an interval
links them again. It replaced the "Porte ve ses / Yalnızca ses" segments.

⚠ **`#advanced` (the "Gelişmiş — geliştirici ayarları" panel) exists only in dev mode** since
2026-10-27 — the dev server, or a device that opened the site with `?dev=1` (`devMode.ts`). A check
against a built or deployed app must not expect it.

### The fingerboard tab (F3, violin)

`#fingerboard[data-omr="fingerboard"][data-tuning][data-strings][data-lines][data-zoom]`,
`[data-omr="finger-marker"]` carrying `data-string` / `data-ratio` / `data-finger="0|1|2|3|4"` (only
while open or stopped; 0 = open string) /
`data-finger-state="idle|open|stopped|rest|out-of-range"`, `[data-omr="finger-number"]` — the digit
drawn in the dot, whose text must equal the marker's `data-finger` — and `[data-omr="fingerboard-tick"]` per
line of the position chart, carrying `data-commas` / `data-ratio` / `data-finger` — so a check reads
WHERE the finger is, never a label.

⚠ The tick is a line **ACROSS the neck**, not a notch on one string, and the chart is **fixed** (the
seven standard first-position notes, identical on every score) — assert it by comparing the whole
chart across two pieces, never by counting.

⚠ `#fingerboard-lines` hides them: assert the marks **AND** `data-lines`, because the checkbox alone
can be unchecked while the lines are still drawn.

⭐ **THE DOWNLOAD QUESTION (2026-09-27).** `#voice-modal[data-voice]` with `#voice-confirm` / `#voice-cancel`,
raised before any recorded voice downloads — a pick in `#instrument`, a pick in `#instrument-pick`,
or opening `#view-instrument`. ⚠ Since 2026-09-30 all three prompts (`#makam-modal`, `#voice-modal`,
`#tuning-modal`) are Base UI Dialogs: the id and `data-*` sit on the `role="dialog"` popup, which is
portalled to `<body>`, and Esc or a backdrop click means cancel. Its backdrop blocks every click: answer it with
`tools/checks/voicePrompt.ts` (`answerVoicePrompt(page, "confirm" | "cancel")`), a no-op when
nothing is asked. ⚠ A voice said yes to is not asked about again in the same page load, so a check
that expects the question must start from a fresh `page.goto` — ⚠ **and, since 2026-10-12, from an
empty voice cache**: a voice whose every file is already in Cache Storage (`omr-voices-*`) is never
asked about, in any visit (`voiceCached` in `audio/loadInstrument.ts`).

⭐ **RETUNING (2026-09-27).** `#tuning-open` opens `#tuning-modal[data-tuning]`, which holds one
`#tuning-<stringId>` select per string (`g`, `d`, `a`, `e`) carrying `data-string` and `data-koma`,
plus `#tuning-reset` and `#tuning-done`. The options are the **twelve Western note names**, four
semitones either side of standard — never a koma.

⚠ **`data-tuning` is `standard` until the four pitches differ, then `custom`, and there is no third
value.** Tuning a string away and back reaches the shipped object again, so a check may assert
`standard` after a round trip. `[data-omr="tuning-label"]` exists ONLY while it is custom.

⚠ **The modal is portalled to `document.body`**, so it is NOT inside `#fingerboard` — find it by id.
Its backdrop covers the page: close it with `#tuning-done` before touching anything underneath, the
way `#makam-confirm` dismisses the makam prompt.

⚠ Same for `#fingerboard-zoom`: the **viewBox** is the zoom, so read that — `data-zoom` alone would
pass on a control wired to nothing.

⚠ Its arithmetic is **not** a browser concern: `tools/tests/fingering-test.ts` owns the position
formula, the string-choice rule and the finger number. [features/instruments.md](features/instruments.md#f3--the-fingerboard-tab)

### The kanun tab (F3's second instrument)

`#kanun[data-omr="kanun"][data-courses][data-mandals][data-zoom="full|mandal"][data-note-state="idle|playing|rest|out-of-range"]`
(`data-mandals` is the TOTAL, 212), 26 `[data-omr="kanun-mandal-row"]` **groups** carrying
`data-course` / `data-levers` / `data-raised`, holding 212 `[data-omr="kanun-mandal"]` in all —
⚠ **not the same number per row** (12 / 9 / 8 by note name in the middle, fewer at both ends, since 2026-11-12; a row's untouched `data-raised` is 6 on a regular course and the course's own number on an end course) — each carrying
`data-course` / `data-mandal` / `data-step` / `data-offset` / `data-mandal-state="up|down"` /
`data-mandal-active="1"` / `data-changed="to|from"`; 26 `[data-omr="kanun-course"]` **groups**
carrying `data-perde` / `data-course-state="idle|playing"`, and one
`[data-omr="kanun-opening-item"]` (`data-offset` in mandals, `data-step` in pitch steps) per course
the makam sets before playing.

Each course group holds **three `<line>`s**, because a perde is three strings sharing one lever —
78 in total, and `smoke:editor` asserts the total, since 26 would still pass if the view went back
to one line each.

⚠ **`data-raised` on the row is the load-bearing one: every course has exactly ONE setting at every
moment**, and its levers must agree with it — the first `data-raised` are `up`, every later one
`down`, and the last one up carries `data-mandal-active`. `smoke:editor` asserts that at every
sample across a whole playback. A mandal is a lever that STAYS WHERE IT IS PUT, so a leak in the
replay shows up there and nowhere else.
⚠ **Do not count `data-mandal-active` and expect 26** (the rule until 2026-11-11): `data-raised="0"`
is the open string, a real setting with NO active lever, and `meltem_notes` opens five courses there.
⭐ **The levers rise from the NUT side** (owner, 2026-11-11, reversing the 2026-10-27 direction).

⚠ **`data-changed` fades**: it marks an event, not a state — on EVERY lever one move moved, `to` for
the ones that rose and `from` for the ones that fell — so never assert it without driving the
clock to a change — and it is drawn as a red **frame**, never a fill, because the fill is what
carries `data-mandal-state`.

⚠ Its arithmetic is `tools/tests/kanun-test.ts`. [features/kanun.md](features/kanun.md#f3--the-kanun-view)

### The bar beside the instrument (2026-09-04)

`#measure-card[data-omr="measure-card"][data-measure][data-total][data-notes][data-follow][data-edit-mode]`,
its own `#measure-surface` + `[data-omr="measure-svg"]`, and `#measure-prev` / `#measure-next` /
`#measure-play` / `#measure-edit` / `#measure-follow`.

⚠ **`data-follow` is the load-bearing one** — a pinned card and a following card are otherwise the
same DOM.

⚠ **`Ölçüyü çal` is asserted by TIME**, stopped again in seconds on a two-minute piece, because only
the cut timeline makes that true.

⚠ **The card has NO editing markers of its own.** It mounts `SheetView`, so its notes, ✕, ghost,
handles and playhead are the page's own `[data-omr-note]` / `#note-delete` /
`[data-omr="playhead"]` — an edit made there is asserted on **`window.__omrDoc`** and then on the
Nota page, because a card with its own overlay could pass "a note is selected" and still be a second
document. [features/instruments.md](features/instruments.md#f3--the-bar-beside-the-instrument)

### The phone

⚠ **None of this exists on a wide window.** It renders only when `(max-width: 700px)` matches AND a
score is installed, so every check that runs at 1280×720 — all of them but `smoke:phone` — selects
none of it. **Why the screen is shaped this way, and every measurement behind it, is
[features/phone.md](features/phone.md);** this is only what a check may read.

| Element | Carries |
|---|---|
| `#app` | `data-mtab` = `nota` \| `duzenle` \| `pages`, plus `data-fullscreen`, `data-pitch` and `data-view` (`sheet` \| `instrument`) |
| `#mobile-tabs` | `data-tab`; each button `[data-tab-id]` |
| `#pitch-toggle` | `aria-expanded` — the settings fold under `#transport-pinned` |
| `#transport-settings` | the fold's content: `#row-sound`, `#row-rhythm`, `#row-pitch` |
| `#voice-field` | the voice select, inside `#row-sound`; its `.kv-hint` status line sits on its own line UNDER the select |
| `#bpm` | the tempo box |
| `#bpm-down` / `#bpm-up` | its ± pair, at every width |
| `#fullscreen-on` | the expand mark in the card head's top-right corner — ⚠ **not on `duzenle`** |
| `#export-toggle` | the save menu's button, same corner — ⚠ **not on `duzenle`** |
| `#fullscreen-bar` | `#fs-play[data-play-state]`, `#fs-stop`, `#fs-exit` |
| `#palette-undo` / `#palette-redo` | the toolbox's undo pair, in its fixed foot |

**Six things a check has to know, because each one has already broken one:**

1. ⛔ **`data-mtab="cal"` does not exist.** The Çal tab was closed 2026-09-26; a check waiting for it
   waits forever.
2. ⚠ **The fold's content is `visibility: hidden` when shut** — not merely invisible, unreachable.
   Open `#pitch-toggle` before touching `#makam-select`, `#instrument` or anything else in there.
3. ⚠ **ONE element, two presentations.** `#transport-settings` is the fold on a phone and an ordinary
   open box on a wide window, so there is never a second `#makam-select` or
   `[data-omr="makam-intonation"]` — a check must say which it means.
4. ⚠ **`#bpm` holds a DRAFT while it is being typed** (`""`, `1`, `1802` are all legal mid-edit), and
   **`#bpm-down` / `#bpm-up` commit on RELEASE** — held they repeat and move only the number on
   screen. A check that steps and then reads `#bpm` must let the pointer up first.
5. ⚠ **`#edit-toggle` is hidden on the NOTA tab** — the Düzenle tab is edit mode. It is still there on
   the Düzenle tab and on every wide window, and `smoke:phone` takes the tab where one exists.
6. ⚠ **Published geometry is in RENDERED units.** A dense page is drawn smaller than its layout, and
   the measure boxes, `[data-omr-note]` targets, tuplet marks and playhead positions are all
   converted; none of them is a VexFlow number. At 1280px the scale is 1.

⚠ **`data-play-state` names THREE buttons** — `#play`, `#palette-play`, `#fs-play`.
⚠ **`data-fullscreen` is NOT gated on the breakpoint** — a phone turned sideways is 844px.
⚠ **`data-pitch` is DERIVED** from (phone, score, Nota tab, not editing), so it cannot be stale.
⛔ **There is no Güfte toggle** — ask for lyrics with `?lyrics=1`.

**The iPhone install strip (2026-11-06)** — `#ios-install-hint[data-omr="ios-install"]`, closed by
`#ios-install-hint-close`. ⚠ **Keyed on the USER AGENT, not the width**: it renders only for an iOS
UA that is not standalone and not an in-app browser, and never once closed (`omrIosHintClosed`).
Every check at the default desktop UA sees none of it; a check that wants it sets an iPhone
`userAgent` on its context. CSS hides it on `data-mtab="duzenle"`.

### Two traps

1. **Nothing that ticks on a timer may render inside `#omr-status`** — `page-smoke` counts distinct
   texts to prove progress moved.
2. **`#strips-input` lives inside the collapsed `<details id="advanced">`**, so `app-smoke` opens it
   first, and the file inputs use the clip pattern, never `display:none`.
