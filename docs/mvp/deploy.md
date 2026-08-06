# Deploying the app — the server, the host, and what the friends release is for

purpose: the build plan for the decode server and the two-friend release; owns W9/W10 hosting and scope choices
audience: the owner (and whoever wires the deploy), picking up W9

updated: 2026-08-06

> **The server is BUILT and checked; it is not DEPLOYED.** Steps 1–4 below are done as code and as
> measurements, on a laptop. Nobody has run `gcloud` yet, so every cloud-side number here (cold
> start, a shared vCPU's speed, the real bill) is still unmeasured. This file does not state the
> next action: [../STATUS.md](../STATUS.md). The ladder: [README.md](README.md). Decisions:
> [../DECISIONS.md](../DECISIONS.md). Numbers: [../METRICS.md](../METRICS.md).
>
> ✅ **Everything on this page is SETTLED** (owner, 2026-08-05). The server happens; it runs on
> Cloud Run; it is Node, not Python; the client falls back to in-browser decode; confidence
> highlighting is out; the release goes to two friends and asks them about the interface.
>
> ✅ **The thermal question is CLOSED too** (owner, 2026-08-05): the machine still gets hot at the
> current ~25 s page. No re-test is owed.
>
> ⚠ **One argument on this page was measured and did not survive: batching.** It is corrected in
> place below rather than quietly deleted.

## What the friends release is actually for

**Two friends. The question is "what features should I add?", not "how good are the readings?"**
That single sentence decides most of what follows, so it is first:

- **The release is not gated on model accuracy.** Round 3 runs in parallel and never blocks it.
- **The friends build takes a better model whenever one lands** — a server redeploy, no client
  download. The cost is that decode-quality comments from this period cannot be attributed to a
  model version; they are anecdotes. The exam stays the only thing that judges a model.
- **Feedback comes back by talking to them.** No in-app reporting button, no telemetry endpoint. At
  n=2 a conversation beats any widget, and it returns feature ideas rather than bug reports. Build
  the endpoint when the audience is too large to talk to.
- **The public launch is a later rung**, behind Round 3's exam result. If Round 3 is good it opens
  up; if not, Round 4, and so on.

## The architecture

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

### The server is Node, and that is the load-bearing choice

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

## Why not stay all-browser

Ordered by how much they still hurt, **after** the 2026-08-05 rescoping.

1. **Thermals — the owner's reason, and now the whole of the live case.** Decode is ~1.2 s/strip on
   an M4 and a page is ~16–19 strips (both in [README.md](README.md)), so a page pegs several
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

## Where the ~25 s of a 7-staff page goes

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

## Hosting

⚠ **Prices and free tiers were checked 2026-08-05 from general knowledge, not from the vendors'
pages. Re-verify before committing money** — these move, and free tiers get withdrawn.

| Option | Free tier | Fit | Watch out for |
|---|---|---|---|
| **Google Cloud Run** ✅ **CHOSEN** | ~180k vCPU-s + 360k GiB-s/month | CPU, scale to zero, HTTP, no ops | **Cold start 10–30 s with a ~1 GB container** |
| **Hetzner CX22** — the named fallback | none, ~€4/month | Always on, no cold starts, predictable | You own the ops and the patching |
| **Modal** | ~$30/month credit | Python-native; GPU per-second | Rejected with the Python stack; credit is not a permanent tier |
| **HF Spaces (CPU basic)** | 2 vCPU / 16 GB, free | Simplest; weights already headed for HF | Sleeps when idle; public unless PRO |
| **Fly.io** | small always-free allowance | Fast resume from suspended machines | More hands-on config |

**Cloud Run is chosen with its cold start on the record.** It is only survivable because of the
fallback below. If cold starts prove intolerable in testing, **Hetzner at ~€4/month buys the problem
away entirely** — and costs less than keeping Cloud Run warm (`min-instances=1` runs ~$15–25/month).

## The in-browser fallback

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

## Hosting the app itself (the other half of W9)

The decode server is one of three things that have to be somewhere. All three are free.

| What | Where | Why there |
|---|---|---|
| The app (HTML/JS/wasm, **43 MB**) | **Cloudflare Pages or Netlify** — both read `public/_headers`, so the choice stays open | It must send **COOP/COEP**, or `onnxruntime-web` loses `SharedArrayBuffer` and the fallback has no wasm threads |
| The weights (**211 MB**) | **Hugging Face Hub**, fetched only if the fallback fires | A static host will not take a 90 MB file, and a friend on the normal path must never download them |
| Decode | **Cloud Run** | Above |

Three rules that follow, each of which was a way to get this wrong:

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

## Cost — now measured, on a laptop

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

## Monetisation — not now, and the ads plan does not pay for itself

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

## Before exposing anything publicly

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
- [ ] **Hard billing cap and a billing alert, plus `--max-instances`** — ⚠ **STILL OWED, and it is
      the only one that bounds the bill when this process is the thing being abused.** It lives in
      the Cloud Run / billing console and cannot be asserted from the repo.

## The build order

| # | Step | State |
|---|---|---|
| 1 | **Build the endpoint** | ✅ done — `apps/server/`, Dockerfile, `cloudbuild.yaml`, `.gcloudignore`. ⚠ **Deploying it is NOT done**: no `gcloud` on the dev machine and no project has been set up, so cold start and a real vCPU's speed stay unmeasured. |
| 2 | **Prove the server matches the browser** | ✅ done — `npm run parity:server`, and then the check that actually decides it: both arms scored against `_realval_v2` gold, **paired, no detectable difference** (McNemar p = 0.727). [../METRICS.md](../METRICS.md) |
| 3 | **Client swap behind a flag, plus the fallback** | ✅ done — `VITE_DECODE_URL` (or `localStorage.omrDecodeUrl`). All three paths pass `smoke:page` with the SAME score: browser 24.5 s, server 6.0 s, and a dead server falling back in 25.0 s while telling the user so. |
| 4 | **Safety checklist** | ✅ code done (`npm run check:limits`, 6/6 + rate limit). ⚠ Billing cap still owed — see above. |

## Open questions

| Question | Answer |
|---|---|
| What does a page cost in vCPU-seconds? | **11.7 at 1 vCPU** (measured, M4). See Cost above. |
| How long is a real cold start? | ⚠ **STILL OPEN — needs a deploy.** Locally the model loads in **1.5 s** after the port binds, which is the *floor*; Cloud Run adds container scheduling and a ~1 GB image pull on top. |
| Does the ~19 crops/page upload beat sending the page image? | **No — it is usually larger** (median ~1.7×, range 0.11–2.03×). The seam stays where it is for the other reasons, and the byte argument is withdrawn. |
| Is the batched encoder worth it? | **No.** Slower and 2.9× the memory; `OMR_MAX_BATCH` defaults to 1. |

## Running it, and deploying it

Locally — the model directory is assembled from the same int8 graphs the browser's fallback uses:

```bash
node apps/server/tools/prepare-models.mjs        # apps/web/public/models → apps/server/models
npm run dev:server                               # :8080, model ready in ~1.5 s
npm run check:limits                             # the safety checklist
npm run parity:server -- --pages 6 --fixture f.json   # server vs browser, saves a replay fixture
npm run bench:server -- --fixture f.json         # vCPU-s/page, payload bytes
VITE_DECODE_URL=http://localhost:8080 npm run smoke:page      # the real app, through the server
VITE_DECODE_URL=http://localhost:9999 npm run smoke:page      # the real app, through the FALLBACK
```

**Never used Google Cloud before? [gcloud-setup.md](gcloud-setup.md) is the step-by-step version of
this section** — accounts, projects, billing, and what a budget alert does and does not do.

Deploying — ⚠ **not yet run by anyone.** The image builds in Cloud Build rather than locally for two
reasons: the Dockerfile is not at the context root (the server bundles `apps/web/src/omr/decode.ts`
on purpose), and a `docker build` on an Apple Silicon Mac produces arm64, which Cloud Run will not
start.

```bash
PROJECT=<your-project>; REGION=europe-west3        # Frankfurt — closest to Türkiye
IMAGE=$REGION-docker.pkg.dev/$PROJECT/omr/decode:latest

gcloud artifacts repositories create omr --repository-format=docker --location=$REGION
gcloud builds submit --config apps/server/cloudbuild.yaml --substitutions _IMAGE=$IMAGE .

gcloud run deploy omr-decode --image $IMAGE --region $REGION \
  --cpu 1 --memory 2Gi --concurrency 1 --max-instances 3 --timeout 300 \
  --set-env-vars OMR_ORT_THREADS=1,ALLOWED_ORIGINS=https://<the-app-host> \
  --allow-unauthenticated
```

Why those flags: `--cpu 1` is the cheapest shape (see Cost); `--concurrency 1` because ORT already
uses the whole core and a second page in flight only doubles memory (the process serializes anyway,
this makes Cloud Run agree); `--memory 2Gi` against a measured 955 MB peak at batch 1;
`--max-instances 3` is the cheap ceiling on total spend. Then, before the URL goes anywhere:
set the **billing cap and alert**, run `npm run check:limits -- --url <service>`, and re-run
`npm run bench:server -- --url <service>` to replace the laptop numbers above.

⚠ `.gcloudignore` is load-bearing: `apps/web/public/models/` is gitignored, and without an explicit
ignore file gcloud derives the upload list from `.gitignore` and ships a context with **no weights
in it**.

## What this changes in the ladder

| Rung | Effect |
|---|---|
| **W8** (confidence) | **DROPPED** for this release — the pre-registered bar was not met. Half of the 2026-07-27 goal stays unbuilt, said out loud. [../DECISIONS.md](../DECISIONS.md) |
| **W9** (server + hosting) | **Server BUILT 2026-08-06, not deployed.** ⚠ The *hosting* half of this rung's title is untouched: the app still runs from `npm run dev:web` and the fallback's weights still come from `apps/web/public/models/`. **Putting the app on a COOP/COEP host and the weights on Hugging Face Hub is owed** — nothing about it changed, it simply was not built, and W10 cannot happen without it. |
| **W10** (friends release) | Two friends, interface feedback, no ads, no in-app reporting; safety checklist first. |
| **public launch** | A new rung after W10, gated on Round 3's exam result. |
