# Mobile — the React Native app

purpose: the native mobile app track — the plan, the state, the milestones and the open questions
audience: anyone starting work on apps/mobile, or deciding what the native app may and may not do
updated: 2026-11-20

> Current state and next action are NOT here — see [../STATUS.md](../STATUS.md). The decision is in
> [../DECISIONS.md](../DECISIONS.md) (2026-10-11, overturning 2026-10-08's "maybe later").

## The plan in one paragraph

A **React Native** app for **Android and iOS together**, started **now, in parallel** with the web
app (owner, 2026-10-11). It reuses `packages/core` unchanged — the note model, 53-TET tuning, makam,
usul, scheduling, edits, fingering — and rebuilds the screens, the score view and the audio engine
for the phone. Decode stays on the existing Cloud Run server: the native app is a second client of
the same `/decode`, not a second decoder. The web app keeps shipping meanwhile; the Play Store TWA
(`com.komavision.app`) is what users have until the native app is good enough to **replace it under
the same package name** — Play allows that, since the upload key (`~/.komavision/`) is ours.

Why native and not only the TWA: the App Store (Apple's guideline 4.2 rejects website wrappers),
a document-scanner camera, playback with the screen locked, a "Share → MakamVision" target, and no
"Running in Chrome" notice. None of these changes reading accuracy; the model is the same model.

## State

| Milestone | What it proves | State |
|---|---|---|
| M0 skeleton | `apps/mobile` builds and runs on one Android phone and one iPhone, importing `@turkish-omr/core` | ⏭ not started — three choices owed first ([README.md § Mobile plan — what is reused, what is rewritten, and what must be…](#mobile-plan--what-is-reused-what-is-rewritten-and-what-must-be-decided-first) §Open) |
| M1 read a page | photo → strips → server decode → notes on screen, same notes as the web app on the same photo | — |
| M2 score view | the page drawn as a staff, tappable | — |
| M3 playback | 53-koma playback with makam and usul, screen-off playback | — |
| M4 editor | select, move, delete, undo — the web editor's vocabulary from `core/edits.ts` | — |
| M5 parity + stores | instrument views, recent pages; Play (replacing the TWA) and App Store | — |

## Files

| File | What it holds |
|---|---|
| [README.md § Mobile plan — what is reused, what is rewritten, and what must be…](#mobile-plan--what-is-reused-what-is-rewritten-and-what-must-be-decided-first) | the milestones in detail, what is reused and what is rewritten, the rules the app inherits, and the open questions |

**Merged into this file on 2026-11-20:**

- [Mobile plan — what is reused, what is rewritten, and what must be decided first](#mobile-plan--what-is-reused-what-is-rewritten-and-what-must-be-decided-first) — was `docs/mobile/README.md`


## Mobile plan — what is reused, what is rewritten, and what must be decided first

*Was `docs/mobile/README.md` (last updated 2026-10-11).*

> Part of the mobile track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md).

### What carries over, and what does not

Measured against the tree on 2026-10-11, not guessed:

| Piece today | Where | On the phone | Why |
|---|---|---|---|
| Note model, tuning, makam, usul, scheduling, edits, fingering, kanun, clarinet | `packages/core` (17 files) | ✅ **reused as is** | Plain TypeScript, no DOM: the only `document`/`window` hits are the word "document" in comments. It was kept platform-free for exactly this (`AudioBackend` is already an adapter interface). |
| Decode | Cloud Run `/decode` | ✅ **same server** | The app POSTs finished crops like the browser does. ⛔ Never a second decoder ([../../CLAUDE.md](../../CLAUDE.md) group 3). `ALLOWED_ORIGINS` only sets a CORS header (`apps/server/src/index.ts`) and refuses nothing — CORS binds browsers, so a native client is admitted as is, under the same rate limit. |
| Server client | `apps/web/src/omr/remote.ts` | 🟡 mostly reusable | `fetch` exists in React Native; the warm-up and retry logic should carry. |
| Crop preprocessing (resize to 409×583) | `apps/web/src/omr/preprocess.ts` | 🔴 **rewritten** — canvas API | ⚠ The server trusts the client's resampling (group 3: "no second resampler to hold in parity"). A native resampler IS a second one, so M1's acceptance is **same notes as the web app on the same photo**. |
| Slicer (staff rows, barlines, windows) | `apps/web/src/omr/slicer/` + opencv.js (~13 MB wasm) | 🔴 **open question** | opencv.js needs a browser. See §Open. |
| Score drawing | `SheetView.tsx` (3,728 lines) on VexFlow | 🔴 **open question** | VexFlow draws into a DOM SVG. ⛔ **The web SheetView stays the training-strip source** whatever the phone does — `render.ts` screenshots it; the phone's drawing must never feed training. |
| Audio engine | `webAudioBackend.ts` (1,139 lines) | 🔴 rewritten behind core's `AudioBackend` | Web Audio is a browser API. A React Native library implementing the Web Audio interface would let much of it carry — a lead, unchecked. |
| Screens, editor UI, instrument views, theme | `App.tsx` (2,646 lines), `Fingerboard`/`Kanun`/`Clarinet`, Tailwind | 🔴 rewritten | DOM + CSS. The *rules* in [../APP-RULES.md](../APP-RULES.md) still bind (never build a clock from the written `doc`; `resolveStructure` is the only repeat rulebook). |
| Recent pages | IndexedDB, `recentPages.ts` | 🔴 rewritten on device storage | ⛔ Still **notes, never an image** — the privacy page says so. |
| Visit counting | Netlify function | 🟡 open | The privacy page describes the web counter; the app must not count more than it says. |

### Milestones

Each one ends on something the owner can hold in a hand, not on code merged.

- **M0 — skeleton.** `apps/mobile` runs on one Android phone and one iPhone, shows the app name,
  and calls one `core` function (e.g. a koma → Hz conversion) to prove the shared import works. ⚠
  **The web app's build and every gate must stay green** — `npm run typecheck`, `npm test`,
  `smoke:build` — because the mobile app joins the same npm workspaces.
- **M1 — read a page.** Gallery or camera → slicing → server decode → the notes listed on screen.
  Acceptance: on the same photos the web app reads, **the same notes**. This is where the slicer and
  the resampler are proven.
- **M2 — score view.** The page drawn as a staff, scrollable on a phone, notes tappable.
- **M3 — playback.** 53-koma playback through `core`'s scheduler, makam deltas and usul included,
  continuing with the screen locked.
- **M4 — editor.** The web editor's operations through `core/edits.ts`, with undo.
- **M5 — parity and stores.** Instrument views, recent pages, the theme. Then **Play: an update of
  the TWA listing** (same `com.komavision.app`, same upload key, a higher version code), and a new
  App Store listing (Apple Developer Program, 99 $/year).

Estimate, not measured: months of part-time work, the bulk in M2–M4.

### ⏭ Open — three choices before M0

1. **Expo or bare React Native?** Recommended: **Expo** (with a development build). It builds both
   platforms from one config and still allows native modules (camera, scanner, audio). Bare gives
   full control at the cost of maintaining two native projects by hand.
2. **Where does a phone slice a page?** (a) a native OpenCV binding on the device — keeps the
   group-3 rule that slicing stays local, but it is a second implementation of the slicer to hold in
   parity with the Python and TS ones; (b) opencv.js inside a hidden WebView — the SAME TS slicer
   code, slower, a 13 MB load; (c) slicing on the server — one implementation, but it **reverses**
   the "slicer stays local" rule and sends whole pages, not strips, to the server. Owner's call;
   none is measured.
3. **How is the score drawn?** (a) the web SheetView inside a WebView on the score screen — fastest
   to parity, one engraving codebase; (b) a native port (react-native-svg or Skia) — smoother, but
   a second engraver of 3,728 lines. Recommended: (a) first, (b) only if (a) is measured too slow.

⚠ **Workspace trap, checked before M0:** the web app is on React 18; a current React Native
template ships a newer React. Two React majors in one npm workspace can break the web build through
hoisting, so the mobile app may need its own `node_modules` (outside `workspaces`, or with
no-hoist). Verify with the gates above, not by eye.
