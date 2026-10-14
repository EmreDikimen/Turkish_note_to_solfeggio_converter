# Status — where the project is and what happens next

purpose: the ONLY file that states current state or next action; rewritten each session, never appended to
audience: anyone starting work — read this before doing anything
updated: 2026-10-14

## Now

⭐ **THE APP IS PUBLIC** — <https://komavision.netlify.app>, posted on LinkedIn by the owner on
2026-09-05, ahead of the exam gate every plan assumed. That was the owner's call. Three things follow
from it and are live today:

1. ⚠ **Visitors read with ROUND 4 CONTROL `r4-ctl-stage2-last`** (owner, 2026-09-28) — Cloud Run
   revision **`omr-decode-00008-hx7`**, `maxScale` **10** (both read off the service on 2026-10-08),
   and the same int8 graphs on the Hub, hash-checked after upload. **It is NOT an exam pass**: Round
   4's exam is unread, and `r4-ctl` beat the previous model only as a *lead* on dense strips
   ([METRICS-ROUND4-AB.md](METRICS-ROUND4-AB.md)). ✅ **The browser gate pins 26/28 since
   2026-10-08**, after its one `\tie` gold was rewritten tie-free — the old "27/28" had been
   unreachable since 2026-09-03 ([METRICS-ONNX.md](METRICS-ONNX.md)). ⭐ **To swap or revert the
   model, follow the seven hops in [app/deploy-ops.md](app/deploy-ops.md)** — a web deploy alone does
   not change what a visitor reads, and the weights' `CACHE_NAME` (missed at the 2026-09-28 swap)
   must move too.
2. ⛔ **Cloud Run capacity is live, and nothing falls back.** Since 2026-09-04 a cold or dead server
   shows `server-unavailable` instead of reading on the visitor's device. A cold start measured
   **38.2 s**; at concurrency 1 an over-capacity request **queues** behind `--max-instances 10`, and
   `WARMUP_WAIT_MS` is **120 s**. ⏭ **`--min-instances 1` is the owner's open call** — it removes the
   cold start and costs money continuously ([app/deploy-ops.md](app/deploy-ops.md)).
3. ✅ **THE COUNTER COUNTS — DAILY TOTALS ONLY, SINCE 2026-10-14.** `STATS_SALT` and `STATS_TOKEN`
   are set; the redeploy that day dropped the per-device hash and the country (a row is a day's total
   per kind of browser), with `privacy.html` rewritten in the same deploy; a second deploy that day put back each row's first and last visit time, again with `privacy.html`. ⚠ The first dashboard read
   after it **deletes every old `d/` row** — the owner was told to screenshot first. ⏭ **Owner:**
   update the Play **Data safety** form — Photos stay; add **App activity → App interactions**
   (collected, not shared, not ephemeral, required, Analytics); deletion question → **No** (180 days)
   ([features/visit-stats.md](features/visit-stats.md)).

⏭ **PLAY STORE: THE 14-DAY CLOSED TEST STARTED 2026-10-14**, the day the twelfth tester opted in —
so "Üretime başvur" opens around **2026-10-28** if the count never drops below 12 (a drop restarts
it; the owner is recruiting a margin). Closed test v1 passed review the same day it was sent. ⏭ Before
applying: the **Data safety** form (item 3), and the owner's own feedback log (what testers said,
what changed). ⚠ The owner chose to ship **no updates during the test** for now; the voice-cache fix
(2026-10-12) waits uncommitted on `main`'s working tree. ⚠ Chrome's "Running in Chrome" notice
appears on launch and cannot be switched off from the app.
[features/play-store.md](features/play-store.md).

**What the live site carries** (last web deploy **2026-10-14** — the counter and `privacy.html`; before it **2026-10-09**, `Deploy is live!`, `smoke:live` PASS —
server read 24 strips / 229 notes in 64.6 s, refusal arm clean; `assetlinks.json`, `privacy.html`,
the manifest and the drum wavs answer 200):
the phone rebuild (2026-09-26..28 — the score fits the phone, the Çal tab folds under Çal/Dur, typed
tempo, the dot tool, ▲/▼ note steps, tap-not-press), the **PWA** (installable; no service worker, on
purpose), **PNG/PDF** saving, violin retuning and finger numbers, the per-measure accidental default,
the first-ending repairs (2026-09-07), the clarinet's lip meter, and the **Tezhip restyle** with the
logo and the Istanbul backdrop, and (2026-10-09) the `CACHE_NAME` bump to `r4-ctl`. ⚠ Never opened
on a real iPhone.

⭐ **ROUND 3 IS CLOSED AND ROUND 4 IS OPEN (owner, 2026-09-03).** Round 3's exam read **51%** against
the signed 75% floor (63 graded pages, about ±12 pp); ~15 of its +17 points was the retired `\tie`.
The owner's hand test outranks the instruments for the SHIP call
([archive/rounds/round3.md](archive/rounds/round3.md)); the signed bar still governs what may be
**published as a model** ([archive/rounds/round3-criteria.md](archive/rounds/round3-criteria.md)) —
and two models have now gone live on judgement rather than on that bar.

⛔ **THE SHIPPED APP CAN RETURN SILENTLY WRONG NOTES ON DENSE PAGES.** At inference an over-long strip
cannot be dropped, so the model stops early and confidently; **5.91%** of real candidate strips
exceed the decoder's ceiling in the old vocabulary. Two candidate fixes, neither measured on pages —
[BACKLOG.md](BACKLOG.md) item 0.

⏭ **THE SLICER IS FROZEN — treat it as frozen unless the owner says otherwise.** A whole staff row
goes missing on 14% of pages and `STAFF_RESCUE` is the fix, **shipping OFF**; a lost row is NO crop,
so no accuracy metric shows it. ⛔ The row-level scorers are blind to staff-count changes
(`score_slicer.py --pair-by-position` exists; `score_barlines.py` has no fix). ⚠ Whether the TRAINING
pools are ever re-cut with the rescue ON is undecided ([METRICS-SLICER-ROOTS.md](METRICS-SLICER-ROOTS.md)).
`GEOMETRY_REV` is 20260903; `--frozen-crops` is the one safe way past it. Rules:
[../CLAUDE.md](../CLAUDE.md) · [METRICS-SLICER.md](METRICS-SLICER.md) ·
[METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md).

⏭ **COLLECTION IS NARROWED TO TWO TARGETS**: pages drawing the concave tuplet mark, and
tuplet-dense instrumentals (sirto, longa, saz semaisi). 2,486 unlabelled page PNGs already sit on
disk, so volume relieves nothing. ⚠ A third target — a third engraving house — is deferred; Round 4's
probe was a null, and more erdincbal pages are its only route to a verdict ([BACKLOG.md](BACKLOG.md)
item 10).

## Next

**The two tracks run in parallel**: the product track never trains, the model track never touches
the app, and neither waits for the other.

### Track A — the product

1. ⏭ **The Play Store closed test** (above) — the owner's priority this week.
1b. ⏭ **A React Native app, Android and iOS together, started in parallel (owner, 2026-10-11).**
   Nothing is built yet: three choices are owed before the skeleton — Expo or bare, where a phone
   slices a page, how the score is drawn ([mobile/plan.md](mobile/plan.md) §Open).
2. ⏭ **The Play Data safety form** (item 3 above) — must match the counter before the production
   application.
3. ⏭ **Five shipped things no eye has judged** —
   [MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md) checks 25–29, via `npm run dev:cloud`:

   | # | Check | The question it answers |
   |---|---|---|
   | 25 | the violin view | Does the dot sit where your finger would? Open strings are the free calibration — the dot must be **at** the nut. Is the finger number the one you would use? |
   | 26 | the kanun view | Is the opening mandal plan one you would set? Does the flash last long enough? Should the close-up be the default? |
   | 27 | the editable signs | Does marking a page up FEEL like marking a page up? |
   | 28 | the playhead follow | Does the jump land where a reader wants to be looking? |
   | 29 | the pinned Çalma row | — |

   ⚠ Do **not** report the violin's thin high positions as a finding (~7 px per koma near the nut is
   the photo's resolution). ⚠ A fix needs its own deploy, then `smoke:live`, which checks neither
   images nor audio — spot-check both by hand.
4. 🚧 **The phone rebuild's owed half**: the phone's own component tree, the `data-phone` /
   `phone.css` split, a category-switching tool strip, and **`tools/browser/phone-smoke.ts` — the gate
   with the nine asserts, which does not exist yet**. ⚠ `npm run smoke:phone` is a probe, never a
   gate; `npm run smoke:app` is red for a reason that predates this work (verified against `a52ce28`).
   [features/phone.md](features/phone.md).
5. ⏸ **A from-scratch UI lives on branch `ui-rebuild`** (pushed 2026-10-01). The owner prefers the
   `main` UI for now — do not merge it unasked.
6. ⏸ **Speed is deferred**: a page takes **~35–55 s**; splitting a page across instances is the only
   option that touches the wait, and **the trigger to build it is a user saying the wait is
   annoying** ([app/latency.md](app/latency.md)).

⚠ **Traps left behind by finished work**, now living elsewhere: `deploy:app` needs
`--filter @turkish-omr/web` or nothing publishes ([app/hosting-setup.md](app/hosting-setup.md));
**`dev:cloud`, not deploying, keeps the Mac cool**; voices ride **`VITE_VOICES_URL`**, and setting
`VITE_AUDIO_URL` in a deploy 404s the drums into synthesis, silently ([../CLAUDE.md](../CLAUDE.md));
ney has **no** CC0 source and oud and tanbur stay Karplus–Strong — not a queue to work down; if the
voices should be louder the order is per-voice `gain` → a `Çalgı sesi` slider → **never**
`MASTER_GAIN`; ⛔ **never re-run the first-time `gcloud run deploy` block against the live service** —
it would reset `--max-instances` and `ALLOWED_ORIGINS` ([app/deploy-ops.md](app/deploy-ops.md)).

### Track B — the model (Round 4, open since 2026-09-03)

Plan, levers, the owner's decisions and where each step ended: **[rung3/round4.md](rung3/round4.md)**.
Every Round-4 number: [METRICS-ROUND4-AB.md](METRICS-ROUND4-AB.md).

| role | pool | state |
|---|---|---|
| real training | **`strips_h1` — 4,456 rows** (b8 re-emitted under scheme H at a budget of 80, `--frozen-crops`, plus the rail's 35); every row read or auto-accepted; the owner's corrections promoted 2026-09-16 | ✅ |
| synthetic training | **`strips_v7_final`, unchanged** — no render this round (owner) | ✅ |
| selection | **`_realval_v2r` — 260 strips** (+ `_tupletval`); the pick leaves out the 29 strips whose song is in the synthetic train split, so it reads **259** | ✅ |
| dense reading | **`_denseval_h1` (442 held-out strips) / `_denseval_h1_dense` (117)** — no piece on the live model's train side, no exam piece | ✅ |
| grading | `examv3`, read **once**, on the model the owner names; dense and third-source columns stay **separate** | ⏭ blocked on that call |

⛔ **Out:** `b8-review`; `strips_oldhuman` (Run B answered it); the raw old pools; `_realval_v2` for
anything but reproducing Round-3 numbers.

**Where Round 4 stands** — both arms trained 2026-09-16/17; every read counted in OLD ids:

1. ⛔ **The vocabulary is a NULL, including where it was meant to win** — H − control +0.077/strip on
   `_realval_v2r` (p = 0.749), +0.060 on the dense 117 (p = 0.549), +0.016 over all 442 (p = 1.000).
2. ⭐ **The control's whole gain over the previous live model is dense**: −0.111 edits/strip on the
   dense 117, CI [−0.291, −0.009], 6 strips better / 1 worse, p = 0.125 — **suggestive, not proven**.
   It went live on that lead (2026-09-28).
3. ⭐ **H's remaining case is the decoder ceiling, not accuracy**: 5.91% of 15,711 candidate strips
   exceed 99 old ids against 0.30% under H, and no gold pool can show it ([BACKLOG.md](BACKLOG.md) item 0).

⏭ **TWO OWNER DECISIONS, AND THE ROUND WAITS ON BOTH.**
**(a) Which model is read on the exam.** The live model is `r4-ctl-stage2-last`, but that was a
ship call, not the exam pick. The evidence above recommends the **control** (old vocabulary): equal
or better everywhere measured, and nothing in the app changes. ⛔ An H model cannot be read on the
exam until `eval_omr.py` gains the old-id mode. ⚠ The exam is one-shot per round.
**(b) Whether the dense-page claim gets a page-level test** — H against the control-plus-app-rail,
counted per page, the only instrument that can see it.

⏭ **Two owner reading queues, both unread, neither blocking the exam**: **`ndhigh`** — 40 random
rows of the 1,678 dense strips the budget used to drop (median **49** ids against **37** accepted);
and **`handtest`** — **457 of 515 rows** over the owner's 20 pages, the page-level instrument.
⛔ Neither is gold and neither may become exam material ([METRICS-HANDTEST.md](METRICS-HANDTEST.md) ·
[rung3/labeling-queues.md](rung3/labeling-queues.md)).

⚠ **Two risks the round carries whatever the owner picks**: synthetic labels stop at **44** H ids
while the real pool reaches 51, so the long band exists only in real material; and every `\sig`
block in the exam still carries the old model-voted override — part of the exam's signature error
class may be bad gold ([RISKS.md](RISKS.md)).

## Where the rest lives

None of these contains a next action.

| For | Read |
|---|---|
| Owed but not next, with the reason it is deferred — ⚠ several are deferred *because* acting would confound something in flight | [BACKLOG.md](BACKLOG.md) |
| What is measured but fragile, and what we do NOT claim — ⚠ read before quoting any number or believing any green check | [RISKS.md](RISKS.md) |
| The app's settled context (the server, the build, the shipped features) | [app/standing.md](app/standing.md) |
| The model track's settled context (real-val v2, the re-slice, the round positions) | [rung3/standing.md](rung3/standing.md) |
| The feature track and the other product docs (phone, look, Play Store) | [features/README.md](features/README.md) |
| What happened on any given day, and why | [log/status-log.md](log/status-log.md) |
| Plans that were abandoned — do not act on them | [log/superseded.md](log/superseded.md) |
| Everything else | [INDEX.md](INDEX.md) |
