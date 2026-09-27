# The phone — the screen the product is actually used on

purpose: the one home for how the phone screen works, every measurement behind it, and the traps that bite anyone changing it
audience: agents and the owner, before touching anything that renders below 700px
updated: 2026-09-26

> Current state and what is deployed are in [../STATUS.md](../STATUS.md). One line per decision,
> with dates, in [../DECISIONS.md](../DECISIONS.md). What a check may READ is
> [../DOM-CONTRACT.md](../DOM-CONTRACT.md). The rules that bind code anywhere are
> [../APP-RULES.md](../APP-RULES.md). How to look at it on a real phone:
> [../COMMANDS.md](../COMMANDS.md).

`package.json` has said *"mobile is the product"* since the first commit, and every human observed
using the deployed app has been on a phone. This file is what that means in practice.

⚠ **Every number here was measured with a Playwright probe at 393×800 unless it says otherwise.**
Where a number has no date it is from 2026-09-26.

## The three viewport questions, and why they are three

`apps/web/src/usePhone.ts` is the only place any of them is asked. ⛔ **Never merge them.**

| Question | Test | Owns |
|---|---|---|
| `isPhone` — *is this narrow?* | `max-width: 700px` | **Layout**: which shell renders, what is on screen |
| `coarse` — *is a finger on this?* | `pointer: coarse` | **Sizes**: 44px targets, 16px form fields, at any width |
| `phoneShaped` — *is the SHORT side phone-sized?* | `max-width: 700px, max-height: 700px` | **The score's fit** |

They disagree constantly and every answer is right. A touchscreen laptop is `coarse` and not a
phone. A desktop window dragged narrow — how this layout is reviewed on the Mac — is a phone and not
`coarse`. **A phone turned sideways is 844×390**: past the 700px line, so only `phoneShaped` is true
of it, and a fit gated on width alone switched off in landscape (measured: **242px** of the sheet
hidden). A bottom tab bar over 390px of height would be most of the screen, so layout keeps asking
about width.

⚠ **700px is not a free choice**: below it the Perde row's transpose group (433px, and it cannot
shrink) stops fitting on one line. An iPad mini at 744px measured clean, and `phoneShaped`
deliberately excludes it — the tablet keeps the desktop layout by decision.

⚠ `coarse` starts `false` and flips in an effect, so the first paint is the desktop wording
everywhere; `isPhone` is read synchronously, because a phone would otherwise flash the whole layout.

⚠ `index.html` carries **`viewport-fit=cover`**. Without it every `env(safe-area-inset-*)` in the
stylesheet resolves to **0px** — which is how six of them sat dead for eight days.

## The screen

Three tabs: **Nota · Düzenle · Sayfalar**. ⛔ There is no Çal tab; it was closed on 2026-09-26 and
`data-mtab="cal"` no longer exists.

```
┌─────────────────────────────────┐
│  ▶ Çal   ■ Dur   ♩= − 80 + ⟲    │  pinned, 70px
├─────────────────────────────────┤
│         Daha fazla ayar         │  44px — the fold's handle
│                ⌄                │
├─────────────────────────────────┤
│  eser adı ✎              ⤢      │  the card head, 189px
│  makam · usul · besteci · nota  │
│  [   Nota   |  Enstrüman  ]     │
│  [      İmleci takip et    ]    │
├─────────────────────────────────┤
│                                 │
│   the score, fitted to width    │  ~330px
│                                 │
├─────────────────────────────────┤
│   Nota    Düzenle    Sayfalar   │  56px + safe area
└─────────────────────────────────┘
```

**The fold** holds everything the Çal tab used to be — **Ses** (the instrument voice), **Ritim**
(usul, metronome, the drum and its volume) and **Perde** (makam with its intonation note,
transposition, the accidental mode). ⛔ It is not shown open: that is **515px** of controls, and
inline it left **32px of music** on an 800px screen. Folded it costs one 44px handle.

⚠ **The handle moves with the fold** — under Çal/Dur when shut, under the settings when open.
Closing is the last thing you do after reading down the stack, so the way out waits where the thumb
already is. Two mount points of ONE button, so `#pitch-toggle` stays a single id.

⚠ **It animates on a grid row, 0fr → 1fr** — the one height transition CSS can do without knowing
the height. That needs a single child, so `.kv-transport__body` wraps the rows and is
`display: contents` everywhere else, changing no layout. Collapsed it is `visibility: hidden` on a
delay: without it a Tab key reaches controls nobody can see. `prefers-reduced-motion` gets the same
fold instantly.

⚠ **Inside the fold it is a FORM, not a bar.** Every label takes one fixed column and every
control takes the rest, ending at the panel's edge; each setting has its own row, so a `<select>`
never shares a line with a toggle or a slider. ⛔ Before it, both edges were ragged and that is what
read as unfinished: in a 359px panel the controls STARTED at 68, 102, 111 and 207 and ENDED at 195,
231, 295, 318 and 337. Now every one starts at **128** and ends at **377**. The price is height —
the panel is **713px** open, against 515px when the toggles still shared lines.

⚠ **The voice picker is in the fold, not the pinned row.** It is set once before playing, and the
pinned row is sticky — it used to follow the reader down the page.

**The card head** is two rows plus the title: the view switch alone (two equal halves), then
İmleci takip et centred. Full screen and Notayı kaydet are marks in the **top-right corner**, out of
the flow, so they cost no row. ⛔ Düzenle is not there on the Nota tab — the bottom bar's tab IS edit
mode, and a second switch was the same fact twice. It stays on the Düzenle tab, where it is the only
thing that says the mode is on.

⛔ **THE CORNER PAIR IS HIDDEN ON THE DÜZENLE TAB, AND IT IS A COVERING BUG THAT PUT IT THERE**
(2026-09-27). That tab hides the title and meta rows, so the view switch rides up into the band the
corner group is absolutely positioned in. Measured at 375×667: the switch ran x=187..341 y=38..82
under a group at x=258..350 y=33..77, and `elementFromPoint` at the centre of *"Enstrüman üzerinde"*
returned `#export-toggle` — **a tap meant for the instrument view opened the save menu**. Hiding the
pair is the same call the two sheet toggles already got: saving and going full screen are decided
while READING, and the Nota tab is one tap away with both still there. ⚠ How it survived a day is
worth more than the fix: the corner group was added on 2026-09-26, the Düzenle hide-list was written
before it, and nothing re-read that list. `smoke:phone` asserts nothing — it caught this only because
it **could not click**.

⛔ **There is no Güfte switch.** The model does not read lyrics off a page, so its only honest state
was off. The feature is untouched: `?lyrics=1` draws them, and `render.ts` renders about a third of
the corpus with them.

⚠ **THE INSTRUMENT VIEW'S HEAD STICKS BELOW THE PINNED ROW, AND THAT IS A BUG FIX.** The Çalma row
is sticky, so anything scrolled up goes under it — including the card head, which carries the only
way back to the score. Measured at 393px in the instrument view: at a scroll of 240 the Nota
button's centre sat at y=6 under a bar ending at 70, and `elementFromPoint` there returned
**`stop`** — the tap was landing on Dur. You could see the button, pressing it did nothing, and so
you pressed again. ⛔ Only in that view: on the Nota tab the head is 189px and pinning it would cost
more music than the bug costs taps. ⚠ It works only because `.kv-card` clips with `overflow: clip`
and not `hidden` — `hidden` makes the card a scroll container and a sticky child then silently does
not stick.

⚠ **SWITCHING VIEWS PAINTS A PLACEHOLDER FIRST.** `SheetView` draws in a `useLayoutEffect`, which
runs BEFORE the browser paints — deliberately, so an edit never flashes an empty stave. The cost is
that mounting the score blocks the frame for the whole engraving: measured at 6× CPU throttling,
**246 ms** on an 83-note page, **606 ms** on 511 notes, **931 ms** on the largest score here, and
longer on a real phone. For that whole time nothing on screen changes — **not even the segmented
control's own highlight**, because the commit that would move it is the commit that blocks. A tap
that changes nothing reads as a tap that was missed, and the owner reported having to press several
times. The swap is two commits now: the first paints the switch and *"nota diziliyor…"*, the second
mounts and blocks. Measured after: the placeholder is on screen at **65 ms**, the music at 963 ms.
⛔ Keeping the score mounted and hidden would make the switch truly instant and was NOT done: the
playhead's follow would scroll the window to an off-screen element during playback in the instrument
view.

⚠ **THE MEASURE CARD'S ARROWS SIT BESIDE THE BAR NUMBER, NOT THE STAFF.** Measured at 393px: the
card is 327 wide, its row 301, and two 44px arrows with their gaps left the staff **197** — while
the engraving asks for **340** (`MIN_CONTENT_W` 320 plus its margins), so **143px** of the bar was
behind a scrollbar. ⛔ Making them borderless and pushing them outward does not reach it: even at
zero gap the row gives about 295. They move to the title row, which was carrying one short line and
nothing else, the staff row becomes one column, and both it and the card reach past their padding —
**325, then 341, hidden 0**. ⛔ `MIN_CONTENT_W` is not lowered: under it the staff draws about 17px
tall and koma stops being tellable from küçük. ⚠ On a wide window the arrows stay flanking the
staff, where there is room.

## Fitting a score into a phone

⭐ **The fit is a RE-ENGRAVE, not a zoom** — fewer bars per system at the same note size, through
`SheetView`'s `contentWidth`. Before it, the default phone screen engraved a 1000px page inside a
~341px box: **659px** hidden off the right edge at 375×667, and the reader dragged the sheet
sideways with one hand while it played. Now **0**, in both orientations.

⭐ **A page too dense to fit is engraved SMALLER, not clipped** (owner's choice over letting it
scroll — the pocket-score answer). It takes two stages and both are load-bearing:

1. **Widen the layout** by exactly what the drawing overran, measured from `getBBox()`. ⛔ Scaling
   alone does not work and was the first attempt: it shrinks the overrun with everything else, so
   the stave ended **49px short** of the box and its notes still hung **22px past the barline**.
2. **Then scale** the finished drawing to the box. Past `MIN_FIT_SCALE` (0.65) it stops shrinking and
   lets the SVG be wider than its box instead — unreadably small is worse than a drag.

Measured over the six scores on disk: two needed it, at **89%** and **87%**; the other four are
untouched at 100%, and staves fill **97%** of the box everywhere. At 1280px every score is 100%, so
`render.ts` never reaches this branch.

⚠ **The size goes on the SVG's inline `style`.** VexFlow's own `resize()` writes one and an
attribute cannot beat it — the mismatch left `preserveAspectRatio` centring the drawing and **75px
of blank** above the first stave. ⚠ `#sheet-surface` is sized in DISPLAYED units, or it is **22px**
wider than the SVG inside it.

⚠ **A ragged last system may be shorter than the page, never wider.** Skipping justification on the
final row let it keep a natural width that can exceed the content area: **470px of stave inside a
324px drawing**, clipped.

⚠ **The engraved header stacks under 520px.** Three flex columns with `white-space: nowrap` are held
at their text width by `min-width: auto`; an ellipsis instead of stacking lost the tempo.

## Coordinates

⭐ **Everything the draw publishes is in RENDERED units, converted in ONE place.** VexFlow works in
the layout's coordinates, and on a fitted page those are not where the ink is. Four consumers —
measure boxes, per-note click targets, tuplet marks, playhead positions — are multiplied by the
applied scale at the end of the draw, where they are made.

⛔ **Never scale a consumer where it is read.** That was the first shape and it cost the same bug
twice in two days: the playhead was fixed alone, the click targets were still logical, and tapping
a note selected one **up and to the left** of it — an average of **55px** out, worst **159px**.
After: average **12px**, worst **20px**, which is the unscaled page's own 14/25, because a hit box
is bigger than a notehead.

## Touch sizes

`--control-h` is **44px** under `(pointer: coarse)`, up from 30. ⚠ The token only reaches the three
containers its `min-height` rule names, so anything outside them says so itself — the toolbox's
transport and undo pairs, `.kv-tool--wide`, the measure card's arrows and foot, the voice notice's
✕, the stored-page rows' ✕.

⚠ **16px on every form field**, which is the threshold below which iOS Safari zooms the page in on
focus and never back. ⚠ Hover is neutralised on touch: the state sticks after a tap and reads as a
selection that will not clear.

## The editor on a phone

The toolbox docks to the bottom as a sheet. It opens at **51dvh** (340px on a 375×667 screen), up
from 34dvh on 2026-09-26: at **227px** the whole of it was DİNLE / Çal / Dur / Seçim and **not one
editing tool** was visible, with every group below the fold of its own scroller. At 340px, **13 of
33** tools are on screen; at 390×844, 20 of 33. The price is the music band, **224px → 111px**.

⚠ The reader can drag the title bar to resize it, between `PHONE_H_MIN` (120px) and 0.6 of the
window; the height is remembered and published to CSS as `--kv-toolbox-h`, which three rules read.

⚠ **Geri al / Yinele are in the toolbox's FIXED foot**, beside Seçim, for the reason Seçim is there:
the tools scroll, the way out does not. The stack was never the problem — four deletes undo to the
original count and `MAX_PAST` is 100 — the button was in the card's head, off the top of the screen.

⚠ **The tempo box holds a draft while it is being typed.** It used to commit straight from the
change event against a controlled value, so every keystroke passing through an out-of-range number
was refused and the box snapped back: from 80 you could not reach 120, because the first keystroke
is "1". ⚠ It looked like a touch bug and was not — a desktop spinner only ever produces in-range
values, so the field worked there by accident. Its **± pair commits on RELEASE**, because
`WebAudioBackend.play()` re-schedules the whole timeline on every call; held, they repeat ~9×/s and
move only the number on screen. The ⟲ reset **keeps its place** when idle, or the group grows at the
moment the tempo is touched and drops onto a second line.

## Full screen

Everything but the score is hidden and the page is re-engraved to what is left. ⚠ **It is not the
Fullscreen API** — `requestFullscreen` does not exist on iPhone Safari. ⚠ `data-fullscreen` is NOT
gated on the breakpoint, deliberately: a phone turned sideways is 844px and full screen has to
survive the rotation, so its stylesheet block lives outside the phone media query and hides the
sections itself with a `:not()` blanket. ⚠ Entering **leaves edit mode**, or exiting lands on the
Nota tab in edit mode with the toolbox hidden.

## What is still owed

- **`tools/browser/phone-smoke.ts` does not exist.** `npm run smoke:phone` is a PROBE — it prints
  findings and always exits 0. Nothing gates the phone. The nine asserts the plan specifies are in
  the session plan file; the two that would have caught real bugs here are *"the score fits"* and
  *"at least six tools are visible in edit mode"*.
- **The phone's own component tree** (`apps/web/src/phone/`) and the `data-phone` / `phone.css`
  split. The layout is still produced by hiding parts of the desktop tree from `app.css`.
- **The tool strip** — the toolbox still scrolls its six groups instead of switching between them.
- **The tablet.** An iPad gets the touch sizes and the desktop layout, including the floating 136px
  toolbox. Out of scope by decision, not by accident.
