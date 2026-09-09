# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-09-09

## Now

⭐ **THE APP IS PUBLIC. The owner put the live link on LinkedIn on 2026-09-05** —
<https://komavision.netlify.app>. This **overturned the standing gate**: every plan in this repo said
the public launch waited on the exam result of the round in progress. It did not wait. That was the
owner's call; the point of this entry is that three risks written as *future* are now *live*, and
**none has been acted on** (owner, 2026-09-05: *"bir şey yapmana gerek yok"*).

1. ⛔ **Cloud Run capacity is no longer hypothetical.** Since 2026-09-04 the app reads **nothing** on
   the visitor's machine — a cold or dead server shows `server-unavailable` instead of falling back
   and pulling 211 MB of graphs. A cold start measured **38.2 s**; `--max-instances` is **10** at
   concurrency 1, so an over-capacity request **queues** rather than failing fast, and
   `WARMUP_WAIT_MS` was raised 40 s → **120 s** to cover it. ⏭ **`--min-instances 1` is the owner's
   open call** — it removes the cold start and costs money continuously.
   [mvp/deploy-ops.md](mvp/deploy-ops.md).
2. ⚠ **Visitors read with ROUND 3 RUN A `best-real`**, staged 2026-09-03, revision
   `omr-decode-00006-7wq` at 100% of traffic. **Verified by hash, not memory.** ⛔ **This file and
   CLAUDE.md both said "still Round 2" and both were wrong** — the claim reasoned about
   `VITE_WEIGHTS_URL`, which governs the BROWSER's weights, and the browser has read nothing since
   2026-09-04. The model a visitor meets is the one the Dockerfile bakes into the Cloud Run image out
   of `apps/web/public/models`. ⚠ Run A was the **hand-test** pick, not an exam pass; the exam floor
   is unmet and the dense-page failure below is still silent.
3. ⚠ **Nobody has looked at the phone with their own eyes.** The phone CSS shipped 2026-09-04 and its
   only coverage is `npm run smoke:phone`, a probe that **never exits nonzero**. LinkedIn traffic is
   phone-heavy. ⏭ `npm run smoke:phone`.

⏭ **NOTHING IS COUNTING YET, AND THE LINK IS LIVE.** The site can count its own visitors
anonymously — openings vs pages actually read, distinct devices, country, browser, robots apart — but
`STATS_SALT` and `STATS_TOKEN` are unset, and an unset salt records **nothing** by design. Every
visitor from that post goes unrecorded. This is the one entry here that a single command would
change. **Owner:** set both, `npm run deploy:app`, read with `npm run stats:ui`, and open the site
once as `?nostats=1` on your own devices. [features/visit-stats.md](features/visit-stats.md).

⭐ **ROUND 3 IS CLOSED AND ROUND 4 IS OPEN (owner, 2026-09-03).** The exam read **51%** against a floor
signed at 75%, on a Round-2 baseline of 44%; ~15 of its +17 points was the retired `\tie`, and every
class the three render flags targeted came out flat or slightly worse. Runs A and B were nulls on
real-val, and the checkpoint selector picked wrong in all three runs. ⚠ **The owner's hand test
disagrees with the instruments and outranks them for the ship call** (*"exam ve evaluationlar o kadar
fazla şey söylemiyor"*): Run A `best-real` reads visibly better than both `r3-final-stage2-last` and
Round 2. Not a contradiction — real-val's ~±0.13 edits/strip hides any gain under ~5%, and the exam
drops **41%** of its candidates, the wide and dense strips a whole page shows.
Plan and evidence: **[rung3/round4.md](rung3/round4.md)**; plain English:
[OVERVIEW-ROUND4.md](OVERVIEW-ROUND4.md).

**Round 4 in one line:** **no new render**, **`\tupend` stays**, **stage 2 at 4,000 steps**; re-emit
the real pools under **scheme H** note-spelling tokens (✅ confirmed by the owner 2026-09-06 at **16
new ids, vocabulary 116**) at a gate of **80 ids, not 59** (owner, 2026-09-07) — ✅ **DONE
2026-09-07 and it moved less than planned: the pool is 4,460 rows, not the 7,437 forecast**, because
the binding gate turned out to be the referee, not the budget (below); stop the signature vote
overwriting silently; select
checkpoints on real-val **corrections**, not loss; beam search measured offline first and **never on
the user path unless it pays**; a 20–40 page **third-source probe** before any crawl. ⛔ **Three
things the round may NOT do**: read the exam again for an A/B, retire `\tupend` or add a
`\dottedbar` token, and **re-pack the synthetic strips** — that was proposed, approved and withdrawn
on 2026-09-06 when the measurement showed it fills the label range by making crops wider, which
[METRICS-GEOMETRY.md](METRICS-GEOMETRY.md) prices as costing edits.

✅ **STEP 1 IS DONE (2026-09-06) and it changed two things.** `scripts/rung3/token_scheme_probe.py`,
~2 minutes, nothing re-decoded. Scheme H is **116 ids, not 118** — `''` and `'''` are used zero times
over 450,456 notes, and ids are append-only, so that was the last cheap moment to catch it. The
rare-pitch segmentation trap does **not** fire, and split evidence improves (1.277% of notes in a
minority id form today → 0.003%). ⚠ **The one risk H carries is real and is now watched, not fixed**:
synthetic labels stop at 44 ids while real ones reach 59, so 887 real strips (11.9%) are longer than
anything synthetic. Long-strip errors become their own column when the H arm is read.
[rung3/tokenization.md](rung3/tokenization.md).

⛔ **THE SHIPPED APP RETURNS SILENTLY WRONG NOTES ON DENSE PAGES.** The browser slicer has **no
label-budget rail**: at training an over-budget strip is dropped, at inference there is none, so the
model emits `</s>` early and **confidently**, and `hitCap` catches almost none of it. ⛔ **The rail
ALONE is a wash** — but that tested inference on a model never trained under the rail, and dense
music already reads twice as badly even in a 1-measure strip, so it is a training gap, not a cutting
one. The settling experiment is the **pair** (re-emit with the rail → train → measure), and it is
part of Round 4. ⚠ **The rail gates on the label's TRUE id count, not on an estimate** — the earlier
plan's "b = 57" was the packer's character-count estimate, whose residual sd is ~30 ids; the shipped
rail asks the emitter instead. ⭐ Deferring it is what keeps the shipping slicer still, so
`examv3` stays valid. [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) ·
[BACKLOG.md](BACKLOG.md) item 0.

⚠ **`GEOMETRY_REV` → 20260903: EVERY DECODE CACHE ON DISK IS REFUSED**, because two slicer fixes moved
crop boundaries the same day — a closing `:|` read as two barlines (`OMR_TAIL_SPAN=0` restores) and a
note stem taken for a barline (`OMR_END_BLOBS=0` restores). ⭐ **`--frozen-crops` is the one way past
that refusal and it does not cheat**: it re-uses the crops as well as the cache, so no re-cut can put
new pixels under an old decode, and it drops a piece whose page has no cache rather than slicing one.
Round 4's pool was emitted that way; nothing is owed today. [METRICS-SLICER-FRAME.md](METRICS-SLICER-FRAME.md) ·
[METRICS-SLICER-STEMS.md](METRICS-SLICER-STEMS.md).

⏭ **THE SLICER IS FROZEN — treat it as frozen unless the owner says otherwise.** ⭐ **A whole staff row
goes missing on 14% of pages and `STAFF_RESCUE` is the fix, SHIPPING OFF**: a lost row is not a bad
crop, it is **NO crop**, so no accuracy metric has ever shown it, and its benefit is **unscoreable,
not merely unmeasured**. ⛔ **The row-level instruments are blind to staff-count changes** — both pair
a row to its cached truth by *system index*, so an inserted staff reports a large regression that is
pure artifact; `score_slicer.py` gained `--pair-by-position`, **`score_barlines.py` has the same
coupling and NO fix**. ⚠ The freeze was lifted twice on 2026-09-03 at the owner's request, both priced
on full 6,440-row runs, both a clear gain; nothing is owed. Mechanism and rules:
[../CLAUDE.md](../CLAUDE.md). Numbers, and the lesson that the faded-page table has now mispredicted a
full run three times: [METRICS-SLICER.md](METRICS-SLICER.md) ·
[METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md).

⏭ **COLLECTION IS NARROWED TO TWO TARGETS, not broadened.** 2,486 unlabelled page PNGs already sit on
disk, so volume relieves nothing. What it cannot substitute for: pages drawing the **concave tuplet
mark** (unscoreable — no labelled real strip carries it) and **tuplet-dense instrumentals** (sirto,
longa, saz semaisi). ⚠ The second does **not** fix itself — the same budget drops the new pages.
⚠ **A THIRD target, DEFERRED not dismissed**: every page we own is from **two websites**, exam
included ([BACKLOG.md](BACKLOG.md) item 10).

✅ **ROUND 3'S SIGNED ACCEPTANCE BAR STILL GOVERNS WHAT MAY BE PUBLISHED AS A MODEL** (owner,
2026-08-15): **≥75% of exam pages needing ≤5 corrections**, with the accidental measures as
no-regression clauses. Written before any Round-3 training and **not re-opened after the read** — a
miss is a miss. ⚠ It is **no longer the public-launch gate**; the launch went ahead of it. ⚠ Report
the primary **with its interval**: at 67 pages the 95% half-width is ~±10.4 pp. ⚠ And the ship call is
a **human judgement taken after reading an error classification** (`error_taxonomy.py`), never the
numeric floor alone. [rung3/round3-criteria.md](rung3/round3-criteria.md).

## Next

**The two tracks run in parallel** (re-scoped 2026-08-05): the product track never trains, the model
track never touches the app, and neither waits for the other. [mvp/README.md](mvp/README.md).

### Track A — the product

⏭ **The next product action, and the only one needing a person, is
[MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) checks 25–29** — five shipped things no eye has
judged. Run them via `npm run dev:cloud`, then deploy if they pass.

| # | Check | The question it answers |
|---|---|---|
| 25 | the violin view | Does the dot sit where your finger would? Open strings are the free calibration — the dot must be **at** the nut. Do the position lines read as information or as clutter? |
| 26 | the kanun view | Is the opening mandal plan one you would actually set? Does the flash last long enough to catch? Is the close-up needed every time (if so its default should flip)? |
| 27 | the editable signs | Does marking a page up FEEL like marking a page up? |
| 28 | the playhead follow | Does the jump land where a reader wants to be looking? |
| 29 | the pinned Çalma row | — |

⚠ Do **not** report the violin's thin high positions as a finding: ~7 px per koma near the nut is the
shipped photo's known limit, and a higher-resolution bare-neck image fixes it with no code change.
⚠ If a look finds something, the fix needs its own deploy (`deploy:app`, then `smoke:live`).
⚠ `smoke:live` checks neither images nor audio — spot-check both by hand after any deploy touching them.

🚧 **TWO things are built but NOT deployed, and both ride the next `deploy:app`.** (a) **The first
ending now sounds once, on two repairs to what the model read** (2026-09-07, owner heard it on the
app): a `\volta2` after the `:‖` is proof of a first ending even with no "1." decoded, and a "1."
printed PAST the `:‖` is a "2." — a first ending lies inside the repeat by definition. Together:
first endings resolved **1,052 → 1,225**, played bars **64,859 → 64,672**, and the live site still
replays them ([DECISIONS.md](DECISIONS.md), [METRICS.md](METRICS.md)). (b) **the sol klarnet's lip
meter** (2026-09-04). ⏭ Then the **altissimo**, Re♭6–Sol6, seven fingerings the owner is filling in.
⚠ `smoke:editor` covers the clarinet VOICE, not the VIEW; its DOM contract is unasserted, unlike the
kanun's and the violin's. [features/clarinet-view.md](features/clarinet-view.md).

⏸ **Everything about SPEED is deferred to after W10** (owner, 2026-08-06): ship at **~35–55 s a page**.
Splitting a page across instances (~52 s → ~13 s) is the only option that touches the warm wait, and
it costs a rate-limiter rewrite plus a chunked-vs-unchunked parity check. **The trigger to build it is
a friend saying the wait is annoying.** [mvp/latency.md](mvp/latency.md).

⏭ **Cheap, independent, still open:** read the request log now that real users exist. "Every human so
far was on a phone" rests on **n=2** and cannot be more than a question; `/decode` is the honest
counter (`/health` fires on every page open, robots included). "Web first, mobile later" is a **plan**,
not a finding. [METRICS-USAGE.md](METRICS-USAGE.md).

⚠ **Traps left behind by finished work**, now living elsewhere: `deploy:app` needs
`--filter @turkish-omr/web` or `netlify-cli` publishes **nothing** after a successful build
([mvp/hosting-setup.md](mvp/hosting-setup.md)); **`dev:cloud`, not deploying, keeps the Mac cool**;
voices ride **`VITE_VOICES_URL`** and setting `VITE_AUDIO_URL` in a deploy 404s the drums into
synthesis, silently ([../CLAUDE.md](../CLAUDE.md)); ney has **no** CC0 source and oud and tanbur stay
Karplus–Strong, and any instrument past those is aimed by what the friends say next — **not a queue to
work down**; if the voices should be louder the order is per-voice `gain` → a `Çalgı sesi` slider →
**never** `MASTER_GAIN`.

### Track B — the model (Round 4, open 2026-09-03)

Still the gate on what may be **published as a model**. Plan, evidence and the owner's decisions:
**[rung3/round4.md](rung3/round4.md)**.

| role | pool | state |
|---|---|---|
| real training | ✅ **`strips_h1` — 4,460 rows**, b8 re-emitted under scheme H at a budget of 80 with `--frozen-crops`: not one page re-sliced, so b8's 980 human reads carried in under a per-row inode+label proof. `over_budget` 4,012 → 141, but only +588 of the returning strips reached training (the `nd` referee gate is what now drops them) and the rail added 35 | ✅ **RUN 2026-09-07**. ⏭ owner reads the 100-row `new_dense_sample` |
| synthetic training | **`strips_v7_final`, unchanged** — no render this round (owner) | ✅ on disk |
| selection | ⛔ **`_realval_v2` IS BROKEN AND IS BEING REPAIRED** — 10 of its 262 images carry a label about music that is not in their picture (`build_realval_v2.py` put current crops under labels read against retired ones). The repaired pool is **`_realval_v2r`**; (+ `_tupletval`), on free-running corrections, not loss, beside the owner's hand-test pages | ⏭ **owner reads the 10-row `realval-repair` queue**, then `repair_realval_v2.py --build` |
| grading | `examv3` as the comparable column; a dense extension and a third-source set as **separate** columns | ⏭ decide before the read |

⛔ **Out:** `b8-review`; `strips_oldhuman` (Run B answered it — nothing measurable); the raw old pools.
`batch3` / `reslice-all`'s hand corrections become usable only through the rail, which is part of the
re-emit.

⏭ **In order:** ✅ the length/segmentation check under H (**done 2026-09-06**, render question
stays closed) → ✅ the `train.py` selector, EMA and label smoothing (**built and smoke-tested
2026-09-06, nothing trained**) → ✅ the signature vote **measured and rule D built 2026-09-06**
→ ✅ the third-source probe **read 2026-09-06 — a NULL** → ✅ **the re-emit is DONE
(2026-09-07): `strips_h1`, no GPU, no re-cut, and the yield claim corrected** → ⏭ **the owner reads
the 100-row sample** → two arms from base (old-vocabulary control vs H — the control now loses only
**4** rows to the 99-id cliff, not 769; run at the default `--real-val-frac 0.10`, since 17 selection
pieces cross into training at 0.05), stage 2 at 4,000 steps → real-val paired → `examv3` once.

⭐ **THE LABEL BUDGET IS 80 IDS UNDER SCHEME H, DECIDED 2026-09-07** (owner, from three `examv3`
strips they had hand-corrected: *"85-90 id den oluşan striplere kadar model doğru bir şekilde tahmin
edebiliyordu"*). ⚠ **59 was never a model limit** — it is the emitter's quality gate; the real
ceiling is **100**, in `decode.ts`'s `MAX_TOKENS` and in `collate(max_len=100)`, which TRUNCATES a
longer label at 99 and teaches the model to stop early. Measured over b8's 15,758 serialized labels:
median 42 → **24** ids under H, and over the gate **504 (3.20%) at 59 against 148 (0.94%) at 80**, so
**356 dense strips train whole**. On the 579 labels the owner hand-typed into `examv3` the longest H
label is **67 ids**. ⚠ **Four files hold that gate and must stay in step** — the emitter,
`audit_coverage.py`, `promote_labels.py --vocab` and `train.py --select-max-length`. ⚠ It widens the
one risk this round already watches: synthetic labels stop at **44** H ids. ⛔ **BOTH FORECASTS ABOVE
WERE OVERTAKEN BY THE RE-EMIT (2026-09-07)**: the 504-vs-148 split and the 769 strips the control arm
could not hold were priced over a 15,610-strip pool the `nd` gate never let exist. In the pool that
actually came out, the rail re-cut **141** windows, the longest H label is **51 ids** (so the 80 gate
binds nothing), and **4** rows — not 769 — exceed 99 under the old vocabulary.
[METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) · [DECISIONS.md](DECISIONS.md).

⭐ **STEP 5 IS RUN, AND IT NEEDED NO GPU — THE RE-EMIT RE-CUT NOTHING** (owner, 2026-09-07:
*"o stripler hala kullanılabilir halde, atmayalım"*). The planned Colab decode was priced first: on
30 pages re-cut with today's slicer **20 cut differently and 15.3% of the strips carrying a LABEL
changed pixels**, i.e. ~600 of the owner's reads invalidated, because a verdict is given against
pixels. ⭐ **The yield comes from the TOKENIZER, not a new cut**, so `--frozen-crops` re-uses the
crops and the 1,720 legacy caches and slices nothing — the one exception to the refuse-a-legacy-cache
rule, safe only because nothing slices ([../CLAUDE.md](../CLAUDE.md)).

**The pool is `data/real/rung3/strips_h1`, 4,460 rows** (b8: 3,929). b8's verdicts carried in under a
per-row inode+label proof: **3,864 of 3,956, 980 of them human reads, 0 refused**.

⛔ **THE ROUND'S HEADLINE YIELD CLAIM IS DEAD, AND WHAT KILLED IT IS A SECOND GATE.** `over_budget`
collapsed as forecast (4,012 → **141**), but of the ~3,871 strips that returned only **+588 reached
training**: ~1,739 went to review, ~1,648 dropped as `nd_high`. A strip over the budget is a DENSE
strip, and `nd` asks the referee to read exactly the material this round opened *because the model
reads it badly*. ⛔ **A better referee does not fix it**: `r3a-stage2-best-real` — fair here, those
strips were never trained on — read **38.2%** of a 12-piece pilot differently and moved acceptance
**33 → 32**. ⚠ **The rail's own yield is +35 strips (+0.8%)**, not the ~282 its 141 windows allowed.
⭐ What did land is aimed right: the new rows carry a median **18 label tokens against 11**.
[METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) · [rung3/round4.md](rung3/round4.md).

⏭ **Owner:** a 40-row random sample of the **1,678** strips `b8` dropped as `over_budget` and `h1`
drops as `nd_high` is staged as queue **`ndhigh`**. They are the dense material this round reopened
(median **49** ids of music in the crop against **37** accepted) and **nobody has read one**. ⚠ `nd`
cannot say whether a high value means the model misread a dense strip or the label names the wrong
measures; on EXAM pieces 75 hand-read rows say it is overwhelmingly the label, but the general
`nd_high` population is **not** dense, so that does not transfer. A high `fix` rate here means dense
material is a training gap worth hand-labelling; a low one means the label was the problem.
[METRICS-ATTRIBUTION.md](METRICS-ATTRIBUTION.md) · [rung3/labeling-queues.md](rung3/labeling-queues.md).

⏭ **Owner:** read the seeded **100-row sample** of the 571 unread rescued strips — `review_ui.py`,
queue **`h1-full`**, filter **`new_dense_sample`**. b8's escaped-bad rate was 12.9% and nothing
measures it for this material; without that number a step-6 arm cannot separate "H helped" from
"the new labels are dirty".

✅ **STEP 3 IS DONE (2026-09-06) — the signature vote is measured AND its rule is built.** `sig_vote_audit.py` read all five
pools; every number is in [METRICS-SIGVOTE.md](METRICS-SIGVOTE.md). ⭐ **It is a DELETION problem, not
only a koma/küçük one**: 410 overrides delete an accidental against 156 that alter one, and 106 of
the deleted entries were in the SymbTr derivation — the model did not see the sign, and its silence
overwrote a correct entry. ⚠ **47% of overrides change only the drawn ORDER** and no earlier count
separated them, so "the override fired on N pieces" always overstated the damage; the real
content-change count is 690. ⚠ `strips_b8`, the real training pool, is the worst at **826 of 1,236
aligned pieces (67%)**. ✅ **RULE D IS IN `emit_strip_labels.py`** (owner, 2026-09-06): a vote that
**deletes or changes** an accidental and does not land on the makam table's **majority** spelling
(or whose makam is absent from the table) **no longer overwrites anything** — the label keeps the
SymbTr derivation and the piece's row-start strips go to review under the new reason
`sig_table_conflict`. A vote that only **adds** or **re-orders** still applies, adding being the case
the override was built for. ⚠ **Majority, not "any listed variant"**: mahur prints both spellings
(küçük 35 / koma 17), so the looser form would have vouched for the vote on **31 mahur pieces** in
exactly the direction the owner corrected 10 times out of 10. Cost: **224 pieces** to read
(~1,198 row-start strips; 84 in `strips_b8`). Unit-tested; **no pool re-emitted yet**.

✅ **THE THIRD-SOURCE PROBE IS DONE AND IT IS A NULL (2026-09-06).** **36 pieces / 53 pages /
1,108 strips** from engraving houses none of our numbers has ever seen: **sahaney.com** (born-digital
vector out of **Mus2 2.1.2**), **erdincbal.com** (TRT-edition scans, indexed by form so the
tuplet-dense sirto/longa/peşrev/saz semaisi come in) and **sarkilarnotalar.blogspot.com** (old prints,
the owner's pick). ⭐ **The pipeline does not jam**: the slicer found staves on all 53 pages, and rows
fail to align **less** often than on our own two sites (28.6% against 33.2% and 36.9%). ⛔ **But the
accuracy question is unanswered.** Raw edits/strip looked like degradation (sahaney 0.86 against our
held-out 0.13) and **the length control killed it** — sahaney's strips carry 40.6 gold ids against
our 33.5, and under 40 ids it reads 0.20 with every interval overlapping. At n = 34 and n = 10 the
probe could not have separated anything under ~3×. ⭐ **One finding that is NOT a null**: a different
engraving house packs **more music into a staff row**, which lands on the label-budget rail the round
is already changing. ⏭ **Growing it is the only route to a verdict** — more erdincbal pages need no
hand labelling (75 SymbTr accepts exist, 14 used). ⚠ The blogspot column produced **no** gold: its
titles are lyric incipits with no makam, one of its 8 pages is re-hosted from erdincbal and one is
THM folk notation. [rung3/third-source.md](rung3/third-source.md).

⛔ **THE POOL THAT PICKS THE CHECKPOINT HAD OLD LABELS WITH NEW PIXELS UNDER THEM (2026-09-09).**
`build_realval_v2.py --build` carries rows out of the previous `_realval` pool — which is entirely on
the **retired** crop root, 271 of 271 PNGs — and copies the `strips_v2` crop under them without
comparing the measure span. **10 of `_realval_v2`'s 262 distinct images (3.8%) carry a label about
music that is not in their picture**; the 5 duplicate manifest rows open since 2026-08-16 were the
symptom. ⚠ **Paired results survive** (both arms read the same wrong labels), but Round 4 gave this
pool a third job — `train.py --select-dir` picks a checkpoint on **absolute** corrections. ⭐ The
referee cost no compute: both roots hold a `round2-stage2-best` decode cache, and the hand-read
`hard` tier is the control that separates the other way. ✅ Repair built: 243 rows keep their label,
5 duplicate twins drop, 3 re-home by measure span. ⏭ **Owner: read the 10-row `realval-repair`
queue**, then `repair_realval_v2.py --build` writes **`_realval_v2r`**. ⛔ `_realval_v2` stays intact —
every Round-3 number was measured on it. ⏭ **The BUILDER is not fixed and will repeat this**
([BACKLOG.md](BACKLOG.md) item 2). [METRICS-SLICER-ROOTS.md](METRICS-SLICER-ROOTS.md) ·
[rung3/labeling-queues-realval.md](rung3/labeling-queues-realval.md).

⏭ **THE HAND-TEST SET EXISTS AND IS WAITING ON THE OWNER'S EYES.** The owner supplied 20 pages on
2026-09-06 (gitignored `exam_pages/`, outside the frozen exam); they are decoded with the live model
and loaded in `review_ui.py` as queue **`handtest`**, where `ok` / `fix` / `bad` count **corrections
per page** rather than pass labels — the page-level instrument [BACKLOG.md](BACKLOG.md) item 6 asks
for. ⛔ **Not gold and not the exam**, by two guarantees, because its `decoded` column is the live
model's own output. ⚠ **No accuracy number exists yet** — nobody has read a row.
Everything measured, and the five things it may not be used to claim:
[METRICS-HANDTEST.md](METRICS-HANDTEST.md).
⏭ **Owner:** press through the queue; the `reason` filter goes straight to the 62 suspicious rows.

⏭ **Recommended, not decided:** a fixed **10–15 page hand-test set** outside the exam, every model on
the same pages, corrections counted per page — the page-level instrument this project has never had
([BACKLOG.md](BACKLOG.md) item 6).

## Where the rest lives

None of these contains a next action.

| For | Read |
|---|---|
| Owed but not next, with the reason it is deferred — ⚠ several are deferred *because* acting would confound something in flight | [BACKLOG.md](BACKLOG.md) |
| What is measured but fragile, and what we do NOT claim — ⚠ read before quoting any number or believing any green check | [RISKS.md](RISKS.md) |
| Settled product context (W0–W9.7, the server, the shipped features) | [mvp/standing.md](mvp/standing.md) |
| Settled real-page context (real-val v2, the re-slice, the Round 2 position) | [rung3/standing.md](rung3/standing.md) |
| The feature track (drums, voices, violin, kanun, clarinet, measure card, stored pages, visit stats) | [features/README.md](features/README.md) |
| What happened on any given day, and why | [log/status-log.md](log/status-log.md) |
| Plans that were abandoned — do not act on them | [log/superseded.md](log/superseded.md) |
| Everything else | [INDEX.md](INDEX.md) |
