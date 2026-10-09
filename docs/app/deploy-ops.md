# Running and deploying the decode server — the commands

purpose: the operational half of the server work — how to run it locally, what each check proves, and how it reaches Cloud Run
audience: whoever runs or redeploys the decode server
updated: 2026-10-08

> Split out of [deploy.md](deploy.md) on 2026-08-07 at the 400-line cap. **This page is HOW.**
> What was chosen and why is [deploy.md](deploy.md); the account-by-account walkthrough for the
> app and the weights is [hosting-setup.md](hosting-setup.md); current state is
> [../STATUS.md](../STATUS.md).

---

## Running it, and deploying it

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

**Never used Google Cloud before? [gcloud-setup.md](gcloud-setup.md) is the step-by-step version of
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

## Swapping or reverting the model — every hop, in order

Pieced together from the 2026-09-28 swap to `r4-ctl-stage2-last` ([../log/status-log.md](../log/status-log.md)).
**The live model is the one baked into the Cloud Run image** — a web deploy alone changes nothing a
visitor reads.

1. **Stage the graphs**: copy `data/checkpoints/<name>-onnx/{encoder_model,decoder_model,decoder_with_past_model}_int8.onnx`
   into `apps/web/public/models/` as the three plain names. ⛔ Copy the graphs only — never re-run
   `make_browser_gate.py` for a swap: it rewrites `gate.json`, golds included
   ([../METRICS-ONNX.md](../METRICS-ONNX.md)). Hash-check each copy against its source.
2. **Bump `CACHE_NAME`** in `apps/web/src/omr/session.ts` to the new model's name. ⚠ Missed at the
   2026-09-28 swap and fixed on 2026-10-08: a browser that had cached the old graphs kept reading with
   them.
3. **Run the gate**: `npm run gate:browser` (pinned **26/28** for `r4-ctl`; a different model may
   land elsewhere — record it in [../METRICS-ONNX.md](../METRICS-ONNX.md) before changing the pin).
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
