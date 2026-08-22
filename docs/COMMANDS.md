# Commands — every command this project has, with its traps

purpose: the full command reference, including the ⚠ traps that cost real time to learn
audience: anyone about to run anything; `../CLAUDE.md` keeps the everyday few and points here

updated: 2026-08-23

> ⚠ **Read the ⚠ lines, not just the command.** Several of these have a failure mode that looks like
> success — a build that publishes nothing, a render that silently produces an uncovered corpus, a
> decode that quietly moves onto your own laptop. Those warnings are the reason this file exists.

Split out of [../CLAUDE.md](../CLAUDE.md) on 2026-08-23 when it crossed the 400-line cap. Genre
split: that file keeps the **rules and the orientation** an agent must not miss, plus the handful of
commands used every session; this one holds the **full reference**. Nothing was dropped in the move.

Python lives in `.venv-ml` (training/data only, never shipped). Node workspaces at the root.

```bash
npm run dev:web                      # harness → http://localhost:5173 (decode on YOUR machine)
npm run dev:cloud                    # the same harness, but decode runs on Cloud Run — see below
npm run typecheck                    # all workspaces
npm test                             # stitcher + label round-trip + edit primitives + usul strokes + voice manifest
                                     # …plus violin fingering (the 53-TET position formula + string choice)
npm run smoke:editor                 # real app: select, drag, delete, undo/redo, the palette, rests, tuplets
                                     # …plus the instrument voices; add --voices-url <hub> for the REAL samples
                                     # …and note-box geometry on a GRACE-NOTE score (see the rule below)
                                     # …and the fingerboard tab: the marker lands on a string and MOVES
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
[mvp/hosting-setup.md](mvp/hosting-setup.md).

⚠ **DEPLOYING IS NOT HOW YOU GET THE WORK OFF THIS MACHINE — `npm run dev:cloud` is** (owner asked
2026-08-11, wanting a cool laptop rather than a public URL). It is `dev:web` with `VITE_DECODE_URL`
pointed at the live Cloud Run service, which works from localhost because `:5173` and `:4173` are in
`ALLOWED_ORIGINS`. Verified end to end: `data-where="server"`, 27.3 s of decode on Cloud Run against
1.6 s of slicing locally. Plain `dev:web` sets no decode URL, so it decodes **in your browser** and
heats the Mac — that is the difference between the two lines above. ⚠ The fallback still exists: if
the service is cold past its wait or down, the read silently moves to this machine and pulls 211 MB
of weights. The status line says which happened (`sunucuda okundu` vs `kendi cihazınızda okundu`) —
believe it, not the elapsed time.

`npm run deploy:app` is the one-command version of the two-command recipe in `hosting-setup.md`
(build with both URLs baked in, then `netlify-cli deploy --prod` to the pinned site id). It publishes
to the real site, so run it deliberately; `npm run smoke:live` after. ⚠ **A successful build is not a
deploy** — `netlify-cli` detects the npm workspaces and stops on an interactive "select the project"
prompt, which once let the recipe build cleanly and publish **nothing**. `--filter @turkish-omr/web`
is in the script for that reason; read the output for `Deploy is live!` rather than trusting exit 0.
⚠ `smoke:live` does not check the audio — spot-check `/audio/<kit>/<stroke>-rr1.wav` for 200 after a
deploy that touches it.

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
`http://localhost:5173` / `:4173` ARE allowed by the server, so a harness on those ports MAY reach
the live decode service. ⚠ **"May" is the whole word** — this line used to say `dev:web` "still
reaches" it, which is false and misread as a promise (owner, 2026-08-11). `ALLOWED_ORIGINS` only
decides whether the server accepts the origin; the CLIENT still has to know the address, and
`dev:web` sets no `VITE_DECODE_URL` (there is no `.env` in this repo), so `decodeUrl()` returns `""`
and the model runs **in the browser**. Measured with the port empty: plain `dev:web` serves
`import.meta.env` with no `VITE_DECODE_URL` in it at all. Use **`npm run dev:cloud`** to decode on
Cloud Run from localhost.

### Python (training and data only — never shipped)

```bash
.venv-ml/bin/python scripts/slicer_ref.py --pages 120 --out ref.json   # slicer port control arm
    # ⚠ `--token-budget N` runs the SAME arm under the LABEL-BUDGET rail. The reference fixes the
    # packing rule as well as the sample, and `parity:slicer` refuses a ref that mixes the two.
.venv-ml/bin/python scripts/rung3/measure_fill_score.py --decode-root data/real/strips_v2
    # the LABEL-FREE accuracy proxy: a strip covers n measures, so its decode must fill n x the
    # page's meter, and an early `</s>` comes up short. ⚠ ALWAYS read it beside
    # `--calibrate <gold manifest.jsonl> --meter-from data/real/strips_v2` — that is the same
    # scorer over hand-verified labels, and everything it flags there is the PROXY's own false
    # alarm (7.6% under-fill). `--compare <root>` pairs two decode roots ON PAGES, never on
    # strips: two packing rules cut different crops, so no strip-to-strip pairing exists.
.venv-ml/bin/python scripts/rung3/decode_budget_arm.py --pages 120 --budget 57
    # arm B for the line above. Arm A is FREE — `strips_v2` already holds every page decoded under
    # the shipped rule with `round2-stage2-best` int8 — so only the rail's crops need decoding.
    # ~21 min for 120 pages on the laptop. Resumable; refuses a page whose arm-A cache used
    # another checkpoint.
.venv-ml/bin/python scripts/rung3/budget_sweep.py --pages 200
    # which budget? No decoding: it re-windows ONE stage-1 geometry at every candidate and reports
    # windows recovered into the trainable set against the near-empty crops over-splitting makes.
    # Answer (2026-08-23): b=57. Recovery is flat b=40..59, so the value rides on cost alone.
.venv-ml/bin/python src/vision/eval_omr.py --checkpoint data/checkpoints/<ckpt> [--strips-dir …]
.venv-ml/bin/python src/vision/decode_page.py <page.png> --checkpoint <ckpt> --onnx-dir <dir> --suffix _int8
.venv-ml/bin/python scripts/rung3/review_ui.py            # labeling/verdict UI → localhost:8377
.venv-ml/bin/python scripts/rung3/emit_strip_labels.py --strips-root data/real/strips_v2 \
    --checkpoint data/checkpoints/round2-stage2-best --onnx-dir data/checkpoints/round2-stage2-best-onnx \
    --testset data/real/rung3/testset.json --out data/real/rung3/strips_b8
    # the B8 re-emit as it was RUN 2026-08-21 (37 min, laptop). ⚠ `--strips-root data/real/strips_v2`
    # is the whole point — the default root is the RETIRED slicer. It reuses the 1,704 page decode
    # caches, which is why no GPU is needed; `--redecode` would throw that away. Its output is NOT
    # training data until `b8-audit` is read and the old pools' human fixes are carried BY MEASURE
    # SPAN (docs/METRICS-CORPUS.md).
.venv-ml/bin/python scripts/rung3/build_exam_v3_queue.py --rebuild
    # the exam, RE-CUT on today's slicer (owner, 2026-08-21). `--plan` prints the emit command; that
    # emit must write to --strips-root data/real/strips_examv3 and NEVER to data/real/strips, which
    # the frozen exam hardlinks from — re-slicing there rewrites the pixels its gold describes.
.venv-ml/bin/python scripts/rung3/staccato_falsedot_score.py --checkpoint <ckpt> [--compare <ckpt>]
    # Lever 6's PRIMARY: the staccato-triggered false-dot rate on the two paired 110-strip pools.
    # The augmentation dot is a SUFFIX inside a duration token, not a token, so eval_omr.py has no
    # per-class row for it and never will. Both pools' gold carries zero dotted durations by
    # construction. --compare pairs a second checkpoint per strip with an exact McNemar.
.venv-ml/bin/python scripts/rung3/staccato_realdot_score.py --checkpoint <ckpt> [--compare <ckpt>]
    # the same read inverted — real dots LOST, gated on easy+mid only, hard tier printed never gated
.venv-ml/bin/python scripts/build_makam_signatures.py \
    --from-json data/makam_signatures.json --ts-out packages/core/src/makamSignatures.ts  # TS copy only
npx --yes tsx tools/render/render.ts --pieces data/pieces_v4.json --out data/synthetic/<set> [--thin-sharps]
    # ⚠ --pieces data/pieces_v4.json, NOT data/pieces.json — the latter is the stale 2026-07-08
    # selection (190 pieces). `strips_v4` AND `data/split_v4.json` were both built from
    # pieces_v4.json (208), so rendering from pieces.json silently produces a corpus the split does
    # not cover: 528 strips in neither train nor val, and 23 of Round 2's pieces missing. It fails
    # nothing and reads as a normal render. Cost one full corpus render on 2026-08-13.
    # [--legacy-tuplet-mark] renders the tuplet A/B's control arm; [--print-noise] opts INTO the
    # Round-3 print realism, which is off by default (it carries the quarantined USUL_BEAM_GROUPS)
    # [--staccato-noise] opts INTO the Round-3 staccato distractors — label-free dots on the
    # notehead side, teaching that a dot means "longer" only BESIDE the notehead. Off by default;
    # `staccatoseed` is deliberately NOT a manifest field, so the two arms stay byte-diffable.
    # [--concave-tuplet] opts INTO the THIRD tuplet shape (2026-08-19): a CONTINUOUS arc with the
    # "3" inside its concavity, on a per-piece coin. Measured off two real scanned editions, which
    # refuted this project's own "16 of 16 marks break the arc" (docs/METRICS-TUPLETS.md).
    # ⚠ Off by default and NO TRAINED ARM MAY CARRY IT — it changes a share of every piece, so a
    # corpus with it on is not comparable to one without. It belongs to the FINAL model's render.
    # `make_round3_colab_zip.sh` refuses any arm whose render_config.json has it on.
npx --yes tsx tools/render/stitch-test.ts                 # expect ALL PASS, 218/218 round-trip
npx --yes tsx tools/render/verify-labels.ts --strips data/synthetic/<set> [--thin-sharps] [--staccato-noise] [--concave-tuplet]
npx --yes tsx tools/render/render-ly.ts --pieces data/pieces_geom_pilot.json --out data/synthetic/<set>
    # the SECOND ENGRAVER (Round 3 Lever 4): real LilyPond renders the SAME labels — needs
    # `brew install lilypond` (2.26), decides nothing itself, and draws no lyrics/repeats/nav
    # marks/slur distractors, so it is a pilot arm and not a corpus. Result: docs/METRICS-ENGRAVER.md
npx --yes tsx tools/render/verify-labels-ly.ts --strips data/synthetic/<set>   # that arm's OWN gate
.venv-ml/bin/python scripts/prepare_strokes.py [--analyse]  # F2's drum samples: fetch VCSL, measure, write
.venv-ml/bin/python scripts/prepare_voices.py [--analyse|--manifest]  # F1's voices: fetch VSCO 2, measure, stage for the Hub
.venv-ml/bin/python scripts/check_docs.py [--facts]       # doc structure + no-info-loss check
```

Long jobs are chunked and resumable — Ctrl-C is safe, re-running skips finished work.
