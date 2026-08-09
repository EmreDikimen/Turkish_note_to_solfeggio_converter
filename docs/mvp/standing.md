# Standing findings — the product track, established and still true

purpose: the settled context behind the product track — what is already built and known, so STATUS can hold only "now" and "next"
audience: agents and the owner working the product side
updated: 2026-08-08

> Moved out of [../STATUS.md](../STATUS.md) on 2026-08-08, when that file crossed its 400-line limit
> a second time. Nothing here is a next action; it is the background a next action rests on. The
> model track's equivalent is [../rung3/standing.md](../rung3/standing.md). Current state and what to
> do → [../STATUS.md](../STATUS.md). Dated history → [../log/status-log.md](../log/status-log.md).
> Every number with its source → [../METRICS.md](../METRICS.md). The ladder itself → [README.md](README.md).

---

## What ships, and where it runs

**W9 IS COMPLETE AND NOTHING IS OWED ON THE RUNG ITSELF.** The app is live at
**<https://komavision.netlify.app>** (Netlify, `dist/`), the weights are on the Hub at
**`Beyaban/omr-weights`**, decode is on Cloud Run behind the origin lock, and `npm run smoke:live`
passes on both paths against the deployed site — the shipped configuration, driven as a friend would.

**The decode server (2026-08-06):** `https://omr-decode-706571981988.europe-west3.run.app` — Cloud
Run, 1 vCPU / 2 GiB / concurrency 1 / max-instances 3. Node + `onnxruntime-node` importing the
browser's own `decode.ts`, so there is **one decode implementation, not a third**. The client swaps
behind `VITE_DECODE_URL` and falls back to in-browser decode on any failure. **It reads what the
browser reads** — 93.8% identical ids, and against gold a paired wash. The safety checklist is
complete. Costs and the concurrency measurement: [../METRICS.md](../METRICS.md), [latency.md](latency.md).

⚠ **It is SLOWER than the owner's own browser (0.66×), plus a 10.6 s cold start** — **exactly what
[deploy.md](deploy.md) predicted and what the release was chosen on**: the win is a friend's laptop
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
ruled out: [hosting-setup.md](hosting-setup.md).

⚠ **The `onnxruntime-web/wasm` shrink is deferred on purpose** — it changes the fallback's runtime.

⚠ **Do not delete the in-browser decode.** `gate:browser`, `parity:armb`, `parity:arma`,
`smoke:page` and the W3 browser-vs-gold result all rest on it; it is both the reference the server is
checked against and the live fallback path.

### The bug that only exists in the built app

**The fallback hung forever.** The bundler inlines ORT's `…jsep.mjs`, which is *also* the worker
script, and a Worker has no `document`. Fixed by shipping ORT's runtime as real files (`/ort/`,
`wasmPaths`). ⚠ Dev, `smoke:page` and the 27/28 gate were all green while the thing a friend would
open was broken — which is the whole argument for `smoke:build`; it is a hard rule in
[../../CLAUDE.md](../../CLAUDE.md).

### Two bugs the 2026-08-08 redeploy found, both fixed the same day

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

## Measurements that settled an argument

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
strong candidate to return if a friend asks. Detail: [rungs.md](rungs.md).

---

## What the rungs established

**✅ W7 PASSED (2026-08-05): THE APP READS A WHOLE PAGE.** Upload an image, get a playable, editable,
saveable score — nothing stubbed. `smoke:page`: **7 staves → 16 strips → 344 notes / 28 measures**,
strip count matching local Python. The 35-second freeze was fixed by making `estimate_skew` a
**generator with two drivers**, with **no arithmetic change** (deskew angle identical 20/20). ⚠ A
hang at 0% CPU was Vite's dep optimizer full-reloading the tab mid-slice, not the port.
Detail: [rungs.md](rungs.md).

**✅ W0–W6 PASSED (2026-08-02/04) — the slicer port is done and the browser is not worse than
Python.** opencv.js bit-identical on all five primitives; the browser scored against the SAME
hand-verified gold as Python (**SER 0.0821 → 0.0818**, exact-match 60.2% both); the ported slicer
checked over 1,781 pages / 33,805 strips with the decode arm **paired** (McNemar p = 0.077).
Write-ups and the four hypotheses that died: [rungs.md](rungs.md). Numbers:
[../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

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

## The three features that shipped outside the ladder

**MAKAM SELECTION (W9.5, shipped 2026-08-07).** Playback used to sound every note where the staff
spells it, which is the written skeleton and not what a player plays. The app now guesses the makam
from a decoded page's own signature and karar, confirms it in a prompt, and bends the **sounding**
komas to that makam's performed intonation — uşşak's segah 1.5 commas below its written koma-bemol,
and an explicit *no deviation* for hüseyni, the contrast the whole feature turns on. **Sound only:
the engraving, `Save JSON` and the training strips never move.** Audibly correct on **204/213**
bundled scores. Table, sources and the guessing rule: [makam.md](makam.md).

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
**[editor-built.md](editor-built.md)** and the brief **[editor.md](editor.md)**.
