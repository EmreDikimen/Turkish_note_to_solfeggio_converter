# CLAUDE.md — read this first

Classical Turkish (makam) music **OMR**: photo/screenshot of sheet music → notes *including the
microtonal accidentals* → editable score → playback at exact 53-TET (Arel-Ezgi-Uzdilek) pitches.
Web app first, mobile later. No server: inference runs in the browser via `onnxruntime-web`.

**The MVP track is the live work (owner, 2026-08-02): the model is FROZEN and the in-browser
pipeline is being wired for a release to friends.** Do not start Round 3 training — the real-page
track is paused until feedback comes back. Ladder and state: [docs/mvp/README.md](docs/mvp/README.md).
Synthetic accuracy is solved (99.9%); the remaining model work is about real printed pages.

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
npm test                             # stitcher unit tests + 194-score label round-trip
npm run gate:browser                 # in-browser ONNX gate, headless — expect 27/28
npm run probe:cv                     # opencv.js vs OpenCV-Python parity (MVP W0)
npm run check:logprobs               # browser confidence signal vs onnx_parity.py (MVP W1)
npm run smoke:app                    # real app: strip crops in → playable score out (MVP W2)
npm run parity:armb -- --pages 20    # browser-vs-Python decode ceiling (MVP W2/W3)
.venv-ml/bin/python src/vision/eval_omr.py --checkpoint data/checkpoints/<ckpt> [--strips-dir …]
.venv-ml/bin/python src/vision/decode_page.py <page.png> --checkpoint <ckpt> --onnx-dir <dir> --suffix _int8
.venv-ml/bin/python scripts/rung3/review_ui.py            # labeling/verdict UI → localhost:8377
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
- **Python is training/data only.** Nothing in `src/` or `scripts/` ships. No backend, ever.
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
