# The decode server — plan, operations, latency

purpose: the decode server: how it was planned, how to run and redeploy it, and the measured options for making a page faster
audience: anyone touching apps/server or a deploy
updated: 2026-11-20

**Merged into this file on 2026-11-20:**

- [Running and deploying the decode server — the commands](#running-and-deploying-the-decode-server--the-commands) — was `docs/app/server.md`
- [Deploying the app — the server, the host, and what the friends release is for](#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for) — was `docs/app/server.md`
- [Making a page faster — the options, with what each one costs](#making-a-page-faster--the-options-with-what-each-one-costs) — was `docs/app/server.md`


## Running and deploying the decode server — the commands

*Was `docs/app/server.md` (last updated 2026-10-08).*

> Split out of [server.md § Deploying the app — the server, the host, and what the friends…](#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for) on 2026-08-07 at the 400-line cap. **This page is HOW.**
> What was chosen and why is [server.md § Deploying the app — the server, the host, and what the friends…](#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for); the account-by-account walkthrough for the
> app and the weights is [phases.md § Putting the app online — step by step, in plain words](../archive/phases.md#putting-the-app-online--step-by-step-in-plain-words); current state is
> [../STATUS.md](../STATUS.md).

---

### Running it, and deploying it

Locally — the model directory is assembled from the same int8 graphs `apps/web/public/models` holds (the browser fallback that used to read them is off since 2026-09-04):

```bash
node apps/server/tools/prepare-models.mjs        # apps/web/public/models → apps/server/models
npm run dev:server                               # :8080, model ready in ~1.5 s
npm run check:bundle                             # the CONTAINER's artifact boots (see below)
npm run check:limits                             # the safety checklist
npm run parity:server -- --pages 6 --fixture f.json   # server vs browser, saves a replay fixture
npm run bench:server -- --fixture f.json         # vCPU-s/page, payload bytes
VITE_DECODE_URL=http://localhost:8080 npm run smoke:page      # the real app, through the server
# ⚠ A dead URL no longer tests a fallback: since 2026-09-04 the app refuses and reads nothing, so
# smoke:page at a dead port simply fails. The refusal is asserted by smoke:build and smoke:live.
```

⚠ **`dev:server` and the container do not run the same thing, and the difference broke the first
deploy.** Dev goes through `tsx`, which resolves CommonJS natively; the container runs an **ESM
bundle**, where `pngjs`'s `require("util")` hits an esbuild shim that throws *Dynamic require of
"util" is not supported* — so the container exited before binding the port and Cloud Run reported
only "failed to start and listen on PORT". Fixed with a `createRequire` banner in
`apps/server/tools/bundle.mjs`. **`npm run check:bundle` boots the bundled artifact and is the
check that would have caught it**; running the server locally a hundred times would not have.

**Never used Google Cloud before? [phases.md § Setting up Google Cloud — step by step, in plain words](../archive/phases.md#setting-up-google-cloud--step-by-step-in-plain-words) is the step-by-step version of
this section** — accounts, projects, billing, and what a budget alert does and does not do.

Deploying — ✅ **run, and these are the commands that worked.** The image builds in Cloud Build
rather than locally for two reasons: the Dockerfile is not at the context root (the server bundles `apps/web/src/omr/decode.ts`
on purpose), and a `docker build` on an Apple Silicon Mac produces arm64, which Cloud Run will not
start.

```bash
PROJECT=<your-project>; REGION=europe-west3        # Frankfurt — closest to Türkiye
IMAGE=$REGION-docker.pkg.dev/$PROJECT/omr/decode:latest

gcloud artifacts repositories create omr --repository-format=docker --location=$REGION
gcloud builds submit --config apps/server/cloudbuild.yaml --substitutions _IMAGE=$IMAGE .

gcloud run deploy omr-decode --image $IMAGE --region $REGION \
  --cpu 1 --memory 2Gi --concurrency 1 --max-instances 10 --timeout 300 --cpu-boost \
  --set-env-vars '^@^OMR_ORT_THREADS=1@ALLOWED_ORIGINS=https://komavision.netlify.app,http://localhost:5173,http://localhost:4173' \
  --allow-unauthenticated
```

⛔ **That is the FIRST-TIME command. To ship a new image to the existing service, pass the image
and nothing else** — `gcloud run deploy omr-decode --image $IMAGE --region $REGION`. Every flag you
leave out is kept from the live revision; every flag you pass overwrites it, and `--set-env-vars`
replaces the WHOLE env list. Read off the live service on 2026-10-08 (`gcloud run services describe
omr-decode --region europe-west3`): revision `omr-decode-00008-hx7`, **`maxScale` 10**, and
`ALLOWED_ORIGINS` carrying a fourth entry, a LAN address added for phone testing
([../COMMANDS.md](../COMMANDS.md)). Until 2026-10-08 this block said `--max-instances 3` and listed
one origin, so re-running it would have cut capacity back to 3 silently and locked out `dev:cloud`.

Why those flags: `--cpu 1` is the cheapest shape (see Cost); `--concurrency 1` because ORT already
uses the whole core and a second page in flight only doubles memory (the process serializes anyway,
this makes Cloud Run agree); `--memory 2Gi` against a measured 955 MB peak at batch 1;
`--max-instances` is the ceiling on total spend — **10 since 2026-09-04** (it was 3): at concurrency 1
an over-capacity request QUEUES rather than failing, so with no browser fallback the ceiling is what a
visitor waits behind. **`--cpu-boost` shipped 2026-08-06** and
aimed at the 9.5 s of model load inside the cold start — ⚠ **the first reading with it on was WORSE
(`loadMs` 25,857 ms vs 9,500), and that is not a finding**: n=1 vs n=1, both on a freshly pushed
image whose layers Cloud Run streams lazily. [../METRICS.md](../METRICS.md).

✅ Verified against the live service: `check:limits` **6/6** and `parity:server --replay` **120/128
strips identical to the browser** — the same rate as the local server. ✅ **The redeploy happened
2026-08-06** (revision `omr-decode-00003-jrl`): 413 fix, `--cpu-boost`, and
`ALLOWED_ORIGINS=https://komavision.netlify.app` — verified by preflight, which returns the header
for that origin and **nothing for a stranger**. ⚠ Two consequences: `smoke:build` driven from a
localhost preview against the live server now fails CORS **by design**, and `--cpu-boost` did not
visibly help (below).

⚠ `.gcloudignore` is load-bearing: `apps/web/public/models/` is gitignored, and without an explicit
ignore file gcloud derives the upload list from `.gitignore` and ships a context with **no weights
in it**.

### Swapping or reverting the model — every hop, in order

Pieced together from the 2026-09-28 swap to `r4-ctl-stage2-last` ([../log/status-log.md](../log/status-log.md)).
**The live model is the one baked into the Cloud Run image** — a web deploy alone changes nothing a
visitor reads.

1. **Stage the graphs**: copy `data/checkpoints/<name>-onnx/{encoder_model,decoder_model,decoder_with_past_model}_int8.onnx`
   into `apps/web/public/models/` as the three plain names. ⛔ Copy the graphs only — never re-run
   `make_browser_gate.py` for a swap: it rewrites `gate.json`, golds included
   ([METRICS.md § Metrics — the exported runtime (ONNX export, int8 quantization,…](../METRICS.md#metrics--the-exported-runtime-onnx-export-int8-quantization-parity)). Hash-check each copy against its source.
2. **Bump `CACHE_NAME`** in `apps/web/src/omr/session.ts` to the new model's name. ⚠ Missed at the
   2026-09-28 swap and fixed on 2026-10-08: a browser that had cached the old graphs kept reading with
   them.
3. **Run the gate**: `npm run gate:browser` (pinned **26/28** for `r4-ctl`; a different model may
   land elsewhere — record it in [METRICS.md § Metrics — the exported runtime (ONNX export, int8 quantization,…](../METRICS.md#metrics--the-exported-runtime-onnx-export-int8-quantization-parity) before changing the pin).
4. **Build and ship the image**: `gcloud builds submit --config apps/server/cloudbuild.yaml
   --substitutions _IMAGE=$IMAGE .`, then `gcloud run deploy omr-decode --image $IMAGE --region
   europe-west3` — image only, as above. Note the new revision name.
5. **Upload the same graphs and `model.json` to the Hub** (`Beyaban/omr-weights`), then **download
   them back and hash-match all four**. ⚠ On 2026-09-28 the first `hf upload` died on a `ReadTimeout`
   while still printing progress, and the Hub sat on the old weights.
6. **`npm run deploy:app`** (carries the new `CACHE_NAME`), read the output for `Deploy is live!`,
   then `npm run smoke:live`.
7. **Write it down**: STATUS, the CLAUDE.md "THE APP IS PUBLIC" line and its revision name, and a
   DECISIONS row.

**To revert to `r3a-stage2-best-real`**: the same seven steps from
`data/checkpoints/r3a-stage2-best-real-onnx/*_int8.onnx` (`apps/server/models-r3a/` holds the same
bytes, already assembled).


## Deploying the app — the server, the host, and what the friends release is for

*Was `docs/app/server.md` (last updated 2026-10-08).*

> ✅ **DEPLOYED 2026-08-06** — `https://omr-decode-706571981988.europe-west3.run.app`, Cloud Run
> europe-west3, 1 vCPU / 2 GiB / concurrency 1 / max-instances 3 (**10 since 2026-09-04**). ⛔ This
> plan assumes the in-browser decode FALLBACK throughout; it was switched off on 2026-09-04, so read
> every "falls back" below as history. All four build steps are done, the
> safety checklist is complete, and the cloud-side numbers below are **measured, not extrapolated**.
> ✅ **AND THE APP IS HOSTED (2026-08-06)** — **<https://komavision.netlify.app>** on Netlify, weights
> on the Hub at `Beyaban/omr-weights`, service redeployed with `ALLOWED_ORIGINS` set to that host,
> the 413 fix and `--cpu-boost`. The finished release plan (build order, open questions, the
> W8–W10 ladder) moved to [history](../archive/phases.md#the-friends-release--plan-build-order-and-ladder-w9w10)
> on 2026-11-20. This file does not state the next action:
> [../STATUS.md](../STATUS.md). The ladder: [phases.md § MVP track — the in-browser pipeline, and a release to friends (CLOSED)](../archive/phases.md#mvp-track--the-in-browser-pipeline-and-a-release-to-friends-closed). Decisions:
> [../DECISIONS.md](../DECISIONS.md). Numbers: [../METRICS.md](../METRICS.md).
> Never used Google Cloud? [phases.md § Setting up Google Cloud — step by step, in plain words](../archive/phases.md#setting-up-google-cloud--step-by-step-in-plain-words). Doing the app/weights hosting?
> **[phases.md § Putting the app online — step by step, in plain words](../archive/phases.md#putting-the-app-online--step-by-step-in-plain-words)** is the same thing for Hugging Face and Netlify.
>
> ✅ **Everything on this page is SETTLED** (owner, 2026-08-05). The server happens; it runs on
> Cloud Run; it is Node, not Python; confidence highlighting is out. (The in-browser fallback it
> also settled was switched off on 2026-09-04.)
>
> ✅ **The thermal question is CLOSED too** (owner, 2026-08-05): the machine still gets hot at the
> current ~25 s page. No re-test is owed.
>
> ⚠ **One argument on this page was measured and did not survive: batching.** It is corrected in
> place below rather than quietly deleted.

### The architecture

```
browser                                    server (Cloud Run, CPU, scale to zero)
────────────────────────────────────       ──────────────────────────────────────
page image
  → prepPage (deskew — ~1.1 s)
  → slicer  (W4–W6, opencv.js) — 1.6 s
  → ~19 strip crops                        Node + onnxruntime-node
  → preprocessToCanvas (rotate/pad)          importing apps/web/src/omr/decode.ts
  → 409×583 PNGs   ─── POST ───────────→     rescale (omr/pixels.ts) → encoder → greedy loop

  editor ← stitch ← tokens ←── JSON ────────────────┘
  playback (unchanged, local)

  └─ on failure/timeout ─→ in-browser decode (weights fetched lazily, first fallback only)
```

The seam sits after the slicer, and after preprocessing:

- **Server cost.** Slicing is the cheap half (1.6 s) and stays free on the client. The server pays
  only for the neural decode.
- **The port keeps earning.** W4–W6 were validated over the whole corpus; that work carries over
  unchanged rather than being replaced by a server-side call.
- **No second resampler.** The client rotates, resizes and pads (`preprocessToCanvas`) and uploads
  the finished 409×583 image; the server applies only the rescale. Resizing again server-side would
  add a THIRD resampler — the canvas draw already is not PIL BILINEAR — and a rung to prove it
  equal. PNG is lossless, so both sides feed the encoder identical bytes.
- ⚠ **"Upload size" was the fourth reason and it is WITHDRAWN.** Measured over 6 real pages, the
  crops upload is **0.11×–2.03× the page image, median ~1.7×** — usually *bigger*, because base64
  adds a third and a padded 409×583 PNG is not small. The seam is right for the reasons above; it
  is not right because it saves bytes.

#### The server is Node, and that is the load-bearing choice

It imports `apps/web/src/omr/decode.ts` — the same module the browser runs, already measured against
Python at W3 (SER 0.0818 vs 0.0821 on 261 hand-verified strips). So there is **one decode
implementation**, not a third to hold in parity.

This matters more than it sounds. Proving that a second implementation matches the first cost this
project an entire rung: the slicer port needed W4, W5 and W6, a Python control arm, a paired decode
A/B and a McNemar test. A Python decode service would open that bill again. Reusing the module means
"the server matches the browser" is true by construction.

It also means **`CLAUDE.md`'s "Python is training/data only and never ships" rule stands unchanged**
— the open question that rule flagged is closed, and nothing under `src/vision/` becomes shippable.

✅ **Batching was verified, not assumed** (2026-08-05): both graphs carry a dynamic `batch_size` axis
(`encoder_model.onnx` → `pixel_values ['batch_size', …]`, `decoder_model.onnx` → the same), so
batched decode needs **no model re-export**.

⛔ **…and then it was benchmarked, and it does not pay (2026-08-06).** Batch 8 against batch 1 over
6 real pages: **a few percent SLOWER at every thread count** (1 thread 12.0 vs 11.8 s/page, 2
threads 8.7 vs 8.3, 4 threads 7.4 vs 7.4) and **2.9× the peak memory** on a 38-strip page (2,778 MB
vs 955 MB) — on Cloud Run, the difference between a 1 GiB and a 4 GiB container. One 409×583 Swin
forward already fills the cores, so a batch finds no idle width. **`OMR_MAX_BATCH` now defaults to
1**; the batched path stays, because this is one CPU architecture and another host may answer
differently — but it must be re-measured there, not assumed.

### Why not stay all-browser

Ordered by how much they still hurt, **after** the 2026-08-05 rescoping.

1. **Thermals — the owner's reason, and now the whole of the live case.** Decode is ~1.2 s/strip on
   an M4 and a page is ~16–19 strips (both in [phases.md § MVP track — the in-browser pipeline, and a release to friends (CLOSED)](../archive/phases.md#mvp-track--the-in-browser-pipeline-and-a-release-to-friends-closed)), so a page pegs several
   threads for ~19 s of the ~25 s it takes. Every user pays that heat on their own machine.
   ✅ **Closed by the owner 2026-08-05: the machine still gets hot at the current ~25 s page — no
   re-test needed.** An earlier version of this page asked for one, on the grounds that the original
   complaint was measured when a page took ~56 s. The owner has used the app since and answered from
   direct experience. It is an observation, not an instrumented number, and it does not need to be
   one: heat on your own laptop is exactly the thing the owner is the authority on.
2. **~~No batching, ever.~~ ⛔ WITHDRAWN 2026-08-06 — measured, and batching is worth nothing** (see
   the section above). What replaced it as the real second reason: **native ORT is ~3× faster than
   wasm on identical hardware.** Same M4, same page, in the real app: **24.5 s in the browser
   against 6.0 s on the server**. That is a runtime difference, not a batching one.
3. **~~The weights get re-downloaded on mobile.~~ PARKED with phones (2026-08-05).** iOS Safari
   evicts Cache Storage for non-installed sites after roughly a week, so a friend opening the app
   every other weekend would re-download ~200 MB on cellular each time. This was the *strongest*
   argument on this page and it is **parked, not refuted** — it returns intact when phones do.
4. **~~Phone CPU.~~ PARKED with phones.** Was an estimate, never measured on a real device.

**What stays true:** the W4–W6 slicer port is not wasted. It moves to the client side of the seam,
where it is what keeps the upload small.

### Where the ~25 s of a 7-staff page goes

| Stage | Client cost today | With the server (measured 2026-08-06, same M4) |
|---|---|---|
| decode (16 strips × ~1.2 s) | **~19 s** | **6.0 s**, and none of it on the client |
| slicer incl. deskew | **1.6 s** | unchanged, still local |
| model load, first use only | ~3.4 s | **never happens** unless the fallback fires |
| the tab's slowest reply during a read | **2,358 ms** | **29 ms** |

That last row was not a goal and is worth keeping: with decode remote, the page stops stuttering as
well as stops heating. Both figures come from `npm run smoke:page` on the same page image.

⚠ **Non-claim, and it must not be forgotten once the numbers above look good: none of this was
measured on a cloud vCPU.** A shared Cloud Run core is slower per core than an M4 P-core, and Cloud
Run adds a 10–30 s cold start that two-friend traffic will pay on nearly every upload. A page costs
**11.7 vCPU-seconds** (below), so on a 1-vCPU container expect roughly **12 s at M4 speed and more
like 20–30 s on a slower core**, plus the cold start. **What the server buys is the friend's laptop
staying cool.** The 4× speedup on this laptop is real but it is a comparison of two runtimes on one
machine, not a promise about the deployed service.

### Hosting

⚠ **Prices and free tiers were checked 2026-08-05 from general knowledge, not from the vendors'
pages. Re-verify before committing money** — these move, and free tiers get withdrawn.

| Option | Free tier | Fit | Watch out for |
|---|---|---|---|
| **Google Cloud Run** ✅ **CHOSEN** | ~180k vCPU-s + 360k GiB-s/month | CPU, scale to zero, HTTP, no ops | **Cold start 10–30 s with a ~1 GB container** |
| **Hetzner CX22** — the named fallback | none, ~€4/month | Always on, no cold starts, predictable | You own the ops and the patching |
| **Modal** | ~$30/month credit | Python-native; GPU per-second | Rejected with the Python stack; credit is not a permanent tier |
| **HF Spaces (CPU basic)** | 2 vCPU / 16 GB, free | Simplest; weights already headed for HF | Sleeps when idle; public unless PRO |
| **Fly.io** | small always-free allowance | Fast resume from suspended machines | More hands-on config |

**Cloud Run is chosen with its cold start on the record**, survivable only because of the fallback
below. If cold starts prove intolerable, **Hetzner at ~€4/month buys the problem away** — and costs
less than keeping Cloud Run warm (`min-instances=1` runs ~$15–25/month).

### The in-browser fallback

If the POST fails, times out (180 s — generous, because a cold container is exactly the case this
must not abandon), or returns anything but a well-formed reply, **the client decodes locally** and
tells the user it is running on their machine this time.

- ✅ **Verified end to end, not just written**: `VITE_DECODE_URL` pointed at a dead port produces the
  *same score* through the same app — `7 staves → 16 strips → 344 notes, 28 measures` either way —
  and the status line reads "read on your machine (the server did not answer)".
- A server outage never reads as "the app is broken" to a friend who cannot debug it.
- It makes the Cloud Run cold start survivable rather than fatal.
- ⚠ **A user's own cancel is not a fallback trigger.** If someone picks a different file mid-decode,
  starting a 25-second local decode of the file they abandoned would be the opposite of helpful.

**Two consequences that are easy to miss:**

1. **The weights must still reach the browser**, so the Hugging Face Hub delivery decision stays
   LOCKED — but they are fetched **lazily, only when the fallback first fires**, never on the normal
   path.
2. **The COOP/COEP host requirement does NOT go away.** It exists so `onnxruntime-web` can use wasm
   threads, and the fallback wants them. An earlier version of this page guessed it would mostly
   lapse once decode moved server-side; that was wrong, and the fallback is why.

### Hosting the app itself (the other half of W9)

The decode server is one of three things that have to be somewhere. All three are free.

| What | Where | Why there |
|---|---|---|
| The app (HTML/JS/wasm, **43 MB**) | **Netlify** ✅ chosen 2026-08-06 — it reads `public/_headers`, so no config changed | It must send **COOP/COEP**, or `onnxruntime-web` loses `SharedArrayBuffer` and the fallback has no wasm threads |
| The weights (**211 MB**) | **Hugging Face Hub**, fetched only if the fallback fires | A static host will not take a 90 MB file, and a friend on the normal path must never download them |
| Decode | **Cloud Run** | Above |

Four rules that follow, each of which was a way to get this wrong:

- **The app host must accept a 25.58 MiB file** — that is `dist/ort/…jsep.wasm`, and it is what ruled
  Cloudflare Pages out (25 MiB cap) on 2026-08-06. Check it before switching hosts again. The
  available shrink to 12.86 MiB, and why it was not taken yet: [../DECISIONS.md](../DECISIONS.md).

- **`npm run build:app` refuses to produce a deployable-looking build that carries the weights.**
  Vite copies all of `public/` into `dist/`, which is 332 MB of ONNX graphs and 220 render-corpus
  scores. `apps/web/tools/prune-dist.mjs` removes them and then **fails the build** if the output
  crosses 60 MB or contains an `.onnx` — deleting a directory is easy to forget, a failing build is
  not. A clean build is **43.3 MB**, most of it ORT's wasm (25.6 MB) and opencv.js (14.8 MB).
- **The weights come from `VITE_WEIGHTS_URL`**, and the layout is exactly what
  `apps/server/tools/prepare-models.mjs` emits — three graphs plus a trimmed `model.json`. **Upload
  that same directory to the Hub.** One artifact set feeds the container, the Hub and a local
  checkout; assembled separately they would drift, and the first symptom would be a friend's
  fallback disagreeing with the server for no visible reason.
- **Weights are cached in Cache Storage** so the second fallback of the day is instant, keyed on the
  checkpoint name so new weights cannot be shadowed by an old copy. ⚠ Best-effort by design: absent
  in a non-secure context, and iOS evicts it after ~a week (parked with phones). A miss costs a
  re-download, never a failure.

```bash
npm run smoke:build          # builds, serves dist/ with the real headers, weights from a SECOND
                             # origin, and drives both paths in a browser
```

That check exists because three things only appear in a production build: cross-origin weights under
`require-corp` (the combination that fails quietly), COOP/COEP coming from the host rather than from
Vite, and a decode URL baked in at build time. It runs the build itself — a check that accepts
whatever `dist/` is lying around eventually passes on a stale one.

### Making a page faster

Not this file's job — the deployed service raised it, and it has its own page with the measured
options and what each one costs: **[server.md § Making a page faster — the options, with what each one costs](#making-a-page-faster--the-options-with-what-each-one-costs)**. Short version: a strip is ~2.0 s, the
encoder is ~78% of it, and **parallelism across instances is measured to work** (3 requests at once
ran at full speed each). ✅ **Decided 2026-08-06: only `--cpu-boost` is bought before W10** — it
rides the redeploy below — and W10 ships at 35–55 s a page, because the cold start is only 10.6 s of
that and the rest costs real work. Batching and GPU are measured dead ends.

### Cost — now measured, on a laptop

The server reports its own `process.cpuUsage()` per request, so this is CPU time as Cloud Run bills
it, not wall time. Median over 6 real pages (128 strips), by container shape:

| `--cpu` | wall / page | **vCPU-s / page** | free tier (~180k vCPU-s) |
|---|---|---|---|
| **1** ✅ recommended | 11.8 s | **11.7** | **~15,400 pages/month** |
| 2 | 8.3 s | 16.8 | ~10,700 pages/month |
| 4 | 7.4 s | 29.3 | ~6,100 pages/month |

**More vCPUs cost more than they save**: 1 → 2 buys 1.4× the speed for 1.44× the CPU, 2 → 4 buys
1.12× for 1.74×. The earlier estimate on this page (30–60 vCPU-s, ~3,000–6,000 pages/month) was
pessimistic by about 3× at 1 vCPU — it assumed the batching that turned out not to exist.

⚠ **Still a laptop.** An M4 core is faster than a shared cloud vCPU, so the pages/month figure is an
upper bound and the wall times are a lower one. Re-run `npm run bench:server -- --url <service>`
after deploying and replace this table.

At two friends, cost is not a consideration at all; this matters only at public launch.

**The GPU cold-start trap** (still true, still the reason GPU is not the default):

| | Inference | Billed |
|---|---|---|
| GPU, warm | ~2 s | ~2 s |
| GPU, cold (container boot + weights onto device) | ~2 s | **20–60 s** |

With sparse traffic almost every request is cold, so the real cost is ~10–15× the "2 seconds of GPU"
figure. GPU is worth buying as a *product feature* (sub-2-second responses), never to save money.

### Monetisation — not now, and the ads plan does not pay for itself

**Out of scope for the friends release entirely.** Kept because the maths stops it being
re-proposed: Turkish display CPMs run roughly $0.30–1.50 RPM against $5–15 for US traffic.

| Per 1,000 pages converted | |
|---|---|
| Ad revenue (~2–3 impressions each, Turkish CPM) | **~$1–4** |
| Cost on scale-to-zero GPU with cold starts | **~$5–15** |
| Cost on CPU inside the Cloud Run free tier | **$0** |

So ads are underwater against the GPU plan and unnecessary against the CPU plan — and AdSense wants
meaningful traffic before approving an account, then drags in a privacy policy and cookie consent
(GDPR/KVKK). **Instead, if it is ever wanted:** one "buy me a coffee" link. A single $5 supporter
beats ~5,000 ad impressions at these rates.

### Before exposing anything publicly

An open inference endpoint with usage billing is the standard way to get a surprise bill — one
script, or one bad crawler. **All four go in before the URL leaves the two friends.**

Three of the four are code, and they are a command: **`npm run check:limits`** against a running
server (add `--rate-url` to exercise the limiter — see the script's header). It passes 6/6 payload
cases plus the rate limit, and it *prints* the two it cannot check rather than counting them.

- [x] Rate limit per IP — 20 requests / 60 s, fixed window, keyed on the leftmost `X-Forwarded-For`
      entry. Checked before the readiness check, so hammering a cold instance is limited too.
      ⚠ In-process and spoofable: a speed bump against scripts, not an authorization system.
- [x] Max upload size (12 MB, enforced on **bytes seen**, not `content-length`) and a cap on strips
      per request (40, checked before any pixels are read)
- [x] Reject non-image payloads early — IHDR is parsed *before* decoding, and a PNG that is not
      409×583 8-bit is refused. That doubles as a correctness guard: a wrong-sized strip means the
      client did not preprocess it, and decoding it would silently produce a bad read instead of an
      error. (`tools/vision/parity/edge-cases.ts` covers the client side.)
- [x] **A billing alert plus `--max-instances`** — ✅ **done 2026-08-06**: a **$5 budget alert** in
      the owner's console, and `--max-instances 3` on the service. This is the one item that bounds
      the bill when this process is the thing being abused, and it lives in the Cloud Run / billing
      console — `check:limits` prints it rather than counting it, because it cannot be asserted from
      the repo. ⚠ **An alert notifies; it does not stop spend.** `--max-instances` is the part that
      actually caps the rate, which is why raising it (latency option 3) widens the worst case.

## Making a page faster — the options, with what each one costs

*Was `docs/app/server.md` (last updated 2026-10-08).*

> Deployment, hosting and the bill: [server.md § Deploying the app — the server, the host, and what the friends…](#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for). Every number below also lives in
> [../METRICS.md](../METRICS.md). Current state and next action: [../STATUS.md](../STATUS.md).
>
> ⚠ **None of this is built, and the owner decided on 2026-08-06 that almost none of it will be
> before W10.** Only **`--cpu-boost`** is bought, because it rides a redeploy that has to happen
> anyway; everything else is **deferred, not dropped**, and the trigger is a friend saying the wait
> is annoying. The reasoning is in [../DECISIONS.md](../DECISIONS.md); the prices below are what
> that decision was made against, so they stay exactly as measured.

### Where the time goes

Measured on the deployed service (Cloud Run, europe-west3, 1 vCPU), 2026-08-06.

| | |
|---|---|
| One strip | **~2.0 s** |
| The encoder's share of that | **74–81%** — anything that does not attack the encoder is rounding |
| Cold start | **10.6 s**, of which **9.5 s is loading the three graphs** |
| Slicing, upload, stitching, rendering | ~3 s combined, all of it on the client |

| A page | decode | total (warm) | total (cold) |
|---|---|---|---|
| 16 strips | 31 s | **~35 s** | ~46 s |
| 26 strips | 51 s | **~55 s** | ~66 s |

⚠ **The "total (cold)" column was wrong until 2026-08-08, and the story is worth keeping.** It
assumes the upload *waits* out the boot. It did not: the container accepts connections before its
graphs are loaded, so `/decode` answered a truthful `503 model still loading`, and `remote.ts` routed
**any** failure to the browser without retrying — so a cold start did not add ~11 s, it moved the
entire page onto the friend's own machine plus a 211 MB weights download. **Fixed the same day**
(option 1 below, both halves), so the column is now what it always claimed to be. Numbers:
[../METRICS.md](../METRICS.md).

⚠ For comparison, the same 26-strip page reads in **34 s in the owner's own browser** on an M4. The
server is slower, deliberately — the release was chosen on thermals, not speed
([DECISIONS.md](../DECISIONS.md)). But a friend waiting 55 s is a W10 problem, because W10 asks
them about the *interface*.

### ✅ Parallelism works — measured, not assumed

Three page requests fired at once against the live service:

| | wall | server-side |
|---|---|---|
| one request alone | 26.6 s | 26.1 s |
| three at once | **35.5 s for all three** | 23.5 / 26.4 / 22.6 s |

Sequentially those three would have taken ~80 s. **Cloud Run gave us three machines and each kept
full speed** — server-side time did not degrade, so they genuinely ran side by side rather than
queueing. The extra ~9 s of wall time on two of them is the cold start of the second and third
instances.

That result is what makes option 3 below worth its complexity: **a page's strips are independent**,
so one page can be split across several instances the same way three pages were.

### The options

| # | Option | Wins | Costs |
|---|---|---|---|
| 1 | **Warm the server when the app opens** | **Recovers the server path itself on the first upload after idle, not merely 10.6 s** — see the warning above; a cold container currently sends the whole page to the browser. A `/health` ping while the user is still picking a file costs nothing | Hides the boot, does not shorten decode; useless if the user uploads immediately; `/health` is not rate-limited, so crawlers would wake containers. ⚠ Not sufficient alone — a user who uploads within ~9 s still 503s, so pair it with a client that retries a `ready: false` 503 instead of falling back on it |
| 2 | **`--cpu-boost` on deploy** | Targets the 9.5 s model load — the big half of the cold start. One flag, no code | Unmeasured for us; Google says "up to", so the gain is not guaranteed. Slightly higher startup billing |
| 3 | **Split a page across instances** | **The real win: a 26-strip page ~52 s → ~13 s at four chunks.** Measured basis above | Five separate risks — see below. This is a real piece of work, not a flag |
| 4 | **`--cpu 2`** | ~1.4× on the decode itself, no code | Sub-linear (on the M4, 2→4 threads bought only 1.12× for 1.74× the CPU); doubles vCPU-seconds; largely redundant with 3 |
| 5 | **`--min-instances 1`** | Kills the cold start outright, no code | **~$15–25/month** — more than the Hetzner box that was rejected, and it buys less than option 1 gives free |
| 6 | **Pre-optimised ONNX graph** | Might cut the 9.5 s load (ORT re-optimises every graph at session creation) | Unmeasured; adds a build step and a second artifact that can drift from the graphs; only helps cold starts, which 1 and 2 already cover more cheaply |

**Recommended order: 1, then 2, then 3.** 1 and 2 are nearly free and attack the cold start; 3 is
the only one that attacks the decode itself. 4 and 5 are for when 3 has been done and is not enough;
6 is last because its gain is unmeasured and overlaps with 2.

✅ **What was actually chosen (owner, 2026-08-06): option 2 only, and W10 ships at 35–55 s.** Option
2 goes on the redeploy that `ALLOWED_ORIGINS` and the 413 fix already require, so it costs nothing.
Option 1 was passed over despite being cheap — it is client code, and it buys the same thing option 2
does. **The distinction that decided it: options 1 and 2 remove the 10.6 s cold start, not the
31–51 s of decode**, so neither changes the wait a friend feels on a typical page. Only option 3
does, and it is deferred until someone says the wait bothers them.

⚠ **That reasoning rests on a premise measured false on 2026-08-08 — recorded here rather than
rewritten, because the decision was the owner's.** Option 1 was priced as buying ~10.6 s of waiting.
It is not: a cold container makes the app read the whole page **on the friend's machine**, so option 1
(with a `ready: false` retry) is what buys the server path at all on a first upload. The "it only
removes the cold start" argument still holds for option 2.

✅ **RE-DECIDED AND BUILT the same day, at the owner's request: option 1, both halves.** The client
now **waits out a warming container** instead of falling back on its 503 (up to `WARMUP_WAIT_MS`,
40 s, against a cold start of ~10 s), and **pings `/health` when the app opens** so a container is
usually ready by the time a file has been chosen. Client-only — the server's contract did not change,
so it needed no Cloud Run redeploy. The retry is the correctness half; the ping only hides the wait.
⚠ **Only a `ready: false` 503 is waited on.** A load that actually failed (`model failed to load`),
and every other failure, fell back at once — waiting on those would strand a user behind a broken
container. ⛔ **Since 2026-09-04 there is no fallback**: those failures raise `server-unavailable`,
and `WARMUP_WAIT_MS` was raised 40 s → **120 s** after a cold start read 38.2 s. Both halves are pinned by `npm run check:coldstart`.

#### What option 3 actually requires

Listed because "just send four requests" hides all of it:

- **`--max-instances` must rise** (it was 3 when this was written; it is **10 since 2026-09-04**, for
  a different reason — over-capacity requests queue now that nothing falls back). That number is currently the ceiling on a runaway bill,
  so raising it widens the worst case. It is still bounded, and the budget alert is set.
- **The rate limit counts REQUESTS, not strips.** A page becoming four requests means a user hits
  the 20/min cap after five pages. It has to count strips instead, or the limit becomes a bug.
- **Each new instance pays its own 10.6 s cold start**, so the first page after idle gains far less
  than the steady-state figure. Options 1 and 2 are what make option 3 look good in practice.
- **Partial failure needs a policy.** One chunk failing must not produce a half-read page: either
  retry that chunk or fail the whole page. Today a failure is all-or-nothing and, since 2026-09-04,
  shows `server-unavailable`.
- **The chunks must stitch back to exactly the same score.** This is the silent-breakage risk — a
  wrong reassembly does not throw, it produces subtly wrong music. Any implementation needs a check
  that a chunked page equals an unchunked one token for token, in the manner of `parity:server`.

### Dead ends — measured, do not re-propose

- **Batching the encoder.** Slower at every thread count and **2.9× the peak memory**
  ([METRICS.md](../METRICS.md)). `OMR_MAX_BATCH` defaults to 1 for this reason.
- **GPU.** With sparse traffic almost every request is cold, and a cold GPU bills 20–60 s for 2 s of
  inference ([server.md § Deploying the app — the server, the host, and what the friends…](#deploying-the-app--the-server-the-host-and-what-the-friends-release-is-for)). Worth buying as a product feature, never to save time or money
  at this scale.

### The ceiling, stated up front

Options 1 + 2 + 3 together land a typical page at roughly **10–15 s**. Below that means a smaller
model or a GPU, and neither is justified at two friends. If sub-10 s ever becomes a requirement, it
is a model decision, not a hosting one.

### What to measure after any change

```bash
npm run parity:server -- --replay f.json --url <service>   # still reads what the browser reads
npm run bench:server -- --fixture f.json --url <service>   # vCPU-seconds and wall time per page
curl -s <service>/health                                    # loadMs = the model-load half of a cold start
```

⚠ A speed change that alters what the model reads is not a speed change. `parity:server` is what
catches that, and it should be run against the live service after anything on this page ships.
