# Commands — every command this project has, with its traps

purpose: the full command reference, including the ⚠ traps that cost real time to learn
audience: anyone about to run anything; `../CLAUDE.md` keeps the everyday few and points here

updated: 2026-09-05

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
                                     # …plus the makam intonation table AND the two 2026-09-05 ear-found bugs:
                                     # ⚠ WHICH DOCUMENT the koma deltas and the usul tracks are built over
                                     # …plus the written-score → performance maps (tools/core/structure-test.ts)
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
npx tsx tools/core/clarinet-chart.ts out.html   # sol klarnet: all 33 fingerings as one HTML page, for a player to audit
npx tsx tools/core/clarinet-editor.ts out.html  # …and the editor that produced it: click points per note, copy the JSON back
```

### The browser decode — gates and parity

```bash
npm run gate:browser                 # in-browser ONNX gate, headless — expect 27/28
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
                                     # token streams, for scripts/score_browser_gold.py to score against GOLD (W3)
                                     # ⚠ `--server <url>` decodes the same pool on the SERVER instead (W9):
                                     # agreement cannot say which side is RIGHT, and only gold can
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
⚠ **A refusal UNMOUNTS `#omr-status`** (`App.tsx` renders the status line or the error box, never
both), so anything waiting on a read must count `#omr-error` **before** it asks the status line for
`data-state`, and must read the status line non-throwingly. Getting that order wrong costs a 30 s
timeout on a detached locator and reports the CHECK's bug as the app's — it did, on 2026-09-05,
while the site was refusing correctly in 5.1 s. Fixed in all three page smokes.

```bash
node apps/server/tools/prepare-models.mjs   # assemble apps/server/models from the browser's graphs
npm run dev:server                   # the decode server on :8080 — needs the line above once
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

### The visit counter (F6)

```bash
npm run stats:ui                     # the owner's dashboard → http://localhost:5173/admin-stats.html
netlify env:set STATS_SALT  "$(openssl rand -hex 32)"   # without this NOTHING is counted, by design
netlify env:set STATS_TOKEN "$(openssl rand -hex 24)"   # what the dashboard asks for; no token, no data
npx tsx tools/analytics/visits-test.ts                  # the arithmetic (also inside `npm test`)
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
([METRICS-USAGE.md](METRICS-USAGE.md)). `?nostats=0` undoes it.
Full design and its limits: [features/visit-stats.md](features/visit-stats.md).

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

**Moved 2026-09-07 to [COMMANDS-PYTHON.md](COMMANDS-PYTHON.md)** — the slicer, the emitter and
its label-budget rail, the review queues, the promoters, the scorers, the probes, and every
`OMR_*` knob with the measurement behind it. Nothing was changed in the move; this file keeps
the app's own commands.
