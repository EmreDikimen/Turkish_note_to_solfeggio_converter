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
AND on the thing that moves. ⚠ A checked box only proves it was clicked. ⚠ **Where it lives depends
on the width** (2026-09-28): inside `#transport-pinned` on a phone, in the card head on a wide
window — never both. Find it by id, never by its container.

The playhead carries `[data-omr="playhead"]`, because an attribute naming a bar cannot prove
playback actually began there.

## The editor

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
are different mechanisms: PNG is drawn by the app and DOWNLOADS, PDF calls `window.print()` and the
browser makes it — so a check can assert the download for one and only the call for the other.
⚠ A failure shows `[data-omr="save-error"]` in the card head; the button is `disabled` while saving.
⛔ **Neither reads or writes `doc`** — export is a picture, and the note model's seam is still
`window.__omrDoc`.

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

⭐ **THE DOWNLOAD QUESTION (2026-09-27).** `#voice-modal[data-voice]` with `#voice-confirm` / `#voice-cancel`,
raised before any recorded voice downloads — a pick in `#instrument`, a pick in `#instrument-pick`,
or opening `#view-instrument`. Its backdrop blocks every click: answer it with
`tools/browser/voicePrompt.ts` (`answerVoicePrompt(page, "confirm" | "cancel")`), a no-op when
nothing is asked. ⚠ A voice said yes to is not asked about again in the same page load, so a check
that expects the question must start from a fresh `page.goto`.

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

## The phone

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

## Two traps

1. **Nothing that ticks on a timer may render inside `#omr-status`** — `page-smoke` counts distinct
   texts to prove progress moved.
2. **`#strips-input` lives inside the collapsed `<details id="advanced">`**, so `app-smoke` opens it
   first, and the file inputs use the clip pattern, never `display:none`.
