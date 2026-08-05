# Deploying the app — the server, the host, and what the friends release is for

purpose: the build plan for the decode server and the two-friend release; owns W9/W10 hosting and scope choices
audience: the owner (and whoever wires the deploy), picking up W9

updated: 2026-08-05

> **Nothing here is built yet, and this file does not state the next action.** Current state and
> next action: [../STATUS.md](../STATUS.md). The ladder: [README.md](README.md). Decisions:
> [../DECISIONS.md](../DECISIONS.md).
>
> ✅ **Everything on this page is now SETTLED** (owner, 2026-08-05). The server happens; it runs on
> Cloud Run; it is Node, not Python; the client falls back to in-browser decode; confidence
> highlighting is out; the release goes to two friends and asks them about the interface. This page
> stopped being a proposal — it is the build order.
>
> ✅ **The thermal question is CLOSED too** (owner, 2026-08-05): the machine still gets hot at the
> current ~25 s page. No re-test is owed, and the request for one has been removed from the build
> order below.

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
  → slicer  (W4–W6, opencv.js) — 1.6 s     Node + onnxruntime-node
  → ~19 strip crops  ─── POST ───────────→   importing apps/web/src/omr/decode.ts
                                             batched encoder + decoder
  editor ← stitch ← tokens ←── JSON ────────────────┘
  playback (unchanged, local)

  └─ on failure/timeout ─→ in-browser decode (weights fetched lazily, first fallback only)
```

Three reasons the seam sits after the slicer and not before it:

- **Upload size.** ~19 small crops instead of one full-resolution page image.
- **Server cost.** Slicing is the cheap half (1.6 s) and stays free on the client. The server pays
  only for the neural decode, which is the half that actually benefits from batching.
- **The port keeps earning.** W4–W6 were validated over the whole corpus; that work carries over
  unchanged rather than being replaced by a server-side call.

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
batched decode needs **no model re-export**. Had it been fixed at 1, the batching argument on this
page would have carried a re-export and a re-run of the whole parity chain behind it.

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
2. **No batching, ever.** `onnxruntime-web` decodes one strip at a time; a server runs all ~19
   through the encoder in one batched pass. Structural, does not close with optimisation.
3. **~~The weights get re-downloaded on mobile.~~ PARKED with phones (2026-08-05).** iOS Safari
   evicts Cache Storage for non-installed sites after roughly a week, so a friend opening the app
   every other weekend would re-download ~200 MB on cellular each time. This was the *strongest*
   argument on this page and it is **parked, not refuted** — it returns intact when phones do.
4. **~~Phone CPU.~~ PARKED with phones.** Was an estimate, never measured on a real device.

**What stays true:** the W4–W6 slicer port is not wasted. It moves to the client side of the seam,
where it is what keeps the upload small.

## Where the ~25 s of a 7-staff page goes

| Stage | Client cost today | Moving it to the server |
|---|---|---|
| decode (16 strips × ~1.2 s) | **~19 s** | removes nearly all remaining page cost *from the client* |
| slicer incl. deskew | **1.6 s** | saves nothing worth the upload |
| model load, first use only | ~3.4 s | disappears on the normal path |

⚠ **Non-claim, and it should not be discovered after the build: the server probably does not make a
page FASTER for the user.** A shared cloud vCPU is slower per core than an M4 P-core, and Cloud Run
adds a 10–30 s cold start that two-friend traffic will pay on nearly every upload. Warm, a page
should land near today's ~25 s; cold, it will be worse. **What the server buys is the friend's
laptop staying cool — that is the decision that was taken, and it is a thermal win, not a latency
win.** Anyone expecting a speedup will read the first benchmark as a failure.

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

If the POST fails, times out, or the server is cold beyond a threshold, **the client decodes
locally** and tells the user it is running on their machine this time.

- The code already exists and is under test (`gate:browser`, `smoke:page`), so this is near-free.
- A server outage never reads as "the app is broken" to a friend who cannot debug it.
- It makes the Cloud Run cold start survivable rather than fatal.

**Two consequences that are easy to miss:**

1. **The weights must still reach the browser**, so the Hugging Face Hub delivery decision stays
   LOCKED — but they are fetched **lazily, only when the fallback first fires**, never on the normal
   path.
2. **The COOP/COEP host requirement does NOT go away.** It exists so `onnxruntime-web` can use wasm
   threads, and the fallback wants them. An earlier version of this page guessed it would mostly
   lapse once decode moved server-side; that was wrong, and the fallback is why.

## Cost

⚠ **Estimates derived from the M4 timings in [README.md](README.md). No server has been
benchmarked** — treat the ratios as the finding, not the absolute numbers.

A page is roughly **30–60 vCPU-seconds** batched on a normal server core. Against Cloud Run's free
tier that is **~3,000–6,000 pages/month at no cost**. At two friends, cost is not a consideration at
all; this number matters only at public launch.

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

- [ ] Hard billing cap **and** a billing alert (Cloud Run: also cap max instances — a cheap ceiling
      on total spend)
- [ ] Rate limit per IP
- [ ] Max upload size, and a cap on strips per request
- [ ] Reject non-image payloads early (`tools/vision/parity/edge-cases.ts` already covers the
      "non-strip images must not throw" case on the client)

## The build order

| # | Step | Why this order |
|---|---|---|
| 1 | **Build the endpoint and deploy it to Cloud Run** | The "benchmark a cloud core first" step is folded in here — you cannot benchmark a batched page without containerising the model and deploying it, which is most of the endpoint. Doing it once answers the vCPU-second cost, the cold-start reality and the payload question together. |
| 2 | **Prove the server matches the browser** | Same discipline as the slicer port: the in-browser path is the reference. Reusing `decode.ts` makes this a smoke test rather than a rung, but it still has to be *run*. |
| 3 | **Client swap behind a flag, plus the fallback** | Keeps the browser path live and switchable. |
| 4 | **Safety checklist** | Before the URL reaches anyone, including the two friends. |

## Open questions

Reduced to two by the rescoping — the phone questions went with the phones, and the thermal question
was closed by the owner (see below).

| Question | How to settle it | Blocks |
|---|---|---|
| What does a batched page cost in vCPU-seconds, and how long is a real cold start? | Falls out of build step 1 | Cloud Run vs Hetzner, and every cost figure here |
| Does the ~19 crops/page upload beat sending the page image? | Compare payload bytes on a few real pages | Whether the seam is in the right place |

## What this changes in the ladder

| Rung | Effect |
|---|---|
| **W8** (confidence) | **DROPPED** for this release — the pre-registered bar was not met. Half of the 2026-07-27 goal stays unbuilt, said out loud. [../DECISIONS.md](../DECISIONS.md) |
| **W9** (server + hosting) | Now the next build. Stack, host, fallback and order all settled above. |
| **W10** (friends release) | Two friends, interface feedback, no ads, no in-app reporting; safety checklist first. |
| **public launch** | A new rung after W10, gated on Round 3's exam result. |
