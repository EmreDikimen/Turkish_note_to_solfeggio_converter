# Metrics — who actually uses the deployed app

purpose: what the live service's own request log says about visitors — how many, on what, and how much of it is robots; split out of METRICS.md at the 400-line cap
audience: agents and the owner, whenever "is anyone using it?" comes up
updated: 2026-08-09

Split out of [METRICS.md](METRICS.md) on 2026-08-09, by genre: that file measures how the system
*performs*, this one measures who *arrives*. Service performance (cold starts, cost, decode speed)
stays there. Current state → [STATUS.md](STATUS.md).

**Where the data comes from, and why it exists at all.** Nothing was instrumented for analytics —
the project has no tracker and [DECISIONS.md](DECISIONS.md) keeps it that way. But the app pings
`/health` when it opens (the cold-start fix), so Cloud Run's ordinary request log became a visit
counter as a side effect. Read it with the two limits below firmly in mind.

⚠ **A request log can tell you how many DEVICES, never how many PEOPLE, and never who.** Every
sharpening of the numbers below came from the owner supplying what the log could not — that nobody
in this circle runs Linux, and that one of the phones was his. Expect to have to ask.

⚠ **`/health` counts openings, `/decode` counts uses.** Only the second means a human read a page.
Robots do the first constantly.

## The live service, 7 days to 2026-08-09

| Measure | Value |
|---|---|
| **Who has actually used the deployed app** (2026-08-09, 7 days of request log) | The app pings `/health` on open, so Cloud Run's log doubles as a visit counter. Three page reads on 2026-08-08, **all from ANDROID PHONES** — but ⚠ **one of them is the OWNER'S own phone** (`144.122.137.254`, 11:35, Chrome/150, also back at 13:14 and 16:38 — owner-confirmed 2026-08-09, after an earlier version of this row miscounted all three as visitors). **That leaves two non-owner page reads:** `88.240.41.208` at 14:18 (Türk Telekom home ADSL, 2.2 MB) and `144.122.151.233` at 20:32 (2.5 MB, desktop-site mode). Everything else from outside is **`/health` with no `/decode`**, and the whois says why: **AWS** (`100.31.187.16`, the post-deploy crawler), **Ace Data Centers** (`23.27.145.210`), a **ProtonVPN** exit in Iceland (`185.159.158.61`), plus scattered foreign ISPs whose device stories do not hold — one iPhone UA from **four unrelated IPs** in two days. ⚠ `/health` is an upper bound on humans; `/decode` is the real count |
| **⚠ Those two remaining reads are ONE OR TWO people — the log cannot say which** | Both ran **Chrome/151** on Android, six hours apart, from two different networks (home ADSL, then the owner's `144.122.x`). A phone moving between them in six hours is unremarkable, and so is two people. **No further evidence exists**: Cloud Run logs no cookie, no session id and no client hints, and the two page sizes prove only that different sheets were read. So the standing count is **≥1 stranger, ≤2**. Resolving it properly means either asking them (W10) or storing a client id, which is tracking and cuts against the no-analytics stance in [DECISIONS.md](DECISIONS.md) |
| **A distinct-device proof that DOES hold** | The owner's phone ran **Chrome/150** at 13:14 and 16:38 while the 14:18 upload came from **Chrome/151**. Browsers never downgrade, so those are certainly two devices — which is how "at least one real stranger" is known rather than assumed. Chrome build number is the only device discriminator this log offers, since the Android UA is frozen to `Android 10; K` |
| **⚠ An `X11; Linux x86_64` UA here does NOT mean a Linux machine** | It is what Chrome for Android sends under **"Request desktop site"**, and mistaking it cost one wrong entry in this file. `144.122.151.233` is the proof, all one IP and one Chrome build: `/health` on the **Android mobile** UA at 20:29:57 → `/health` on the **X11 Linux** UA at 20:30:57 → upload at 20:32. One person, one phone, one minute. Owner-confirmed context: nobody in this circle runs Linux |
| **⚠ Real visitors are arriving on PHONES, against a "web first, mobile later" plan** | All three humans were on Android, and one switched to desktop mode within 60 s of opening — then uploaded. That is a small n, and the switch has no stated reason, so it is a **signal to ask W10's friends about, not a finding**: it is equally consistent with a cramped mobile layout or with habit. Plan it is in tension with: [OVERVIEW.md](OVERVIEW.md) |
