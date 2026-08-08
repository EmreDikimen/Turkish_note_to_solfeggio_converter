# Putting the app online — step by step, in plain words

purpose: the owner's walkthrough for the two accounts W9 still needs (Hugging Face for the weights, Netlify for the app), from "no account" to "a link a friend can open"
audience: the project owner (basic English, same style as OVERVIEW.md)

updated: 2026-08-08

> ✅ **This was all done on 2026-08-06** — the app is at **<https://komavision.netlify.app>**, the
> weights at **`Beyaban/omr-weights`**. The page is kept as the record of how, and as the recipe for
> doing it again (a second site, a rebuilt machine, a new model). Two things bit us and are marked
> ⚠ **GOTCHA** below.
>
> This page is **how to do it**. What we chose and why is [deploy.md](deploy.md). The Google Cloud
> half has its own page: [gcloud-setup.md](gcloud-setup.md). Current state: [../STATUS.md](../STATUS.md).

---

## What still has to go somewhere

The decode server is already live. Two things are not:

| What | Size | Where | Done? |
|---|---|---|---|
| The decode server | — | Cloud Run | ✅ live |
| **The weights** (three model files) | **211 MB** | **Hugging Face Hub** | ❌ this page |
| **The app** (the web page itself) | **43 MB** | **Netlify** | ❌ this page |

**Do them in that order.** The weights get an address, and that address has to be typed into the
app *while it is being built* — so the app cannot be built until the weights exist.

⚠ **Nothing here needs a payment card.** Both are free at this size.

### Why the weights are not just part of the app

A static host will not accept a 90 MB file, and — more importantly — **a friend on the normal path
never downloads them at all**. The weights are only fetched if the Cloud Run server does not answer
and the app has to read the page on their own machine instead. So they live somewhere separate, and
are collected only in that emergency.

---

## Part 1 — Hugging Face (the weights)

Hugging Face is a free hosting site for machine-learning files. Think of it as GitHub for models.

### Step 1 — make the account

1. Go to <https://huggingface.co/join>.
2. Sign up with your email. Pick a username — **it becomes part of the address of your weights**, so
   choose one you are happy to keep.
3. Confirm the email they send.

### Step 2 — make a token, so the computer can log in as you

A token is a long password that programs use instead of your real one.

1. Go to <https://huggingface.co/settings/tokens>.
2. **Create new token** → give it the **Write** role (it needs to upload, not just read).
3. Name it something like `turkish-omr-upload`.
4. Copy it. **You cannot see it again after you leave that page** — if you lose it, delete it and
   make another; that costs nothing.

Then log in on this machine:

```bash
.venv-ml/bin/hf auth login
```

It asks you to paste the token. Paste it and press Enter. (It will not appear on screen as you
type — that is normal, not a frozen terminal.)

⚠ It also asks whether to use the token for git. **Say no** — this project does not push code to
Hugging Face, only files.

### Step 3 — make the repository, and make it PUBLIC

```bash
.venv-ml/bin/hf repo create omr-weights --repo-type model
```

This creates `https://huggingface.co/<your-username>/omr-weights`.

⚠ **It must be public, which is the default here — do not add `--private`.** The reason: the app
fetches these files straight from a friend's browser, with no password anywhere. A private repo
would need a token embedded in the app, and anything embedded in a web page is public anyway — it
would be a secret in name only.

Nothing sensitive is in there. It is a music-reading model, trained on our own rendered sheets.

### Step 4 — upload the weights

```bash
.venv-ml/bin/hf upload <your-username>/omr-weights apps/server/models . --repo-type model
```

That is 211 MB over your connection — expect a few minutes, and it prints progress. If it stops
half way, run the same command again: it skips what already arrived.

⚠ **Upload `apps/server/models/`, not any other model folder.** That exact directory is what the
Cloud Run container was built from, so the server and the emergency fallback read the same bytes. If
they were assembled separately they would slowly drift apart, and the first sign of it would be a
friend's fallback quietly disagreeing with the server for no visible reason.

If that folder is missing, rebuild it with:

```bash
node apps/server/tools/prepare-models.mjs
```

### Step 5 — check it from outside

```bash
curl -sIL https://huggingface.co/<your-username>/omr-weights/resolve/main/model.json | head -20
```

You want a `200` on all four files. You also want an `access-control-allow-origin` line — that
header is what lets a browser on another website read the file, and without it the fallback fails
*quietly*.

⚠ **The three `.onnx` files answer `*`, but `model.json` does not, and that is fine.** The big files
are LFS and come from a CDN; the small one is served by the Hub app, which **reflects whoever asked**
behind `vary: Origin`. A bare `curl` sends no Origin, so it shows `https://huggingface.co` and looks
broken. Ask the way a browser does before believing it:

```bash
curl -s -o /dev/null -D - -H "Origin: https://example.netlify.app" \
  "https://huggingface.co/<your-username>/omr-weights/resolve/main/model.json" | grep -i access-control-allow-origin
```

It should echo back the origin you sent. `model.json` is fetched on **every** page load, not just
the fallback, so this one is worth checking properly.

**Write this address down**, it is the next part's input:

```
https://huggingface.co/<your-username>/omr-weights/resolve/main
```

(`resolve/main` is the part that means "give me the actual file", not the web page about the file.)

---

## Part 2 — Netlify (the app)

### Why Netlify and not Cloudflare Pages

Cloudflare was the first choice and it does not work, for one specific reason found on 2026-08-06:
**Cloudflare Pages refuses any single file over 25 MiB**, and one file in our app is **25.58 MiB** —
the wasm runtime that lets the browser read a page on its own. Over by about 600 KB.

Netlify has no cap in the way, and reads the same `_headers` file, so nothing in the project had to
change. (This is the payoff of a choice made back on 2026-08-05: the two hosts were kept
interchangeable on purpose.)

The wasm file *can* be made half the size later — see [deploy.md](deploy.md) — but that is a change
to how the app reads pages, and it should not be rushed to meet a hosting deadline.

### Step 6 — make the account

Go to <https://app.netlify.com/signup> and sign up with your email. No card.

### Step 7 — build the app, with both addresses baked in

The app has to be built **knowing** where the server and the weights are. These are not settings you
can change afterwards — they are written into the files.

```bash
VITE_DECODE_URL=https://omr-decode-706571981988.europe-west3.run.app \
VITE_WEIGHTS_URL=https://huggingface.co/<your-username>/omr-weights/resolve/main \
npm run build:app
```

⚠ It is the whole address from step 5, `huggingface.co` included — and no trailing slash.

The build takes a few seconds and ends with `✓ deployable (under 60 MB, no weights)`. That last
check exists because the project folder holds 332 MB of model files that must **not** be published;
the build refuses rather than trusting anyone to remember.

### Step 8 — send it to Netlify

```bash
npx netlify-cli login                       # opens a browser, click Authorize
```

⚠ **GOTCHA 1 — the interactive commands do not work in a monorepo.** `netlify sites:create` and a
plain `netlify deploy` stop and ask "which project?" (it sees `packages/core`, `apps/server`,
`apps/web`). Go through the API instead, which asks nothing. What actually worked:

```bash
cd apps/web                                  # or it resolves ./dist against the repo root and fails
npx netlify-cli api createSite --data '{"name":"komavision"}'
# it ignores "name" and invents one — rename it, and check the answer:
npx netlify-cli api updateSite --data '{"site_id":"<id>","body":{"name":"komavision"}}'
npx netlify-cli deploy --dir /absolute/path/to/apps/web/dist --prod --site <id> --no-build
```

⚠ **GOTCHA 2 — a brand-new Netlify site is PRIVATE, and it does not tell you.** Every URL answers
**401** with a "Login Redirect" page, including the one you just deployed. Nothing is wrong with the
build: Netlify now switches SSO on for new sites (`sso_login: true`). Turn it off:

```bash
npx netlify-cli api updateSite --data '{"site_id":"<id>","body":{"sso_login":false}}'
```

Then `curl -sI https://<name>.netlify.app/` should be **200**. It was neither the account nor the
email — both were fine — so do not go hunting for a verification email as we nearly did.

**Simpler alternative if the terminal is annoying:** open <https://app.netlify.com/drop> and drag
the `apps/web/dist` folder onto the page. Same result, and it does not hit gotcha 1.

**Write down the address it gives you.**

---

## Part 3 — lock the door and check it

### Step 9 — tell the server who is allowed to call it

Right now the decode server accepts requests from anywhere (`ALLOWED_ORIGINS` is `*`). Now that the
app has a real address, this one command does three owed things at once:

```bash
gcloud run deploy omr-decode \
  --image europe-west3-docker.pkg.dev/turkish-omr-app/omr/decode:latest \
  --region europe-west3 \
  --cpu 1 --memory 2Gi --concurrency 1 --max-instances 3 --timeout 300 --cpu-boost \
  --set-env-vars OMR_ORT_THREADS=1,ALLOWED_ORIGINS=https://<your-site>.netlify.app \
  --allow-unauthenticated
```

⚠ **Rebuild the image first** if the running one predates commit `0b1cb44` — see the deploy commands
in [deploy.md](deploy.md). That commit fixes an oversized upload reporting itself as "the server is
down" instead of "that file is too big".

What the three are: the address lock, the 413 fix, and `--cpu-boost` (extra processing power during
the slow first start, decided 2026-08-06).

### Step 10 — check it the way a friend would

Open the Netlify address in a browser and upload a page of sheet music. Then check two things:

1. It says **"read on the server"** at the end, not "read on your machine". If it says the second
   one, the app could not reach Cloud Run — most likely step 9 has a typo in the address.
   ⚠ **On the first upload after a quiet spell it will say "read on your machine", and nothing is
   broken.** The server takes ~10 seconds to wake and honestly says "not ready yet" until it has; the
   app does not wait, it just reads the page here instead. Upload a second page and it will say "on
   the server". If you want the first one to go to the server, open the page, wait ten seconds, then
   upload. (Whether the app *should* wait is an open call — [latency.md](latency.md), option 1.)
2. It finishes. A page takes **35–65 seconds** depending on how many lines of music are on it. The
   first upload after idle is the one read on your own machine, which is a similar wait but also
   downloads the 211 MB of model files once.

And re-check the machine-run version, which tests both paths at once:

```bash
npm run smoke:build -- --decode-url https://omr-decode-706571981988.europe-west3.run.app
```

⚠ `--cpu-boost` is new and unproven for us. Google says "up to" faster, so **read the number rather
than believing it**:

```bash
curl -s https://omr-decode-706571981988.europe-west3.run.app/health
```

`loadMs` is how long the model took to load. It was **9,500 ms** before. Put whatever it is now in
[../METRICS.md](../METRICS.md).

---

## Shipping a change afterwards (you will do this for every frontend edit)

The two URLs are **baked into the files at build time**, so `dist/` cannot be edited in place and a
rebuild always needs both variables. Two commands:

```bash
VITE_DECODE_URL=https://omr-decode-706571981988.europe-west3.run.app \
VITE_WEIGHTS_URL=https://huggingface.co/Beyaban/omr-weights/resolve/main \
npm run build:app

cd apps/web && npx netlify-cli deploy --dir "$PWD/dist" --prod \
  --site f16514d1-b17b-4dcd-8fc9-2f93816b1d64 --no-build
```

Then `npm run smoke:live` — it confirms the machinery still works after the furniture moved. A bad
deploy is one click to undo: Netlify keeps every previous version under **Deploys → Publish deploy**.

⚠ While working locally, `npm run dev:web` reaches the live decode server because
`http://localhost:5173` and `:4173` are in `ALLOWED_ORIGINS`. `npm run smoke:build` against the live
server does **not** — it serves on its own port and gets refused. That is the lock working.

## What it costs

| | |
|---|---|
| Hugging Face (211 MB, public) | **$0** — free for public model files, no card |
| Netlify (43 MB app) | **$0** — the free tier allows 100 GB of traffic a month; two friends will use a fraction of a GB |
| Cloud Run | **$0** — already measured, about 15% of the free tier at 50 users |

---

## If you get stuck

- **The app says "read on your machine" every time.** The browser could not reach Cloud Run. Open
  the browser's developer console (⌥⌘I) and look for a red CORS message — that means step 9's
  address does not exactly match the app's address (`https://`, no trailing slash).
- **The app hangs with a spinner forever.** That is the fallback failing, and it means the weights
  address is wrong. Re-run step 5's `curl`.
- **`hf: command not found`.** Use the full path: `.venv-ml/bin/hf`.
- **Netlify deployed but the page is blank.** Check you pointed it at `apps/web/dist`, not
  `apps/web`.
- **You want to undo a Netlify deploy.** Netlify keeps every previous version — in the site's
  **Deploys** tab, open an older one and press "Publish deploy".
