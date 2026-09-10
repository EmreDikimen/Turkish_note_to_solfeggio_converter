# Commands — Python: training, the corpus, and the slicer

purpose: the full reference for every `.venv-ml/bin/python` command — the slicer, the emitter, the review queues, the scorers and the probes — with the ⚠ traps that make one fail silently
audience: anyone about to run anything on the model or the corpus; the app's own commands are next door

updated: 2026-09-07

Split out of [COMMANDS.md](COMMANDS.md) on 2026-09-07 when that file crossed the 400-line cap. Genre
split: that file keeps the **app** — the dev servers, the browser gates, the deploy, the visit
counter; this one keeps **Python, which never ships**. Nothing was changed in the move.

> ⚠ **Read the ⚠ lines, not just the command.** Several of these have a failure mode that looks like
> success — a scorer that reports a false regression, a cache that describes crops the slicer no
> longer cuts, an emit that silently drops the labels you meant to promote.

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
.venv-ml/bin/python scripts/rung3/budget_tail_probe.py
    # where should the label budget SIT? Free — tokenizes labels that already exist. Reads
    # emit_responses.json, NOT the manifest: the question is about the strips the gate threw away.
    # Answer (owner, 2026-09-07): 80 under scheme H, where every earlier pool used 59. 59 was never
    # a model limit — the ceiling is 100 (decode.ts MAX_TOKENS, data.collate), and past it a label
    # is TRUNCATED at 99. ⚠ The gate lives in FOUR files and they move together: the emitter,
    # audit_coverage.py, promote_labels.py --vocab, train.py --select-max-length.
.venv-ml/bin/python scripts/rung3/token_scheme_probe.py [--checkpoint <ckpt>] [--json-out f.json]
    # what a note-spelling scheme costs, BEFORE any training. No GPU, no model, no decode; ~2 min.
    # Encodes every label in strips_v7_final + strips_b8 + the over_budget labels emit_responses.json
    # kept, under three vocabularies (today / B / H), and reports lengths per pool, strips rescued,
    # whether synthetic still covers the real length range, and how each pitch segments.
    # ⚠ Run it before adding ANY token: ids are append-only, and this is what caught `''` and `'''`
    # being used zero times under H (2026-09-06). Results: docs/rung3/tokenization.md.
.venv-ml/bin/python src/vision/eval_omr.py --checkpoint data/checkpoints/<ckpt> [--strips-dir …]
.venv-ml/bin/python src/vision/decode_page.py <page.png> --checkpoint <ckpt> --onnx-dir <dir> --suffix _int8
.venv-ml/bin/python scripts/rung3/build_handtest_queue.py --mapping <pages.tsv>
    # the OWNER'S HAND-TEST pages as a review queue (queue id `handtest`): decode them first with
    # decode_page.py --out data/real/rung3/_handtest, then build. ⚠ NOT gold and NOT the exam —
    # `label` is empty on every row and the filename is neither emit_review.csv nor full_audit.csv,
    # so promote_labels.py cannot read it. Verdicts are a CORRECTION COUNT: ok = the model read it
    # right, fix = the model was wrong, bad = the crop is unusable. Corrections per page = rows that
    # are not `ok`. Re-running carries verdicts across by strip name — but NOT across a re-slice,
    # because the crop moves and the verdict was given against pixels.
.venv-ml/bin/python scripts/rung3/review_ui.py            # labeling/verdict UI → localhost:8377
    # ⚠ THE HINT COLUMN IS NORMALISED ON READ, NEVER ON DISK: the retired \tie is dropped and a
    # spaced `32` is re-glued (2,914 rows over 25 queues, every one verified id-identical in both
    # vocabularies). The model writes `f'' 32` because the base alphabet has no digit 3 — scheme H
    # removes the cause. ⛔ 32 ONLY: 16 and 8 DO differ in id space. docs/rung3/tokenization.md
    # ⚠ THE EDIT-BOX LINT PRICES IDS UNDER THE QUEUE'S OWN VOCABULARY, and it says which one
    # on screen (`= 42/80 ids (vocab h)`). The h1-* queues are scheme H, everything else is
    # the old alphabet; the list and the budget are IMPORTED from src/vision (data.py,
    # audit_coverage.MAX_IDS_BY_VOCAB), never copied into the UI. A new H pool needs its queue
    # id adding to QUEUE_VOCAB or the lint will price it with the wrong alphabet.
    # ⛔ THE RETIRED `\tie` IS DROPPED FROM THE `decoded` HINT ON THE WAY TO THE BROWSER, so a
    # reviewer cannot read it, diff against it, or store it with `✓ accept` (which saves the
    # decode verbatim). The CSV keeps it: `load_queue(clean=True)` is asked for by the two READ
    # paths only, never by save_verdict, so no file is laundered a verdict at a time. The
    # Round-2 exam queues (exam-fix, examv2-*) are EXEMPT — their ties are the record.
.venv-ml/bin/python scripts/rung3/repair_realval_v2.py --report | --queue | --build
    # `_realval_v2` carries 157 rows out of the OLD pool with the CURRENT crop under them —
    # build_realval_v2.py copies strip_root's PNG for every carried row and never compares the
    # measure span. --report classifies (keep / drop-duplicate / re-home-by-span / needs-a-human),
    # --queue writes the 10-row `realval-repair` queue, --build assembles `_realval_v2r`.
    # ⛔ --build REFUSES while any review row is unverdicted. ⚠ `_realval_v2` is left intact:
    # every Round-3 number was measured on it. docs/METRICS-SLICER-ROOTS.md
.venv-ml/bin/python scripts/rung3/verdict_attribution.py [--active-only] [--retired]
    # Splits the owner's verdicts into "the LABEL was wrong" vs "the MODEL was wrong", by error
    # kind, from data already on disk — no model runs. ⚠ --active-only is the ANCHORING CONTROL and
    # is usually the number you want: the edit box is seeded with the label's \sig plus the
    # decode's notes, so on a passive row `truth` equals the seed by construction and the
    # attribution restates the seeding. Only 7-28% of rows were actively re-typed.
    # ⛔ Counts are in LABEL-TOKEN space (error_taxonomy.relabel), never eval_omr edit counts.
    # docs/METRICS-ATTRIBUTION.md
.venv-ml/bin/python scripts/rung3/build_ndhigh_queue.py [--n 40]
    # Stages a RANDOM sample of the 1,678 dense strips b8 dropped as over_budget and h1 drops as
    # nd_high, as review_ui queue `ndhigh`. ⚠ Random, NOT worst-first — every other queue here is
    # worst-first to harvest labels; this one is read for a RATE, so ordering would bias it.
    # `label` is empty (a dropped strip has no stored label), so it settles one question: does the
    # model read dense material correctly. ⛔ Not gold; refuses to overwrite an existing file.
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
.venv-ml/bin/python scripts/rung3/emit_strip_labels.py ... --vocab h --rail-plan
    # …then the SAME command with --rail <out>/emit_rail.json instead: Round 4's label-budget rail
    # in its two runs (docs/rung3/round4.md step 5) — run 1 PRICES every candidate sub-range of
    # every over-budget window and cuts nothing, run 2 splits only the windows that failed.
    # ⚠ `--vocab` must MATCH across the two, and every page the plan names is RE-DECODED (the GPU).
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
.venv-ml/bin/python scripts/check_docs.py                 # doc structure check (--facts is GONE, 2026-09-06)
```

Long jobs are chunked and resumable — Ctrl-C is safe, re-running skips finished work.
