# Deploying the app — hosting, cost, and the server question

purpose: the plan for how this app reaches real users, and the costing behind it; owns W9/W10 hosting choices
audience: the owner (and whoever wires the deploy), at the point the app is feature-complete
updated: 2026-08-05

> **Nothing here is built yet, and nothing here is the next action.** Current state and next action:
> [../STATUS.md](../STATUS.md). The ladder this belongs to (W9 hosting, W10 friends release):
> [README.md](README.md). Decisions: [../DECISIONS.md](../DECISIONS.md).
>
> ⚠ **This reopens a LOCKED decision.** "No production backend" (2026-07-02) and the `CLAUDE.md`
> hard rule "No backend, ever" both predate this. The owner's stated reason for reopening it
> (2026-08-05) is thermal, not capability: the in-browser decode pegs the CPU long enough to heat
> the machine. The decision is **reopened, not taken** — see [../DECISIONS.md](../DECISIONS.md).
>
> ⚠ **UPDATED 2026-08-05, later the same day: the client-side prerequisite this doc asked for is
> DONE, and it changes the numbers below.** The deskew sweep is 126× cheaper at no change in its
> answers, so a page went **~56 s → ~25 s** and the slicer went 36.6 → 1.3 s/page. The CPU a page
> burns is now **~21 s, essentially all of it decode**. That makes the server question cleaner (the
> only thing left to move IS the decode) and the thermal complaint smaller (about 60% less heat per
> page). **Re-test whether the machine still gets hot before building anything** — the complaint
> that opened this doc was measured against a page that no longer exists.

## The recommendation, in one line

**Slice in the browser, decode on a CPU server that scales to zero.** Not all-browser (thermals,
the re-download problem), not GPU (cold starts cost more than the inference), not ads (the CPM
maths does not work for this audience).

## Why not stay all-browser

Four problems, ordered by how much they will actually hurt. The first is the one that decides it.

1. **The weights get re-downloaded on mobile.** iOS Safari evicts Cache Storage for non-installed
   sites after roughly a week of no use. The weights are ~200 MB (size in [README.md](README.md)),
   so a friend who opens the app every other weekend pays that download *every time*, on cellular.
   There is no clean in-browser fix. This is a harder wall than any speed number.
2. **Thermals — the owner's actual complaint.** Decode is ~1.2 s/strip on an M4 and a page is ~16–19
   strips (both in [README.md](README.md)), so a page pegs several threads for ~19 s. On this
   fanless M4 that is a measurable heat event, and every user pays it on their own machine.
   ⚠ **This is now the WHOLE of it.** Slicing used to add ~36 s of equally hot work and now adds
   1.6 s, so the per-page heat is already down ~60% without touching the architecture. Whether what
   remains still justifies a backend is **unmeasured since the change**.
3. **Phone CPU.** ⚠ **Estimate, not measured** — WASM SIMD on a mid-range Android is roughly 3–6×
   slower than the M4, a recent iPhone roughly 1.5–2×. That puts a page somewhere between 30 s and
   2 minutes. **Nobody has run this on a real phone yet**; see [Open questions](#open-questions).
4. **No batching, ever.** `onnxruntime-web` decodes one strip at a time. A server runs all ~19
   strips through the encoder in one batched pass. This gap is structural — it does not close with
   optimisation, and it is why the same model is several times cheaper per page on a server.

**What stays true:** the W4–W6 slicer port is *not* wasted by this. It moves to the client side of
the seam below, where it is still the thing that makes the upload small.

## The architecture

```
browser                                   server (scale-to-zero, CPU)
───────────────────────────────────       ─────────────────────────────
page image
  → prepPage (deskew — ~1.1 s since 2026-08-05, was ~35 s)
  → slicer  (W4–W6, opencv.js)  — 1.6 s/page all in
  → ~19 strip crops  ─── POST ──────────→  batched encoder + decoder
                                                    │
  editor ← stitch ← tokens  ←─── JSON ─────────────┘
  playback (unchanged, local)
```

Three reasons the seam sits there and not earlier:

- **Upload size.** ~19 small crops instead of one full-resolution page photo. Much cheaper on phone
  data than shipping the original image.
- **Server cost.** Slicing is the cheap half and it stays free on the client. The server only pays
  for the neural decode, which is the half that actually needs batching.
- **The port keeps earning.** W4–W6 were validated over the whole corpus; that work carries over
  unchanged rather than being replaced by a Python call.

✅ **This doc said "fix the deskew before building any server", and that was done on 2026-08-05.**
The reasoning was that prep stays on the client in *both* architectures, so a client-side win is
never wasted, and at the time the sweep was the larger share of page latency. It turned out not to
need the behaviour change this doc budgeted for: the sweep's per-call cost collapsed 126× as an
**exact** substitution, verified at 0 disagreements over 328 angle evaluations and unchanged
parity ([rungs.md](rungs.md), [../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md)).

**Where that leaves the ~25 s a 7-staff page now takes:**

| Stage | Client cost today | Moving it to a server would |
|---|---|---|
| decode (16 strips × ~1.2 s) | **~19 s** | remove nearly all remaining page cost |
| slicer incl. deskew | **1.6 s** | save nothing worth the upload |
| model load, first use only | ~3.4 s | disappear (weights never reach the client) |

So the cheap client-side win is spent, and **decode is now the entire case for a server** — which is
a cleaner argument than the one this doc opened with, not a weaker one. What has NOT been re-checked
is whether ~19 s of decode alone still produces the heat that motivated it.

## Hosting options

⚠ **Prices and free tiers checked 2026-08-05 from general knowledge, not from the vendors' pages.
Re-verify every number before committing** — these move, and free tiers get withdrawn.

| Option | Free tier | Fit | Watch out for |
|---|---|---|---|
| **Google Cloud Run** (recommended) | ~180k vCPU-s + 360k GiB-s/month | CPU, scale to zero, HTTP, no ops | Cold start 10–30 s with a ~1 GB container |
| **Modal** | ~$30/month credit | Python-native — could run `decode_page.py` nearly verbatim; GPU available per-second | Credit is not a permanent free tier |
| **HF Spaces (CPU basic)** | 2 vCPU / 16 GB, free | Simplest; weights already planned for HF Hub | Sleeps when idle; public unless PRO |
| **Fly.io** | small always-free allowance | Fast resume from suspended machines | Needs more hands-on config |
| **Hetzner CX22** | none, ~€4/month | Always on, no cold starts, predictable | You own the ops and the patching |

**Pick Cloud Run** unless cold starts prove unacceptable in testing, in which case Hetzner at ~€4
buys away the problem entirely.

## Cost, and why GPU is the wrong default

⚠ **All figures below are estimates derived from the M4 timings in [README.md](README.md).** No
server has been benchmarked. Treat the ratios as the finding, not the absolute numbers.

A page is roughly **30–60 vCPU-seconds** on a normal server core, batched. Against Cloud Run's free
tier that is **~3,000–6,000 pages/month at no cost** — several hundred active users before the
first bill.

**The GPU cold-start trap.** Per-second GPU billing sounds cheaper than it is when traffic is
sparse, which is exactly the traffic this will have:

| | Inference | Billed |
|---|---|---|
| GPU, warm | ~2 s | ~2 s |
| GPU, cold (container boot + weights onto device) | ~2 s | **20–60 s** |

With sparse traffic almost every request is cold, so the real cost is ~10–15× the "2 seconds of
GPU" figure. GPU is worth buying only as a *product feature* (sub-2-second responses), never as a
way to save money.

## Monetisation — the ads plan does not pay for itself

The idea was: pass the free tier, add ads, app pays for itself. **The CPM maths kills it.** This
audience is largely Turkish, and Turkish display CPMs run roughly $0.30–1.50 RPM against $5–15 for
US traffic.

⚠ Estimates, order-of-magnitude only:

| Per 1,000 pages converted | |
|---|---|
| Ad revenue (~2–3 impressions each, Turkish CPM) | **~$1–4** |
| Cost on scale-to-zero GPU with cold starts | **~$5–15** |
| Cost on CPU inside the Cloud Run free tier | **$0** |

So ads are underwater against the GPU plan, and unnecessary against the CPU plan. On top of that,
AdSense wants meaningful traffic before approving an account, and it drags in a privacy policy and
cookie consent (GDPR/KVKK) — real work for a few dollars.

**Instead:** one "buy me a coffee" link. A single $5 supporter beats ~5,000 ad impressions at these
rates, costs nothing to add, and does not degrade the app.

**Not in the friends release either way.** W10 exists to collect honest feedback on the OMR; ads
would collect feedback on the ads.

## Before exposing anything publicly

An open inference endpoint with usage billing is the standard way to get a surprise bill — one
script, or one bad crawler. All four of these go in before the URL is shared beyond friends:

- [ ] Hard billing cap **and** a billing alert (Cloud Run: also cap max instances — a cheap ceiling
      on total spend)
- [ ] Rate limit per IP
- [ ] Max upload size, and a cap on strips per request
- [ ] Reject non-image payloads early (`tools/vision/parity/edge-cases.ts` already covers the
      "non-strip images must not throw" case on the client)

## Feedback collection — worth doing regardless

Independent of where inference runs: **W10's stated goal is feedback, and an all-browser app
returns none.** When a friend gets a bad decode, nothing comes back unless they email.

An opt-in "this was wrong" button that POSTs the page image plus the decode to a cheap endpoint is a
few dozen lines, and it is worth more to Round 3 than any speedup here. If the server exists for
inference anyway, this is nearly free. **If the server plan is dropped, build this part anyway.**

## Open questions

These are unmeasured, and the first one can still change the whole plan.

| Question | How to settle it | Blocks |
|---|---|---|
| **Does the machine still get hot?** The complaint that opened this doc was measured against a ~56 s page; it is ~25 s now, ~19 s of it decode | Convert a few pages and watch the thermals, as before | **Whether this doc is still needed at all** |
| What does a page actually cost on a real phone? | Load the app on a mid-range Android and an iPhone, time one page, watch for a tab kill | Whether the server is needed at all |
| What does a batched page cost in vCPU-seconds? | Benchmark the batched decode on one cloud core | Every cost figure on this page |
| Is a Cloud Run cold start tolerable for a first upload? | Deploy once, measure with min-instances 0 | Cloud Run vs Hetzner |
| Does the ~19 crops/page upload beat sending the page image? | Compare payload bytes on a few real pages | The seam position |

⚠ **The first two are hours of work and the whole plan rests on them.** The re-test costs one page;
the server argument otherwise rests on an extrapolation from one M4, against a page latency that has
since changed by more than half.

## What this changes in the ladder

| Rung | Effect |
|---|---|
| **W8** (confidence) | None — unchanged, and still next |
| **W9** (model delivery + hosting) | Split: weights-to-browser delivery becomes weights-to-server, and the [../DECISIONS.md](../DECISIONS.md) 2026-08-02 "revisit at W9" row is the one to settle here |
| **W10** (friends release) | Gains the safety checklist above; ads explicitly out of scope |

The COOP/COEP hosting constraint mostly **goes away** if decode moves server-side: it exists so
`onnxruntime-web` can use threads. Keep it only if the browser path is retained as a fallback.
