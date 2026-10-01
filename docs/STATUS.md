# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-09-28

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
2. ⚠ **Visitors read with ROUND 4 CONTROL `r4-ctl-stage2-last`** (owner, 2026-09-28), staged that
   day, revision **`omr-decode-00008-hx7`** at 100% of traffic, and the Hub weights
   (`VITE_WEIGHTS_URL`) carry the same int8 graphs — **downloaded back and hash-matched on all three
   graphs plus `model.json`**, not assumed from a successful-looking upload: the first `hf upload`
   died on a `ReadTimeout` while still printing progress, and the Hub sat on the 2026-09-03 weights.
   **Verified by hash at every local hop and by
   `smoke:page` against the live URL** (159 notes / 27 measures, server-side, no page errors) — not
   from memory. It replaced Round 3 Run A `best-real`. ⚠ **It is NOT an exam pass either**: Round 4's
   exam has not been read, and `r4-ctl` beat the live model only as a *lead* — every paired interval
   spans zero once clustered by piece ([METRICS-ROUND4-AB.md](METRICS-ROUND4-AB.md)). What it does
   have is the browser gate: **24/28 against the outgoing model's 22/28 on the same golds**. ⭐ **To
   revert**: re-stage `data/checkpoints/r3a-stage2-best-real-onnx/*_int8.onnx` into
   `apps/web/public/models`, rebuild and redeploy ([../CLAUDE.md](../CLAUDE.md)).
   ⛔ **`gate:browser`'s documented "expect 27/28" IS STALE — neither model reaches it**, and it has
   been failing unnoticed since at least the 2026-09-03 staging ([METRICS-ONNX.md](METRICS-ONNX.md)).
3. ✅ **THE PHONE REBUILD IS LIVE, AND THE APP IS INSTALLABLE** (deployed 2026-09-28, `Deploy is
   live!`, `smoke:live` PASS). Everything built 2026-09-26..28 is on the site: the score fits the
   phone, the Çal tab folds under Çal/Dur, tempo takes typing, PNG/PDF saving, violin retuning, the
   per-measure accidental default, a yes/no before any voice download, ▲/▼ note steps and
   tap-not-press on touch, the dot tool, İmleci takip et pinned, the stacked reading card — and the
   owner's own stitcher changes (commit `1000d72`, included at the owner's call). ⭐ **It is a PWA now**: a
   manifest and icons, so Android Chrome offers "Uygulamayı yükle" and iOS "Ana Ekrana Ekle"; Chrome's
   own check reports **0 installability errors** on the live site. ⚠ The icon is a PLACEHOLDER drawn
   from the favicon until there is a logo (`tools/browser/make-icons.ts`). ⚠ **No service worker, on
   purpose** (DECISIONS 2026-09-28). ⚠ Never opened on a real iPhone.
   ⏭ **Play Store is the owner's next step, and it is a PEOPLE problem, not a code one**: a new
   personal account needs a closed test of **12 testers for 14 days** before production; the plan is
   the owner's school music club. The TWA package (Bubblewrap) and `/.well-known/assetlinks.json` are
   owed once the account exists. [log/status-log.md](log/status-log.md), 2026-09-28.

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

**Round 4's levers, and where each one ended:** no new render and `\tupend` stays (owner);
re-emit the real pools under **scheme H** at a gate of **80 ids** ✅ done 2026-09-07 — ⛔ **and the
vocabulary itself bought nothing, on any pool (2026-09-19, below)**; stop the signature vote
overwriting silently ✅ rule D built; select checkpoints on real-val **corrections** ✅ used, and it
tied with `last` in both arms; beam search offline ⏭ not started; a third-source probe ✅ read, a
null. ⛔ **Three things the round may NOT do**: read the exam again for an A/B, retire `\tupend` or
add a `\dottedbar` token, and **re-pack the synthetic strips** — proposed, approved and withdrawn on
2026-09-06 when the measurement showed it fills the label range by making crops wider, which
[METRICS-GEOMETRY.md](METRICS-GEOMETRY.md) prices as costing edits. Step-by-step history:
[rung3/round4.md](rung3/round4.md) · [log/status-log.md](log/status-log.md).

⚠ **The one risk scheme H carried is still live for the pool, whatever the owner picks**: synthetic
labels stop at **44** H ids while the real pool reaches 51, so the long band exists only in real
material ([RISKS.md](RISKS.md), [rung3/tokenization.md](rung3/tokenization.md)).

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

⭐ **THE TEZHİP RESTYLE IS BUILT ON `main`, NOT DEPLOYED (2026-09-30)** — new palette, dark mode,
self-hosted fonts, Base UI dialogs, and a render job that is now a pinned page so a restyle cannot
move a strip. ⏭ The owner's next ask: **a from-scratch UI on its own branch**.
[features/look.md](features/look.md).

⏭ **The phone rebuild is DEPLOYED (2026-09-28); the next product actions are the Play Store closed
test and `STATS_SALT`** (Now, item 3 and below). The rebuild itself keeps going: phases 0 and 1
of the plan are done and phase 2 — the `apps/web/src/phone/` shell — is partly built in place: the
Çal tab is gone, the settings fold, and the score card's head is down to two rows. What is still
owed from the plan: the phone's own component tree, the `data-phone` / `phone.css` split, the
category-switching tool strip (the toolbox still scrolls its six groups), and
**`tools/browser/phone-smoke.ts` — the gate with the nine asserts, which does not exist yet**.
⚠ `npm run smoke:phone` is still only a probe, and `npm run smoke:app` is red for a reason that
predates this work (verified against `a52ce28`).

⏭ **Still open, and needing a person's eyes:** [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md)
checks 25–29 — five shipped things no eye has judged. Run them via `npm run dev:cloud`, then deploy
if they pass.

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

Still the gate on what may be **published as a model**. Plan, levers and the owner's decisions:
**[rung3/round4.md](rung3/round4.md)**. Every Round-4 number:
[METRICS-ROUND4-AB.md](METRICS-ROUND4-AB.md). Why each step went the way it did, day by day:
[log/status-log.md](log/status-log.md).

| role | pool | state |
|---|---|---|
| real training | **`strips_h1` — 4,456 rows** (b8 re-emitted under scheme H at a budget of 80, `--frozen-crops`, plus the rail's 35). Every row read or auto-accepted; the owner's corrections promoted 2026-09-16 (185 labels replaced, 4 rows removed, 0 rejects) | ✅ |
| synthetic training | **`strips_v7_final`, unchanged** — no render this round (owner) | ✅ |
| selection | **`_realval_v2r` — 260 strips** (+ `_tupletval`); the pick leaves out the 29 strips whose song is in the synthetic train split, so it reads **259** | ✅ |
| dense reading | **`_denseval_h1` (442 held-out strips) / `_denseval_h1_dense` (117, 54.7% over the old gate)**, built 2026-09-18 — no piece on the live model's train side, no exam piece | ✅ |
| grading | `examv3`, read **once**, on the model the owner picks; a dense extension and the third-source set stay **separate** columns | ⏭ blocked on that pick |

⛔ **Out:** `b8-review`; `strips_oldhuman` (Run B answered it); the raw old pools; `_realval_v2` for
anything but reproducing Round-3 numbers.

⭐ **WHERE ROUND 4 STANDS (2026-09-19).** Both arms trained on Colab 2026-09-16/17 — control from
Round 3's stage 1, H from its own — and **four paired reads plus two live-model reads are done**, all
counted in old ids. Three results:

1. ⛔ **The vocabulary is a NULL, including where it was meant to win.** H − control is +0.077/strip
   on `_realval_v2r` (p = 0.749), **+0.060 on the dense 117** (p = 0.549) and +0.016 over all 442
   (p = 1.000) — level at 34 vs 34 edits on the 325 short and medium strips, 7 worse on the dense ones.
2. ⭐ **Round 4's control beats the LIVE model, and the whole gain is dense.** Over 442: −0.020/strip
   (null). On the dense 117: **−0.111/strip, CI [−0.291, −0.009]** — −13 edits there against +4 on the
   rest. ⚠ 6 strips better / 1 worse, p = 0.125: **suggestive, not proven**.
3. ⭐ **H's remaining case is the decoder ceiling, not accuracy.** **5.91%** of all 15,711 candidate
   strips exceed 99 old ids — past `decode.ts`'s `MAX_TOKENS`, where the model stops early and returns
   silently wrong notes — against **0.30%** under H. ⛔ No gold pool can show it: the emitter dropped
   exactly those strips. ⚠ The app-side label-budget rail is the other candidate fix and needs no new
   vocabulary ([BACKLOG.md](BACKLOG.md) item 0). [METRICS-DENSE.md](METRICS-DENSE.md).

⏭ **TWO OWNER DECISIONS, AND THE ROUND WAITS ON BOTH.**
**(a) Which model is read on the exam** — recommendation on the evidence above: the **control**
(`r4-ctl-stage2`, old vocabulary), which is equal or better everywhere measured and changes nothing in
the shipped app. ⛔ **An H model cannot be read on the exam at all until `eval_omr.py` gains the
old-id mode** ([../CLAUDE.md](../CLAUDE.md)). **(b) Whether the dense-page claim gets a page-level
test** — H against the app-side rail, counted per page, which is the only instrument that can see it.
⚠ The exam is **one-shot per round** and the signed bar (≥75% of pages needing ≤5 corrections) is what
it grades.

⏭ **Two owner reading queues, both still unread**, neither blocking the exam:
**`ndhigh`** — 40 random rows of the 1,678 dense strips `b8` dropped as `over_budget` and `h1` drops
as `nd_high` (median **49** ids against **37** accepted, and nobody has read one); and **`handtest`** —
**457 of 515 rows** over the owner's 20 pages, the page-level instrument
([BACKLOG.md](BACKLOG.md) item 6). ⛔ Neither is gold and neither may become exam material
([METRICS-HANDTEST.md](METRICS-HANDTEST.md) · [rung3/labeling-queues.md](rung3/labeling-queues.md)).

⏭ **Owed inside the round, not started:** beam search measured offline (step 7), and the third-source
probe's only route to a verdict — more erdincbal pages, which need no hand labelling
([rung3/third-source.md](rung3/third-source.md)).

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
