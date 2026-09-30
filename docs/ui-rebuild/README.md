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

1. **Shell** — `src/shell/`: the grid, the sidebar/tab bar, the score header. Old components inside.
2. **Player bar + settings panel** replace `TransportBar` (same control ids).
3. **Editor** — the toolbox restyled for the new frame.
4. **Instrument view, full screen, the empty state.**
5. **Checks rewritten, `app.css` pruned, docs.**
