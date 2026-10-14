# Closed-test feedback — every problem found since the Play test began, and what happened to it

purpose: the one list of problems reported or found during the Play Store closed test, with who found each, its state, and what was done — the raw material for the production-access application
audience: the owner (filling Play's production questionnaire) and anyone fixing app bugs
updated: 2026-10-14

> Current state and next action are NOT here — see [../STATUS.md](../STATUS.md). How the closed test
> itself works: [play-store.md](play-store.md).

⚠ **Dates are the day the problem was first written down, not invented spacing.** Play's
questionnaire asks what testers found and what changed; it does not need dates, and a date that did
not happen is a false statement on that form. "Source" says who found it: a **tester**, the
**owner** testing himself, or an **agent** while working.

⚠ **Updates during the test are allowed** (owner, 2026-10-14 — an earlier line here said the
opposite, an agent's misreading). "Fixed, not deployed" below only means not released yet.

## Open — app bugs

| # | First noted | Source | Problem | State |
|---|---|---|---|---|
| 1 | 2026-10-14 | owner | **Grace notes are drawn but not played.** | ⏭ not investigated |
| 2 | 2026-10-14 | owner | **Kanun: lowering a mandal may need to move every mandal to its left as well** — how the instrument behaves. ⚠ The owner is not sure this is how a real kanun works. | ⏸ **confirm with a kanun player first**; a wrong "fix" is worse than none |
| 3 | 2026-10-14 | owner | **The first volta (1. ending) is played twice.** | ⏭ not investigated. ⚠ What a repeat or a volta does is decided ONLY by `resolveStructure` in `stitch.ts` ([../APP-RULES.md](../APP-RULES.md)) — fix it there, never with a second rule in the editor |
| 4 | 2026-10-13 | tester | **"Gelişmiş — geliştirici ayarları" is visible to everyone** (JSON load, strip reader, slice inspector, raw model output). | ⏸ owner's choice owed: hide in production behind `?dev=1`, or hide all but Hece çizgisi / Tekrarlar. `app-smoke` opens `#advanced`, so the panel must stay reachable, not be deleted |

## Feature requests

| # | First noted | Source | Request | State |
|---|---|---|---|---|
| 14 | 2026-10-14 | tester | **A progress bar while a page is read.** | ⏭ **TODO, decided, not started** (owner, 2026-10-14). **A REAL bar**: the server reports each strip as it finishes. Facts behind it: the server already decodes strips one at a time (`decodeBatch.ts`, batch 1 — batching measured slower and 2.9× the memory, [../app/latency.md](../app/latency.md)), so streaming each result costs bytes per ~2 s strip — expected well under 1%, **to be measured**. The comment in `remote.ts` that chunking "would give batching back" predates that measurement. **Plan, as the owner set it:** (1) streaming is **opt-in** — only a client that asks for it gets a stream; any other client still gets one JSON reply, so an old page open on a phone never breaks; (2) ⛔ **nothing runs on the Mac** — the new server goes to Cloud Run as a **no-traffic, tagged revision** (its own `test---` URL, live traffic stays 100% on the current revision), and the app goes to a **Netlify preview deploy** pointed at it; (3) after a check there, move traffic with one `update-traffic`, then deploy the web app; revert is the same command back. ⚠ Cloud Build + a Cloud Run revision cost money and minutes — ask before each |
| 15 | 2026-10-14 | owner | **Open pages read before without internet.** The notes and downloaded voices are already on the device; the app shell is not, because there is no service worker (deliberate, DECISIONS 2026-09-28: a worker can keep serving an old bundle after a deploy). | ⏭ not started — reading a NEW page offline stays impossible either way (the model is on the server) |

## Fixed

| # | First noted | Source | Problem | What was done | Live? |
|---|---|---|---|---|---|
| 5 | 2026-10-12 | owner | **"Download this voice?" was asked again on every visit**, though the files were already on the device (the yes lived in memory, the files in Cache Storage). | `voiceCached()` checks every sample; a voice fully on the device is not asked about | ⏸ **fixed, not deployed** (working tree on `main`; `smoke:editor` passes both arms) |
| 6 | 2026-10-13 | owner | **A voice read from the device still said "ses indiriliyor"**. | the notice says "ses hazırlanıyor" when every sample is cached (`data-voice-source`) | ⏸ **fixed, not deployed** (same change as 5) |
| 7 | 2026-10-08 | owner | **The Android navigation bar stayed light under the dark theme.** | the Play app's bars follow the phone: ivory by day, night slate at night ([play-store.md](play-store.md)) | ✅ in the Play package since v1 |
| 8 | 2026-10-10 | owner | **The Play app opened with an address bar** (a Chrome tab, not full screen). | Play's app-signing key added to `assetlinks.json` | ✅ live 2026-10-10 |
| 9 | 2026-10-12 | agent | `smoke:editor --voices-url` hung on a disabled stop button, so the real-voices arm never ran to the end. | the check clicks stop only when it is enabled | ⏸ fixed in the working tree with 5 |

## Not app bugs — explained or not fixable

| # | First noted | Source | What happened | Answer |
|---|---|---|---|---|
| 10 | 2026-10-13 | tester | Tapping "download it on Google Play" gave a **black screen**. | WhatsApp's in-app browser cannot hand off to the Play Store; open the opt-in link in **Chrome** |
| 11 | 2026-10-13 | tester | Play opened but **the app's page would not load** right after opting in. | propagation after opting in (minutes to an hour), or the Play Store on a different Google account than the one that opted in |
| 12 | 2026-10-11 | owner | **"Running in Chrome" notification** on every launch. | Chrome's mandatory disclosure for a Trusted Web Activity; the app cannot switch it off. Only a WebView build (the React Native track) removes it |
| 13 | 2026-10-08 | owner | The **home-screen icon** of the browser-installed app kept the old logo. | Chrome refreshes an installed web app's icon at most daily, after all its windows close; remove and re-add it. The Play app carries the new logo |
