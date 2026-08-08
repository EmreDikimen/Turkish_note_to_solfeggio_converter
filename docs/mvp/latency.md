# Making a page faster — the options, with what each one costs

purpose: the measured options for cutting the time a friend waits for a page, and the honest cost of each; owns the latency decisions the deployed server raised
audience: whoever picks up "make it faster" — the numbers here are measured, not estimated

updated: 2026-08-08

> Deployment, hosting and the bill: [deploy.md](deploy.md). Every number below also lives in
> [../METRICS.md](../METRICS.md). Current state and next action: [../STATUS.md](../STATUS.md).
>
> ⚠ **None of this is built, and the owner decided on 2026-08-06 that almost none of it will be
> before W10.** Only **`--cpu-boost`** is bought, because it rides a redeploy that has to happen
> anyway; everything else is **deferred, not dropped**, and the trigger is a friend saying the wait
> is annoying. The reasoning is in [../DECISIONS.md](../DECISIONS.md); the prices below are what
> that decision was made against, so they stay exactly as measured.

## Where the time goes

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

⚠ **The "total (cold)" column is wrong about what a user experiences, and 2026-08-08 measured it.**
It assumes the upload *waits* out the boot. It does not: the container accepts connections before its
graphs are loaded, so `/decode` answers a truthful `503 model still loading`, and `remote.ts` routes
**any** failure to the browser without retrying. A cold start therefore does not add ~11 s — it moves
the entire page onto the friend's own machine, plus a 211 MB weights download the first time. Those
numbers are the fallback's, not the server's. **This is the strongest argument for option 1 below**,
and it makes option 1 a correctness fix rather than a polish item. Numbers:
[../METRICS.md](../METRICS.md).

⚠ For comparison, the same 26-strip page reads in **34 s in the owner's own browser** on an M4. The
server is slower, deliberately — the release was chosen on thermals, not speed
([DECISIONS.md](../DECISIONS.md)). But a friend waiting 55 s is a W10 problem, because W10 asks
them about the *interface*.

## ✅ Parallelism works — measured, not assumed

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

## The options

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
removes the cold start" argument still holds for option 2. Worth re-deciding, not worth assuming.

### What option 3 actually requires

Listed because "just send four requests" hides all of it:

- **`--max-instances` must rise** (3 → ~8). That number is currently the ceiling on a runaway bill,
  so raising it widens the worst case. It is still bounded, and the budget alert is set.
- **The rate limit counts REQUESTS, not strips.** A page becoming four requests means a user hits
  the 20/min cap after five pages. It has to count strips instead, or the limit becomes a bug.
- **Each new instance pays its own 10.6 s cold start**, so the first page after idle gains far less
  than the steady-state figure. Options 1 and 2 are what make option 3 look good in practice.
- **Partial failure needs a policy.** One chunk failing must not produce a half-read page: either
  retry that chunk or fall back to the browser for the whole page. Today a failure is all-or-nothing
  and the fallback handles it.
- **The chunks must stitch back to exactly the same score.** This is the silent-breakage risk — a
  wrong reassembly does not throw, it produces subtly wrong music. Any implementation needs a check
  that a chunked page equals an unchunked one token for token, in the manner of `parity:server`.

## Dead ends — measured, do not re-propose

- **Batching the encoder.** Slower at every thread count and **2.9× the peak memory**
  ([METRICS.md](../METRICS.md)). `OMR_MAX_BATCH` defaults to 1 for this reason.
- **GPU.** With sparse traffic almost every request is cold, and a cold GPU bills 20–60 s for 2 s of
  inference ([deploy.md](deploy.md)). Worth buying as a product feature, never to save time or money
  at this scale.

## The ceiling, stated up front

Options 1 + 2 + 3 together land a typical page at roughly **10–15 s**. Below that means a smaller
model or a GPU, and neither is justified at two friends. If sub-10 s ever becomes a requirement, it
is a model decision, not a hosting one.

## What to measure after any change

```bash
npm run parity:server -- --replay f.json --url <service>   # still reads what the browser reads
npm run bench:server -- --fixture f.json --url <service>   # vCPU-seconds and wall time per page
curl -s <service>/health                                    # loadMs = the model-load half of a cold start
```

⚠ A speed change that alters what the model reads is not a speed change. `parity:server` is what
catches that, and it should be run against the live service after anything on this page ships.
