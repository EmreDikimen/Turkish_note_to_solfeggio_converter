# The DOM contract — what the browser checks are allowed to assert on

purpose: the full list of DOM attributes the automated checks read, and the ⚠ traps in each
audience: anyone writing a browser check, or changing a component a check watches
updated: 2026-09-05

Split out of [../CLAUDE.md](../CLAUDE.md) on 2026-09-05, when that file crossed its 400-line cap for
the second time — the same genre split that produced [COMMANDS.md](COMMANDS.md). This block grows
with every feature, which is exactly why it does not belong in the orientation file. Nothing was
dropped in the move; CLAUDE.md keeps the rule and points here for the list.

> The rule itself is in [../CLAUDE.md](../CLAUDE.md) and is short: **the deploy checks read DOM
> state, never the words on the page** (2026-08-07, the style pass).

## Why the rule exists

`apps/web/src/ui/status.ts` is the single producer of the contract. Because the six
`tools/browser/*-smoke.ts` assert on attributes and never on text, **all user-facing copy is free to
change** — that is what let the UI become Turkish without touching a check. Every user-visible
string lives in `apps/web/src/ui/strings.ts`.

⛔ **Never reintroduce a text or regex matcher** for a status message or a button label.

## Status, errors, readiness

| Element | Carries |
|---|---|
| `#omr-status` | `data-state`, `data-kind`, `data-where` and the counts |
| `#omr-error` | `data-error-kind` |
| `#play` | `data-play-state` |
| `#app` | `data-ready` |

⚠ **`data-ready` never appears on a bare visit** — it means *a score is installed*, and none is
(no score ships; see [THIRD-PARTY.md](THIRD-PARTY.md)). Ask for `?score=` if you need one, or wait
on `#page-input` if you are uploading.

⚠ **A refusal UNMOUNTS `#omr-status`.** Look at `#omr-error` first, or the locator detaches and the
check times out while the app is behaving correctly — that cost the three page smokes a false
failure on 2026-09-05.

## The sheet and the follow

`#follow-playhead[data-follow]` **and** `#sheet-surface[data-follow]` — the setting on the control
AND on the thing that moves. ⚠ A checked box only proves it was clicked.

The playhead carries `[data-omr="playhead"]`, because an attribute naming a bar cannot prove
playback actually began there.

## The editor

- `#edit-toggle[data-edit-mode]`, `#sheet-surface[data-edit-mode]` + `[data-selected-note]`
- `[data-omr-note]` / `[data-selected]` per note; `#note-delete` / `#undo` / `#redo`
- the palette: `#edit-palette[data-armed]` + `[data-tool]` per tool
- its transport: `#edit-palette[data-play-from]` + `#palette-play[data-play-state]` / `#palette-stop`
- its toolbox shell: `#edit-palette[data-collapsed]` + `#palette-fold[data-collapsed]`
- the insert preview: `[data-omr="insert-ghost"][data-insert-pitch]`
- the off-meter mark: `[data-omr="bar-warning"]` + `[data-bar]` + `[data-bar-fill="over|under"]`

⚠ **A FLOATING, draggable, foldable toolbox since 2026-09-03** — `fixed`, rendered from `App`
OUTSIDE `.kv-card`, taking no width from the score row. **Folding UNMOUNTS every tool**, so unfold
before arming one.

⚠ **`data-edit-mode` is on FOUR elements** (`#edit-toggle`, `#sheet-surface`, `#measure-surface`,
`#measure-card`) and **`data-play-state` on TWO** (`#play`, `#palette-play`). Select the one you
mean by id.

⚠ **There is no `#save-json` any more** (owner, 2026-08-30). A check that needs the note model reads
**`window.__omrDoc`**; **`window.__omrStructure`** carries a decoded page's signs and playing order.
Both sit beside the older `__omrStrips` / `__omrMeta` / `__omrConfig` hooks.

### The tuplet tool and the drawn mark

- `#sheet-surface[data-tuplet-anchor]` + `[data-tuplet="start|member|anchor|end|blocked"]` per note
- the mark's own target: `[data-omr="tuplet-mark-hit"][data-tuplet-group][data-tuplet-mark="closed|broken"]`
- a HELD mark: `#sheet-surface[data-tuplet-selected]` + `[data-tuplet-held]` per member +
  `[data-tuplet-landing="start|end|both"]` (plus `[data-tuplet-fix]` where the move would COMPLETE a
  broken mark) + `[data-omr="tuplet-handle"][data-edge]` + `[data-omr="tuplet-frame"]` + `#tuplet-remove`

⚠ **The SIGN selects a tuplet; its notes are `pointer-events: none`** (owner, 2026-08-30).

⚠ **A tuplet is not stored anywhere**, so no attribute can prove one was made. `smoke:editor` counts
the marks the engraver drew, in **both** styles — `.vf-tuplet` and the curved arc's italic "3", the
style being a per-piece coin.

### The structure signs

`[data-tool="sign:repStart|repEnd|volta|segno|coda|dc|fine"]`, their delete targets
`[data-omr="sign-hit"][data-bar][data-sign]`, the unfinished `‖:`
`[data-omr="open-repeat"][data-bar]`, and a refusal's `.kv-toolbox__hint[data-refused]`.

## The stored-page list

`#recent[data-omr="recent"][data-count][data-open][data-current]`, one
`[data-omr="recent-item"][data-page-id]` per row (`[data-omr="recent-open"]` /
`[data-omr="recent-remove"]` inside), plus `#recent-toggle`, `#recent-clear`, the row's
`[data-omr="recent-rename"]`, the heading's `#score-rename` + `[data-omr="score-name"]`, and the
shared box `[data-omr="rename-input"][data-page-id]`.

⚠ **`data-count` is the load-bearing one** — it is the only proof a page was stored. `#recent`
renders NOTHING when the store is empty, so its **absence is an assertion too**.

⚠ **`data-page-name` / `data-page-makam` are what a rename and the makam are asserted on**: a page
name is user DATA, not copy, so an attribute is the standing rule there rather than an exception to
it. [features/recent-pages.md](features/recent-pages.md)

## The instrument picker and the voice bridge

`#instrument[data-instrument][data-voice-state]` **plus `data-voice-sounding`**.

⚠ **`data-voice-sounding` is the only proof of the 2026-09-04 bridge.** A voice switch made while a
piece plays keeps the OLD recording sounding until the new one downloads — and from the DOM that is
the same notes, the same playhead and the same picker. `data-voice-sounding` disagreeing with
`data-instrument` **is** the evidence. (The same blind spot exists for `sampled` / `synth`.)

Its toast:
`#voice-notice[data-omr="voice-switch"][data-voice-to][data-voice-sounding][data-voice-state][data-voice-loaded][data-voice-total]`
— ⚠ rendered from `App`, `position: fixed`, **click-through except its ✕**, and deliberately NOT
inside `#omr-status`, because its counter ticks.

## The makam picker

`[data-omr="makam-intonation"][data-makam][data-rules][data-notes]` plus one
`[data-omr="makam-rule"][data-letter][data-alter][data-delta][data-notes]` per bent perde.

⚠ **`data-notes` is only worth anything RE-DERIVED.** It counts this score's matching notes, so a
check that reads it back off the element proves nothing — `smoke:editor` counts them off
`window.__omrDoc` instead.

⚠ It renders NOTHING with no makam chosen, so its **absence is an assertion too**, and a rule
matching no note reads **0** rather than vanishing. [mvp/makam.md](mvp/makam.md)

## The transport

`#bpm` and `#transport-pinned`.

⚠ **The ÇALMA row is pinned to the top of the page since 2026-09-05 (`position: sticky`) and the
other two rows are not**, which takes TWO measurements to assert:

1. `#transport-pinned`'s box sits at `top ≈ 0` after a scroll to the bottom, **and**
2. `#transport-pinned + .kv-transport` (Ritim + Perde) is gone off the top.

A whole bar made sticky passes the first and fails the second.

⚠ **There is ONE Çal button again.** It replaced a corner-parked second pair (`#sticky-transport` /
`#play-sticky` / `#stop-sticky`), which is DELETED — so a check presses `#play` itself from wherever
it has scrolled to.

## The fingerboard tab (F3, violin)

`#fingerboard[data-omr="fingerboard"][data-tuning][data-strings][data-lines][data-zoom]`,
`[data-omr="finger-marker"]` carrying `data-string` / `data-ratio` /
`data-finger-state="idle|open|stopped|rest|out-of-range"`, and `[data-omr="fingerboard-tick"]` per
line of the position chart, carrying `data-commas` / `data-ratio` / `data-finger` — so a check reads
WHERE the finger is, never a label.

⚠ The tick is a line **ACROSS the neck**, not a notch on one string, and the chart is **fixed** (the
seven standard first-position notes, identical on every score) — assert it by comparing the whole
chart across two pieces, never by counting.

⚠ `#fingerboard-lines` hides them: assert the marks **AND** `data-lines`, because the checkbox alone
can be unchecked while the lines are still drawn.

⚠ Same for `#fingerboard-zoom`: the **viewBox** is the zoom, so read that — `data-zoom` alone would
pass on a control wired to nothing.

⚠ Its arithmetic is **not** a browser concern: `tools/core/fingering-test.ts` owns the position
formula and the string-choice rule. [features/fingerboard.md](features/fingerboard.md)

## The kanun tab (F3's second instrument)

`#kanun[data-omr="kanun"][data-courses][data-mandals][data-zoom="full|mandal"][data-note-state="idle|playing|rest|out-of-range"]`,
312 `[data-omr="kanun-mandal"]` carrying `data-course` / `data-mandal` / `data-offset` /
`data-mandal-state="up|down"` / `data-changed="to|from"`, 26 `[data-omr="kanun-course"]` **groups**
carrying `data-perde` / `data-course-state="idle|playing"`, and one
`[data-omr="kanun-opening-item"]` per course the makam sets before playing.

Each course group holds **three `<line>`s**, because a perde is three strings sharing one lever —
78 in total, and `smoke:editor` asserts the total, since 26 would still pass if the view went back
to one line each.

⚠ **`data-mandal-state` is the load-bearing one: exactly ONE lever per course is `up` at every
moment**, and `smoke:editor` asserts that at every sample across a whole playback. A mandal is a
lever that STAYS WHERE IT IS PUT, so a leak in the replay shows up there and nowhere else.

⚠ **`data-changed` fades**: it marks an event, not a state, so never assert it without driving the
clock to a change — and it is drawn as a red **frame**, never a fill, because the fill is what
carries `data-mandal-state`.

⚠ Its arithmetic is `tools/core/kanun-test.ts`. [features/kanun-view.md](features/kanun-view.md)

## The bar beside the instrument (2026-09-04)

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
document. [features/measure-card.md](features/measure-card.md)

## Two traps

1. **Nothing that ticks on a timer may render inside `#omr-status`** — `page-smoke` counts distinct
   texts to prove progress moved.
2. **`#strips-input` lives inside the collapsed `<details id="advanced">`**, so `app-smoke` opens it
   first, and the file inputs use the clip pattern, never `display:none`.
