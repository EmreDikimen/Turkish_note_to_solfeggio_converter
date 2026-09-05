# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-09-05

## Now

⭐ **THE PUBLIC LAUNCH HAPPENED ON 2026-09-05: THE OWNER PUT THE LIVE APP'S LINK ON LINKEDIN.**
This **overturns the standing gate** — every plan in this repo said the public launch waited on the
exam result of the round in progress, and it did not. Nothing is wrong with that; it was the owner's
call to make. But three things that were written as *future* risks are now *live* ones, and no one
has acted on any of them yet:

1. ⛔ **Cloud Run capacity is no longer hypothetical.** Since 2026-09-04 the app reads **nothing** on
   the visitor's machine — a cold or dead server shows `server-unavailable` instead of falling back.
   A cold start measured **38.2 s**, `--max-instances` is **10** at concurrency 1, and an
   over-capacity request QUEUES rather than failing fast. ⏭ **`--min-instances 1` is still the
   owner's open call**: it removes the cold start and costs money continuously.
2. ⚠ **Visitors are reading with ROUND 3 RUN A `best-real`** (owner, corrected 2026-09-05 —
   ⛔ **this file said "still Round 2" and that was wrong**). **Verified by hash, not by memory**:
   `apps/web/public/models/encoder_model.onnx` is byte-identical to
   `data/checkpoints/r3a-stage2-best-real-onnx/encoder_model_int8.onnx`, it was staged **2026-09-03
   13:22**, the live image was built **13:38** the same day, and revision **`omr-decode-00006-7wq`**
   takes **100%** of traffic. ⚠ **The wrong claim came from reasoning about the wrong path**: it is
   true that `VITE_WEIGHTS_URL` keeps a `deploy:app` from publishing a model — but the browser path
   reads nothing since 2026-09-04, so the model a visitor meets is the one **baked into the Cloud Run
   image**, which the Dockerfile copies out of `apps/web/public/models`. ⚠ Run A was the **hand-test**
   pick, not an exam pass; the exam floor is unmet and the dense-page failure below is still silent.
3. ⚠ **Nobody has looked at the phone with their own eyes.** The phone CSS shipped 2026-09-04 and is
   covered only by `npm run smoke:phone`, a probe that never exits nonzero. LinkedIn traffic is
   phone-heavy. ⏭ `npm run smoke:phone`.

⚠ **This entry records the fact, not a plan.** The owner asked on 2026-09-05 for the state to be
written down and for nothing to be acted on. [DECISIONS.md](DECISIONS.md) ·
[mvp/README.md](mvp/README.md).

✅ **DEPLOYED 2026-09-05** (owner asked) — <https://komavision.netlify.app>, everything below this line included: the phone CSS, the measure card, the stored-pages list, the voice bridge, the makam picker's new line and the usul fix below. **The MODEL is untouched and still Round 2**: weights come from `VITE_WEIGHTS_URL` on the Hub, so a `deploy:app` cannot publish the locally staged Round-3 arm. `npm run smoke:live` **PASSES** — the site read a page on Cloud Run (9 porte → 24 şerit → 229 nota, 45.6 s) and **refused** to read anywhere else when pointed at a dead server. ⚠ That refusal arm had never run against a real deployment before and it exposed a bug **in the check, not the app**: a refusal UNMOUNTS `#omr-status`, and all three page smokes asked it for `data-state` before looking at `#omr-error`, so they timed out on a detached locator while the app was behaving correctly in 5.1 s. Fixed in `live-smoke.ts` / `build-smoke.ts` / `page-smoke.ts`. ⏭ Look at the phone itself with `npm run smoke:phone`.

⛔ **THE APP NEVER READS A PAGE ON THE VISITOR'S MACHINE ANY MORE (owner, 2026-09-04), AND THAT MAKES
CLOUD RUN'S CAPACITY A RELEASE BLOCKER.** A configured server that is cold or dead used to fall back
to the browser and pull **211 MB** of graphs over the visitor's connection; it now shows
`server-unavailable` and reads nothing. ⚠ The in-browser path is untouched and still the only path
where no server is configured — `gate:browser` and the parity checks are unaffected
([../CLAUDE.md](../CLAUDE.md)). ✅ **The two timings the fallback used to absorb are both raised**
(2026-09-04): `--max-instances` **3 → 10** on the live service (image untouched, revision
`omr-decode-00006-7wq`) and `WARMUP_WAIT_MS` **40 s → 120 s** — ⭐ that second one on a measurement
taken while doing the first, **`loadMs` 38,178 ms on a cold start**, two seconds inside the old
budget. ⏭ **Still the owner's call: `--min-instances 1`**, which removes the cold start altogether
and costs money continuously. [deploy-ops.md](mvp/deploy-ops.md) · [DECISIONS.md](DECISIONS.md).

✅ **THE REPO IS LICENSED — Apache-2.0, with a scope note** (owner, 2026-09-04). `LICENSE` + `NOTICE`;
it covers this project's own work and explicitly not SymbTr, the neyzen screenshot, the base model or
the bundled audio. ⏭ **The other copyright item is still open and still the owner's**: those files
remain in the public repo's **git history**, and clearing them needs a `filter-repo` rewrite and a
force-push. [THIRD-PARTY.md](THIRD-PARTY.md).

⭐ **ROUND 3 IS CLOSED AND ROUND 4 IS OPEN (owner, 2026-09-03).** The exam read **51%** against a floor
signed at 75% and a Round-2 baseline of 44%; ~15 of its +17 points was the retired `\tie`, and every
class the three render flags targeted came out flat or slightly worse. Runs A and B were nulls on
real-val, and the checkpoint selector picked wrong in all three runs. Every number, once:
[METRICS-EXAMSET.md](METRICS-EXAMSET.md) · [METRICS-ROUND3-RUNS.md](METRICS-ROUND3-RUNS.md) · [METRICS.md](METRICS.md). **The plan, its evidence and the owner's decisions: [rung3/round4.md](rung3/round4.md)**;
plain English: [OVERVIEW-ROUND4.md](OVERVIEW-ROUND4.md).

⭐ **THE OWNER'S HAND TEST OUTRANKS THE PAIRED READS FOR THE SHIP CALL, AND IT SAYS RUN A `best-real`
IS VISIBLY BETTER than both `r3-final-stage2-last` and Round 2** (owner, 2026-09-03: *"exam ve
evaluationlar o kadar fazla şey söylemiyor"*). ⚠ Not a contradiction: real-val's ~±0.13 edits/strip hides
any gain under ~5%, and the exam drops **41%** of its candidates — the wide, dense strips a page shows. ⏭ **Owner's call, recommended: stage and publish Run A `best-real`**
through the usual chain (ONNX → int8 → parity → `gate:browser`, where **27/28 is the ceiling for any
tie-free model** → `deploy:app` + server). ✅ **DONE — Run A `best-real` IS what the live server runs**
(staged 2026-09-03 13:22, image built 13:38, revision `omr-decode-00006-7wq` at 100%; confirmed by
hashing the staged graph against the checkpoint). Both predecessors are kept beside it:
`_r3final_backup/` is `r3-final-stage2-last` and `_round2_backup/` is `round2-stage2-best`. ⏭ Recommended, not decided: a fixed **10–15 page hand-test set** outside the exam,
corrections counted per page per model — the page-level instrument this project lacks.

**Round 4 in one line (owner's decisions, 2026-09-03):** **no new render**, **`\tupend` stays**,
**stage 2 at 4,000 steps**; re-emit the real pools under **scheme H** note-spelling tokens (16 ids —
recommended, **owner to confirm**) + the label-budget rail at **b = 57** + a balanced packer, which
returns 3,508 of the 4,012 over-budget strips; stop the signature vote from overwriting silently;
select checkpoints on real-val **corrections**, not loss; beam search measured offline first and
**never on the user path unless it pays**; a 20–40 page **third-source probe** before any crawl.

⛔ **Two things the round is NOT allowed to do**: read the exam again for an A/B, and retire
`\tupend` or add a `\dottedbar` token — [rung3/round4.md](rung3/round4.md) "Not this round".

⭐ **FOUR FEATURES SHIPPED 2026-09-04/05 AND ARE LIVE.** Each has a doc that owns its design, its traps and its numbers; this file keeps one line each plus the warning that outlives the build. **The phone works** (2026-09-04) — the app had **no width-based media query at all**, now fixed behind `(pointer: coarse)` and `(max-width: 700px)` at the END of `app.css` so order wins, which is what leaves the desktop app and every existing check untouched; ⚠ **`npm run smoke:phone` is a probe, not a gate — it never exits nonzero**, so nothing about the phone is proven by CI ([DECISIONS.md](DECISIONS.md)). **The instrument tab shows the bar it is playing, and edits it there** (2026-09-04, revised 2026-09-05) — ⭐ the card IS `SheetView` mounted again (`onlyMeasure`), so one editor, one document, one undo stack ([features/measure-card.md](features/measure-card.md)). **The app remembers the pages it has read** (2026-09-05) in the reader's own IndexedDB, 30 pages, renameable, makam beside the name; ⚠ a **cache, not a save** — notes only, the photograph is never stored, and it does not travel to another device ([features/recent-pages.md](features/recent-pages.md)). **The makam picker says which notes it plays differently** (2026-09-05): per rule, the written perde, the shift in commas, and how many notes of THIS page it reaches — ⛔ **and it found a shipped bug**, the deltas keyed by the written document while `unfoldDoc` renumbers, so `gamzedeyim-deva` under uşşak bent **19 wrong notes out of 22**, silently, since 2026-08-30; `remapKomaDeltas` re-keys them ([mvp/makam.md](mvp/makam.md)).

⛔ **THE USUL STOPPED PARTWAY THROUGH A PAGE WITH A REPEAT AND NEVER CAME BACK — FIXED AND LIVE**
(owner heard it, 2026-09-05). The metronome and stroke tracks were built from the WRITTEN score
while the timeline has run on the performance since 2026-08-30 — the second symptom of one mistake,
hours after the makam deltas. ⚠ **No automated check can see this class of bug** (the smokes load a
SymbTr sample, which never folds); `tools/core/usul-test.ts` pins the rule instead. The rule that
came out of it is now in [../CLAUDE.md](../CLAUDE.md). [DECISIONS.md](DECISIONS.md) ·
[log/status-log.md](log/status-log.md).

✅ **CHANGING THE INSTRUMENT MID-PLAYBACK NO LONGER DROPS TO THE DEFAULT TONE** (owner, 2026-09-04) —
the old recording keeps sounding until the new one downloads. ⚠ `state === "failed"` no longer
implies the default tone; read `VoiceStatus.sounding`. ⏭ **Owner: only covered by `npm run
smoke:editor -- --voices-url <hub>`**, since the default arm has no host and so never holds a voice.
[DECISIONS.md](DECISIONS.md) · [log/status-log.md](log/status-log.md).

⚠ **`GEOMETRY_REV` → 20260903: EVERY DECODE CACHE ON DISK IS NOW REFUSED** (2026-09-03), because two
slicer fixes moved crop boundaries the same day — a closing `:|` read as two barlines
(`OMR_TAIL_SPAN=0` restores) and a note stem taken for a barline (`OMR_END_BLOBS=0` restores; the
`end_blobs` geometry key tells the two apart under one rev). The next emit re-decodes; nothing is
owed today. [METRICS-SLICER-FRAME.md](METRICS-SLICER-FRAME.md) · [METRICS-SLICER-STEMS.md](METRICS-SLICER-STEMS.md).

⏭ **THE NEXT ACTION (agent, no GPU, no labelling), in order:** (1) the synthetic-vs-real id-length
distributions under the scheme-H tokenizer, and how the 7 rare pitches segment — the only thing that
could reopen the render question; (2) the selector change in `train.py` (+ EMA, label smoothing); (3)
the signature-vote disagreement list ([BACKLOG.md](BACKLOG.md) item 9). **Owner:** confirm scheme H,
decide on publishing Run A, pick the hand-test pages.

⏭ Settled Round-3 findings that used to sit here are in [METRICS-ROUND3-RUNS.md](METRICS-ROUND3-RUNS.md),
[METRICS.md](METRICS.md), [METRICS-EXAMSET.md](METRICS-EXAMSET.md), [DECISIONS.md](DECISIONS.md) and
[log/status-log.md](log/status-log.md). ⚠ One is still a rule: **the ship call is a human judgement
taken after reading an error classification** (`error_taxonomy.py`), never the numeric floor alone.

⛔ **THE SHIPPED APP RETURNS SILENTLY WRONG NOTES ON DENSE PAGES. THE FIX IS MEASURED, SPECIFIED,
AND DEFERRED TO ROUND 4 (owner, 2026-08-23) — which is what RELEASES THE EXAM.** The browser slicer
has **no label-budget rail**: at training an over-budget strip is dropped, at inference there is
none, so the model emits `</s>` early and **confidently**, and `hitCap` catches almost none of it.
⛔ **The rail ALONE is a wash** — but that tested INFERENCE on a model never trained under the rail,
and dense music already reads twice as badly even in a 1-measure strip, so it is a training gap and
not a cutting one. ⏭ The settling experiment is the **pair** — re-emit with the rail → train →
measure — at **b = 57, not 50**. ⭐ Deferring it is what keeps the shipping slicer still, so
`examv3` stays valid. Every number: [METRICS-SLICER-WINDOWS.md](METRICS-SLICER-WINDOWS.md) ·
[BACKLOG.md](BACKLOG.md) item 0.

⏭ **THE SLICER IS FROZEN — treat it as frozen unless the owner says otherwise**, and three settled findings ride with it. ⭐ **A whole staff row goes missing on 14% of pages and `STAFF_RESCUE` is the fix, SHIPPING OFF until you say otherwise**: a lost row is not a bad crop, it is **NO crop**, so no accuracy metric has ever shown it; every global knob was measured and rejected, and what ships is a second pass re-detecting only in the bands the page's own staff pitch says are empty — ⚠ its benefit is **unscoreable, not merely unmeasured**, the evidence being visual. ⛔ **The row-level instruments are blind to staff-count changes**: both pair a row to its cached truth by **system index**, so an inserted staff reports a large regression that is pure artifact — `score_slicer.py` gained `--pair-by-position`, **`score_barlines.py` has the same coupling and NO fix**, which is why the rescue's new rows can never be scored there. ⚠ **The 2026-08-26 freeze was lifted twice on 2026-09-03**, both at the owner's request (the trailing `:|`, and a stem taken for a barline — `END_BLOBS`), both priced on full 6,440-row runs, both a clear gain with parity exact; nothing is owed on either. Mechanism and rules: [../CLAUDE.md](../CLAUDE.md). Numbers and the freeze's own history — including the lesson that the faded-page table has now mispredicted a full run three times: [METRICS-SLICER.md](METRICS-SLICER.md) · [METRICS-SLICER-STEMS.md](METRICS-SLICER-STEMS.md) · [METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md) · [DECISIONS.md](DECISIONS.md).

⏭ **COLLECTION IS NARROWED TO TWO TARGETS, not broadened.** 2,486 unlabelled page PNGs already sit
on disk, so volume relieves nothing. What it cannot substitute for: pages drawing the **concave
tuplet mark** (unscoreable — no labelled real strip carries it) and **tuplet-dense instrumentals**
(sirto, longa, saz semaisi). ⚠ The second does **not** fix itself — the same budget drops the new
pages. ⚠ **A THIRD target, DEFERRED not dismissed**: every page we own is from **two websites**,
exam included ([BACKLOG.md](BACKLOG.md) item 10).

✅ **ROUND 3 HAS A SIGNED ACCEPTANCE BAR** (owner, 2026-08-15): **≥75% of exam pages needing ≤5
corrections**, with the accidental measures as no-regression clauses. Written before any Round-3
training and **not re-opened after the read** — a miss is a miss. ⚠ **It is no longer the
public-launch gate**: it was written as one, and the launch went ahead of it on 2026-09-05 (top of
this file). It still governs what may be PUBLISHED as a model. ⚠ Report the primary **with its
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

3. **✅ `Save JSON` IS GONE (owner, 2026-08-30); `window.__omrDoc` is the seam the check reads
   instead. The editor's list is complete — steps 1–8 and 10, built, deployed, checked on the
   production bundle.** [mvp/editor.md](mvp/editor.md) · [DECISIONS.md](DECISIONS.md).
3b. **✅ F3 IS BUILT (2026-08-16), DEPLOYED (2026-08-18), REBUILT UPRIGHT (2026-08-27), DEPLOYED
   AGAIN (2026-08-30).** ⭐ Asking whether its position lines were spaced right exposed a fault one
   level down: the **string choice** had no notion of a hand and let an ascending line climb one string
   forever. [features/fingerboard.md](features/fingerboard.md) · [DECISIONS.md](DECISIONS.md).
3c. **✅ F3 HAS A SECOND INSTRUMENT: THE KANUN (2026-08-29), DEPLOYED 2026-08-30.** ⭐ Not the violin
   view with another picture: a violin position is a fact about one note, a mandal **stays where it is
   put** — a state machine over the piece, which buys the **opening mandal plan**. [features/kanun-view.md](features/kanun-view.md) · [DECISIONS.md](DECISIONS.md).
3d. **✅ ONE INSTRUMENT PAGE, AND THE PIANO ROLL IS GONE (2026-08-29)**, the owner's call after
   seeing the kanun. Keman and Kanun share one **Enstrüman üzerinde** tab whose dropdown ⭐ sets the
   sound as well as the picture; `PianoRoll.tsx` is deleted. ⭐ **Since 2026-09-04 merely OPENING the
   tab loads that voice** — reversing the rule that let a first visit draw a violin while the default
   tone played, at the price of a 20–35 MB Hub download on arrival. **Deployed 2026-08-30**; that
   reversal is NOT deployed. [features/README.md](features/README.md) · [DECISIONS.md](DECISIONS.md).

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
3f. **✅ THE EDIT PALETTE IS A FLOATING TOOLBOX, AND THE SHEET HAS NO SCROLLBAR OF ITS OWN
   (owner, 2026-09-03).** The palette was `sticky` inside the score's row: it took **164 px** from the
   page, so pressing Düzenle **moved the music**, and it still slid off the top of a long page. Now
   `.kv-toolbox` — `fixed`, rendered from `App` outside `.kv-card`, **dragged** by its title bar and
   **folded** to that bar alone, both remembered in `localStorage`; `.kv-score` measures **1050 px in
   edit mode and out of it**. ⭐ The second scrollbar was a **font artifact, not content**: an inline
   box's layout overflow comes from the font's ascent/descent, and the accidental legend sets Bravura
   — 105 px of scroll height in a 72 px box with every rect fitting. `npm test`, `smoke:app`,
   `smoke:editor` **ALL PASS**. ⏭ Unchecked by an eye; nothing owed beyond opening Düzenle and
   dragging it. [DECISIONS.md](DECISIONS.md) · [mvp/editor-built.md](mvp/editor-built.md).
3g. **✅ THE SIGNS ARE EDITABLE (owner, 2026-09-03).** `‖:` `:‖` 1./2. 𝄋 ⊕ "D.C." "Son" are placed by
   arming one in the toolbox and clicking a bar, and deleted by clicking the drawn sign in Seçim.
   ⭐ **The playing order is re-derived by the DECODER's own expanders** — the marks were split out
   of `MeasureRec` as `StructureMarks`, so `resolveStructure` runs `expandRepeats`/`expandSegnoJumps`/
   `expandDaCapo` over a hand-edited page; there is no second rulebook. ⭐ **A placement is refused by
   SIMULATION**: resolve it, reject it if it added a warning the page did not have — which caught the
   mid-piece D.C. and the endless-𝄋 section without being told about either. ⭐ **The repeat is ONE
   tool and TWO clicks, on the barlines** (owner, same day, revising a first version with a `‖:` tool
   and a `:‖` tool): the palette asks where it starts, then where it ends, and both marks land in one
   operation — so the page can never hold half a repeat. `npm test` (36 checks, every one a
   `playBars` list) and
   `smoke:editor` **ALL PASS**. ⏭ **Unchecked by an eye — [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md)
   check 27**, which is about whether marking a page up FEELS like marking a page up; nothing else is
   owed. [DECISIONS.md](DECISIONS.md) · [../tools/render/structure-edit.ts](../tools/render/structure-edit.ts).
3h. **✅ THE PAGE FOLLOWS THE PLAYHEAD — ONCE PER ROW, AND THE READER CAN TURN IT OFF (owner,
   2026-09-03).** A sheet is taller than the window, so the cursor used to walk off the bottom and
   stay there. It now scrolls the page to itself, and sideways too on a window too narrow for the
   1020 px sheet. ⭐ **The trigger is the cursor arriving on a NEW ROW** (the owner's revision the
   same day): inside a row the page never moves, so nothing shifts under a pointer mid-bar and a
   reader who scrolls away is left alone until the music turns the corner. **On by default**, a
   checkbox beside **Güfte**, remembered in `localStorage`; `?follow=0` pins it off for a harness.
   ⭐ Two things only the check could find: the sideways follow was **dead** (the box that reports
   hidden width is not the box that scrolls — the sheet's own wrapper overflows with
   `overflow: visible`), and a page that moves during playback broke an unrelated check — the B4
   insert-mapping read measures a blank point and then clicks it, so it now owns the scroll.
   `npm test` + `smoke:editor` **ALL PASS**. ⏭ **Unchecked by an eye —
   [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) check 28**, which is the only thing that can
   say whether the jump lands where a reader wants to be looking. [DECISIONS.md](DECISIONS.md).
3i. **✅ THE ÇALMA ROW IS PINNED TO THE TOP OF THE PAGE (owner, 2026-09-05).** ▶ Çal, ■ Dur, the tempo
   and the instrument stay at the top of the window wherever you scroll; **Ritim and Perde scroll away**
   — set once before playing, and pinning all three would hold a third of a laptop window over the
   music. ⚠ It **replaced the 2026-09-03 answer to the same complaint**, a second Çal/Dur in the
   bottom-right corner: that pair, its CSS and its two `:has()` phone rules are **deleted**. ⚠ `sticky`
   cannot leave its own parent, so the bar is **two boxes** now, the pinned row being its own
   `.kv-transport` under `.kv-page`; the voice toast and the playhead follow both clear it. `smoke:editor` asserts both halves (row at `top ≈ 0` AND the other two
   gone). ⏭ **Unchecked by an eye — [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) check 29.** [DECISIONS.md](DECISIONS.md).
3j. **✅ A FRONTEND CRAFT PASS — THE CONTROL BAR, AND SIX THINGS THAT LOOKED LIKE FAULTS (owner,
   2026-09-03: *"profesyonel durmayan noktaları profesyonelleştir"*).** ⭐ **The transport is three
   named rows — ÇALMA / RİTİM / PERDE — instead of one `flex-wrap` holding twelve controls**: the
   browser used to pick the break, so line one ran flush into the right edge, line two carried two
   controls and half a page of gap, and nothing said which control belonged with which. Rows also
   fail predictably — a narrow window costs ONE group a second line. ⚠ The separator is HORIZONTAL
   and belongs to the row; the vertical rule that was tried and removed once (it dangled at the end
   of a wrapped line) stays removed. Six defects went with it: the wordmark's Bravura glyph hung
   below the baseline with its stem clipped (a SMuFL accidental's origin is the middle staff line,
   so it has no usable text baseline); the footer's `max-width` shortened its own `border-top`, so
   the page ended on a rule two-thirds across; the edit toolbox kept **Seçim and the refusal
   message inside its scrolling body**, which put the only way out of an armed tool and the only
   explanation of a rejected sign below the fold on a 900 px screen; edit mode's instructions were a
   ten-line paragraph; `Gelişmiş` carried the same fill and width as the dropzone; and the violin's
   string names were four dark smudges (a 1.8 px `non-scaling-stroke` halo eating ~10 px letters).
   ⭐ **Seven `var(--fg)` / `var(--text-1)` references pointed at tokens that do not exist** — dead
   since the 2026-08-08 palette change, and silently doing nothing on the kanun's and the violin's
   labels. `npm test`, `smoke:editor`, `smoke:app` **ALL PASS**; every `id` and `data-*` in the
   deploy contract is unchanged. ⏭ **Not done and deferred by the owner: the phone.** A 390 px
   window still stacks the transport into ten rows of native controls and cuts the sheet sideways
   with no scroll affordance — the app has no breakpoint at all. Unchecked by an eye.
   [log/status-log.md](log/status-log.md).
3k. **✅ ONE CONTROL VOCABULARY: THE ELEVEN NATIVE CHECKBOXES ARE TOGGLE BUTTONS, AND THE `<select>`s
   ARE THE APP'S OWN** (owner, 2026-09-03, after asking whether checkboxes were a professional
   choice). A checkbox means "a value in a form you fill in and submit"; every one of these acted on
   the click, which is a **toggle** — and the app already spoke that language in two places
   (`.kv-btn.is-on`, `.kv-seg`), so half the controls were the design system's and half were macOS's.
   ⭐ **A real `<input type="checkbox">` is still inside each one**, so screen readers, the keyboard
   and `smoke:editor`'s eight `.check()`/`.uncheck()` calls all keep working — the conversion cost the
   checks **zero lines**. ⚠ It is a **transparent overlay**, not `.kv-visually-hidden`: the clip
   pattern was tried first and FAILED — clip leaves a 1×1 box in the label's corner, `.check()` aimed
   at it and hit the label. Clip is right for a file input and wrong for anything a test clicks.
   ⚠ `appearance: none` on the selects **keeps the native popup** (keyboard, a11y tree, the phone's
   own picker) and replaces only the closed box. ⭐ **"Porte değişmesin" is now two segments of the
   TRANSPOSITION**, not a checkbox beside it — **"Porte ve ses" / "Yalnızca ses"**, both answering
   one question in one grammar after the owner rejected a first pair that did not
   (*"pek açıklayıcı değil"*). `npm test`, `smoke:editor` (320 checks) and `smoke:app` **ALL PASS**.
   ⏭ Unchecked by an eye. [DECISIONS.md](DECISIONS.md) · [log/status-log.md](log/status-log.md).
3e. **🚧 THE SOL KLARNET — DEPLOYED 2026-08-30, NOT REDEPLOYED SINCE (built 2026-08-29).**
   ⭐ **THE LIP METER NOW SHOWS THE GRIP, NOT THE BEND** (owner, 2026-09-04): horizontal, above the
   photograph, an ordinary note at its **middle**, a koma a step to the left, and the tighter half
   drawn but never filled and never ticked — no koma is played by biting above normal. It is HTML
   now, not SVG (`.kv-clarinet__lip*`), and `LIP_BAR` is gone from `clarinetArt.ts`. Looked at by
   eye in the real app at 1280 px and at 390 px; `typecheck` + `npm test` pass. ⏭ **Not deployed**
   — it rides the next `deploy:app`. [features/clarinet-view.md](features/clarinet-view.md) ·
   [DECISIONS.md](DECISIONS.md).
   ⚠ **`smoke:editor` covers the clarinet VOICE, not the VIEW** — its DOM contract
   (`#clarinet[data-holes|data-keys|data-lip-reach]`, `[data-omr="clarinet-key"]`,
   `[data-omr="clarinet-lip-tick"]`, and now `[data-omr="clarinet-lip-meter"|"clarinet-lip-normal"]`)
   is unasserted, unlike the kanun's and the violin's. Confirmed
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

### Track B — the model (Round 4, OPEN 2026-09-03)

Still the **public-launch gate**, and it shares no file with the feature track. Plan, evidence, the
owner's decisions and the order of work: **[rung3/round4.md](rung3/round4.md)**. ⚠ **The live runtime
is Round 3 Run A `best-real`** since 2026-09-03 — published on the owner's hand test, not on an exam
pass, so Round 4's job is unchanged.

| role | pool | state |
|---|---|---|
| real training | `strips_b8` (3,929) **re-emitted under scheme H + the rail at b = 57 + a balanced packer** — the 4,012 over-budget drops are the target (3,508 return under H, measured) | ⏭ not run; needs a Colab decode, every cache is refused since `GEOMETRY_REV` 20260903 |
| synthetic training | **`strips_v7_final`, unchanged** — no render this round (owner) | ✅ on disk |
| selection | `_realval_v2` (+ `_tupletval`), **on free-running corrections, not loss**, beside the owner's hand-test pages | ⏭ selector change owed |
| grading | `examv3` as the comparable column; a dense extension and a third-source set as **separate** columns | ⏭ decide before the read |

⛔ **Out:** `b8-review`; `strips_oldhuman` (Run B answered it — nothing measurable); the raw old
pools. `batch3` / `reslice-all`'s hand corrections become usable only through the rail, which is
part of the re-emit.

⏭ **Next, in order:** the length-distribution and rare-pitch segmentation check under H (no GPU) →
`train.py` selector → the signature-vote rule ([BACKLOG.md](BACKLOG.md) item 9) → the third-source
probe → re-emit → the owner reads the audit sample and every `\sig` row → two arms from base (old
vocabulary control vs H), stage 2 at 4,000 steps, EMA + label smoothing → real-val paired → `examv3`
once. ⚠ Beam search is measured offline on the current model first and reaches the user path only
if it pays.

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
