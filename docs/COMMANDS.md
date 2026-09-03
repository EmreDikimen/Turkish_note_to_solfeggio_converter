# Commands — every command this project has, with its traps

purpose: the full command reference, including the ⚠ traps that cost real time to learn
audience: anyone about to run anything; `../CLAUDE.md` keeps the everyday few and points here

updated: 2026-09-03

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
                                     # …plus the written-score → performance maps (tools/core/structure-test.ts)
npm run check:fold                   # every cached page decode: does keeping the repeat SIGNS change the sound?
                                     # …expect 1720 pages, 0 changed. Needs data/real/strips_v2 (this machine only)
npm run smoke:editor                 # real app: select, drag, delete, undo/redo, the palette, rests, tuplets
npx tsx tools/core/clarinet-chart.ts out.html   # sol klarnet: all 33 fingerings as one HTML page, for a player to audit
npx tsx tools/core/clarinet-editor.ts out.html  # …and the editor that produced the table: click points per note, copy the JSON back
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
.venv-ml/bin/python src/vision/page_to_strips.py <page.png> --out <dir> --debug
    # slice ONE page and write the overlay. `<page>_debug.png` legend: GREEN = detected staff lines,
    # BLUE = an accepted barline, RED box = a strip crop, and the rejects colour-coded by WHY —
    # ORANGE gate2_fat, AMBER gate2_ends, YELLOW gate3_blob, PURPLE gate3_clef, GREY xrange. ⚠ A row with NO blue line
    # found no barline at all and is being cut by WIDTH, straight through the music.
.venv-ml/bin/python scripts/rung3/score_slicer.py --sample 25   # ⚠ a 124-row SAMPLE, see below
.venv-ml/bin/python scripts/rung3/score_slicer.py              # the real instrument: 6,440 rows, ~30 min
.venv-ml/bin/python scripts/rung3/score_slicer.py --pair-by-position
    # ⚠ REQUIRED for any change that adds or removes a STAFF. Both row-level scorers pair a row to
    # its cached truth by SYSTEM INDEX, so a pass that inserts a staff shifts every later index and
    # scores each row against another row's answer — a large FALSE regression, not an error. This
    # re-pairs by vertical position and reports the added rows separately (they cannot be scored:
    # the truth is aligned from the OLD pipeline's decodes, which never saw them).
    # ⛔ `score_barlines.py` has the SAME coupling and NO equivalent flag — its hand marks are keyed
    # to detected rows. Across a staff change `bozukNihavendLonga` read 30 marked before and 3
    # after. Do not quote it across such a change. docs/METRICS-SLICER.md.
    # measure-count regression against SymbTr truth, no model. ⚠ Its truth comes from aligning the
    # OLD pipeline's decodes, so a row that pipeline never read is ABSENT — the blind spot is
    # exactly the faded rows a slicer fix rescues. Read it beside the two below, never alone.
    # ⚠ `--sample` has NO default and the sampled form is what every score quoted before
    # 2026-08-25 evening used — 86/124, 82/124, 86 -> 83. At 124 rows a 3-4 row difference is not
    # separable from noise, and the full run reversed one such call (BAR_FADE). PRICE A GATE CHANGE
    # ON THE FULL RUN. ⚠ It does NOT call `window_cache_ok`, deliberately: its `old_*` column IS the
    # retired pipeline's cache, so the geometry guard does not blind it.
.venv-ml/bin/python scripts/rung3/build_barline_truth.py && open data/real/rung3/_barline_truth/mark.html
    # cut the hand-marking sheets, then click every printed barline
    # (n/p = row, f = fit to window, c = clear the row, s = save)
    # ⚠ The row list is INLINED into mark.html on purpose — a browser refuses `fetch` from a file://
    # page, and the first build rendered a BLANK sheet with nothing in the console to say why.
    # and drop `barline_truth.json` back into that folder. ⚠ Mark ALL of a row's barlines, not just
    # the missed ones, or precision cannot be scored. ⚠ Do NOT mark where a staff starts and stops —
    # the slicer always emits those two boundaries itself, so they test nothing and are dropped. ⚠ The sheets deliberately show NOTHING the
    # slicer found — a marker shown the answer anchors to it, the same rule the exam gold lives by.
.venv-ml/bin/python scripts/rung3/score_barlines.py
    # what the measure count cannot say: RECALL, PRECISION, and for every miss WHICH GATE rejected
    # it — or `never_a_candidate`, meaning gate 1 (continuity + touching both staff lines). Honours
    # the slicer's env flags, so it A/Bs a gate change directly. The gate-3 ones:
    #   OMR_BLOB_LINE=0   the staff line counts as an attachment again (2026-08-24 behaviour)
    #   OMR_BLOB_FILL=0.3 how much of a row's width ink must span to BE the staff line (ships 0.4)
    #   OMR_STAFF_ROW_POS=0 gate 2's staff rows go back to fill-only, ignoring WHERE the lines are
    #   OMR_BAR_FADE=0.25 gate 1's fade tolerance, ships OFF — turned on 2026-08-25 and reverted
    #                    the same day: free on the 4 faded pages, net -76 rows at full scale
    #   OMR_END_BLOBS=0   gate 2b OFF: a stroke with wide ink at BOTH ends (a head and a beam) is a
    #                    barline again, the 2026-09-02 behaviour — METRICS-SLICER-STEMS.md
    # ⚠ Read every gate change on `score_slicer.py` too. The two instruments price different pages
    # and have disagreed on the same change more than once.
    # ⛔ AND DO NOT USE THIS SCORER ACROSS A STAFF-DETECTION CHANGE AT ALL — its hand marks are keyed
    # to detected rows, so a changed staff count renumbers them. `bozukNihavendLonga` read 30 marked
    # before such a change and 3 after. That is the instrument breaking, not the slicer.

# ---- the STAFF knobs (2026-08-26). All three ship ON except the rescue. ----------------------
OMR_STAFF_GROUP_SPAN=0   # stop repairing a system the 2.2*sp gap rule SPLIT (ships ON)
OMR_STAFF_SPAN_FIX=0     # stop trusting a staff's HEIGHT over its own measured spacing (ships ON)
OMR_STAFF_RESCUE=1       # re-detect a staff in the bands the page's row pitch says are EMPTY.
                         # Ships OFF; +320 rows on 227 of 1,592 pages, all 6,440 scored rows
                         # unchanged. It is ON in the slice inspector only — a row the slicer never
                         # found leaves NO crop, so that is the one view that can show you it.
    # ⚠ Each must move together with its `apps/web/src/omr/slicer/constants.ts` twin or the app cuts
    # differently from the training data. docs/METRICS-SLICER-STAFF.md.
npx tsx tools/vision/parity/rescue-check.ts
    # does a BROWSER-ONLY toggle actually fire? Drives the real slicer harness in headless chromium
    # and prints staff counts per page with the rescue off and on. It exists because `STAFF_RESCUE`
    # is a compile-time constant flipped through a setter, so no Python run can test it — and
    # because a `parity:slicer` pass with a flag OFF executes none of the flagged code.
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
.venv-ml/bin/python scripts/rung3/carry_old_fixes.py [--apply]
    # Finds the RETIRED pools' 1,479 hand corrections again inside strips_b8 and marks them with
    # oldfix / oldfix_kind / oldfix_src, which the review UI's `⭐ old human fix` filter reads.
    # ⛔ Matches on the MEASURE SPAN the slicer recorded — (page, system, meas_from, meas_to) from
    # each crop root's <page>_manifest.json — NEVER on the filename: 248 fixes name a strip that now
    # holds different music. A page whose two slicers disagree on staff-row count is refused.
    # ⚠ A carried fix is a SUGGESTION, never a verdict: a span match is the same BARS and never the
    # same pixels (0 of 1,215 crops byte-identical). Writes no verdict; --apply is idempotent, backs
    # up to .bak-oldfix, and is safe with the review UI open. Report only without --apply.
.venv-ml/bin/python scripts/rung3/unaccept_sig.py --sig-has '\komaSharp' [--dry-run]
    # Sends MACHINE-accepted strips back to pending when the label's \sig block carries the given
    # accidental — because there "label agrees with decode" is circular: the signature is the one
    # part of a label the MODEL voted on. Never undoes a human read. It was run on b8-full and the
    # owner then corrected 12 rows, all 12 carrying a \sig block (docs/BACKLOG.md item 9).
.venv-ml/bin/python scripts/rung3/auto_accept_agree.py [--dry-run]
    # b8-full: draft `ok` (by=agree) on every pending row whose LABEL and model DECODE are the same
    # token-for-token, and carry the 201 hand-read b8-audit verdicts in first. 2,896 drafted / 842
    # left pending (2026-08-27). ⚠ A DRAFT IS NOT A READ — agreement was right on 94% of the rows a
    # human has read and the misses clump on one page, so spot-check in the UI's
    # `🤖 auto-accepted (agree)` filter, which lists them LEAST CONFIDENT FIRST. Undo = restore
    # full_audit.csv.bak-agree. Only still-pending rows are written, so a live UI session is safe.
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
.venv-ml/bin/python scripts/rung3/make_usul_pools.py --plan
    # the DOTTED (USUL) BARLINE's paired pools, built the same way the staccato ones were: two
    # renders of one 40-piece list differing ONLY in --usul-barline. ⚠ It does NOT re-derive which
    # pieces the coin picked — it MEASURES it, by sha256 of the two renders' PNGs, so no copy of
    # hashStr/mulberry32/USUL_BEAM_GROUPS exists in Python to drift from the renderer. Selects
    # strips whose gold carries ZERO \repstart, so "a repeat sign appeared at all" is the metric.
    # `--plan` prints the two render commands; pass the OTHER two final-render flags to BOTH.
.venv-ml/bin/python scripts/rung3/usul_falserep_score.py --checkpoint <ckpt> [--compare <ckpt>]
    # that flag's PRIMARY: the false-`\repstart` rate on the paired pools. Exists because the final
    # render carries THREE flags at once, so a general movement is unattributable — this makes two
    # of the three attributable instead of one (the concave tuplet mark has no instrument and never
    # claimed one). \repend is reported beside it, never gated with it: different glyph, different
    # place in the bar, different cause. ⚠ Prices the model's RESPONSE to the mark, not the realism
    # of USUL_BAR_RATE, which is still chosen not measured (docs/BACKLOG.md item 5).
sh scripts/make_round3_colab_zip.sh final
    # the FINAL run's upload package: corpus strips_v7_final (3 flags) + strips_b8 as the ONLY real
    # pool. ⚠ The four ARMS keep the retired pools on purpose — that is what they trained on — so the
    # pool set is per-arm, not global. The render_config gate now checks usulBarline and concaveTuplet
    # against the arm's wanted value instead of refusing them outright. Notebook:
    # notebooks/round3_final_colab.ipynb (the staccato notebook is that ARM's record — do not edit it
    # into the final run).
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
    # [--usul-barline] opts INTO the DOTTED (USUL) BARLINE (2026-08-31): a light dashed rule on the
    # usul's own beat groups INSIDE the bar (aksak 9/8 = 2+2+2+3 -> three rules), which Turkish
    # editions print and this corpus had never drawn — so the model reads one as `\repstart`.
    # Label-free: 188 strip labels over 4 scores are byte-identical with it on and off. Coined per
    # PIECE, not per bar. Off by default and it belongs to the FINAL model's render, like the two
    # flags above. Previews of all three: data/synthetic/_flag_preview/.
npx --yes tsx tools/render/stitch-test.ts                 # expect ALL PASS, 218/218 round-trip
npx --yes tsx tools/render/verify-labels.ts --strips data/synthetic/<set> [--thin-sharps] [--staccato-noise] [--concave-tuplet] [--usul-barline]
    # ⚠ PASS EVERY FLAG THE CORPUS WAS RENDERED WITH. The verifier renders its own comparison
    # pixels, so a gate run without them is checking a different picture than the corpus ships.
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
