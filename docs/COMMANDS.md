# Commands — every command this project has, with its traps

purpose: every command — the app, the Python tools, and training on Colab — with the ⚠ traps that make one fail silently
audience: anyone about to run anything; `../CLAUDE.md` keeps the everyday few and points here

updated: 2026-11-20

> ⚠ **Read the ⚠ lines, not just the command.** Several of these have a failure mode that looks like
> success — a build that publishes nothing, a render that silently produces an uncovered corpus, a
> decode that quietly moves onto your own laptop. Those warnings are the reason this file exists.

Split out of [../CLAUDE.md](../CLAUDE.md) on 2026-08-23 when it crossed the 400-line cap. Genre
split: that file keeps the **rules and the orientation** an agent must not miss, plus the handful of
commands used every session; this one holds the **full reference**. Nothing was dropped in the move.

Python lives in `.venv-ml` (training/data only, never shipped). Node workspaces at the root.

### Every session

```bash
npm run dev:web                      # harness → http://localhost:5173 (decode on YOUR machine)
npm run dev:cloud                    # the same harness, but decode runs on Cloud Run — see below
npm run typecheck                    # all workspaces
npm test                             # stitcher + label round-trip + edit primitives + usul strokes + voice manifest
                                     # …plus violin fingering (the 53-TET position formula + string choice),
                                     # …the kanun's mandals, and the sol klarnet's fingerings + lip bound
                                     # …and the slicer's screenshot-frame step against Python's bytes (frame-test.ts)
                                     # …plus the makam intonation table AND the two 2026-09-05 ear-found bugs:
                                     # ⚠ WHICH DOCUMENT the koma deltas and the usul tracks are built over
                                     # …plus the written-score → performance maps (tools/tests/structure-test.ts)
npm run check:fold                   # every cached page decode: does keeping the repeat SIGNS change the sound?
                                     # …expect 1720 pages, 0 changed. Needs data/real/strips_v2 (this machine only)
npm run smoke:editor                 # real app: select, drag, delete, undo/redo, the palette, rests, tuplets
                                     # …plus the instrument voices; add --voices-url <hub> for the REAL samples
                                     # …and note-box geometry on a GRACE-NOTE score (see the rule below)
                                     # …and the fingerboard tab: the marker lands on a string and MOVES
```

### Hearing the instrument voices (they do NOT ship with the app)

```bash
npm run dev:voices                   # dev:web with VITE_VOICES_URL on the Hub — the ONLY way to hear the real
                                     # ⚠ clarinet/violin/kanun; plain dev:web has no host and plays the synth
npm run serve:voices                 # serve data/audio_voices/ on :8788, to hear a voice BEFORE it is uploaded…
npm run dev:voices:local             # …and point the app at it. ⚠ `python -m http.server` will NOT do: the dev
                                     # server sets COEP require-corp, so a static server sending no CORS/CORP
                                     # header gets the file BLOCKED — and the app reports the voice as FAILED
                                     # while it plainly serves fine in a browser tab
npx tsx tools/dev/clarinet-chart.ts out.html   # sol klarnet: all 33 fingerings as one HTML page, for a player to audit
npx tsx tools/dev/clarinet-editor.ts out.html  # …and the editor that produced it: click points per note, copy the JSON back
```

### The browser decode — gates and parity

```bash
npm run gate:browser                 # in-browser ONNX gate, headless — expect 26/28 (docs/METRICS.md)
npm run probe:cv                     # opencv.js vs OpenCV-Python parity (MVP W0)
npm run check:logprobs               # browser confidence signal vs onnx_parity.py (MVP W1)
npm run smoke:app                    # real app: strip crops in → playable score out (MVP W2)
npm run smoke:page -- --ref ref.json # real app: a PAGE image in → playable score out (MVP W7)
npm run check:deskew                 # the skew sweep's fast path is EXACT vs the morphology (W7)
npm run check:edge                   # does the browser decode path fail GRACEFULLY on images that are not
                                     # ⚠ strips (W2)? The bar is "does not throw", never "reads them correctly"
npm run parity:armb -- --pages 20    # browser-vs-Python decode ceiling (MVP W2/W3)
npm run parity:arma -- --pages 20    # ported slicer's crops vs Python's, PAIRED (MVP W6)
npm run parity:slicer -- --ref ref.json                # ported slicer vs local python (MVP W4-W6)
npm run decode:pool -- --pool <dir> --out f.json       # decode a flat strip pool IN THE BROWSER and dump the
                                     # token streams, for ml/prep/score_browser_gold.py to score against GOLD (W3)
                                     # ⚠ `--server <url>` decodes the same pool on the SERVER instead (W9):
                                     # agreement cannot say which side is RIGHT, and only gold can
```

### The decode server and the deployable app (W9 — SHIPPED)

**It is live**: app <https://komavision.netlify.app> (Netlify), weights `Beyaban/omr-weights`
(Hugging Face Hub), decode on Cloud Run behind `ALLOWED_ORIGINS`. Setup recipe and its two traps:
[archive/phases.md](archive/phases.md#putting-the-app-online--step-by-step-in-plain-words).

⚠ **DEPLOYING IS NOT HOW YOU GET THE WORK OFF THIS MACHINE — `npm run dev:cloud` is** (owner asked
2026-08-11, wanting a cool laptop rather than a public URL). It is `dev:web` with `VITE_DECODE_URL`
pointed at the live Cloud Run service, which works from localhost because `:5173` and `:4173` are in
`ALLOWED_ORIGINS`. Verified end to end: `data-where="server"`, 27.3 s of decode on Cloud Run against
1.6 s of slicing locally. Plain `dev:web` sets no decode URL, so it decodes **in your browser** and
heats the Mac — that is the difference between the two lines above. ⛔ There is no fallback any more
(2026-09-04): if the service is cold past its 120 s wait or down, `dev:cloud` shows
`server-unavailable` and reads nothing — it never quietly moves the read onto this machine. The raw
decode inspector says where a page was read (`sunucuda okundu` / `bu bilgisayarda okundu`).

⭐ **LOOKING AT IT ON A REAL PHONE: EXPOSE THE DEV SERVER, THEN ADD ITS ORIGIN TO CLOUD RUN.** The
phone has to reach the Mac and the Mac's origin has to be on the decode server's allowlist — and
missing the second step produces an error that names the wrong cause.

```bash
ipconfig getifaddr en0                                   # the Mac's address on the network
VITE_DECODE_URL=https://omr-decode-706571981988.europe-west3.run.app \
  npm run -w @turkish-omr/web dev -- --host 0.0.0.0 --port 5173 --strictPort
# then, ONCE per address (this creates a new revision, so warm it afterwards):
gcloud run services update omr-decode --region europe-west3 \
  --update-env-vars '^@^ALLOWED_ORIGINS=https://komavision.netlify.app,http://localhost:5173,http://localhost:4173,http://<ADDRESS>:5173'
curl -s -o /dev/null -w '%{http_code}\n' https://omr-decode-706571981988.europe-west3.run.app/health
```

⛔ **`npm run dev:cloud -- --host` DOES NOT WORK** — that script ends in `npm run -w … dev`, so npm
eats the flag as its own instead of passing it to vite. Run the workspace's `dev` directly, as above.

⚠ **AN ORIGIN THE SERVER REFUSES IS REPORTED AS `server-unavailable`, WHICH READS AS "THE SERVER IS
ASLEEP"** (2026-09-20). The preflight comes back **204 with no `access-control-allow-origin` header**,
the browser drops the request, and the app cannot tell a CORS refusal from a dead container — so the
error offers *"sunucu uykudaysa uyanması yarım dakika sürebilir"* about a server answering `/health`
in 0.16 s. Waiting never fixes it. **Test the preflight, do not trust the message:**

```bash
curl -s -i -X OPTIONS https://omr-decode-706571981988.europe-west3.run.app/decode \
  -H 'Origin: http://<ADDRESS>:5173' -H 'Access-Control-Request-Method: POST' \
  | grep -i 'access-control-allow-origin'          # no line = the origin is not on the list
```

⚠ **The address is DHCP and will change**, and the day it does this fails again with the same
misleading message. ⚠ Deployed visitors cannot hit this — the site's own origin is on the list — so
it is a dev trap, not a user-facing bug.

`npm run deploy:app` is the one-command version of the two-command recipe in `hosting-setup.md`
(build with both URLs baked in, then `netlify-cli deploy --prod` to the pinned site id). It publishes
to the real site, so run it deliberately; `npm run smoke:live` after. ⚠ **A successful build is not a
deploy** — `netlify-cli` detects the npm workspaces and stops on an interactive "select the project"
prompt, which once let the recipe build cleanly and publish **nothing**. `--filter @turkish-omr/web`
is in the script for that reason; read the output for `Deploy is live!` rather than trusting exit 0.
⚠ `smoke:live` does not check the audio — spot-check `/audio/<kit>/<stroke>-rr1.wav` for 200 after a
deploy that touches it.
⚠ **A refusal UNMOUNTS `#omr-status`** (`App.tsx` renders the status line or the error box, never
both), so anything waiting on a read must count `#omr-error` **before** it asks the status line for
`data-state`, and must read the status line non-throwingly. Getting that order wrong costs a 30 s
timeout on a detached locator and reports the CHECK's bug as the app's — it did, on 2026-09-05,
while the site was refusing correctly in 5.1 s. Fixed in all three page smokes.

```bash
node apps/server/tools/prepare-models.mjs   # assemble apps/server/models from the browser's graphs
npm run dev:server                   # the decode server on :8080 — needs the line above once
    # ⚠ MODEL_DIR must be ABSOLUTE — it resolves against apps/server, not the repo root, so a
    # relative path silently 503s with "model failed to load".
    # ⚠ `npm run dev:web -- --port 5173` MANGLES the args: the inner script runs `vite 5173`, which
    # vite reads as the ROOT DIRECTORY, and every page 404s while the log still says "ready".
    # Run `npm run dev:web` bare (5173 is the default anyway).

# TRYING A SECOND MODEL SIDE BY SIDE — e.g. scheme H, which the shipped stitcher cannot parse:
.venv-ml/bin/python ml/omr/make_browser_gate.py --checkpoint data/checkpoints/<ck> \
    --onnx-dir data/checkpoints/<ck>-onnx --out data/checkpoints/_stage --n 3
    # ⛔ It REWRITES gate.json, golds included, when --strips-dir differs from the staged model's.
    # Stage a model for the LIVE site by copying the three graphs only, and leave gate.json alone —
    # otherwise `gate:browser` stops being comparable with every earlier reading. docs/METRICS.md
node apps/server/tools/prepare-models.mjs --from data/checkpoints/_stage --out apps/server/models-h
MODEL_DIR=$PWD/apps/server/models-h PORT=8081 npm run dev:server
npx tsx tools/dev/h-respace-proxy.mts --upstream http://localhost:8081 --port 8082
VITE_DECODE_URL=http://localhost:8082 npm run dev:web
    # ⛔ The proxy is NOT optional for scheme H: straight at :8081 the app produces 0 svg and no
    # score; through :8082 it reads the page normally. docs/CODE_TOUR.md
npm run parity:server -- --pages 6 --fixture f.json   # server vs browser; --replay f.json skips the browser
npm run bench:server -- --fixture f.json              # vCPU-seconds per page, payload bytes
npm run check:limits                 # the deploy safety checklist, against a running server
npm run check:bundle                 # the BUNDLED server boots — not the same artifact as dev:server
npm run check:coldstart              # a COLD server still gets the page (needs a running dev:server)
VITE_DECODE_URL=http://localhost:8080 npm run smoke:page   # the app THROUGH the server
    # ⚠ Point it at a server that ANSWERS. Since 2026-09-04 a dead URL no longer exercises the
    # fallback — the app refuses and reads nothing; the refusal is smoke:build's and smoke:live's.
npm run build:app                    # the deployable app — FAILS if the weights leak into dist/
npm run smoke:build                  # builds, then drives the BUILT app: server, local (opt-in), refusal
npm run smoke:phone                  # opens the app at four PHONE sizes and MEASURES: sideways scroll,
                                     # tap targets under 32px, iOS zoom-on-tap fields, where the toolbox lands
                                     # …screenshots → tmp/phone-shots/ (PHONE_SHOTS=<dir> to move them)
npm run smoke:live                   # drives the DEPLOYED site — server path, then the refusal
```

### Saving a score (PNG / PDF)

```bash
npm run check:export                 # SAVE a score as PNG and PDF in Chromium, Firefox AND WebKit (~1 min); --scheme dark too;
                                     # …every glyph outlined, no blank page, engines agree. ⚠ needs
                                     # …`npx playwright install firefox webkit` once. Files land in tmp-export-check/
```

### The visit counter (F6)

```bash
npm run stats:ui                     # the owner's dashboard → http://localhost:5173/admin-stats.html
npx tsx tools/dev/make-icons.ts   # re-draws the logo: favicon.svg + the PWA icons (apps/web/public/icons/)
netlify env:set STATS_SALT  "$(openssl rand -hex 32)"   # without this NOTHING is counted, by design
netlify env:set STATS_TOKEN "$(openssl rand -hex 24)"   # what the dashboard asks for; no token, no data
npx tsx tools/tests/visits-test.ts                  # the arithmetic (also inside `npm test`)
```

**Is it actually live? One request tells you, and the status code names the fault:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://komavision.netlify.app/.netlify/functions/stats
```

| Code | What it means | Fix |
|---|---|---|
| **401** | the counter is deployed and `STATS_TOKEN` is set — it just refused an empty token. **This is the healthy answer** | nothing; open the dashboard |
| **503** | deployed, but no `STATS_TOKEN` on the site | `netlify env:set STATS_TOKEN …`, then redeploy |
| **404** | the site deployed WITHOUT its functions | redeploy with `npm run deploy:app` (it carries `--functions`) |

⚠ **`stats:ui` pins port 5173 (`--strictPort`) and that is deliberate**: the dashboard reads a
deployed site from `localhost`, and only the ports in `DEV_ORIGINS` (`netlify/functions/stats.mts`)
are allowed to. Letting vite drift to 5174 when 5173 is busy would turn a busy port into a CORS
error that reads like a broken token. It now refuses to start instead, which is the legible failure.

⚠ **`deploy:app` carries `--functions netlify/functions` — without that flag the site deploys fine and
the counter is simply absent.** The dashboard reports it as a 404 in plain Turkish rather than drawing
an empty chart, which is the failure mode that would otherwise be easy to read as "nobody came".
⚠ **The dashboard is NOT on the deployed site and must never be.** Vite builds `index.html` and nothing
else, so `admin-stats.html` exists on the dev server only; the token on `stats.mts` is the lock that
actually protects the data. ⚠ **Rotating `STATS_SALT` is not housekeeping** — yesterday's device ids and
today's stop matching, so a device active across the change is counted twice.
⭐ **Open the real site once as `?nostats=1` on your own phone and laptop.** It stops counting you, and
a past count already had to have the owner's own phone subtracted by hand
([METRICS.md](METRICS.md#metrics--who-actually-uses-the-deployed-app)). `?nostats=0` undoes it.
Full design and its limits: [features/README.md](features/README.md#f6--the-visit-counter-and-the-owners-private-dashboard).

⚠ **`smoke:phone` is a PROBE, not a gate — it prints findings and always exits 0.** Read it, do not
grep it for a word. Two of its lines are expected and are not bugs: `div#sheet-surface` reported wide
is the engraved sheet scrolling sideways **inside its own box**, which is the design; and the footer's
prose links are under 32px because they are links inside a sentence. ⚠ **Never give it
`fullPage: true` screenshots.** A full-page shot makes Chromium resize the viewport and it does not
restore the touch emulation afterwards, so every measurement after it reports the phone as having a
**mouse** — every `(pointer: coarse)` rule switches off and fixed things read as broken. It only ever
showed on the 667px screen, the one short enough for the shot to need a resize, which is why it looked
like a 375px bug for a round. The probe now prints a loud line if a page thinks it has a mouse.

⛔ **THE FALLBACK IS OFF WHERE A SERVER IS CONFIGURED (owner, 2026-09-04), AND THAT CHANGED THREE
CHECKS.** A cold or dead container no longer routes to the browser; the app raises
`server-unavailable` and reads nothing ([../CLAUDE.md](../CLAUDE.md)). So: `smoke:build` runs
**three** arms — server, a local read that OPTS IN (`localStorage.omrAllowLocalDecode`, which is how
the built bundle is still proven able to decode), and the refusal; `smoke:live`'s second arm is the
**refusal**, where it used to assert `data-where="local-fallback"` — the outcome that must now never
happen; and `smoke:page` pointed at a dead port simply fails, because there is nothing left for it
to exercise. ⚠ In all of them the assertion with teeth is that **no `data-where` appears at all** —
a build that read the page locally would report one.

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

All Python is the `ml/` package — `ml/omr` (slicer, training, eval), `ml/labels` (the real-page
label tools), `ml/prep` (corpus and asset prep), `ml/symbtr` (the SymbTr parser) — since
2026-11-20. **Once per machine:** `.venv-ml/bin/pip install -e .` from the repo root; after that
every script runs as `.venv-ml/bin/python ml/<part>/<script>.py` and imports `ml.omr.data` etc.
⛔ Never add a `sys.path` line. The full Python reference is the next section.

**Merged into this file on 2026-11-20:**

- [Commands — Python: training, the corpus, and the slicer](#commands--python-training-the-corpus-and-the-slicer) — was `docs/COMMANDS-PYTHON.md`
- [Training on Google Colab — first-timer's guide](#training-on-google-colab--first-timers-guide) — was `docs/COLAB.md`


## Commands — Python: training, the corpus, and the slicer

*Was `docs/COMMANDS-PYTHON.md` (last updated 2026-11-15).*

Split out of [COMMANDS.md](COMMANDS.md) on 2026-09-07 when that file crossed the 400-line cap. Genre
split: that file keeps the **app** — the dev servers, the browser gates, the deploy, the visit
counter; this one keeps **Python, which never ships**. Nothing was changed in the move.

> ⚠ **Read the ⚠ lines, not just the command.** Several of these have a failure mode that looks like
> success — a scorer that reports a false regression, a cache that describes crops the slicer no
> longer cuts, an emit that silently drops the labels you meant to promote.

#### Python (training and data only — never shipped)

```bash
.venv-ml/bin/python ml/prep/slicer_ref.py --pages 120 --out ref.json   # slicer port control arm
.venv-ml/bin/python ml/prep/frame_whiten_ref.py   # `whiten_frame` on six synthetic pages -> sha256.
    # ⚠ Run after ANY change to the screenshot-frame rule and paste the hashes into
    # tools/tests/frame-test.ts, or `npm test` fails: that test holds the browser port to these bytes.
    # ⚠ `--token-budget N` runs the SAME arm under the LABEL-BUDGET rail. The reference fixes the
    # packing rule as well as the sample, and `parity:slicer` refuses a ref that mixes the two.
.venv-ml/bin/python ml/omr/page_to_strips.py <page.png> --out <dir> --debug
    # slice ONE page and write the overlay. `<page>_debug.png` legend: GREEN = detected staff lines,
    # BLUE = an accepted barline, RED box = a strip crop, and the rejects colour-coded by WHY —
    # ORANGE gate2_fat, AMBER gate2_ends, YELLOW gate3_blob, PURPLE gate3_clef, GREY xrange. ⚠ A row with NO blue line
    # found no barline at all and is being cut by WIDTH, straight through the music.
.venv-ml/bin/python ml/labels/score_slicer.py --sample 25   # ⚠ a 124-row SAMPLE, see below
.venv-ml/bin/python ml/labels/score_slicer.py              # the real instrument: 6,440 rows, ~30 min
.venv-ml/bin/python ml/labels/score_slicer.py --pair-by-position
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
.venv-ml/bin/python ml/labels/build_barline_truth.py && open data/real/rung3/_barline_truth/mark.html
    # cut the hand-marking sheets, then click every printed barline
    # (n/p = row, f = fit to window, c = clear the row, s = save)
    # ⚠ The row list is INLINED into mark.html on purpose — a browser refuses `fetch` from a file://
    # page, and the first build rendered a BLANK sheet with nothing in the console to say why.
    # and drop `barline_truth.json` back into that folder. ⚠ Mark ALL of a row's barlines, not just
    # the missed ones, or precision cannot be scored. ⚠ Do NOT mark where a staff starts and stops —
    # the slicer always emits those two boundaries itself, so they test nothing and are dropped. ⚠ The sheets deliberately show NOTHING the
    # slicer found — a marker shown the answer anchors to it, the same rule the exam gold lives by.
.venv-ml/bin/python ml/labels/score_barlines.py
    # what the measure count cannot say: RECALL, PRECISION, and for every miss WHICH GATE rejected
    # it — or `never_a_candidate`, meaning gate 1 (continuity + touching both staff lines). Honours
    # the slicer's env flags, so it A/Bs a gate change directly. The gate-3 ones:
    #   OMR_BLOB_LINE=0   the staff line counts as an attachment again (2026-08-24 behaviour)
    #   OMR_BLOB_FILL=0.3 how much of a row's width ink must span to BE the staff line (ships 0.4)
    #   OMR_STAFF_ROW_POS=0 gate 2's staff rows go back to fill-only, ignoring WHERE the lines are
    #   OMR_BAR_FADE=0.25 gate 1's fade tolerance, ships OFF — turned on 2026-08-25 and reverted
    #                    the same day: free on the 4 faded pages, net -76 rows at full scale
    #   OMR_END_BLOBS=0   gate 2b OFF: a stroke with wide ink at BOTH ends (a head and a beam) is a
    #                    barline again, the 2026-09-02 behaviour — METRICS-SLICER-STAFF.md
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
npx tsx tools/checks/parity/rescue-check.ts
    # does a BROWSER-ONLY toggle actually fire? Drives the real slicer harness in headless chromium
    # and prints staff counts per page with the rescue off and on. It exists because `STAFF_RESCUE`
    # is a compile-time constant flipped through a setter, so no Python run can test it — and
    # because a `parity:slicer` pass with a flag OFF executes none of the flagged code.
.venv-ml/bin/python ml/labels/measure_fill_score.py --decode-root data/real/strips_v2
    # the LABEL-FREE accuracy proxy: a strip covers n measures, so its decode must fill n x the
    # page's meter, and an early `</s>` comes up short. ⚠ ALWAYS read it beside
    # `--calibrate <gold manifest.jsonl> --meter-from data/real/strips_v2` — that is the same
    # scorer over hand-verified labels, and everything it flags there is the PROXY's own false
    # alarm (7.6% under-fill). `--compare <root>` pairs two decode roots ON PAGES, never on
    # strips: two packing rules cut different crops, so no strip-to-strip pairing exists.
.venv-ml/bin/python ml/labels/decode_budget_arm.py --pages 120 --budget 57
    # arm B for the line above. Arm A is FREE — `strips_v2` already holds every page decoded under
    # the shipped rule with `round2-stage2-best` int8 — so only the rail's crops need decoding.
    # ~21 min for 120 pages on the laptop. Resumable; refuses a page whose arm-A cache used
    # another checkpoint.
.venv-ml/bin/python ml/labels/budget_sweep.py --pages 200
    # which budget? No decoding: it re-windows ONE stage-1 geometry at every candidate and reports
    # windows recovered into the trainable set against the near-empty crops over-splitting makes.
    # Answer (2026-08-23): b=57. Recovery is flat b=40..59, so the value rides on cost alone.
.venv-ml/bin/python ml/labels/budget_tail_probe.py
    # where should the label budget SIT? Free — tokenizes labels that already exist. Reads
    # emit_responses.json, NOT the manifest: the question is about the strips the gate threw away.
    # Answer (owner, 2026-09-07): 80 under scheme H, where every earlier pool used 59. 59 was never
    # a model limit — the ceiling is 100 (decode.ts MAX_TOKENS, data.collate), and past it a label
    # is TRUNCATED at 99. ⚠ The gate lives in FOUR files and they move together: the emitter,
    # audit_coverage.py, promote_labels.py --vocab, train.py --select-max-length.
.venv-ml/bin/python ml/labels/token_scheme_probe.py [--checkpoint <ckpt>] [--json-out f.json]
    # what a note-spelling scheme costs, BEFORE any training. No GPU, no model, no decode; ~2 min.
    # Encodes every label in strips_v7_final + strips_b8 + the over_budget labels emit_responses.json
    # kept, under three vocabularies (today / B / H), and reports lengths per pool, strips rescued,
    # whether synthetic still covers the real length range, and how each pitch segments.
    # ⚠ Run it before adding ANY token: ids are append-only, and this is what caught `''` and `'''`
    # being used zero times under H (2026-09-06). Results: docs/rung3/tokenization.md.
.venv-ml/bin/python ml/omr/eval_omr.py --checkpoint data/checkpoints/<ckpt> [--strips-dir …]
.venv-ml/bin/python ml/omr/decode_page.py <page.png> --checkpoint <ckpt> --onnx-dir <dir> --suffix _int8
.venv-ml/bin/python ml/labels/build_handtest_queue.py --mapping <pages.tsv>
    # the OWNER'S HAND-TEST pages as a review queue (queue id `handtest`): decode them first with
    # decode_page.py --out data/real/rung3/_handtest, then build. ⚠ NOT gold and NOT the exam —
    # `label` is empty on every row and the filename is neither emit_review.csv nor full_audit.csv,
    # so promote_labels.py cannot read it. Verdicts are a CORRECTION COUNT: ok = the model read it
    # right, fix = the model was wrong, bad = the crop is unusable. Corrections per page = rows that
    # are not `ok`. Re-running carries verdicts across by strip name — but NOT across a re-slice,
    # because the crop moves and the verdict was given against pixels.
.venv-ml/bin/python ml/labels/build_denseval.py [--apply] [--min-ids 49] [--out DIR]
    # the DENSE evaluation pool: strips_h1's HELD-OUT side, filtered by label length in OLD ids.
    # Report-only without --apply. Built because every Round-4 read landed on `_realval_v2r`, which
    # is 5.8% over-budget material against the real-page 14.5% — docs/METRICS-EXAM.md.
    # ⚠ OLD ids for every model: a pool cut with H's tokenizer would hold different strips per arm.
    # ⚠ --real-val-frac must match the training run (0.10), or the held-out set is a different one.
    # ⛔ It refuses to build if an exam piece is on the held-out side. NOT the exam: not page-complete,
    # not one-shot; quote it as a strip pool, like real-val.
.venv-ml/bin/python ml/labels/decode_page_arms.py <page.png> [--prefix NAME] [--int8]
    # ONE page, sliced ONCE, decoded by the live model / Round 4 control / scheme H (+ --int8 for
    # the live ONNX a visitor actually gets), each stitched to apps/web/public/scores/<prefix>_<arm>.json
    # and printed as a `?score=` link. Run `npm run dev:web` and open them side by side.
    # ⭐ The single slice is the whole point: if each arm re-sliced, a page difference could be the
    # SLICER — docs/METRICS-SLICER.md prices how often a re-cut moves pixels.
    # ⛔ canonical_label is applied for every arm on the way to the stitcher: stitch.ts cannot split
    # scheme H's glued decode, and without it an H page collapses to a few empty measures. For the
    # old-vocabulary arms the re-spaced stitch is byte-identical to the raw one (verified on meltem1).
    # ⛔ Scores land in public/scores/ — gitignored AND on prune-dist.mjs's DROP list, so they cannot
    # reach a build; a .json at the dist ROOT fails the build by design (third-party engravings).
    # ⚠ It does NOT rename the documents: doc.name seeds the tuplet bracket-or-arc hash, so renaming
    # the arms would re-engrave their triplets and the pages would differ for a non-model reason.
    # ⚠ NO GOLD — pictures to look at, never a number. It warns (does not refuse) when a word in the
    # filename also appears in testset.json; check the piece by hand. ⛔ Never point it at the exam.
.venv-ml/bin/python ml/labels/build_model_compare.py [--pool DIR ...] [--limit N]
    # Decodes every strip of one or more pools with THREE checkpoints (live / Round-4 control /
    # scheme H) and writes strip + gold + all three decodes to data/real/rung3/_compare/models.json.
    # ~0.25 s per strip per model on the M4's GPU; the default two pools are 465 strips ≈ 10-14 min,
    # so run it with `nohup nice -n 19` and read the log at the end (stdout is BUFFERED to a file).
    # ⚠ Edits AND agreement are on the OLD-id scale (canonical_label + the old vocabulary), the same
    # rule as paired_arm_score.py --score-vocab old — so H is not flattered by spelling a note in
    # fewer ids, and its glued decode (`b''32a''32`) is not counted as a disagreement.
    # ⚠ The control column is `r4-ctl-stage2-last`, the UNBIASED pick. Swapping it for `best-edits`
    # makes the edit column incomparable with the published dense numbers — say so if you do.
    # ⚠ A pool with no manifest.jsonl (a bare page's crops) is accepted and has NO gold: those rows
    # are model-against-model only. ⛔ Never point it at the exam.
.venv-ml/bin/python ml/labels/compare_ui.py [--data F] [--port 8378]
    # Reads that file → localhost:8378. Strip picture, gold, and all three decodes side by side,
    # with the tokens that differ from gold painted red. Filters: agreement (all three / exactly two
    # with the odd one named / none), which model is the odd one out, gold present, label length,
    # `nd`, and a piece/file search. ⛔ READ-ONLY — it writes nothing, which is why it is a separate
    # tool from review_ui.py rather than a queue in it.
    # ⚠ NOTE NAMES (do re mi fa sol la si) are ON by default, `n` toggles them — the same display
    # rule review_ui.py and apps/web/src/omr/solfege.ts apply, so a strip reads the same way in all
    # three. The alignment still runs on the LilyPond LETTERS, so toggling cannot move which token
    # is painted red, and nothing on disk is rewritten.
    # ⛔ IT IS NOT A MEASUREMENT. It shows rows in the order you ask for; quoting "H looked worse"
    # off it repeats the mistake the round already paid for. A number needs paired_arm_score.py,
    # with its interval, on a pool chosen before looking. docs/METRICS-EXAM.md
.venv-ml/bin/python ml/labels/review_ui.py            # labeling/verdict UI → localhost:8377
    # ⚠ THE HINT COLUMN IS NORMALISED ON READ, NEVER ON DISK: the retired \tie is dropped and a
    # spaced `32` is re-glued (2,914 rows over 25 queues, every one verified id-identical in both
    # vocabularies). The model writes `f'' 32` because the base alphabet has no digit 3 — scheme H
    # removes the cause. ⛔ 32 ONLY: 16 and 8 DO differ in id space. docs/rung3/tokenization.md
    # ⚠ THE EDIT-BOX LINT PRICES IDS UNDER THE QUEUE'S OWN VOCABULARY, and it says which one
    # on screen (`= 42/80 ids (vocab h)`). The h1-* queues are scheme H, everything else is
    # the old alphabet; the list and the budget are IMPORTED from ml/omr (data.py,
    # audit_coverage.MAX_IDS_BY_VOCAB), never copied into the UI. A new H pool needs its queue
    # id adding to QUEUE_VOCAB or the lint will price it with the wrong alphabet.
    # ⛔ THE RETIRED `\tie` IS DROPPED FROM THE `decoded` HINT ON THE WAY TO THE BROWSER, so a
    # reviewer cannot read it, diff against it, or store it with `✓ accept` (which saves the
    # decode verbatim). The CSV keeps it: `load_queue(clean=True)` is asked for by the two READ
    # paths only, never by save_verdict, so no file is laundered a verdict at a time. The
    # Round-2 exam queues (exam-fix, examv2-*) are EXEMPT — their ties are the record.
.venv-ml/bin/python ml/labels/repair_realval_v2.py --report | --queue | --build
    # `_realval_v2` carries 157 rows out of the OLD pool with the CURRENT crop under them —
    # build_realval_v2.py copies strip_root's PNG for every carried row and never compares the
    # measure span. --report classifies (keep / drop-duplicate / re-home-by-span / needs-a-human),
    # --queue writes the 10-row `realval-repair` queue, --build assembles `_realval_v2r`.
    # ⛔ --build REFUSES while any review row is unverdicted. ⚠ `_realval_v2` is left intact:
    # every Round-3 number was measured on it. docs/METRICS-SLICER.md
.venv-ml/bin/python ml/labels/verdict_attribution.py [--active-only] [--retired]
    # Splits the owner's verdicts into "the LABEL was wrong" vs "the MODEL was wrong", by error
    # kind, from data already on disk — no model runs. ⚠ --active-only is the ANCHORING CONTROL and
    # is usually the number you want: the edit box is seeded with the label's \sig plus the
    # decode's notes, so on a passive row `truth` equals the seed by construction and the
    # attribution restates the seeding. Only 7-28% of rows were actively re-typed.
    # ⛔ Counts are in LABEL-TOKEN space (error_taxonomy.relabel), never eval_omr edit counts.
    # docs/METRICS-DIAGNOSTICS.md
.venv-ml/bin/python ml/labels/build_ndhigh_queue.py [--n 40]
    # Stages a RANDOM sample of the 1,678 dense strips b8 dropped as over_budget and h1 drops as
    # nd_high, as review_ui queue `ndhigh`. ⚠ Random, NOT worst-first — every other queue here is
    # worst-first to harvest labels; this one is read for a RATE, so ordering would bias it.
    # `label` is empty (a dropped strip has no stored label), so it settles one question: does the
    # model read dense material correctly. ⛔ Not gold; refuses to overwrite an existing file.
.venv-ml/bin/python ml/labels/carry_old_fixes.py [--apply]
    # Finds the RETIRED pools' 1,479 hand corrections again inside strips_b8 and marks them with
    # oldfix / oldfix_kind / oldfix_src, which the review UI's `⭐ old human fix` filter reads.
    # ⛔ Matches on the MEASURE SPAN the slicer recorded — (page, system, meas_from, meas_to) from
    # each crop root's <page>_manifest.json — NEVER on the filename: 248 fixes name a strip that now
    # holds different music. A page whose two slicers disagree on staff-row count is refused.
    # ⚠ A carried fix is a SUGGESTION, never a verdict: a span match is the same BARS and never the
    # same pixels (0 of 1,215 crops byte-identical). Writes no verdict; --apply is idempotent, backs
    # up to .bak-oldfix, and is safe with the review UI open. Report only without --apply.
.venv-ml/bin/python ml/labels/auto_accept_agree.py [--dry-run]
    # b8-full: draft `ok` (by=agree) on every pending row whose LABEL and model DECODE are the same
    # token-for-token, and carry the 201 hand-read b8-audit verdicts in first. 2,896 drafted / 842
    # left pending (2026-08-27). ⚠ A DRAFT IS NOT A READ — agreement was right on 94% of the rows a
    # human has read and the misses clump on one page, so spot-check in the UI's
    # `🤖 auto-accepted (agree)` filter, which lists them LEAST CONFIDENT FIRST. Undo = restore
    # full_audit.csv.bak-agree. Only still-pending rows are written, so a live UI session is safe.
.venv-ml/bin/python ml/labels/emit_strip_labels.py --strips-root data/real/strips_v2 \
    --checkpoint data/checkpoints/round2-stage2-best --onnx-dir data/checkpoints/round2-stage2-best-onnx \
    --testset data/real/rung3/testset.json --out data/real/rung3/strips_b8
    # the B8 re-emit as it was RUN 2026-08-21 (37 min, laptop). ⚠ `--strips-root data/real/strips_v2`
    # is the whole point — the default root is the RETIRED slicer. It reuses the 1,704 page decode
    # caches, which is why no GPU is needed; `--redecode` would throw that away. Its output is NOT
    # training data until `b8-audit` is read and the old pools' human fixes are carried BY MEASURE
    # SPAN (docs/METRICS-CORPUS.md).
.venv-ml/bin/python ml/labels/emit_strip_labels.py ... --vocab h --rail-plan
    # …then the SAME command with --rail <out>/emit_rail.json instead: Round 4's label-budget rail
    # in its two runs (docs/rung3/round4.md step 5) — run 1 PRICES every candidate sub-range of
    # every over-budget window and cuts nothing, run 2 splits only the windows that failed.
    # ⚠ `--vocab` must MATCH across the two, and every page the plan names is RE-DECODED (the GPU).
.venv-ml/bin/python ml/labels/build_exam_v3_queue.py --rebuild
    # the exam, RE-CUT on today's slicer (owner, 2026-08-21). `--plan` prints the emit command; that
    # emit must write to --strips-root data/real/strips_examv3 and NEVER to data/real/strips, which
    # the frozen exam hardlinks from — re-slicing there rewrites the pixels its gold describes.
.venv-ml/bin/python ml/labels/promote_labels.py --dir data/real/rung3/strips_h1 \
    --strips-root data/real/strips_v2 --vocab h --audit-csv full_audit.csv --audit-csv rail_added.csv
    # Round 4's promote as RUN 2026-09-16 (185 replaced, 4 removed, 0 rejects). ⚠ --vocab h is not
    # optional for an H pool: under the old vocabulary its labels are ~40% longer, get rejected as
    # over budget, and a rejected audit `fix` REMOVES its row. ⚠ --audit-csv REPLACES the default,
    # so name full_audit.csv too; rail_added.csv is the only way the rail's verdicts reach training.
    # ⚠ --strips-root data/real/strips_v2: the default is the RETIRED root. Add --dry-run first.
.venv-ml/bin/python ml/labels/paired_arm_score.py --score-vocab old \
    --ctl <control ckpt> --arm <H ckpt> --pool data/real/rung3/_realval_v2r --out <file.json>
    # two checkpoints, one pool, paired per strip. ⛔ --score-vocab old is REQUIRED when the two
    # vocabularies differ, and the script refuses without it: counted in its own ids the same
    # mistake costs an H model 1.139 fewer edits per strip. Omit it only for two old-vocabulary
    # checkpoints, which is what every number before 2026-09-16 was. docs/METRICS-EXAM.md
.venv-ml/bin/python ml/labels/score_vocab_check.py
    # ~10 s, no model: proves the old-id scale is lossless and neutral. Must print PASS again after
    # any change to data.canonical_label, ADDED_TOKENS or SCHEME_H_TOKENS.
sh ml/prep/make_round4_colab_zip.sh
    # Round 4 step 6's ONE upload for BOTH arms -> data/colab/tnc_round4_colab.zip, and it writes the
    # zip's byte count into ml/notebooks/round4_vocab_ab_colab.ipynb. ⛔ Refuses until _realval_v2r
    # exists (repair_realval_v2.py --build). Drops the strips_h1 labels over 99 OLD ids inside the
    # zip only — the Mac's pool is never edited. ⚠ Re-run it after ANY pool change, then re-upload.
.venv-ml/bin/python ml/prep/build_makam_signatures.py \
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
    # refuted this project's own "16 of 16 marks break the arc" (docs/METRICS-DIAGNOSTICS.md).
    # ⚠ Off by default and NO TRAINED ARM MAY CARRY IT — it changes a share of every piece, so a
    # corpus with it on is not comparable to one without. It belongs to the FINAL model's render.
    # `make_round3_colab_zip.sh` refuses any arm whose render_config.json has it on.
    # [--usul-barline] opts INTO the DOTTED (USUL) BARLINE (2026-08-31): a light dashed rule on the
    # usul's own beat groups INSIDE the bar (aksak 9/8 = 2+2+2+3 -> three rules), which Turkish
    # editions print and this corpus had never drawn — so the model reads one as `\repstart`.
    # Label-free: 188 strip labels over 4 scores are byte-identical with it on and off. Coined per
    # PIECE, not per bar. Off by default and it belongs to the FINAL model's render, like the two
    # flags above. Previews of all three: data/synthetic/_flag_preview/.
npx --yes tsx tools/tests/stitch-test.ts                 # expect ALL PASS, 218/218 round-trip
npx --yes tsx tools/render/verify-labels.ts --strips data/synthetic/<set> [--thin-sharps] [--staccato-noise] [--concave-tuplet] [--usul-barline]
    # ⚠ PASS EVERY FLAG THE CORPUS WAS RENDERED WITH. The verifier renders its own comparison
    # pixels, so a gate run without them is checking a different picture than the corpus ships.
npx --yes tsx tools/render/render-ly.ts --pieces data/pieces_geom_pilot.json --out data/synthetic/<set>
    # the SECOND ENGRAVER (Round 3 Lever 4): real LilyPond renders the SAME labels — needs
    # `brew install lilypond` (2.26), decides nothing itself, and draws no lyrics/repeats/nav
    # marks/slur distractors, so it is a pilot arm and not a corpus. Result: docs/METRICS-INPUT.md
npx --yes tsx tools/render/verify-labels-ly.ts --strips data/synthetic/<set>   # that arm's OWN gate
.venv-ml/bin/python ml/prep/prepare_strokes.py [--analyse]  # F2's drum samples: fetch VCSL, measure, write
.venv-ml/bin/python ml/prep/prepare_voices.py [--analyse|--manifest]  # F1's voices: fetch VSCO 2, measure, stage for the Hub
.venv-ml/bin/python tools/dev/check_docs.py                 # doc structure check (--facts is GONE, 2026-09-06)
```

Long jobs are chunked and resumable — Ctrl-C is safe, re-running skips finished work.


## Training on Google Colab — first-timer's guide

*Was `docs/COLAB.md` (last updated 2026-08-19).*

> How to run the scaled fine-tune (`ml/omr/train.py`) on Colab, written for someone who has
> never used Colab. This doc is the context around the ml/notebooks: what Colab is, which plan to buy,
> how not to lose a run, and what "done" looks like.
>
> The ml/notebooks of Rounds 1–3 and Rung 2 were deleted on 2026-11-20 (git keeps them; their
> protocols are in [archive/rounds.md](archive/rounds.md)). **One notebook per round — never re-point an old one.** Each carries its round's corpus paths,
> recipe and caveats in its own cells, so a stale path can't silently train on the wrong data:
>
> | Round | Notebook | Zip | Corpus |
> |---|---|---|---|
> | **Round 4 — the vocabulary A/B (both arms)** | **`ml/notebooks/round4_vocab_ab_colab.ipynb`** | `tnc_round4_colab.zip` (`ml/prep/make_round4_colab_zip.sh`) | `strips_v7_final` + `strips_h1` |
>
> ⚠ **The scan arm ships no corpus of its own, and that is the design.** Its only variable is the
> augmentation mix (`--photo-share 0.20 --scan-share 0.25`), chosen at training time, so its control
> is `data/checkpoints/r3-tupnew-stage2-best` — already trained, same corpus, split, recipe, steps
> and seed. **One run, not two.** Nothing downstream records the mix, so `train.py` prints it in its
> startup line and the notebook asserts it before any long run; that log line is the only evidence of
> which arm a checkpoint is. Protocol: [archive/rounds.md](archive/rounds.md#the-scan-profile--round-3s-first-trained-arm-lever-7--null).
>
> The Round-3 tuplet notebook is **run twice**, once per arm, off a single `ARM` cell — it is one
> experiment, and the arms must not drift apart in recipe. ⚠ The two corpora have **byte-identical
> manifests** (the tuplet mark is pixels only), so nothing downstream can tell them apart: the zip
> script and the notebook both assert `render_config.json`, which is the only file that can.
> Protocol: [archive/rounds.md](archive/rounds.md#round-3-criteria--the-pre-registration-and-the-tuplet-ab-protocol).
>
> Round 2 differs from Round 1 in three places that matter: `--strips-dir data/synthetic/strips_v4`,
> `--split data/split_v4.json`, and the real-pool oversample **`:9` not `:8`** (synthetic grew, so
> `:8` would drop real from ~34% to 31.9% of batches). It runs ONE recipe, not an A/B.
>
> **Outcome: Rung 2 PASSED on the first full run (2026-07-07, batch 16, lr 3e-5, 6000 steps ≈
> 110 min)** — full result in `ml/omr/MODEL_EVAL.md`; checkpoint copied local to
> `data/checkpoints/rung2-best/`. This guide stays as the recipe for future Colab runs
> (e.g. the Rung-3 fine-tune on real photos).
>
> ### GPU decode offload — a different genre, same rules
>
> These ml/notebooks train nothing; they run the emitter's expensive half (slice + decode every page)
> and bring back the `<page>_decode.json` caches so the laptop only does the cheap alignment.
>
> | Job | Notebook | Zip | Model | Window | Out |
> |---|---|---|---|---|---|
> | tuplet pass (2026-07-18) | `rung3_decode_colab.ipynb` | `tnc_rung3_decode_colab.zip` | `rung3-labeler` | `--measures-per-strip 1` | `data/real/strips` |
>
> Build the package with `ml/labels/make_decode_zip.sh <pages-list> <zip-name>`; both
> arguments are optional and the pages list keeps its own filename inside the zip.
>
> ⚠ **Two flags decide whether the trip was worth anything.** `--cache-checkpoint` is the string
> recorded in every JSON, and the laptop emitter refuses a cache whose recorded checkpoint differs
> from its own `--checkpoint` — get it wrong and the whole batch is discarded on arrival. `--out`
> must not be an existing strip root, because live manifests point into those. The re-slice
> notebook asserts both on 5 smoke pages before the full run.
>
> **The offload is not always the cheap option.** Measured 2026-07-30 on this M4 at `nice -19`:
> **5.2 pages/min on CPU**, so the 1,578-page re-slice is ~5 h locally against a 1.2 GB upload,
> 1.5–3 h of T4, and a ~1 GB download. Overnight on the laptop is a real alternative when the job
> is inference rather than training; the fanless rule is about sustained heat, and this workload is
> resumable and page-cached, so it can be stopped at any point.

### 1. Colab in three sentences

Google Colab is a Jupyter notebook running on a rented Google VM with a GPU attached — you open a
notebook in the browser, pick a GPU, and run cells. The VM is **ephemeral**: its disk is wiped
when the session ends, and sessions DO end (idle timeout, usage limits, random disconnects).
Everything that must survive therefore lives in your **Google Drive**, which the notebook mounts
like a folder — our checkpoints stream there, so a killed session costs minutes (`--resume`), not
the run.

### 2. Which plan? — **Colab Pro. Not Pro+.**

The run is small by GPU standards (143M params, 18.6k strips, ~6k steps):

| GPU | availability | full-run time (defaults) | ≈ compute units |
|---|---|---|---|
| T4 16 GB | free tier + paid | ~2.5–4 h | ~3–7 |
| L4 24 GB | Pro | ~1.5–2 h | ~4–5 |
| A100 40 GB | Pro (when available) | ~45–75 min | ~6–10 |

- **Free tier**: enough for the shakeout (and technically even a full run across interrupted
  sessions, thanks to `--resume`) — but sessions are short, T4-only, and can be preempted.
- **Colab Pro (~$10/month)**: 100 compute units + L4/A100 access + longer sessions. One full run
  burns ~5–10 units, so Pro covers **~10+ full runs** — the whole Rung-2 campaign including LR
  retries, and later the Rung-3 fine-tune on real photos. **This is the plan to buy.**
- **Colab Pro+ (~$50/month)**: 500 units + background execution (runs survive a closed browser).
  Our checkpoint/resume design makes background execution redundant, and 500 units is ~10× more
  compute than Phase 3 needs. Not worth it here.

Suggested path: do the free-tier shakeout first (§4), buy Pro the same day the full run starts.

### 3. One-time setup

1. **Build the upload package** (on the Mac):
   ```bash
   sh ml/prep/make_round4_colab_zip.sh   # → data/colab/tnc_round4_colab.zip
   ```
   One zip, mirroring the repo layout: the `ml/omr` training kit, the split, the corpus and the
   real pools. Nothing else is needed on the Colab side — no git.
2. **Upload it to Drive**: go to [drive.google.com](https://drive.google.com), create a folder
   **`tnc`** in My Drive, drag the zip into it. (~5–15 min on a home connection;
   one-time — later sessions reuse it.)
3. **Open the notebook**: go to [colab.research.google.com](https://colab.research.google.com) →
   `Upload` → pick `ml/notebooks/round4_vocab_ab_colab.ipynb` from this repo.
4. **Pick a GPU**: menu `Runtime → Change runtime type → Hardware accelerator`. Free tier: T4.
   Pro: L4 (best value) or A100 (fastest).

### 4. Running it (the notebook does all of this)

Run the cells top to bottom:

1. `nvidia-smi` — confirms which GPU you got.
2. Mount Drive (approve the permission popup).
3. Copy the zip **Drive → VM disk** and unzip there. This matters: training reads 18k PNGs
   per epoch, and the Drive mount is far too slow for a dataloader — data goes on the VM's local
   disk, only the ~200 MB checkpoints go the other way, to Drive.
4. `pip install` the three missing packages (torch is preinstalled).
5. **Shakeout** (~3 min, do this on the FREE tier before paying): 100 steps on 512 strips. It
   proves the whole chain — manifest, tokenizer extension (`+21 ids` in the log), augmentation
   workers, AMP, checkpoint write to Drive. The loss must fall; then check
   `MyDrive/tnc/rung2-shakeout/` exists in Drive.
6. **Full run**: defaults (`batch 8, lr 3e-5, 6000 steps` ≈ 2.9 epochs). On L4/A100 add
   `--batch-size 16`. Progress prints every 25 steps; val loss + checkpoints every 500
   (`best` = lowest val loss, `last` = resume point, both on Drive).
7. **Eval** the best checkpoint — the headline per-class AEU accidental accuracy.

**If the session disconnects** (it will, eventually): `Runtime → Reconnect`, rerun cells 1–4,
then the **resume** cell (`--resume` reloads model + optimizer + scheduler from
`MyDrive/tnc/rung2/last`). Keep the browser tab open and the machine awake during long runs on
free tier / Pro; only Pro+ runs survive a closed tab, and we don't need that.

### 5. What "done" looks like (and what to do with it)

- **Judge on `eval_omr.py`, not val loss**: the per-class accuracy over the 8 AEU accidentals is
  the Rung-2 headline (`docs/PHASE2.md` §5; SER + exact-match are secondary). It appends to
  `rung2/best/eval.jsonl` so runs are comparable.
- **Keep** (all already on Drive): `rung2/best/` (the weights — input to the ONNX export, which
  reuses the proven Rung-1.5 pipeline), `rung2/metrics.jsonl`, `eval.jsonl`.
- **Good result** → Rung 2 passes → Rung 3: real-photo collection + model-assisted labeling
  (`docs/CODE_TOUR.md` §3). **Poor accidental accuracy** after honest retries (LR within
  1e-5–5e-5, more steps, `--photo-share` sanity checks) → that was the planned trigger to evaluate
  the CRNN+CTC fallback (`ROADMAP.md` §1). *(Moot: Rung 2 passed first try; the fallback is retired.)*
- Typical knobs, in the order to try them: more steps (`--max-steps 10000 --resume`), LR 1e-5 or
  5e-5 (fresh run), `--batch-size 16` with A100. Change ONE thing per run; `metrics.jsonl` +
  `eval.jsonl` are the comparison record.
