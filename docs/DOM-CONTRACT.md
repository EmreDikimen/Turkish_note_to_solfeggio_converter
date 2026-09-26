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
- its undo pair: `#palette-undo` / `#palette-redo`, in the toolbox's FIXED foot beside
  `#palette-select` (2026-09-26). ⚠ **They share one stack with the card's `#undo` / `#redo`** and
  the same App handlers, so either road stops playback and clears the selection. ⚠ On the phone's
  Düzenle tab the CARD's pair is hidden (`.kv-card__undo`) — the toolbox carries them there — but
  it keeps its ids and is what every check at 1280px drives. ⚠ Folding the toolbox unmounts these
  along with the tools.
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

## The phone layout (2026-09-11, rebuilt through 2026-09-26)

⚠ **None of this exists on a wide window.** The bottom tab bar renders only when
`(max-width: 700px)` matches AND a score is installed, so every check that runs at 1280×720 with a
mouse — which is all of them but `smoke:phone` — selects none of it.

⭐ **THREE TABS, NOT FOUR.** `Çal` was closed on 2026-09-26 and everything it held moved into a fold
on the Nota tab. ⛔ `data-mtab="cal"` no longer exists; a check that waits for it waits forever.

| Element | Carries |
|---|---|
| `#app` | `data-mtab` = `nota` \| `duzenle` \| `pages`, plus `data-fullscreen` and `data-pitch` |
| `#mobile-tabs` | `data-tab`; each button `[data-tab-id]` |
| `#pitch-toggle` | `aria-expanded` — the fold under `#transport-pinned` that holds everything the Çal tab used to be. Phone, Nota tab, not editing; `App` passes no handler anywhere else, so no wide window renders it |
| `#transport-settings` | the Ritim + Perde box. ⭐ On the Nota tab it is the FOLD: `#app[data-pitch="open"]` runs its grid row 0fr → 1fr. ⚠ ONE element, two presentations — a wide window shows it open and inline, so there is never a second `#makam-select` or `[data-omr="makam-intonation"]`; a check must say which it means. ⚠ Collapsed, its `.kv-transport__body` is `visibility: hidden` — the controls inside are not merely invisible, they are unreachable, and a check must open the fold first |
| `#row-rhythm` / `#row-pitch` | the two rows inside it |
| `#voice-field` | the voice select. It lives in the PINNED box, so the fold cannot contain it; it is shown and hidden WITH the fold instead |
| `#bpm` | ⚠ holds a DRAFT while being typed (`""`, `1`, `1802` are all legal mid-edit), so reading it mid-edit can return something that is not the tempo. Blur drops the draft |
| `#bpm-down` / `#bpm-up` | the tempo's ± pair, at every width. ⭐ They commit on RELEASE, not per step — held, they repeat ~9×/s and move only the number on screen. A check that steps then reads `#bpm` must let the pointer up first. Each disables itself at its end of 20–400 |
| `#fullscreen-on` | a button in the score card's tools (`.kv-card__tools`). ⚠ Phone only and only while full screen is OFF. ⚠ Entering LEAVES EDIT MODE (`applyFullScreen`), or exiting would land on the Nota tab in edit mode with the toolbox hidden |
| `#fullscreen-bar` | `#fs-play[data-play-state]`, `#fs-stop`, `#fs-exit` |
| `#palette-undo` / `#palette-redo` | the toolbox's own undo pair, in its FIXED foot beside `#palette-select`. One stack with the card's `#undo` / `#redo`. ⚠ On the Düzenle tab the card's pair is hidden (`.kv-card__undo`) but keeps its ids, and that is what every check at 1280px drives |

⛔ **THE GÜFTE TOGGLE IS GONE** (2026-09-26) — the model does not read lyrics off a page. The feature
is not: `?lyrics=1` still draws them and `render.ts` still renders a third of the corpus with them.
A check that wants lyrics asks for them in the URL.

⚠ **`data-play-state` names THREE buttons** — `#play`, `#palette-play` and `#fs-play`. A check must
say which one it means.

⚠ **The Düzenle tab IS edit mode.** `#edit-toggle[data-edit-mode]` stays the fact, and the tab moves
with it in both directions (`applyEditMode` in `App.tsx`). ⛔ `#edit-toggle` may not be hidden on
that tab even though the tab says the same thing: `smoke:phone` clicks it at 375px.

⚠ **`data-fullscreen` is NOT gated on the phone breakpoint**, deliberately — a phone turned sideways
is 844px wide, past the 700px line, and full screen has to survive the rotation. Its stylesheet
block therefore lives outside the phone media query and hides the sections itself.

⚠ **`data-pitch` is DERIVED** from (phone, score installed, Nota tab, not editing) rather than only
stored, so no path can leave the fold open behind another screen.

⚠ **A DENSE PAGE IS DRAWN SMALLER THAN ITS LAYOUT, AND EVERY GEOMETRY THE DRAW PUBLISHES IS IN
RENDERED UNITS** (2026-09-26). `SheetView` measures what it drew and shrinks the SVG's coordinate
system until it fits the box; the measure boxes, note targets, tuplet marks and playhead positions
are all converted once, where they are made. ⚠ A check that compares a `data-omr-note` box against
anything must not assume the numbers are VexFlow's. At 1280px the scale is 1 and nothing converts.

## Two traps

1. **Nothing that ticks on a timer may render inside `#omr-status`** — `page-smoke` counts distinct
   texts to prove progress moved.
2. **`#strips-input` lives inside the collapsed `<details id="advanced">`**, so `app-smoke` opens it
   first, and the file inputs use the clip pattern, never `display:none`.
