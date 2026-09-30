# The look — Tezhip palette, the stylesheet's layers, and the render pin

purpose: the one home for how the app is styled since the 2026-09-30 Tezhip restyle — the palette, dark mode, the CSS layer order, and the rule that keeps a restyle from touching training strips
audience: agents and the owner, before changing any colour, font, stylesheet or UI library
updated: 2026-09-30

> Current state and what is deployed: [../STATUS.md](../STATUS.md). The rules that bind code
> anywhere: [../APP-RULES.md](../APP-RULES.md). What a check may READ:
> [../DOM-CONTRACT.md](../DOM-CONTRACT.md). The phone's own measurements: [phone.md](phone.md).

## What it looks like, and why

**Tezhip** (owner, 2026-09-30) — the illuminated page of an Ottoman manuscript:

- **Ivory paper** (`--paper #f7f4ec`) as the ground. White (`--paper-raised`) only for panels and the
  score's sheet, so nothing is lighter than the music.
- **Lapis** (`--accent #1f3a6b`) is the one working colour: the primary button, the active segment,
  focus rings, links.
- **Gold** (`--gold #b08a3e`) is ornament ONLY — the header's ruled line, the star knots, the upload
  box's double frame, a toggle's "on" dot. ⚠ It is 2.9:1 on the paper, so it never carries text;
  `--gold-ink #8c6a2a` is the only gold a reader is asked to read (the makam name in the recent list).
- **Turquoise** and **Turkish red** are the secondary pigments (`--teal`, `--danger`).
- **EB Garamond** for display, **Inter** for the interface — both self-hosted through `@fontsource`
  (`main.tsx`), because COEP `require-corp` blocks every font CDN. ⚠ The score's own header keeps
  **Georgia** (`--font-score`): it is engraved to match the notation.
- **Ornament is subtle** (owner: *"ince ve ölçülü"*): every ornament is built from one drawn shape,
  the eight-pointed star (`ui/ornament/Star.tsx`), in `GoldRule` and `TezhipPattern`. The tiled
  ground appears only on the empty upload box, never under the score.

It replaced **İznik** turquoise (2026-08-08), which had replaced a cream-and-terracotta palette the
owner said read as somebody else's website. **Do not bring cream + terracotta back.**

Every text pair's contrast is computed in the header of `apps/web/src/styles/tokens.css`.

## Dark mode

- **Follows the system; there is no toggle** (owner, 2026-09-30).
- The page goes to a night slate (`--paper #12151f`). **The score does not go dark**: `.kv-paper`
  on `.kv-score` re-declares the light tokens, so the sheet and everything drawn in it (header,
  legend, instrument views) keep their light colours.
- **At night the sheet is ivory `#edeae0`** — the exact complement of the night page — with black
  ink. ⛔ **An inverted sheet (light marks on dark paper) was built and REJECTED the same day**: the
  owner found it harder to read. Staff lines and stems are hairlines, and thin light strokes on a
  dark ground bloom and thin out; a softened invert was also tried and looked grey. The owner chose
  the ivory sheet from three side-by-side screenshots.
- ⛔ **Never write a `dark:` utility.** The island only works because every colour is a token the
  card re-declares; `css-contract-test.ts` fails on one.

## The stylesheet's layers

`apps/web/src/index.css` declares the order, and **the layer decides who wins, not the file order**:

| Layer | File | Holds |
|---|---|---|
| `theme` | `tailwindcss/theme.css` + `styles/theme.css` | Tailwind's variables; our colour names as `@theme inline` |
| `tokens` | `styles/tokens.css` | the palette, type, space. ⚠ Layered on purpose: `app.css` re-defines `--control-h` to 44px under a coarse pointer, and an unlayered token beat it (measured: every phone control shrank to 30px) |
| `base` | `styles/base.css` | element defaults, Bravura. **No Tailwind preflight** — it would move the engraved SVG |
| `components` | `styles/components.css` | the control kit: `.kv-btn`, `.kv-toggle`, `.kv-field`, `.kv-seg` |
| `legacy` | `styles/app.css` | every other `.kv-*` rule, including the phone and full-screen state machine |
| `utilities` | Tailwind | classes written on elements (the ornaments, `ui/kit/Modal.tsx`) |
| *(unlayered)* | `styles/contract.css` | the rules checks and the strip renderer depend on — beats every layer |

⚠ **Why the kit is a CSS layer and not React components with utility classes:** `app.css`
re-sizes the kit by context in more than 30 places (the transport's one height, the phone's tab
rules, the coarse-pointer block, full screen's round buttons). A utility on the element sits ABOVE
`legacy` whatever its specificity, so it would silently undo those overrides. In `components`,
under `legacy`, the kit is the default and every contextual rule still wins.

⚠ `source(none)` plus the two `@source` lines keep Tailwind from scanning `public/` (hundreds of MB
of models and scores).

**Base UI** (`@base-ui/react`) is used where it earns its place and nowhere else: the three prompts
on `ui/kit/Modal.tsx` (focus trap, Esc, scroll lock, focus return), and the save menu (`Menu`). ⛔
Not for checkboxes, selects, the tab bar or `<details id="advanced">` — checks drive the real
elements ([../DOM-CONTRACT.md](../DOM-CONTRACT.md)).

## The render pin — a restyle can no longer move a training strip

**Found 2026-09-30:** the first palette commit changed **every** strip `render.ts` cut from 2 pieces
(302 strips, 0 label changes). The engraving was identical; the new font changed the chrome's height
above the score, so the sheet landed on a different fraction of a pixel. 155 strips were only shifted
by 1–2 device pixels; 147 also had different antialiasing.

**Fix (owner's choice):** `#app[data-render="1"]` is set whenever the URL carries `mode` — every
render job and every `verify-labels` replay. `contract.css` then hides all chrome and pins the
score's position in literal pixels. Proven the same day: re-rendering after deliberately enlarging
the header (a 3.12rem title, a 61.37px gap) gave **302 of 302 strips byte-identical**. The pin itself
moved the strips once (258 of 302 differ from the pre-restyle render at antialias level; 0 labels
changed; `verify-labels` 302/302 exact). **`strips_v7_final` on disk is untouched**; only a future
re-render would differ from it at that level.

⚠ Change nothing in the `data-render` block of `contract.css` without re-rendering and accepting a
new strip baseline.

## Checking a style change

- `npx tsx tools/browser/visual-snap.ts --out <dir>` — 22 screenshots (desktop 1280 and phone 393,
  light and dark) plus `snap.json` with the rects that matter. Run before and after, and compare.
- `npm test` includes `tools/browser/css-contract-test.ts`: the static rules above.
- Strips: `render.ts --from 0 --to 2` against the running dev server, before and after; the PNGs
  must be byte-identical.
- The usual gates: `typecheck`, `smoke:editor`, `smoke:phone` (read it), `build:app` + `smoke:build`.

## Not done (2026-09-30)

The component CSS for the transport, the edit toolbox, the instrument views and the tab bar was
**repainted through the tokens, not rewritten**. The owner then asked for a from-scratch UI on a
separate branch, which makes a line-by-line migration of those sections on `main` wasted work.
