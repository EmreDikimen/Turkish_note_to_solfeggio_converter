# UI rebuild — the app as a music player (branch `ui-rebuild`)

purpose: the plan and the running state of the from-scratch UI on the `ui-rebuild` branch
audience: agents and the owner working on that branch
updated: 2026-09-30

> This track lives on the **`ui-rebuild` branch only** (owner, 2026-09-30: *"yeni bir branch açıp bu
> sefer uygulamanın ui ını sıfırdan kur … istediğin kütüphane istediğin yapı"*). `main` keeps the
> Tezhip restyle ([../features/look.md](../features/look.md)). Current state of the product:
> [../STATUS.md](../STATUS.md).

## The owner's choices (2026-09-30)

- **Structure: a music app** — a library of read pages, the score in the middle, and a player bar
  that is always on screen. Settings slide in; editing is a mode.
- **Checks move with the UI**: where a feature survives it keeps its id; where the structure changes,
  the browser checks are rewritten. The branch is not done until they are green.
- Palette, fonts and dark mode are the Tezhip ones from `main` — this rebuild is structure and
  components, not a new look.

## What does NOT change, whatever the UI

- **The engine stays in `App.tsx`**: every state, handler and effect (decode, playback, edits,
  recent pages, voices). Only the render tree and the components under it are rebuilt.
- **`SheetView` and the training-strip path.** `.kv-score` rules, the `data-render` pin, and
  `render.ts` / `verify-labels.ts` byte-identity (proof: re-render 2 pieces, 302/302 identical).
- **The DOM contract's hard parts**: real checkboxes, native selects, clip-pattern file inputs,
  `#omr-status` / `#omr-error` / `#page-input`, the modal ids, `data-play-state` on every play button.

## Layout

| | Wide window (> 700px) | Phone (≤ 700px) |
|---|---|---|
| Library (upload + read pages) | left sidebar | the **Kütüphane** tab |
| Score | the main column, re-engraved to its width | the **Nota** tab |
| Player bar (play, stop, tempo, follow, settings) | fixed at the bottom, full width | fixed above the tab bar |
| Settings (sound, rhythm, pitch) | a panel sliding in from the right | a bottom sheet |
| Editor | the toolbox floats over the score | the **Düzenle** tab, toolbox as a sheet |

## Milestones

| # | What | State (2026-09-30) |
|---|---|---|
| 1 | **Shell** — `src/shell/`: the grid, the sidebar, the tab bar (`NavBar`), `Chrome` (brand, welcome, footer) | ✅ done |
| 2 | **Player bar + settings panel** (`PlayerBar`, `TempoControl`, `SettingsPanel` on Base UI's Drawer) replace `TransportBar`, which is deleted | ✅ done |
| 3 | **Editor** — the toolbox opens over the sidebar on a wide window and docks above the tab bar on a phone | ✅ placed; its own look is still the old one |
| 4 | **Instrument view, full screen, the empty state** | ✅ working in the shell; not restyled beyond the tokens |
| 5 | **Checks, `app.css` pruning, docs** | ✅ checks green; ⏭ `app.css` still carries the dead phone state machine (`.kv-page[data-mtab]` rules select nothing now) |

## Where the checks stand (2026-09-30, commit `ab17e68`)

`typecheck`, `npm test`, `smoke:editor` ALL PASS, **`smoke:app` PASS** (red on `main` since before
the rebuild — two causes, both fixed here: the library folded itself away when a stored page was
opened, and the rename step raced its own IndexedDB write), `build:app` + `smoke:build` PASS,
`smoke:phone` no sideways scroll at any of its four sizes. Strips: `render.ts` on 2 pieces,
**302/302 byte-identical** to the pinned baseline. Not run: `smoke:page` (minutes of in-browser
slicing and decode — heats the Mac), `gate:browser`.

What the checks now know: the settings panel is mounted only while open
(`tools/browser/settingsPanel.ts`); the voice is readable off `#transport-pinned[data-instrument]`;
the player-bar test replaced the sticky-row test; and the narrow-window test asserts the sheet is
RE-ENGRAVED to its column instead of scrolled sideways, because the shell fits it at every width.
