# The app — settled context and the makam table

purpose: the settled facts about the shipped app, and the makam intonation table and how a page's makam is guessed
audience: anyone working on the app
updated: 2026-11-20

**Merged into this file on 2026-11-20:**

- [The app — server, hosting, editor, makam, speed](#the-app--server-hosting-editor-makam-speed) — was `docs/app/README.md`
- [Standing findings — the product track, established and still true](#standing-findings--the-product-track-established-and-still-true) — was `docs/app/README.md`
- [Makam selection — the performed intonation](#makam-selection--the-performed-intonation) — was `docs/app/README.md`


## The app — server, hosting, editor, makam, speed

*Was `docs/app/README.md` (last updated 2026-10-08).*

> Current state and the next action are NOT here: see [../STATUS.md](../STATUS.md). The rules that
> bind code anywhere in the app: [../APP-RULES.md](../APP-RULES.md). The commands:
> [../COMMANDS.md](../COMMANDS.md). Single features (voices, instrument views, phone, look, stored
> pages, visit counter, Play Store): [../features/README.md](../features/README.md).

This folder was `docs/mvp/` until 2026-10-08. The **MVP ladder W0–W10 is CLOSED** — the in-browser
pipeline was built, the server went live on 2026-08-06, two friends used it on 2026-08-11 and the
owner made it public on 2026-09-05. The ladder's own record is
[phases.md § MVP track — the in-browser pipeline, and a release to friends (CLOSED)](../archive/phases.md#mvp-track--the-in-browser-pipeline-and-a-release-to-friends-closed). What stayed live moved here.

| File | What it owns |
|---|---|
| [README.md § Standing findings — the product track, established and still true](#standing-findings--the-product-track-established-and-still-true) | Settled findings about the server, the build and the shipped features — background, not next actions |
| [server.md § Deploying the app — the server, the host, and what the friends…](server.md#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for) | Why decode runs on a server, what it costs, the safety checklist, the hosting choice |
| [server.md § Running and deploying the decode server — the commands](server.md#running-and-deploying-the-decode-server--the-commands) | **The commands** to run and redeploy the decode server, and how to swap or revert the model |
| [phases.md § Setting up Google Cloud — step by step, in plain words](../archive/phases.md#setting-up-google-cloud--step-by-step-in-plain-words) | Google Cloud from scratch, step by step (owner walkthrough) |
| [phases.md § Putting the app online — step by step, in plain words](../archive/phases.md#putting-the-app-online--step-by-step-in-plain-words) | Netlify + the Hub weights, step by step (owner walkthrough) |
| [server.md § Making a page faster — the options, with what each one costs](server.md#making-a-page-faster--the-options-with-what-each-one-costs) | How a page could get faster, what each option costs, and why all of it waits |
| [README.md § Makam selection — the performed intonation](#makam-selection--the-performed-intonation) | The makam intonation table, its sources, and how a page's makam is guessed |
| [editor.md](editor.md) | The editor brief — direct editing on the staff, Mus2-style |
| [editor.md § The editor — what each step BUILT, and the traps it found](editor.md#the-editor--what-each-step-built-and-the-traps-it-found) | What each editor step built, and the traps it found |


## Standing findings — the product track, established and still true

*Was `docs/app/README.md` (last updated 2026-10-08).*

> Moved out of [../STATUS.md](../STATUS.md) on 2026-08-08, when that file crossed its 400-line limit
> a second time. Nothing here is a next action; it is the background a next action rests on. The
> model track's equivalent is [README.md § Standing findings — the real-page track, established and still true](../rung3/README.md#standing-findings--the-real-page-track-established-and-still-true). Current state and what to
> do → [../STATUS.md](../STATUS.md). Dated history → [../log/status-log.md](../log/status-log.md).
> Every number with its source → [../METRICS.md](../METRICS.md). The (closed) MVP ladder → [phases.md § MVP track — the in-browser pipeline, and a release to friends (CLOSED)](../archive/phases.md#mvp-track--the-in-browser-pipeline-and-a-release-to-friends-closed).

---

### What ships, and where it runs

**W9 IS COMPLETE AND NOTHING IS OWED ON THE RUNG ITSELF.** The app is live at
**<https://komavision.netlify.app>** (Netlify, `dist/`), the weights are on the Hub at
**`Beyaban/omr-weights`**, decode is on Cloud Run behind the origin lock, and `npm run smoke:live`
passes on both paths against the deployed site — the shipped configuration, driven as a friend would.

**The decode server (2026-08-06):** `https://omr-decode-706571981988.europe-west3.run.app` — Cloud
Run, 1 vCPU / 2 GiB / concurrency 1 / max-instances 3 at launch (**10 since 2026-09-04**). Node +
`onnxruntime-node` importing the browser's own `decode.ts`, so there is **one decode implementation,
not a third**. The client swaps behind `VITE_DECODE_URL`. ⛔ It fell back to in-browser decode on any
failure until **2026-09-04**; since then a configured server that does not answer raises
`server-unavailable` and nothing is read on the visitor's machine ([../DECISIONS.md](../DECISIONS.md)). **It reads what the
browser reads** — 93.8% identical ids, and against gold a paired wash. The safety checklist is
complete. Costs and the concurrency measurement: [../METRICS.md](../METRICS.md), [server.md § Making a page faster — the options, with what each one costs](server.md#making-a-page-faster--the-options-with-what-each-one-costs).

⚠ **It is SLOWER than the owner's own browser (0.66×), plus a 10.6 s cold start** — **exactly what
[server.md § Deploying the app — the server, the host, and what the friends…](server.md#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for) predicted and what the release was chosen on**: the win is a friend's laptop
staying cool, not speed. The free tier still covers ~4× more than 50 users need.

⚠ **Two things are still OWED on the server.** A genuine cold start after real idle — the 2026-08-06
attempt FAILED, hitting a warm instance (`uptimeS` 315), so it needs container-start timestamps from
the logs. And one controlled read of `--cpu-boost`, which across two revisions has **not** beaten the
9.5 s it aimed at.

⚠ **Two bugs stood between "built" and "running", both the same shape** — what ships was never what
was tested (an ESM-bundle `require`, and a 503 that should have been a 413). `check:bundle` and a
live `check:limits` now cover them; the standing rule is in [../DECISIONS.md](../DECISIONS.md).

**The build (2026-08-06):** `build:app` produces **43.3 MB** and **fails** if the output crosses
60 MB or contains an `.onnx` — Vite copies all of `public/` (332 MB of graphs) into `dist/`, and
deleting a directory by hand is easy to forget. Weights come from `VITE_WEIGHTS_URL`, cached in Cache
Storage and fetched **only if the fallback fires**; `public/_headers` carries COOP/COEP, which
**Netlify** reads unchanged. `smoke:live` came out server 49.8 s, Hub-weights fallback 73.0 s, same
score, no page errors. It exists because the origin lock refuses a localhost preview, so
`smoke:build` can no longer reach the real chain. The two hosting traps and why Cloudflare Pages was
ruled out: [phases.md § Putting the app online — step by step, in plain words](../archive/phases.md#putting-the-app-online--step-by-step-in-plain-words).

⚠ **The `onnxruntime-web/wasm` shrink is deferred on purpose** — it changes the fallback's runtime.

⚠ **Do not delete the in-browser decode.** `gate:browser`, `parity:armb`, `parity:arma`,
`smoke:page` and the W3 browser-vs-gold result all rest on it; it is both the reference the server is
checked against and the live fallback path.

#### The bug that only exists in the built app

**The fallback hung forever.** The bundler inlines ORT's `…jsep.mjs`, which is *also* the worker
script, and a Worker has no `document`. Fixed by shipping ORT's runtime as real files (`/ort/`,
`wasmPaths`). ⚠ Dev, `smoke:page` and the 27/28 gate were all green while the thing a friend would
open was broken — which is the whole argument for `smoke:build`; it is a hard rule in
[../../CLAUDE.md](../../CLAUDE.md).

#### Two bugs the 2026-08-08 redeploy found, both fixed the same day

- **The cold-start fallback.** A warming container's truthful `503` made a friend's first upload
  after idle decode on their own laptop. The client now waits it out and pings `/health` on open,
  pinned by `check:coldstart`.
- **The "one giant note".** A grace note's merged bounding box stole **126 of 134 clicks** on the
  page; boxes reaching the SVG origin now fall back to the note's own ink, pinned by `smoke:editor`
  on a grace-note score.

Both are written up in full — mechanism, what was rejected, the numbers — in
[../log/status-log.md](../log/status-log.md); the rules they left behind are in
[../../CLAUDE.md](../../CLAUDE.md).

---

### Measurements that settled an argument

**⛔ THE BATCHING ARGUMENT FOR HAVING A SERVER IS WITHDRAWN — measured, not argued (2026-08-06).**
Batch 8 is **slower at every thread count** and costs **2.9× the peak memory**, so `OMR_MAX_BATCH`
defaults to **1**. **The real second reason for a server is that native ORT is ~4× faster than
wasm.** The **"smaller upload" reason is withdrawn too** (median **1.7× the page image**).

**A page costs 11.7 vCPU-seconds at 1 vCPU** — the server's own `process.cpuUsage()`, which is what
Cloud Run bills. **1 vCPU is the cheapest shape by 2.5×**; the earlier 30–60 vCPU-s estimate was ~3×
pessimistic because it assumed the batching that does not exist.

**⛔ The confidence signal missed its pre-registered bar, and W8 is DROPPED (owner, 2026-08-05).**
The signal is real (flagged strips average **8.60 token edits vs 2.69**) but "flag 10% of tokens,
catch ≥60% of errors" is **NOT MET** — best at a 10% budget is **26.3%**, and a usable soft point
existed and was **not** taken. **The bar was not moved to fit the result.** That leaves half of the
2026-07-27 goal unbuilt, and saying so is the point of this paragraph. Nothing is deleted; it is a
strong candidate to return if a friend asks. Detail: [phases.md § MVP rungs — what each one established](../archive/phases.md#mvp-rungs--what-each-one-established).

---

### What the rungs established

**✅ W7 PASSED (2026-08-05): THE APP READS A WHOLE PAGE.** Upload an image, get a playable, editable,
saveable score — nothing stubbed. `smoke:page`: **7 staves → 16 strips → 344 notes / 28 measures**,
strip count matching local Python. The 35-second freeze was fixed by making `estimate_skew` a
**generator with two drivers**, with **no arithmetic change** (deskew angle identical 20/20). ⚠ A
hang at 0% CPU was Vite's dep optimizer full-reloading the tab mid-slice, not the port.
Detail: [phases.md § MVP rungs — what each one established](../archive/phases.md#mvp-rungs--what-each-one-established).

**✅ W0–W6 PASSED (2026-08-02/04) — the slicer port is done and the browser is not worse than
Python.** opencv.js bit-identical on all five primitives; the browser scored against the SAME
hand-verified gold as Python (**SER 0.0821 → 0.0818**, exact-match 60.2% both); the ported slicer
checked over 1,781 pages / 33,805 strips with the decode arm **paired** (McNemar p = 0.077).
Write-ups and the four hypotheses that died: [phases.md § MVP rungs — what each one established](../archive/phases.md#mvp-rungs--what-each-one-established). Numbers:
[METRICS-SLICER.md § Slicer port parity — does the TypeScript reproduce the Python?](../METRICS-SLICER.md#slicer-port-parity--does-the-typescript-reproduce-the-python).

⚠ Three things still bind: **agreement with an artifact is not correctness** (the `strips_v2`
manifests are not the bar — current Python reproduces 98.59%, and three criteria had to be restated
for it); **`prepPage` is not a no-op** (15.3% of pages take a real rotation); and the **86.0%
browser-vs-Python ceiling** is near-ties, not a resampler, so `preprocess.ts` is unchanged.

**A slice inspector, and two crop fixes (2026-08-05).** `/slices.html` shows every crop with the
slicer's own reasoning, its decoded label and its placement ([../MANUAL_CHECKS.md](../MANUAL_CHECKS.md)
Check 13) — it is how both were found: a slur above the staff shearing the beams below (beam loss
**−13.6%**, ⚠ an information argument, not a decode result), and the page latency fixed **exactly**
(36.6 → 1.3 s/page, a closed form for the skew sweep, **0 disagreements in 328 evaluations**).

**A decoded `\tup3` that could not close was drawing the WRONG rhythm, and is fixed (2026-08-05).**
Owner-reported as "`\repstart`/`\repend`/`\tup3` are not seen in the sheet"; it was two different
things. **Repeats are not lost** — they are consumed into an UNFOLDED playing order, the wanted
behaviour; **92.3% of pages unfold**, the rest carry a `\repstart` the model never closed and are
left alone rather than guessed at. **Triplets were genuinely broken**: an unclosed run yielded no
group, so every member snapped to the nearest plain value — a definitely-wrong rhythm with no mark
saying so, now **0**. ⚠ `tupletGroupsIn` is shared with the label serializer, so both moved: **5
measures in 1 of 190 training pieces**, on a future re-render only. ⚠ **`verify-labels.ts` cannot see
this** — the real check was rendering the 3 worst pages through both draw paths with 0 dropped
measures. Reasoning: [../DECISIONS.md](../DECISIONS.md).

---

### The three features that shipped outside the ladder

**MAKAM SELECTION (W9.5, shipped 2026-08-07).** Playback used to sound every note where the staff
spells it, which is the written skeleton and not what a player plays. The app now guesses the makam
from a decoded page's own signature and karar, confirms it in a prompt, and bends the **sounding**
komas to that makam's performed intonation — uşşak's segah 1.5 commas below its written koma-bemol,
and an explicit *no deviation* for hüseyni, the contrast the whole feature turns on. **Sound only:
the engraving, the document and the training strips never move.** Audibly correct on **204/213**
bundled scores. Table, sources and the guessing rule: [README.md § Makam selection — the performed intonation](#makam-selection--the-performed-intonation).

**THE STYLE PASS (W9.6, done 2026-08-07, live 2026-08-08).** The harness is now **KomaVision**, in
**Turkish**: upload is the hero (drag, drop or paste), the transport keeps the controls a musician
touches, the rest fold into a collapsed **Gelişmiş**. Scope held: presentation only — slicing,
decode, the fallback and the origin lock did not move. `smoke:build` came out `9/26/399/26` on both
paths, **identical to the pre-editor run**.

⚠ **Three controls came back up on 2026-08-08** (owner): transposition, *porte değişmesin* and
*arıza işaretleri* sit in the transport bar, because a ney player transposing a score is using the
app as intended and should not have to open "geliştirici ayarları"; the transposition list now speaks
**komas**, named by the scale degree one lands on ("4 ses (22 koma)"). ⚠ The palette was repainted
İznik turquoise on 2026-08-08 — tokens only, no layout moved.

Underneath it, the load-bearing change: **the deploy checks no longer read the copy** — `#omr-status`
carries `data-state / kind / where` + counts (`apps/web/src/ui/status.ts`), which is what let the UI
become Turkish without touching one assertion.

**THE EDITOR REWORK (W9.7, steps 1–8 and 10, 2026-08-07/08).** Edit mode is a Mus2-style armed
palette beside the sheet: click a note to select, **✕** to delete, **drag** to move its pitch
(carrying its accidental across the octave seam), **undo/redo** (buttons + Ctrl/⌘+Z); arm a value, a
rest or any of the thirteen koma signs and click a note to apply it, or click blank staff to
**insert** one — pitch from the click's height, previewed by a ghost notehead. **ÜÇLEME** makes and
unmakes triplets, with everything illegal dim and unclickable rather than erroring. A `+`/`−` badge
marks any bar off the **derived meter**; **edits absorb and bar lines never move**. The palette's own
**Çal plays from the last edited bar**. Editing is **whole-score, not measure-scoped**, and there is
**no zoom**. Steps 1–8 are checked on the **deployed production bundle** as well as on dev — worth
keeping up, because `smoke:editor` cannot see that build.

Underneath it, one set of edit primitives (`packages/core/src/edits.ts`) serves every edit path,
which fixed a live bug on the way: the piano roll moved a dragged note's *sound* and left its
notehead behind (`updateEvent` never rewrote `noteName`).

⚠ **The per-measure modal was deleted out of order, at the owner's request.** It took four things
with it; **two came back into the palette the same day** (owner's call): an **Es row of six rest
values** — arm one and click blank staff, or click a note to turn it into a rest, and a note value on
a rest turns it back, pitched by the click's height — and **all thirteen alterations**, the numbered
±2/±3 and the previously-missing ±8 included. Still gone: editing a **lyric syllable** and typing an
exact **koma/Hz**. ⚠ A ±2/±3 is stored exactly and **drawn snapped** to the nearest AEU sign, because
that is what a Turkish edition prints.

⚠ Slice 1 deviated from the brief in one place, on purpose: the per-note rects are **local
`SheetView` state, not part of `onLayout`** — that payload is the training-strip crop contract.

⚠ **Settled, do not re-open:** **repeats stay uneditable** (the stitcher unfolds them), **tuplets are
exactly three notes** (the drawn digit is hardcoded "3") and their members must be **plain `1/2^k`
values** (a dotted run's ×⅔ never closes), **token-editing was rejected**, an edit **absorbs into its
bar and bar lines never move**, and a bar over *or* under its length **warns** rather than blocking —
against the **derived meter**, not `Measure.lengthBeats` (which is computed from the bar's own
contents and so is true by construction). ⚠ Deliberately unbuilt and said so in the brief: **an edit
still stops playback**; resume-in-place is deferred, not done.

⚠ **Now visible, and still unverified:** that meter check flags **8/28 interior bars on a decoded
page vs 0/200 across three clean scores** — error localisation, free, from a warning the editor
needed anyway. n = 1 page; verify before promising it.

The traps worth knowing before touching any of it (Bravura ink outside its em box; a tuplet is **not
stored**, so the check counts drawn marks in both styles; bar 1 is exempt from the short-bar warning):
**[editor.md § The editor — what each step BUILT, and the traps it found](editor.md#the-editor--what-each-step-built-and-the-traps-it-found)** and the brief **[editor.md](editor.md)**.

### The 2026-08-09 copyright + koma-bemol deploys, and the raw-token panel

Moved out of STATUS.md on 2026-08-11 (it holds only "now" and "next"). Settled; no next action here.

**The copyright redeploy went out 2026-08-09 and the live site is now what we mean to publish.**
Before it, the deployed build served five bundled SymbTr scores — CC BY-NC-SA, which would bind the
whole app to NonCommercial forever, and two were compositions still in copyright under FSEK 5846.
All five answered **200** on the live host that morning and all five answer **404** now, alongside
`/scores/` and `/models/`. The legal footer ships. The full account — what was found, why removal
beat attribution, and the enforcement — is [THIRD-PARTY.md](../THIRD-PARTY.md); the decision row is in
[DECISIONS.md](../DECISIONS.md); the hard rule is in [../CLAUDE.md](../../CLAUDE.md). The model card is
now on the Hub as `Beyaban/omr-weights/README.md`.

Green for that deploy: `typecheck`, `build:app` (11 files, 42.7 MB, no score at the dist root, both
real URLs baked in and no `localhost:8080` left in the bundle), and `smoke:live` **PASS on both
paths** — numbers in [METRICS.md](../METRICS.md). `npm test` (217/217), `smoke:editor` (**ALL PASS**,
including the grace-note geometry section) and `smoke:page` were green in this HEAD on 2026-08-08 and
no source moved since.

**A second deploy went out the same day: the sheet no longer shows a koma bemol as a küçük bemol.**
Owner report from real use — in `Standart (ölçü boyunca)` the staff dropped the sign on any
alteration pointing the same way as the donanım, so it read as the signature's size while the audio
played the true koma (**134 of 213 bundled scores** have at least one such letter). The
`sigTolerant` printing rule is now the **renderer's only**: on for render jobs, which must imitate
real printed pages, off for a human. The corpus is untouched — same glyph tally on `?mode=measure`
before and after — and pixels==labels holds on both settings. Decision row in
[DECISIONS.md](../DECISIONS.md), account in [log/status-log.md](../log/status-log.md). Green for it:
`typecheck`, `npm test`, `smoke:editor`, a fresh `build:app` (both real URLs, no `localhost:8080`),
`smoke:live` **PASS on both paths**, and the fix confirmed **on the deployed bundle** (51 signs on
the human path vs 40 on `?mode=measure`, same score).

**And the model's own tokens are visible in the app** (owner request): `Gelişmiş` → **Modelin ham
çıktısı** shows, per strip of the last read, every token the model produced with its confidence,
the truncation flag, and the stitcher's warnings — the answer to "the model saw it, so why is it not
on the page". Nothing kept those tokens before; `stitchDecoded` consumes them. `smoke:app` asserts
it. Walkthrough: check 22 in [MANUAL_CHECKS.md](../MANUAL_CHECKS.md).


## Makam selection — the performed intonation

*Was `docs/app/README.md` (last updated 2026-09-05).*

Pipeline stage 9, the makam half. Design and the rest of the stage: [CODE_TOUR.md § Inference pipeline — from a full uploaded image to editable notes](../CODE_TOUR.md#inference-pipeline--from-a-full-uploaded-image-to-editable-notes).
State and next action: [../STATUS.md](../STATUS.md). Numbers: [../METRICS.md](../METRICS.md).

### The problem

Playback used to sound every note exactly where the staff spells it. That is the **written
skeleton**, not what a performer plays. Arel-Ezgi-Uzdilek has four accidentals — koma (±1), bakiye
(±4), küçük (±5), büyük (±8) — and several perdes are performed away from all of them, because the
notation has no sign for where they really sit. Uşşak's segah is played below its written
koma-bemol; Sabâ's hicaz above its written bakiye-bemol; Hüzzam's hisar higher than written.

The page cannot tell you this. Only the makam can. So the app guesses the makam, asks the user to
confirm, and bends the **sounding** komas accordingly.

**The written staff never moves.** The deltas reach `buildTimeline` and nothing else — not the
engraving, not the saved document, not the training strips. Selecting a makam changes what you hear, never
what the OMR claims it read. `none` is the identity and the default.

### The intonation table

Lives in `MAKAM_INTONATION` (`packages/core/src/makam.ts`). A rule matches a note by its **written**
letter + written alteration, at every octave, and adds a signed comma delta to the sounding koma.
Deltas are fractional on purpose — the audio path is float, and the sources are not comma-integers.

| Makam(s) | Written perde | Delta | Sounds at | Why |
|---|---|---|---|---|
| ussak, beyati, bayati, isfahan, besteisfahan, bestenigar, karcigar, saba | segah — `B` at −1 | **−1.5** | −2.5 | Dügâh→segah collapses from AEU's 8 commas (181 c) to the 6–7 of practice, the *eksik büyük mücennep*; descent pulls it lower still. −1.5 is the midpoint, giving 6.5 commas ≈ 147 c |
| saba | hicaz — `D` at −4 | **+1.5** | −2.5 | Rauf Yektâ's 12/11 çargâh–hicaz puts 2.5 commas of flatness on the re-bemol, not 4 |
| huzzam | hisar — `E` at −4 | **+1** | −3 | The hüzzam pentachord's augmented second shrinks from 12 commas to ~10.5–11 |
| segah, huzzam | segah karar — `B` at −1 | **−1** | −2 | The Ottoman segah perde sits about a comma below the Arelian one |
| huseyni, muhayyer, tahir | — | **none** | — | Documented as **not** taking the uşşak lowering — hüseyni approaches segah higher, audible in its cadences |

Everything else is absent from the table: selectable in the dropdown, plays as written.

The last row is not padding. It is the reason detection has to work: hüseyni and uşşak print nearly
the same si koma-bemol and mean different perdes, so "same signature ⇒ same sound" is exactly the
inference that must not be made. Do not "complete" the table by symmetry.

**Deliberately not modelled.** Direction — the rules have no ascending/descending axis, though the
uşşak lowering is strongest in descent and karcığar's hicaz-on-nevâ is an *average* of the two.
Transposition — rules key on written spelling, which is right for canonical notation (each makam
written at its own perde) and wrong for a page written in another key; there is no degree-relative
resolution yet.

#### Sources

- TDV İslâm Ansiklopedisi: [Uşşak](https://islamansiklopedisi.org.tr/ussak) ·
  [Hüzzam](https://islamansiklopedisi.org.tr/huzzam) · [Sabâ](https://islamansiklopedisi.org.tr/saba)
- [Türk musikisinde "sabâ" perdesinin nazariye ve icra analizi](https://dergipark.org.tr/en/download/article-file/3479433) (DergiPark)
- Hazım Gökçen, [Uşşak](https://www.hazimgokcen.net/turk-sanat-muzigi/ussak-makami/) /
  [Hüseyni](https://www.hazimgokcen.net/turk-sanat-muzigi/huseyni-makami-2/) /
  [Hüzzam](https://www.hazimgokcen.net/turk-sanat-muzigi/huzzam-makami/) — the uşşak/hüseyni contrast
- Yarman & Karaosmanoğlu, [Yarman-36 makam tone-system](https://www.ozanyarman.com/files/Yarman36.pdf)
  — the general AEU-vs-praxis mismatch
- Akkoç, [Experiments on the relationship between perde and seyir](https://sethares.engr.wisc.edu/paperspdf/MP3204_02_Akkoc.pdf)

The literature disagrees on the magnitudes (uşşak's lowering is variously 1–2 or 2–3 commas). The
table takes the midpoint where sources conflict and records the reasoning in each rule's `why`
string, which is what the UI shows. Changing a number is a one-line edit; **update this table too.**

### What the picker says (2026-09-05)

The dropdown marks a deviating makam with a **♪**, which says that *something* moves without saying
what. `apps/web/src/ui/MakamIntonation.tsx` is the rest of the answer, beside the picker and again
inside the post-decode prompt — one component in both places, so the two cannot describe one makam
two ways. Per rule it shows the **written perde** (Si with its koma-bemol drawn as the real Bravura
sign), **how far the note is really played from it** ("1,5 koma pes"), and **how many notes of this
score** the rule reaches; `neden?` unfolds the rule's own `why`.

Three things it does deliberately:

- **The count is the score's, not the table's.** A rule is a claim about a perde, not about the page
  in front of you. `makamRuleUsage` walks the same matcher `makamKomaDeltas` walks — both over
  `eachRuleMatch` — so the number on screen and the pitches playback bends cannot drift apart.
- **Zero is shown, not hidden.** Hüzzam's hisar matches nothing on `gamzedeyim-deva`, and the line
  says *bu eserde yok* rather than promising a bend nobody will hear.
- **A makam that bends nothing gets one sentence** — *"Bu makam yazıldığı gibi çalınıyor."* — for
  every reason it might bend nothing (owner, 2026-09-05, cutting a first version that split "the
  sources report no deviation" from "not in our table"). ⚠ The difference is real and it lives
  **here and in the table**: hüseyni's `[]` is a finding, an unlisted makam is silence, and the
  empty arrays must never be deleted as clutter. It is just not a difference the transport bar owes
  a reader who is asking whether the piece will sound as it looks.

Contract for the checks: `[data-omr="makam-intonation"]` carries `data-makam` / `data-rules` /
`data-notes`, and each `[data-omr="makam-rule"]` carries `data-letter` / `data-alter` / `data-delta`
/ `data-notes` — so a check reads which perde bends and by how much without matching Turkish copy.
`npm run smoke:editor` re-derives the count from `window.__omrDoc` and asserts it.

#### ⛔ The trap: the deltas are keyed by the WRITTEN document

`makamKomaDeltas` returns a map keyed by `NoteEvent.index` **of the written score**. A transpose
keeps those indices; **`unfoldDoc` does not** — it renumbers every event to a fresh 1..N. Applying
the written map to a performance therefore bends whatever note now holds that number, and **nothing
throws**, because every index still exists. The page just plays out of tune.

Two things renumber, and the second is the one that surprises: a repeated bar (one written note,
several sounding ones) — and, on a page with **no repeat at all**, the `meta` events the unfolder
drops (`groupMeasures` skips them, shifting every later index down).

It shipped that way from 2026-08-30 to 2026-09-05 and was found **by ear**, not by a check: on
`gamzedeyim-deva` under uşşak, **19 of the 22 bent notes were the wrong ones** — a Re, a La, a Do
and a 2-koma si taking the segah's lowering, while three landed right by luck. The fix is
`remapKomaDeltas(deltas, played.srcOf)`, and `tools/core/makam-test.ts` pins it.

⚠ **Re-key, do not bend before unfolding.** `perf.doc` is what the instrument views read, and a
kanun course is looked up by an exact **written** koma — a fractional one misses it. The bend
belongs to the timeline and to nothing else.

⚠ **A segah spelled `b2` is not matched, and that is correct — it is a SymbTr artefact** (owner,
2026-09-05). The rules key on the exact written alteration while the staff draws the nearest AEU
sign, so on the bundled SymbTr exports a `Si4b2` and a `Si4b1` are one koma-bemol on screen and only
the second bends: `gamzedeyim-deva` **22 against 54**, `beyati-delisin` **0 against 40**. ⛔ **A real
page cannot spell one.** The model's vocabulary is the 8 AEU accidentals plus a natural
(`ADDED_TOKENS`), and a printed edition prints only those four signs, so a decode yields ±1/±4/±5/±8
— `decoded.json`, the one bundled score that came from a photograph, reads 2 `b1` / 0 `b2`. Do not
"fix" the matcher by snapping: it would make the editor's deliberate ±2/±3 stop meaning what they
say, for one hand-placed note. Full reasoning and the two residues: [../BACKLOG.md](../BACKLOG.md).

### Guessing the makam from a decoded page

A decoded page has no metadata — `tools/render/stitch.ts` writes `makam: ""` — so `detectMakam`
reads it out of the notes:

1. **Signature.** `deriveKeySignature(doc)` → `signatureKey` → the exact string
   `data/makam_signatures.json` is keyed on (`"\komaFlat b \bakiyeSharp f"`). No match at all →
   `none`, and playback stays as written.
2. **Karar.** The last sounding note, as written. Required, not garnish:
   `\komaFlat b \bakiyeFlat e \bakiyeSharp f` is printed by **hüzzam** (karar segah),
   **karcığar** (dügâh) and **sûznâk** (rast) — three makams, three different intonations, one
   signature. `MAKAM_KARAR` covers only the makams where the karar disambiguates or is certain;
   guessing the rest would add wrong labels for no gain.
3. **Contradiction ⇒ decline.** If some candidate declares a karar and the piece ends somewhere
   else, return `none` rather than rank. A wrong makam detunes notes that should not move; `none`
   only declines to help.
4. **Otherwise rank by corpus weight** — how many adjudication-confirmed real strips showed that
   makam printing that signature.

The user is then asked (`apps/web/src/MakamModal.tsx`), and the prompt shows its own evidence — the
signature it matched, the karar it used, the makams that share the signature — because "Hüzzam"
with nothing behind it is not something anyone can sanity-check.

Accuracy, and the caveat that it is measured on clean scores rather than decoded pages:
[../METRICS.md](../METRICS.md).

### Where the code is

| Piece | File |
|---|---|
| Table, karar, detection, deltas | `packages/core/src/makam.ts` |
| Signature table (GENERATED — do not hand-edit) | `packages/core/src/makamSignatures.ts` |
| Its generator (`--ts-out` / `--from-json`) | `scripts/build_makam_signatures.py` |
| The prompt | `apps/web/src/MakamModal.tsx` |
| The line beside the picker, shared with the prompt | `apps/web/src/ui/MakamIntonation.tsx` |
| The rules, the deltas, the re-key and the picker's counts | `tools/core/makam-test.ts` (in `npm test`) |
| Dropdown + the audio wiring (`makamDeltas` / `makamUsage` → `timeline`) | `apps/web/src/App.tsx` |
| Smoke-check dismissal helper | `tools/browser/makamPrompt.ts` |

Two duplications are deliberate and both are pinned by tests:

- `SIG_TOKEN_BY_ALTER` in core mirrors `AEU_TOKEN` in `tools/render/lilypond.ts` — core must not
  depend on `tools/`, and the label path is load-bearing enough not to move. `npm test` round-trips
  every signature in the generated table through both vocabularies.
- `packages/core/src/makamSignatures.ts` mirrors `data/makam_signatures.json` — the app ships
  without `data/` and without Python. One script writes both; re-emit with
  `--from-json data/makam_signatures.json --ts-out packages/core/src/makamSignatures.ts` so a
  refresh of the TS copy cannot silently rewrite the JSON from whatever pools are on the machine.

### Adding a makam to the table

1. Find its signature in `data/makam_signatures.json`. If it is missing, the makam is not in the
   corpus and detection will never propose it — add a `THEORY` row in the builder first.
2. Add a `MAKAM_KARAR` entry **only if you are sure**, and a `MAKAM_INTONATION` entry **only with a
   source**. An empty array is a real answer and belongs in the table when a source says so.
3. Add the row to the table above, with the citation. The rule's `why` is what the picker prints,
   so write it in plain Turkish for a reader, not as a note to yourself.
4. `npm test` (signature vocabulary), `npm run typecheck`, `npm run smoke:editor` (the picker's
   line), then check 14 in [../MANUAL_CHECKS.md](../MANUAL_CHECKS.md) — the only check that uses
   your ears.
