# F6 — the visit counter, and the owner's private dashboard

purpose: the design, the privacy contract and the limits of the anonymous visit counter, and how to read its dashboard
audience: agents and the owner, before changing what is counted, what is stored, or who can read it
updated: 2026-09-05

> Current state is in [../STATUS.md](../STATUS.md). The decision is one line in
> [../DECISIONS.md](../DECISIONS.md); the track index is [README.md](README.md). What the OLD
> request-log estimates said, and why they were so hard to sharpen: [../METRICS-USAGE.md](../METRICS-USAGE.md).

Answer "kaç kişi girdi?" with a counter built for the question, instead of reading tea leaves in a
request log — and answer it without learning anything about anybody.

## Why it exists

The question was already being asked, and it was being answered badly. The app pings Cloud Run's
`/health` when it opens, so that service's ordinary request log became an accidental visit counter
([../METRICS-USAGE.md](../METRICS-USAGE.md)). It could not do the job. Robots dominate it. It has no
session, no cookie and no client id, so it cannot tell one phone visiting twice from two phones
visiting once — the standing answer there is literally *"≥1 stranger, ≤2, the log cannot say which"*.
Every sharpening of its numbers came from the owner supplying by hand what the log could not: that
nobody in this circle runs Linux, that one of the phones was his own.

This replaces the guessing. It counts two events, it separates robots from people, and it counts
devices rather than requests.

## What was decided, and what was turned down (owner, 2026-09-05)

| Question | Answer | Why |
|---|---|---|
| **Names?** | **No.** Anonymous counting only | Named invite links (`?k=ahmet`) and a real login were both offered and declined. There is no account system to build and no name to leak |
| **Where?** | **Netlify Functions + Blobs** | The site is already deployed there ([deploy-ops.md](../mvp/deploy-ops.md)); no new service, no new bill, and the Cloud Run decoder stays a pure function of pixels |
| **Who may read it?** | **The owner only, and the page is never published** | See "Two locks" below |
| **What is stored?** | **No IP, ever** — a salted hash that expires nightly | The alternative (raw IP) is personal data under KVKK/GDPR and contradicts the footer |

## The privacy contract

This is the part to read before changing anything.

- **The raw address is never written down.** `visit.mts` mixes the IP with a secret (`STATS_SALT`)
  **and the current date**, hashes it, keeps 16 hex characters, and throws the address away.
- **The identifier expires every night.** Because the date is inside the hash, the same phone is a
  different id tomorrow. Nobody — the owner included — can take a row from last week and an address
  from today and prove they are the same person.
- **No cookie, no `localStorage`, no fingerprint.** Nothing is written on the visitor's machine by
  the counter at all. The one exception is the owner's own opt-out flag, below.
- **The referrer keeps its host and loses its path**, which is where a search query would hide.
- **Uploads are untouched by all of this.** No image, no score, no filename ever reaches the counter.
- **Rows are deleted after `RETAIN_DAYS` (180)**, swept lazily whenever the dashboard is opened — so
  the retention period is code that runs, not a promise in a document.
- **The visitor is told.** `TR.footer.counting` says so on the page: *"Ziyaretler anonim sayılır:
  çerez yok, IP adresi saklanmaz."* ⚠ That line is a statement of fact about the code, exactly like
  the three beside it — it stops being true the day this stores an address, and both move together.

⛔ **No salt means no counting.** With `STATS_SALT` unset, `visit.mts` records nothing and the
dashboard says so in a yellow box. The tempting fallback — hash without a salt, or with a fixed one —
would keep the numbers flowing while quietly making the identifier permanent, which is the single
thing this design exists to prevent.

## Two locks, and why there are two

**The dashboard is never published.** `apps/web/admin-stats.html` is not an entry in the build:
vite builds `index.html` and nothing else, so no route, no bundle and no file in `dist/` comes from
it. It is served by the dev server (`npm run stats:ui`) and nowhere else. ⛔ Do not add it to
`build.rollupOptions.input`, and do not move its logic under a path `index.html` can reach.

**The data needs the token wherever it is asked for.** `stats.mts` demands
`Authorization: Bearer <STATS_TOKEN>` and answers **503, not 200,** when no token is configured —
because the failure mode worth engineering against is an endpoint that serves everyone while the
owner believes it is private. This is also what lets the CORS allowlist open for `localhost` without
opening the data.

Neither lock depends on the other. Hiding the page is not security; requiring the token is.

## What is counted

Two events, and the difference between them is the whole point.

| Event | Fired when | What it means |
|---|---|---|
| `open` | the app mounts | somebody, or something, loaded the page |
| `read` | a page has been decoded into notes | **a human used the product** |

⭐ **`read` is the number to trust.** A robot loads a page constantly; it does not photograph sheet
music and upload it. `../METRICS-USAGE.md` spent its whole length on this distinction.

**Who is not counted**, each for its own reason: the dev server (no function behind it), anything
under `navigator.webdriver` (⚠ **load-bearing** — `smoke:live` and `smoke:build` drive the real
deployed site and would otherwise be most of the traffic), `localhost`, and any device that has
opted out.

⭐ **The owner's own devices should opt out: open the site once as `?nostats=1`.** This is not a
nicety. `../METRICS-USAGE.md` records three page reads counted as visitors, one of which turned out
to be the owner's own phone and had to be subtracted by hand afterwards. `?nostats=0` undoes it.

## What a row is, and what it cannot tell you

One row is **one device, for one day**: `opens`, `reads`, first and last time, country (Netlify's
edge geo), device type, browser with its major version, OS, a robot flag, and up to five referrer
hosts.

⚠ **A row is a device, not a person.** One friend with a phone and a laptop is two rows. Two people
sharing a browser are one row.

⚠ **The browser VERSION is the only evidence here that two visits came from two machines** — it is
how `../METRICS-USAGE.md` established "at least one real stranger" (Chrome/150 and Chrome/151, and
browsers never downgrade). Android's user-agent is frozen to `Android 10; K`, so nothing else in the
string discriminates. Never drop it to tidy the column.

⚠ **An `X11; Linux x86_64` user-agent is not a Linux machine.** It is what Chrome for Android sends
under "Request desktop site", and mistaking it already cost one wrong entry in
`../METRICS-USAGE.md`. The dashboard labels the column as the browser's own claim rather than
pretending otherwise; the counter cannot fix this and does not try.

⚠ **Robot detection is one-way.** What it catches really is automated; plenty of automation says
nothing at all and lands in the human column. Hence `read` over `open`, again.

⚠ **Two visits from the SAME device in the same instant can lose one count.** A row is a
read-modify-write of one blob and Netlify Blobs has no transaction. Different devices are different
keys and never collide. Against single-digit daily traffic this costs at most one opening; it is a
counter, not a ledger. If the site ever gets real traffic, that is the line to revisit first.

## Setting it up

Two secrets on the site, once. Any long random string works; `openssl` is just a convenient source.

```bash
netlify env:set STATS_SALT  "$(openssl rand -hex 32)"   # rotating it resets device counting, nothing else
netlify env:set STATS_TOKEN "$(openssl rand -hex 24)"   # this is what the dashboard asks for
npm run deploy:app                                      # the functions ship with the site
npm run stats:ui                                        # → http://localhost:5173/admin-stats.html
```

⚠ **`npm run deploy:app` now carries `--functions netlify/functions`.** Without that flag the site
deploys fine and the counter is simply not there — the dashboard reports the 404 in plain Turkish
rather than an empty chart, which is the failure this is easiest to miss.

⚠ **Rotating `STATS_SALT` is not free**: yesterday's ids and today's stop matching, so a device
active across the change counts twice. Rotate it deliberately, not as housekeeping.

## Where the code is

| Part | File |
|---|---|
| What a visit is; the hash, the user-agent reading, the folding | `netlify/shared/visits.ts` |
| Write side — one event in, one row out | `netlify/functions/visit.mts` |
| Read side — the token, the window, the retention sweep | `netlify/functions/stats.mts` |
| The browser's beacon, and everyone it refuses to count | `apps/web/src/analytics/visits.ts` |
| The dashboard (never published) | `apps/web/admin-stats.html` · `apps/web/src/admin/statsPage.ts` |
| The arithmetic, pinned | `tools/analytics/visits-test.ts` (`npm test`) |
