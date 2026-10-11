# Mobile plan — what is reused, what is rewritten, and what must be decided first

purpose: the native app's milestones, the reuse map against today's code, the rules it inherits, and the open questions that block M0
audience: whoever builds apps/mobile
updated: 2026-10-11

> Part of the mobile track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md).

## What carries over, and what does not

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

## Milestones

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

## ⏭ Open — choices before M1 and M2

1. ✅ **Expo or bare React Native? → Expo, run in Expo Go for M0** (owner, 2026-10-11). This Mac
   has neither Xcode nor the Android SDK, and Expo Go needs neither. Native modules (camera, scanner,
   background audio) will need a **development build** (`eas build --profile development`) from M1
   or M3 on — the code stays the same.
2. **Where does a phone slice a page?** (a) a native OpenCV binding on the device — keeps the
   group-3 rule that slicing stays local, but it is a second implementation of the slicer to hold in
   parity with the Python and TS ones; (b) opencv.js inside a hidden WebView — the SAME TS slicer
   code, slower, a 13 MB load; (c) slicing on the server — one implementation, but it **reverses**
   the "slicer stays local" rule and sends whole pages, not strips, to the server. Owner's call;
   none is measured.
3. **How is the score drawn?** (a) the web SheetView inside a WebView on the score screen — fastest
   to parity, one engraving codebase; (b) a native port (react-native-svg or Skia) — smoother, but
   a second engraver of 3,728 lines. Recommended: (a) first, (b) only if (a) is measured too slow.

⚠ **Workspace trap — closed at M0 (2026-10-11):** the web app is on React 18, Expo SDK 57 ships
React 19.2. So `apps/mobile` is **NOT an npm workspace**: the root `workspaces` names `apps/web` and
`apps/server` instead of `apps/*`, the mobile app has its own `node_modules`, and it reaches core
through `"@turkish-omr/core": "file:../../packages/core"` plus `watchFolders` in
`apps/mobile/metro.config.js`. ⛔ Never put `apps/*` back in the root `workspaces`. Checked after
the change: root `typecheck`, `npm test` and `build:app` pass; the lockfile changed only in the
workspace list.
