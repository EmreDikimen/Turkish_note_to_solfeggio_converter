# CLAUDE.md — read this first

Classical Turkish (makam) music **OMR**: photo/screenshot of sheet music → notes *including the
microtonal accidentals* → editable score → playback at exact 53-TET (Arel-Ezgi-Uzdilek) pitches.
Web app first, mobile later. Inference runs in the browser via `onnxruntime-web` — though whether it
stays there is [reopened](docs/mvp/deploy.md).

**TWO TRACKS RUN IN PARALLEL (owner, 2026-08-05).** The product track is building a decode server
(W9) for a release to **two friends** who will be asked about the **interface, not the model**; the
model track is **Round 3, now UNPAUSED** — it no longer waits for feedback, because feature feedback
would not aim it. Neither blocks the other. The public launch is gated on Round 3's exam result.
Ladder and state: [docs/mvp/README.md](docs/mvp/README.md). Synthetic accuracy is solved (99.9%);
the remaining model work is about real printed pages.

> **Current state + the next action → [docs/STATUS.md](docs/STATUS.md). Never answer "what's next"
> from this file or from ROADMAP.** Plain-English version for the project owner:
> [docs/OVERVIEW.md](docs/OVERVIEW.md).
>
> 📝 **Asked to "sync the docs", "update the docs", or writing anything down after a piece of
> work? READ [docs/MAINTAINING.md](docs/MAINTAINING.md) FIRST and follow it** — it says which file
> owns what, and the end-of-session checklist. Do not improvise doc updates.

## Where things are

| Need | File |
|---|---|
| **"Sync the docs" / update docs after work** | **[docs/MAINTAINING.md](docs/MAINTAINING.md) — read before editing any doc** |
| What ships today, what's next, open risks | [docs/STATUS.md](docs/STATUS.md) |
| Any headline number (accuracy, corpus size, yield) | [docs/METRICS.md](docs/METRICS.md) |
| Why something was decided (and what overturned it) | [docs/DECISIONS.md](docs/DECISIONS.md) |
| **What we may publish** — licences, attribution, why no score ships | **[docs/THIRD-PARTY.md](docs/THIRD-PARTY.md)** |
| The full doc map | [docs/INDEX.md](docs/INDEX.md) |
| **MVP track (in-browser pipeline → friends release)** | **[docs/mvp/README.md](docs/mvp/README.md)** |
| Real-page track (collect → label → exam → rounds) | [docs/rung3/](docs/rung3/) |
| Code map / reading order | [docs/CODE_TOUR.md](docs/CODE_TOUR.md) |
| Page → strips → decode → stitch design | [docs/PIPELINE.md](docs/PIPELINE.md) |
| See a feature with your own eyes | [docs/MANUAL_CHECKS.md](docs/MANUAL_CHECKS.md) |
| Training runs, raw results | [src/vision/MODEL_EVAL.md](src/vision/MODEL_EVAL.md) |
| Long-range plan (evergreen, no status) | [ROADMAP.md](ROADMAP.md) |

## Commands

Python lives in `.venv-ml` (training/data only, never shipped). Node workspaces at the root.

```bash
npm run dev:web                      # harness → http://localhost:5173
npm run typecheck                    # all workspaces
npm test                             # stitcher unit tests + label round-trip + edit primitives
npm run smoke:editor                 # real app: select, drag, delete, undo/redo, the palette, rests, tuplets
                                     # …and note-box geometry on a GRACE-NOTE score (see the rule below)
npm run gate:browser                 # in-browser ONNX gate, headless — expect 27/28
npm run probe:cv                     # opencv.js vs OpenCV-Python parity (MVP W0)
npm run check:logprobs               # browser confidence signal vs onnx_parity.py (MVP W1)
npm run smoke:app                    # real app: strip crops in → playable score out (MVP W2)
npm run smoke:page -- --ref ref.json # real app: a PAGE image in → playable score out (MVP W7)
npm run check:deskew                 # the skew sweep's fast path is EXACT vs the morphology (W7)
npm run parity:armb -- --pages 20    # browser-vs-Python decode ceiling (MVP W2/W3)
npm run parity:arma -- --pages 20    # ported slicer's crops vs Python's, PAIRED (MVP W6)
npm run parity:slicer -- --ref ref.json                # ported slicer vs local python (MVP W4-W6)
```

### The decode server and the deployable app (W9 — SHIPPED)

**It is live**: app <https://komavision.netlify.app> (Netlify), weights `Beyaban/omr-weights`
(Hugging Face Hub), decode on Cloud Run behind `ALLOWED_ORIGINS`. Setup recipe and its two traps:
[docs/mvp/hosting-setup.md](docs/mvp/hosting-setup.md).

```bash
node apps/server/tools/prepare-models.mjs   # assemble apps/server/models from the browser's graphs
npm run dev:server                   # the decode server on :8080 — needs the line above once
npm run parity:server -- --pages 6 --fixture f.json   # server vs browser; --replay f.json skips the browser
npm run bench:server -- --fixture f.json              # vCPU-seconds per page, payload bytes
npm run check:limits                 # the deploy safety checklist, against a running server
npm run check:bundle                 # the BUNDLED server boots — not the same artifact as dev:server
npm run check:coldstart              # a COLD server still gets the page (needs a running dev:server)
VITE_DECODE_URL=http://localhost:8080 npm run smoke:page   # the app THROUGH the server
npm run build:app                    # the deployable app — FAILS if the weights leak into dist/
npm run smoke:build                  # builds, then drives the BUILT app: server path + fallback
npm run smoke:live                   # drives the DEPLOYED site — the only check the origin lock allows
```

⚠ **`smoke:build` from localhost can no longer reach the live server** — `ALLOWED_ORIGINS` refuses
it, by design. Use `smoke:live` for the deployed chain, or a local `dev:server` for `smoke:build`.
`http://localhost:5173` / `:4173` ARE allowed, so `dev:web` still reaches the live decode server.

### Python (training and data only — never shipped)

```bash
.venv-ml/bin/python scripts/slicer_ref.py --pages 120 --out ref.json   # slicer port control arm
.venv-ml/bin/python src/vision/eval_omr.py --checkpoint data/checkpoints/<ckpt> [--strips-dir …]
.venv-ml/bin/python src/vision/decode_page.py <page.png> --checkpoint <ckpt> --onnx-dir <dir> --suffix _int8
.venv-ml/bin/python scripts/rung3/review_ui.py            # labeling/verdict UI → localhost:8377
.venv-ml/bin/python scripts/build_makam_signatures.py \
    --from-json data/makam_signatures.json --ts-out packages/core/src/makamSignatures.ts  # TS copy only
npx --yes tsx tools/render/render.ts --pieces data/pieces.json --out data/synthetic/<set> [--thin-sharps]
npx --yes tsx tools/render/stitch-test.ts                 # expect ALL PASS, 217/217 round-trip
npx --yes tsx tools/render/verify-labels.ts --strips data/synthetic/<set> [--thin-sharps]
.venv-ml/bin/python scripts/check_docs.py [--facts]       # doc structure + no-info-loss check
```

Long jobs are chunked and resumable — Ctrl-C is safe, re-running skips finished work.

## Hard rules

- **The exam is one-shot.** `data/real/rung3/testset.json` pieces are never trained on, and the
  exam is read once per round on the final model. All iteration happens on real-val.
- **Photos of exam pieces are EXAM-ONLY.** Training on them leaks the exam. Camera photos for
  training must come from different pieces.
- **No Western rehearsal data** in fine-tuning (owner decision 2026-07-03). Coverage comes from
  self-rendered Turkish strips.
- **There IS a backend now, for decode only** (owner decision 2026-08-05, reversing "no backend,
  ever"): the browser slices and POSTs crops, a **Cloud Run** CPU server runs the model. Reason:
  protect the user's machine — a page burns ~19 s of multi-threaded CPU on the client. Plan:
  [docs/mvp/deploy.md](docs/mvp/deploy.md). **Everything else stays local** — audio, the editor, and
  the W4–W6 slicer port. **Do not delete the in-browser decode path**: `gate:browser`,
  `parity:armb`, `parity:arma`, `smoke:page` and the W3 browser-vs-gold result all rest on it, and
  it is also the **live fallback** when the server is cold or down.

- **The server is Node + `onnxruntime-node` importing `apps/web/src/omr/decode.ts`** — the browser's
  own module, so there is ONE decode implementation, not a third to hold in parity. Do not write a
  second decoder in any language. **Built AND DEPLOYED 2026-08-06** — live on Cloud Run (europe-west3, 1 vCPU); URL and numbers in [docs/STATUS.md](docs/STATUS.md). Two
  rules follow from how it was made to work: `decode.ts` may **not** import an ORT runtime (types
  come from `onnxruntime-common`, the `Tensor` constructor rides on `Sessions`), and **the client
  preprocesses** — the server receives finished 409×583 PNGs and applies only the rescale, so there
  is no second resampler to hold in parity either.

- **The deploy checks read DOM state, never the words on the page** (2026-08-07, the style pass).
  `apps/web/src/ui/status.ts` is the single producer of the contract — `#omr-status` carries
  `data-state`, `data-kind`, `data-where` and the counts; `#omr-error` carries `data-error-kind`;
  `#play` carries `data-play-state`; `#app` carries `data-ready`. The editor adds
  `#edit-toggle[data-edit-mode]`, `#sheet-surface[data-edit-mode]` + `[data-selected-note]`,
  `[data-omr-note]` / `[data-selected]` per note, `#note-delete` / `#undo` / `#redo`, and the
  palette's `#edit-palette[data-armed]` + `[data-tool]` per tool, its transport
  `#edit-palette[data-play-from]` + `#palette-play[data-play-state]` / `#palette-stop`, the
  insert preview `[data-omr="insert-ghost"][data-insert-pitch]`, the tuplet tool's
  `#sheet-surface[data-tuplet-anchor]` + `[data-tuplet="start|member|anchor|end|blocked"]` per note,
  and the off-meter mark `[data-omr="bar-warning"]` + `[data-bar]` + `[data-bar-fill="over|under"]`
  (⚠ **`data-edit-mode` AND `data-play-state` are each on two elements** — select the one you mean
  by id). The playhead carries `[data-omr="playhead"]`, because an attribute naming a bar cannot
  prove playback began there. A tuplet is **not stored** anywhere, so no attribute can prove one was
  made: `smoke:editor` counts the marks the engraver drew, in **both** styles (`.vf-tuplet` and the
  curved arc's italic "3" — the style is a per-piece coin). The six
  `tools/browser/*-smoke.ts`
  assert on those, so **all user-facing copy is free to change** — that is what let the UI become
  Turkish. Never reintroduce a text/regex matcher for a status message or a button label. Every
  user-visible string lives in `apps/web/src/ui/strings.ts`. ⚠ Two traps: nothing that ticks on a
  timer may render inside `#omr-status` (`page-smoke` counts distinct texts to prove progress
  moved), and `#strips-input` lives inside the collapsed `<details id="advanced">`, so `app-smoke`
  opens it first and the file inputs use the clip pattern, never `display:none`.
- **THE APP PUBLISHES NO SCORE, AND NOTHING MAY PUT ONE BACK** (owner decision 2026-08-08). Every
  score this project has is a SymbTr export, and SymbTr is **CC BY-NC-SA 4.0** — serving one binds
  the app to **NonCommercial forever**, and two of them were compositions still in copyright under
  FSEK 5846. So `SAMPLES` in `App.tsx` is **empty**, there is no Sample dropdown, and the app opens
  on the upload prompt. The files stay on disk **gitignored** because `npm test`, `smoke:editor` and
  the manual checks read them through **`?score=…`** against a dev server — local use is not
  distribution, adding a `SAMPLES` entry is. ⚠ The enforcement is `prune-dist.mjs`, which **fails
  the build on any `.json` at the dist root**: everything under `public/` is served to whoever
  guesses the name, so "no UI links to it" proves nothing. An own-work score would go in a
  subdirectory. ⚠ Consequence for browser checks: **`data-ready` never appears on a bare visit** —
  it means "a score is installed" and none is. Ask for `?score=` if you need one; wait on
  `#page-input` if you are uploading your own. ⚠ The footer (`#legal`) claims uploads are not
  stored — true only while `apps/server/src/index.ts` writes no image to disk; change both together.
  Full map: [docs/THIRD-PARTY.md](docs/THIRD-PARTY.md).
- **The score's SVG is also the training-strip source, so CSS must not reach it.** No selector under
  `.kv-score` may set a font, and no `transform`/`zoom`/`scale` may touch that container —
  `tools/render/render.ts` screenshots the VexFlow SVG by rect to cut strips, and rects do not
  survive a transform. The design system is `apps/web/src/styles/` (`tokens.css` → `base.css` →
  `app.css`); classes are `.kv-*`.
- **`StaveNote.getBoundingBox()` is a merge over the note's MODIFIERS, so it is not safe on its own**
  (2026-08-08, a live bug). `GraceNoteGroup` never positions itself, so it reports its box at the SVG
  **origin**, and merging that stretched a graced note's click box from the top-left of the score to
  the note — 949×1805 px, stealing 126 of 134 clicks on the page. `noteBoxOf` in `SheetView.tsx`
  therefore rejects any box reaching x ≤ 0 or y ≤ 0 and falls back to the note's own ink
  (`getNoteHeadBounds` / `getStemExtents` / `getGlyphWidth`, all real positioned geometry). Two things
  follow: **the default sample has no grace notes, so `smoke:editor` loads `beyati-delisin.json` for
  its geometry section** — keep it that way, a check on a graceless score cannot see this class of
  bug; and if you ever add a modifier, verify it positions itself before trusting a merged box.
- **A production build is not the dev server, and only `smoke:build` knows the difference.** ORT's
  wasm runtime must be served as real files (`/ort/`, via `copy-ort.mjs`) or the bundler inlines its
  worker glue and every session creation hangs — dev, `smoke:page` and the 27/28 gate stayed green
  while the built app's fallback was frozen. Weights ship from `VITE_WEIGHTS_URL`, never from
  `dist/`; `build:app` fails if they leak in.
- **Python is training/data only, and NOTHING ships.** The rule stands unchanged: the open question
  about a Python decode service was **closed on 2026-08-05** by choosing the Node stack above.
  Nothing under `src/vision/` becomes shippable.
- **The makam bends the SOUND ONLY** (owner decision 2026-08-06, shipped 2026-08-07). Selecting a
  makam adds comma deltas to the sounding koma on the way into `buildTimeline` — the engraving,
  `Save JSON` and `buildStrips` never move, and no key signature is redrawn. The table carries
  **documented deviations only**; `none` is the default. Table, sources and the signature+karar
  guess: [docs/mvp/makam.md](docs/mvp/makam.md). Two deliberate duplications live here and are both
  pinned by `npm test`: core's `SIG_TOKEN_BY_ALTER` mirrors `AEU_TOKEN` in `tools/render/
  lilypond.ts`, and `packages/core/src/makamSignatures.ts` is **GENERATED** from
  `data/makam_signatures.json` — never hand-edit it, and re-emit with `--from-json` so refreshing
  the TS copy cannot rewrite the JSON from whatever pools are on the machine.
- **Token ids are append-only** — new tokens go at the END of `ADDED_TOKENS` so existing ids stay
  stable across checkpoints.
- **This Mac is a fanless M4.** Heavy compute goes to Colab (`docs/COLAB.md`), or locally with
  `nice -19` and `OMR_ORT_THREADS=2`.
- **Pixels and labels must be produced by the same code path.** The renderer and the label
  serializer share `rhythm.ts` / `stripExport.ts` on purpose — never hand-write a label. Where a
  rule IS duplicated (the carry/`sigTolerant` decision lives in both `SheetView.tsx` and
  `lilypond.ts`), a corpus is not trainable until `tools/render/verify-labels.ts` passes on it:
  that duplication silently cost Round 1 (docs/METRICS.md).
- **Commits:** short lowercase subject, no co-author trailer.

## Doc conventions (keep them or the docs rot)

The short version is below; the full procedure — what to update after a session, and why each rule
exists — is [docs/MAINTAINING.md](docs/MAINTAINING.md).

Full guide — what to update after a session, and why each rule exists:
[docs/MAINTAINING.md](docs/MAINTAINING.md).

1. `docs/STATUS.md` is the **only** file that states current state or next action. Everything else
   links to it — never restate status.
2. **A number lives in one place**: `docs/METRICS.md` (or its source log). Prose may name a metric,
   not restate its value.
3. `docs/log/` is **append-only history**. `docs/log/superseded.md` holds abandoned plans — never
   act on anything found there.
4. New work goes in the track doc it belongs to (`docs/rung3/*`), not into STATUS.
5. Keep any doc under ~400 lines; split it instead of appending forever.
6. Run `.venv-ml/bin/python scripts/check_docs.py` after doc edits.

## Data layout (all gitignored)

```
data/real/            real pages: pdfs/ images/ rung3/ (matched, strips, photos_exam, testset.json)
data/synthetic/       rendered strips — strips_v4 is current, older sets kept (v3 = the A/B control)
data/checkpoints/     round1-best (+ -onnx int8, the live runtime), earlier rung2*/rung22* runs
data/split.json       piece-level train/val split (strips_v4 uses data/split_v4.json, v3 split_v3)
                      — ALWAYS split by piece, never by strip: strips of one piece are near-duplicates
```
