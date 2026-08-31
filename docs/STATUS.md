# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-08-31

## Now

⭐ **ROUND 3'S DATA IS SETTLED AND THE ROUND IS READY TO RUN (owner, 2026-08-31).** Every labelling
question is closed. Round 3 uses **four** things and nothing else: **`strips_b8`** as the real
training pool (3,936 strips after promotion), a **new 3-flag synthetic render** off
`data/pieces_v4.json` + `data/split_v4.json`, **`_realval_v2`** (+ `_tupletval`) to select the
checkpoint, and **`examv3`** to grade. ⏭ **`b8-review`, the old human fixes, `batch3` and
`reslice-all` all go to ROUND 4** — the last two could not join anyway, see below.
[rung3/worklist.md](rung3/worklist.md) · [rung3/labeling-queues.md](rung3/labeling-queues.md).

✅ **THE EXAM IS FINISHED — `examv3` is 663 of 663 verdicted, all 64 pages PAGE-COMPLETE** (573 fix /
61 bad / 29 ok), on top of the 139 `examv3-full` rows read on 2026-08-21. **B0 no longer blocks the
read.** ⏭ It still has to be promoted (`promote_labels.py --exam --strips-root
data/real/strips_examv3` — the default root holds the same filenames with the RETIRED slicer's
pixels), and that manifest then **replaces** `strips_exam_v2_clean` as the exam.
[rung3/exam.md](rung3/exam.md) · [METRICS-EXAMSET.md](METRICS-EXAMSET.md).

✅ **`b8-full` IS READ AND CLOSED (owner, 2026-08-31)** — 3,955 rows, **3,362 ok / 576 fix / 17 bad**,
of which **1,016 were read by hand**; the remaining 2,939 stand as machine `agree` drafts. The owner
accepted them, and our own sample says he is right: in the random 201-row `b8-audit`, **41 rows had
`label == decode` and a human read all 41 as `ok` — 0 wrong** (95% upper bound ~7% at that n).
⛔ **ONE MEASURED EXCEPTION, AND IT IS `\sig`.** Where the label's signature came from the model's
own vote, "label agrees with decode" is close to circular. `scripts/rung3/unaccept_sig.py` sends
such rows back to pending; it was run, and the owner then corrected **12 rows — all 12 carrying a
`\sig` block**. [BACKLOG.md](BACKLOG.md) item 9 · [METRICS-CORPUS.md](METRICS-CORPUS.md).

⭐ **THE DOTTED (USUL) BARLINE IS NOW DRAWN — the third and last flag the final render was
specified to carry.** `drawUsulBars` rules the usul's own beat groups inside the bar (aksak 9/8 =
2+2+2+3, so three rules a bar), reading the groupings already in `USUL_BEAM_GROUPS`; the coin is
per **PIECE**, because an edition either uses the convention or it does not. ✅ **Label-free, and
checked: 188 strip labels over 4 scores are byte-identical with the flag on and off.** Previews of
all three flags: `data/synthetic/_flag_preview/`. ⚠ **`USUL_BAR_RATE = 0.35` and the placement are
CHOSEN, NOT MEASURED** — counting dotted barlines in real print is still owed **before** the render;
7.8% is a statistic about the model's guesses. ⏭ It also still owes its **own paired scorer** (a
clone of `staccato_falsedot_score.py` for the false-`\repstart` rate), or two of the three flags in
that render are unattributable. [BACKLOG.md](BACKLOG.md) item 5 · [METRICS-UNSEEN.md](METRICS-UNSEEN.md).

⛔ **THE PROMOTION GATE WAS DELETING HAND CORRECTIONS, AND THE DRY RUN CAUGHT IT.** Six of the
owner's 576 `b8-full` fixes carried the model's `f'' 32` spacing; the round-trip gate read that as
two unknown tokens and failed the row — and **an audit `fix` that fails the gate REMOVES the
manifest row**, so six corrected strips would have been *deleted from training* over a form measured
to be **identical in token ids**. `norm_label` now re-glues a spaced `32`, the same rule and regex as
`build_realval_v2.py`. ⛔ **`32` ONLY — 16 and 8 DO differ in id space.** Rejects **9 → 3**; the
three left are genuinely over the 59-id cap (60, 61, 60) and are correctly dropped.

⭐ **THE RETIRED POOLS' 1,479 HUMAN FIXES WERE FOUND AGAIN — AND THE OWNER HAD ALREADY REDONE THE
WORK BY HAND.** `scripts/rung3/carry_old_fixes.py` locates them by the measure span the slicer
itself recorded, `(page, system, meas_from, meas_to)`, **never by filename**. ⚠ The key was
validated before it was trusted: where it says "same music" the real SymbTr span agrees on **1,002
of 1,026 (97.7%)**, and where it says "different", **35 of 36** really are. Of the 198 span-matched
fixes disagreeing with b8's label in `b8-full`, **122 the owner had already fixed identically** —
two independent reads, different crops, months apart, agreeing **122 of 140 (87%)**. ⛔ **A span
match is the same BARS, never the same pixels: 0 of 1,215 crops are byte-identical and 77.7%
changed size**, which is why the hint has its own accept button and plain `ok` never stores it. The
review UI's **⭐ old human fix** filter lists them, worth-first. [METRICS-CORPUS.md](METRICS-CORPUS.md).

⚠ **TWO LAUNCH FILES STILL NAME THE RETIRED POOLS, AND NOTHING DOWNSTREAM CHECKS.**
`scripts/make_round3_colab_zip.sh` (`REAL_POOLS=`) and `notebooks/round3_staccato_colab.ipynb`
(`--real-dir …:9`) both hardcode `strips_nota` / `strips_r1` / `strips_tup`. Launched as they stand,
the final run would ship the **retired crops and never see `strips_b8`** — silently. ⚠ **And `:9`
must become `:5`**: that suffix holds real at ~34% of stage-2 batches (2,097 train-side real × 9
against 36,057 synthetic = 34.4%, the figure on record); at 3,936 strips the same share needs `:5`
(32.9%), while `:9` would push real to 47% and change the recipe as a side effect. `train.py` prints
the pool counts at startup — read that line rather than trusting this one. ⚠ The zip script also
**refuses any corpus carrying `concaveTuplet`**, which the final render carries by design.

⏭ **STILL OPEN AND THE OWNER'S, AND IT MUST BE SETTLED BEFORE THE READ:** does **75%** stay as an
absolute product statement, or is it re-expressed against the Round-2 baseline re-measured on the
harder rebuilt exam? Choosing after seeing the number is the one option that is not available.
[rung3/round3-criteria.md](rung3/round3-criteria.md) §3c.

⏭ **THE FINAL RUN SAVES TWO CHECKPOINTS AND CHOOSES BETWEEN THEM ON REAL-VAL.** `best` is selected
on a val loss that is **94.6% synthetic** (4,769 strips outvoting 271, nineteen to one) in a round
graded on real pages. Rather than swap the selector mid-round, the final run keeps it *and*
additionally keeps one selected on a free-running real metric, comparing them on `_realval_v2`
**before** the exam. Legal by the standing rule: real-val selects, the exam is one-shot. ⚠ `train.py`
saves only one `best` today, so the cheap version is `best` + `last` compared on `_realval_v2` (what
the arms already did) and the full version is a code change. [BACKLOG.md](BACKLOG.md) item 3.

⚠ **THE REBUILT EXAM IS HARDER THAN THE ONE THE FLOOR WAS SIGNED AGAINST.** It grades ~12 candidate
strips a page against 7.1, so a page collects more edits at equal model quality and the primary
reads lower. Fairness is intact — the `round2-stage2-best` re-score puts both models on the same set,
and that re-score is a **precondition of the read** — but what 75% *means* changes.
⚠ **The exam also still throws away the wide and the dense — 567 of 1,369 candidates (41%)** — so it
reads each page on its easier material. Quote it with the result.
[rung3/round3-criteria.md](rung3/round3-criteria.md) §3b · [METRICS-EXAMSET.md](METRICS-EXAMSET.md).

⛔ **`batch3` AND `reslice-all` COULD NOT HAVE JOINED ROUND 3 EVEN IF ASKED.** Neither has any
promotion path, and the reason is structural: **53 of `batch3`'s 66 hand corrections sit on strips
the emitter DROPPED** (`split_wide` / `over_budget` / `row_unaligned`), as do **all 50** of
`reslice-all`'s. Making them usable IS the label-budget rail. [rung3/labeling-queues.md](rung3/labeling-queues.md).

⛔ **THE SHIPPED APP RETURNS SILENTLY WRONG NOTES ON DENSE PAGES. THE FIX IS MEASURED, SPECIFIED,
AND DEFERRED TO ROUND 4 (owner, 2026-08-23) — which is what RELEASES THE EXAM.** The browser slicer
has **no label-budget rail**: at training an over-budget strip is dropped, at inference there is
none, so the model emits `</s>` early and **confidently** — `hitCap` catches **7 of 4,012 (0.2%)**,
and **998 of 1,689 pages (59.1%)** carry such a strip. ✅ Browser-vs-Python parity is **CLOSED**
(132 pages). ⛔ **The rail ALONE is a wash** (under-fill 15.7% → 16.6%, p = 0.57). ⚠ But that tested
INFERENCE on a model never trained under the rail: a split strip *fits the 59-id emitter gate and
therefore enters training*, and today **4,012 over-budget strips are dropped**. ⭐ **Dense music
already reads twice as badly even in a 1-measure strip (9.9% vs 4.8%, p = 0.013)** — a training gap,
not a cutting one. ⏭ The settling experiment is the **pair** — re-emit with the rail → train →
measure — at **b = 57, not 50**. ⭐ Deferring it is what keeps the shipping slicer still, so
`examv3` stays valid. [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) · [BACKLOG.md](BACKLOG.md) item 0.

⭐ **A WHOLE STAFF ROW GOES MISSING ON 14% OF PAGES, AND `STAFF_RESCUE` IS THE FIX — SHIPPING OFF
UNTIL YOU SAY OTHERWISE.** The horizontal opening's kernel is **one pixel tall**, so a staff line
that wanders across rows is **erased, not weakened**; a lost row is not a bad crop, it is **NO
crop**, so no accuracy metric has ever shown it. ⛔ Every global knob was measured and rejected. ✅
What ships is a **second pass** re-detecting only in the bands the page's own staff pitch says are
empty: all **6,440** scored rows identical, **+320 rows on 227 of 1,592 pages**, `parity:slicer`
passes with the flag ON. ⚠ Its benefit is **unscoreable, not merely unmeasured**; the evidence is
visual, 14 of 14 rows on 4 pages. ⚠ `STAFF_RESCUE` must move together in Python and `constants.ts`,
and turning it on bumps `GEOMETRY_REV`. [METRICS-SLICER.md](METRICS-SLICER.md).

⛔ **THE ROW-LEVEL SLICER INSTRUMENTS ARE BLIND TO STAFF-COUNT CHANGES.** Both pair a row to its
cached truth by **system index**, so inserting a staff shifts every later index and reports a large
regression that is pure artifact. `score_slicer.py` gained `--pair-by-position`; ⛔ **`score_barlines.py`
has the same coupling and NO fix** — `bozukNihavendLonga` read **30 marked before a staff change and
3 after**. It is also why the rescue's 320 rows can never be scored there. [METRICS-SLICER.md](METRICS-SLICER.md).

✅ **THE SLICER IS FROZEN AGAIN** (owner, 2026-08-26) after three fixes landed and two were rejected
— the browser/Python staff divergence, the over-wide staff span, and `OMR_BLOB_FILL` 0.3 (measured
and **REJECTED**, with the lesson that the faded-page table has now mispredicted the full run three
times). Both shipped fixes bump `GEOMETRY_REV` → **20260826**, so every decode cache on disk is
invalid. [METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md) · [DECISIONS.md](DECISIONS.md).

⭐ **THE ARMS ARE DONE (2026-08-20) — one dropped, one null, one PASSED.** The staccato arm took its
false-dot rate **72.7% → 0.0%**, paired **60–0** (exact McNemar p = 1.7e-18), and it keeps its own
paired instrument so the claim survives whatever else moves in the render. ⛔ **ARM 2 (one measure
per strip) IS DROPPED and ARM 1 (the scan profile) WAS A NULL** — `scan_share` stays **off**.
⚠ **That is three nulls on one axis and one pass off it**: every "make the synthetic pixels look
more like real pages" arm returned null, and only the arm that showed the model a symbol it had
**never seen** moved its primary. **A hole responds to being filled; a domain gap does not** — so a
fourth realism arm does not follow, and the dotted barline counts because it is a hole.
[rung3/staccato-arm.md](rung3/staccato-arm.md) · [rung3/levers.md](rung3/levers.md).

⏭ **COLLECTION IS NARROWED TO TWO TARGETS, not broadened.** 2,486 unlabelled page PNGs already sit
on disk, so volume relieves nothing. What it cannot substitute for: pages drawing the **concave
tuplet mark** (unscoreable — no labelled real strip carries it) and **tuplet-dense instrumentals**
(sirto, longa, saz semaisi). ⚠ The second does **not** fix itself — the same budget drops the new
pages. ⚠ **A THIRD target, DEFERRED not dismissed**: every page we own is from **two websites**,
exam included ([BACKLOG.md](BACKLOG.md) item 10).

✅ **ROUND 3 HAS A SIGNED ACCEPTANCE BAR, and it is also the public-launch gate** (owner,
2026-08-15): **≥75% of exam pages needing ≤5 corrections**, against 57% today, with the accidental
measures as no-regression clauses. Written before any Round-3 training and **not re-opened after the
read** — a miss is a miss and the launch waits for Round 4. ⚠ Report the primary **with its
interval**: at 67 pages the 95% half-width is ~±10.4 pp. [rung3/round3-criteria.md](rung3/round3-criteria.md).

✅ **`\tie` IS RETIRED AND BOTH SIDES ARE DONE** (owner, 2026-08-22) — rule and numbers in
[../CLAUDE.md](../CLAUDE.md); ⚠ real-val's arc-`\tup3` diagnostic prints `n/a` (that floor is read on
the **exam**, which keeps its ties). [rung3/labeling.md](rung3/labeling.md).

✅ **TRACK A IS SHIPPED AND LIVE — <https://komavision.netlify.app>.** The 2026-08-30 deploy took out
F1's voices, F2's drums, all three F3 instruments, the sol klarnet, the **repeat drawn as a sign**
with the teslim replayed after every hâne, and a **tuplet mark you can hold**. `smoke:live` passes on
both paths. ⏭ **The next product action, and the only one needing a person, is
[MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) checks 25 AND 26** — is the finger mark in the
right place, and is the kanun's opening mandal plan one you would actually set. ⚠ The trap that
outlives F1: voices ride **`VITE_VOICES_URL`**, the drums ship with the app, and setting
`VITE_AUDIO_URL` in a deploy 404s the drums into synthesis — silently.
[features/README.md](features/README.md) · [log/status-log.md](log/status-log.md).

⚠ **Two copyright items remain open and are both the owner's call**: the samples and the neyzen.com
screenshot are out of HEAD but remain in the **public** repo's git history (clearing them needs a
`filter-repo` rewrite and a force-push), and there is still **no LICENSE file**. [THIRD-PARTY.md](THIRD-PARTY.md).

**The two tracks run in parallel, as re-scoped 2026-08-05:** the product track never trains, the model track never touches the app, and neither waits for the other. [mvp/README.md](mvp/README.md).

## Previously — the settled context

Established findings live in these files, so this one holds only "now" and "next". None contains a next action.

| Track | Settled context |
|---|---|
| Product (W0–W9.7, the server, the shipped features) | [mvp/standing.md](mvp/standing.md) — moved 2026-08-08 |
| Real pages (real-val v2, the re-slice, Round 3 pre-render checks, the Round 2 position, the `\tup3` A/B) | [rung3/standing.md](rung3/standing.md) — moved 2026-08-07 |
| The feature track (F0's scheduler, F2's drums, F1's voices, F3's two instruments) | [features/README.md](features/README.md) + [features/audio-sources.md](features/audio-sources.md) + [features/fingerboard.md](features/fingerboard.md) + [features/kanun-view.md](features/kanun-view.md) + [features/kanun.md](features/kanun.md) |
| What happened on any given day, and why | [log/status-log.md](log/status-log.md) |

## Next — two tracks, running in parallel

Since 2026-08-05 the product and the model advance independently: **the product track never trains,
the model track never touches the app.** Either can be worked on without waiting for the other.

### Track A — the product (W9 → W10 → public)

3. **✅ `Save JSON` IS GONE (owner, 2026-08-30) — and the check that needed it now reads the
   document directly.** The 2026-08-15 decision kept the button for one reason: `smoke:editor` had no
   other way to see what an edit did. That is paid off, not overruled — `window.__omrDoc` sits beside
   the existing `__omrStrips`/`__omrConfig` hooks, `save()` reads it, and both suites pass. **The
   editor's list is complete: steps 1–8 and 10, built, deployed and checked on the production
   bundle.** [mvp/editor.md](mvp/editor.md) · [mvp/standing.md](mvp/standing.md) ·
   [DECISIONS.md](DECISIONS.md).
3b. **✅ F3 IS BUILT (2026-08-16), DEPLOYED (2026-08-18), REBUILT UPRIGHT (2026-08-27) AND DEPLOYED
   AGAIN (2026-08-30).** ⭐ Asking whether its position lines were spaced right exposed a real fault
   one level down — the **string choice** had no notion of a hand and let an ascending line climb one
   string forever; it is now a hand-position model. Account and numbers:
   [features/fingerboard.md](features/fingerboard.md) · [DECISIONS.md](DECISIONS.md).
3c. **✅ F3 HAS A SECOND INSTRUMENT: THE KANUN (2026-08-29), DEPLOYED 2026-08-30.** ⭐ It is not the
   violin view with a different picture: a violin position is a fact about one note, while a mandal
   **stays where it is put**, so this is a state machine over the whole piece — which is what buys the
   piece's **opening mandal plan**, listed in words before you press play.
   [features/kanun-view.md](features/kanun-view.md) · [DECISIONS.md](DECISIONS.md).

3d. **✅ ONE INSTRUMENT PAGE, AND THE PIANO ROLL IS GONE (2026-08-29)**, both the owner's call after
   seeing the kanun. Keman and Kanun now share one tab — **Enstrüman üzerinde** — with a dropdown
   that ⭐ **sets the sound as well as the picture**. `PianoRoll.tsx` is deleted; `PitchRangeNote`
   survives it and is unrelated. ⚠ The tab does **not** set the voice merely by being opened: a
   sampled voice is a 20–35 MB Hub download and "load only on selection" is F1's requirement, so a
   first visit can draw a violin while the default tone still plays. `smoke:editor` **217 ALL PASS**,
   including that picking Kanun moves the transport's own voice. **Deployed 2026-08-30.**
   [features/README.md](features/README.md) · [DECISIONS.md](DECISIONS.md).

   ⏭ **THE NEXT PRODUCT ACTION, and the only one that needs a person, is
   [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) checks 25 AND 26 — the violin view and the
   kanun view, now both behind the one **Enstrüman üzerinde** tab, neither of which any eye has judged** — via `npm run dev:cloud`, then a deploy once
   they pass. Check 25: does the dot sit where your finger would (open strings are the free
   calibration — the dot must be **at** the nut), and do the lines read as information or as clutter?
   Check 26: is the opening mandal plan one you would actually set, does the flash last long enough
   to catch, and is the close-up needed every single time (if so its default should flip)?
   ⚠ Do **not** report the thin high positions as a finding; ~7 px per koma near the nut and less
   above is the shipped photo's known limit, and a higher-resolution bare-neck image fixes it with no
   code change. Everything it built, and the traps inside it: [features/README.md](features/README.md).
   ⚠ **If the look finds something, the fix now needs its own deploy** — the cost of the inverted
   order, and it is small (`deploy:app`, then `smoke:live`). ⚠ `smoke:live` checks neither images nor
   audio; spot-check both by hand after any deploy touching them.
3e. **🚧 THE SOL KLARNET — DEPLOYED 2026-08-30, STILL UNCHECKED IN THE BROWSER (built 2026-08-29).**
   ⚠ **`smoke:editor` covers the clarinet VOICE, not the VIEW** — its DOM contract
   (`#clarinet[data-holes|data-keys|data-lip-reach]`, `[data-omr="clarinet-key"]`,
   `[data-omr="clarinet-lip-tick"]`) is unasserted, unlike the kanun's and the violin's. Confirmed
   pre-deploy by hand only: 6 holes, 18 keys, 5 lip ticks, photo loaded, no page errors.
   ⭐ **THE TABLE IS NOW THE OWNER'S OWN** (2026-08-30), placed note by note in
   `tools/core/clarinet-editor.ts`: **six of nineteen changed, every one a KEY; no hole, no note.**
   The chart's *notes* survived a real sol klarnet; five of my six by-eye key positions did not.
   ⛔ Two earlier wrong turns caught by eye and by no test: a table from **Boehm** diagrams, and
   artwork that went CC0-schematic → own-drawing → **photograph**. ⏭ Next: the **altissimo**,
   Re♭6–Sol6 (seven fingerings the owner is filling in), then the browser checks. [features/clarinet-view.md](features/clarinet-view.md)

4. **⏸ Everything else about speed is DEFERRED to after W10** (owner, 2026-08-06): ship at **~35–55 s
   a page**. Splitting a page across instances (~52 s → ~13 s) is the only option that touches the
   warm wait — the cold start is just 10.6 s of it — and it costs a rate-limiter rewrite plus a
   chunked-vs-unchunked parity check. **The trigger to build it is a friend saying the wait is
   annoying**, which is exactly what W10 is for. Menu and prices: [mvp/latency.md](mvp/latency.md).
5c. **Cheap, independent, and still open — but it is NOT the next action; 3b is.** Read the request
   log now that real users exist. The "every human so far was on a phone" line rests on **n=2** and
   cannot be more than a question ([METRICS-USAGE.md](METRICS-USAGE.md)). The friends' own reads are
   the first data that can move it, and `/decode` is the honest counter (`/health` fires on every page
   open, robots included). "Web first, mobile later" is a **plan**, not a finding, and two friends on
   phones would be evidence against it.
6. **Public launch** — a later rung, gated on Round 3's exam result, not on W10.

⚠ **Items 0, 0b, 1, 2, 5 and 5b are done and retired from this list** — the real drum samples, the
ear-verified stroke tables, the F0+F2 deploy, the copyright redeploy, **W10 itself** (the link went to
two friends, they liked it and asked for more instrument sounds) and **F1's instrument voices**. Each
account is in [log/status-log.md](log/status-log.md), [mvp/README.md](mvp/README.md) and
[features/README.md](features/README.md). ⚠ Traps they left behind, now living elsewhere: `deploy:app`
needs `--filter @turkish-omr/web` or `netlify-cli` publishes **nothing** after a successful build
([mvp/hosting-setup.md](mvp/hosting-setup.md)); **`dev:cloud`, not deploying, keeps the Mac cool**
([../CLAUDE.md](../CLAUDE.md)); ney has **no** CC0 source and oud and tanbur stay Karplus–Strong, and
any instrument past those is aimed by what the friends say next — **not a queue to work down**; and if
the voices should be louder the order is per-voice `gain` → a `Çalgı sesi` slider → **never**
`MASTER_GAIN`.

### Track B — the model (Round 3, UNPAUSED)

Still the **public-launch gate**, and runnable at any time — it shares no file with the feature
track. ⭐ **THE LABELLING IS DONE. What is left is render → train → read, plus three preparations
that need no human judgement.** `round2-stage2-best` stays the runtime until a Round-3 model beats it.

**What Round 3 consumes — settled 2026-08-31 and closed to additions:**

| role | pool | state |
|---|---|---|
| real training | **`strips_b8`** | 3,955 read; **3,936 strips** after promotion |
| synthetic training | the **3-flag render** (`--staccato-noise --concave-tuplet --usul-barline`), `pieces_v4.json` + `split_v4.json` | ⏭ not rendered |
| selection | **`_realval_v2`** (+ `_tupletval` for the free `\tup3` column) | built |
| grading | **`examv3`** | 663/663, 64 pages complete; ⏭ not promoted |

⛔ **Out, by the owner's call or by construction:** `b8-review` (4,738 rows, 450 carrying an old
human fix) and the old fixes → **Round 4**; `batch3` and `reslice-all` → Round 4 and *unusable*
before it; `strips_nota` / `strips_r1` / `strips_tup` → **superseded, must not be passed** (same
music, retired crops). `photo-gold`, `batch1`, `batch2` and the historical tabs are in neither.

⏭ **THE ORDER OF WHAT IS LEFT.** Steps 1–3 need no decision and no labelling.

| # | do this | why now | cost |
|---|---|---|---|
| 1 | `promote_labels.py --dir data/real/rung3/strips_b8 --strips-root data/real/strips_v2` | turns 576 hand corrections into the training pool; dry-run is clean at **3,936 rows, 3 rejects** | seconds |
| 2 | `promote_labels.py --dir data/real/rung3/strips_exam_v3 --exam --strips-root data/real/strips_examv3` | the exam gold; that manifest then **replaces** `strips_exam_v2_clean` | seconds |
| 3 | re-score `round2-stage2-best` on the rebuilt exam | the **baseline column** of every floor pair; a **precondition of the read** | one CPU decode run |
| 4 | count dotted barlines in real print | `USUL_BAR_RATE` is chosen, not measured, and 7.8% is a statistic about the model's guesses | a probe |
| 5 | give the dotted barline its **own paired scorer** | three flags in one render ⇒ a general movement is unattributable; this makes two of three attributable | clone `staccato_falsedot_score.py` |
| 6 | render the corpus + `stitch-test` + `verify-labels` **with the same three flags** | a gate run on a different picture is not this corpus's gate | ~75–80 min, heats the Mac |
| 7 | fix `make_round3_colab_zip.sh` and the notebook: `strips_b8`, `:5`, allow `concaveTuplet` | otherwise the run trains on retired crops, silently | minutes |
| 8 | train (stage 1 6,000 @ 16, stage 2 2,000 @ 16, `--every-share 0.15`, `scan_share` off) | the recipe held fixed from the arms | Colab |
| 9 | settle what 75% means, pick the checkpoint on `_realval_v2`, then **the exam, read ONCE** | §3c must be answered **before** the read | — |

**The item-by-item detail — what each of B0–B9 is, what it found, and what it still owes — is in**
**[rung3/worklist.md](rung3/worklist.md).** Only the tables above and the next action stay here.


### Owed but not next → [BACKLOG.md](BACKLOG.md)

Genre split: this file holds current state and the next action; a backlog is neither. Every deferred
item lives there with the reason it is deferred — ⚠ and several are deferred *because* acting on them
would confound something in flight, so read the reason before starting one.

## Open risks and non-claims

Moved to **[RISKS.md](RISKS.md)** on 2026-08-17, when this file crossed the 400-line cap. Genre split:
this file states current state and the next action; standing caveats are neither.

⚠ **Read it before quoting any number or believing any green check.** It carries, among others: the
±12-point interval on Round 3's primary floor, why a cold start has never been measured on a genuinely
idle service, why real-val orders models but does not predict the exam (28 pp), why the AEU headline
is fragile to low-n classes, and the four things that separate a Round-3 model from
`round2-stage2-best`.

## Where the detail is

| For | Read |
|---|---|
| Every number, with its date and source | [METRICS.md](METRICS.md) |
| Why a thing was decided, and what overturned it | [DECISIONS.md](DECISIONS.md) |
| The real-page track, step by step | [rung3/README.md](rung3/README.md) |
| Round 1 in full (criteria → A/B → exam → disposition) | [rung3/round1.md](rung3/round1.md) |
| Round 2 so far (photos, sharps, what's open) | [rung3/round2.md](rung3/round2.md) |
| Round 3: what it targets and the checks to run first | [rung3/round3.md](rung3/round3.md) |
| Dated history of everything | [log/status-log.md](log/status-log.md) |
| Plans that were abandoned — do not act on them | [log/superseded.md](log/superseded.md) |
| Plain-English version of this page | [OVERVIEW.md](OVERVIEW.md) |
| How to update this file (and the others) | [MAINTAINING.md](MAINTAINING.md) |
