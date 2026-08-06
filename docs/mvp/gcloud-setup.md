# Setting up Google Cloud — step by step, in plain words

purpose: the owner's walkthrough for getting from "gcloud is installed" to "the decode server is running", written for someone who has never rented a server
audience: the project owner (basic English, same style as OVERVIEW.md)

updated: 2026-08-06

> This page is **how to do it**. What we chose and why is [deploy.md](deploy.md); the exact deploy
> commands live there too and are repeated at the end here. Current state:
> [../STATUS.md](../STATUS.md).

---

## First: do NOT delete your old gcloud

You installed `gcloud` before, for freelance work. **Keep it.** Deleting and reinstalling would not
make anything cleaner, and it could break the other job's setup.

`gcloud` is built for exactly your situation. It can hold **several accounts** and **several
projects** at the same time, kept apart in things called **configurations**. A configuration is just
a saved set of three answers: *which Google account*, *which project*, *which region*.

**The one real danger** is doing this work while the old freelance configuration is active. Then a
deploy could go into someone else's project. So step 2 below makes a separate configuration, and
after that the two never touch each other.

---

## Step 1 — see what you already have

```bash
gcloud version                        # is it installed, and how old is it
gcloud config configurations list     # the setups you already have (one is probably "default")
gcloud auth list                      # which Google accounts are logged in
gcloud config list                    # what the ACTIVE setup points at right now
```

Write down what you see, or take a screenshot. That is your "before" picture — if anything looks
wrong later, you know what to go back to.

If `gcloud version` says it is very old, update it:

```bash
gcloud components update              # if you installed it from Google's installer
brew upgrade google-cloud-sdk         # if you installed it with Homebrew (the first one will error)
```

---

## Step 2 — make a separate setup for this project

```bash
gcloud config configurations create turkish-omr
```

This creates it **and switches to it**. From now on, everything you type affects only this one.

To go back to your freelance work later:

```bash
gcloud config configurations activate default      # or whatever its name was in step 1
gcloud config configurations activate turkish-omr  # and back again
```

---

## Step 3 — log in with your own Google account

```bash
gcloud auth login
```

A browser window opens. **Choose your personal account**, not a client's.

---

## Step 4 — make a project

A "project" is a box that holds everything: the server, the logs, the bill.

```bash
gcloud projects create turkish-omr-app --name="Turkish OMR"
gcloud config set project turkish-omr-app
gcloud config set run/region europe-west3
```

Two things to know:

- **The project id must be unique in the whole world.** If `turkish-omr-app` is taken, add something:
  `turkish-omr-app-2026`. Use the same name in the later commands.
- **`europe-west3` is Frankfurt** — the closest Google region to Türkiye, so your friends wait less.

---

## Step 5 — connect a payment card (yes, even though it will be free)

Google will not run anything without a card on file. Your usage should sit inside the free tier and
cost about **$0** — see the measured numbers in [deploy.md](deploy.md).

1. Open <https://console.cloud.google.com/billing> in your browser.
2. Create a billing account if you do not have one, and add your card.
3. Connect it to the project:

```bash
gcloud billing accounts list          # copy the ID, it looks like 0X0X0X-0X0X0X-0X0X0X
gcloud billing projects link turkish-omr-app --billing-account=0X0X0X-0X0X0X-0X0X0X
```

---

## Step 6 — set a budget, and understand what it does NOT do

Do this **before** the server exists.

1. Go to **Billing → Budgets & alerts → Create budget**.
2. Set the amount to something small, like **$5 per month**.
3. Tick alerts at 50%, 90% and 100%. Put your email in.

⚠ **Be clear about this: a Google budget only sends you an email. It does not stop the spending.**
There is no simple "hard stop at $5" switch. (There is a complicated way — a script that switches
billing off — and it is not worth it for a hobby project, because it can also break things while you
sleep.)

So the real protection is three cheap things, and they are already in place:

| Protection | Where it comes from |
|---|---|
| `--max-instances 3` | the deploy command — Google will never run more than 3 copies |
| 20 uploads per minute per person | built into the server (`npm run check:limits` proves it) |
| The free tier itself | your expected use is roughly 15% of it |

---

## Step 7 — turn on the three services you need

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

In plain words: **Cloud Run** runs the server, **Cloud Build** turns the code into a container, and
**Artifact Registry** stores that container.

---

## Step 8 — build and deploy

```bash
PROJECT=turkish-omr-app; REGION=europe-west3
IMAGE=$REGION-docker.pkg.dev/$PROJECT/omr/decode:latest

gcloud artifacts repositories create omr --repository-format=docker --location=$REGION
gcloud builds submit --config apps/server/cloudbuild.yaml --substitutions _IMAGE=$IMAGE .

gcloud run deploy omr-decode --image $IMAGE --region $REGION \
  --cpu 1 --memory 2Gi --concurrency 1 --max-instances 3 --timeout 300 \
  --set-env-vars OMR_ORT_THREADS=1 \
  --allow-unauthenticated
```

The build takes a few minutes and uploads about 211 MB of model. **Expect the first attempt to need
a fix or two** — the container has never been built anywhere, because there was no working Docker on
the dev machine (deploy.md says so out loud).

At the end Google prints a URL. Check it:

```bash
curl https://<that-url>/health          # should say "ready": true
npm run check:limits -- --url https://<that-url>
npm run bench:server -- --fixture f.json --url https://<that-url> --cold
```

The last one gives you **the first real cold-start number this project has ever had**. Put it in
[../METRICS.md](../METRICS.md) and delete the laptop guesses.

---

## Step 9 — after the app is hosted, lock the door

Once the app has a real address, tell the server to accept only that address:

```bash
gcloud run services update omr-decode --region $REGION \
  --set-env-vars OMR_ORT_THREADS=1,ALLOWED_ORIGINS=https://your-app-address
```

Until you do this, it accepts requests from anywhere.

---

## What it will actually cost

| | |
|---|---|
| Cloud Run (the server) | **$0** — you would use roughly 15% of the free tier at 50 users |
| Cloud Build | **$0** — 2,500 free build-minutes a month, you need a few |
| Artifact Registry (storing the container) | **~$0.10/month** — the free tier is 0.5 GB and the image is about 1 GB |

⚠ So it is "free" with an asterisk: expect a bill of a few cents, not zero. Prices were not checked
against Google's pricing page — re-read them when you set the budget.

---

## If you get stuck

- `gcloud config list` tells you which setup is active. Most confusing errors are "wrong project".
- `gcloud run services logs read omr-decode --region europe-west3` shows what the server printed.
- A `403` almost always means step 7 (services) or step 5 (billing) is missing.
