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
| M0 skeleton | `apps/mobile` builds and runs on one Android phone, importing `@turkish-omr/core` | ✅ **DONE** — built on branch `native-app` 2026-10-11 (Expo SDK 57 — **upgraded to SDK 58 on 2026-10-29**, when Expo Go updated itself and refused 57; `tsc` clean, `expo-doctor` 21/21, Android bundle exports, 597 modules); **opened on the owner's Android phone in Expo Go and confirmed working (2026-10-29)**. iPhone deferred: no device |
| M1 read a page | photo → strips → server decode → notes on screen, same notes as the web app on the same photo | 🚧 **both halves built**: `POST /page` (2026-10-11) is on Cloud Run as a **tagged, no-traffic test revision** since 2026-10-29 ([METRICS.md § the server's page path](../METRICS.md#metrics--the-servers-page-path-post-page)); the phone client (2026-10-29) picks or takes a photo, POSTs it, stitches with the web's own `tools/render/stitch.ts` and lists the notes bar by bar. ✅ **the owner read a real photo on his phone and got the notes listed (2026-10-29)**. ⏭ Still owed for the milestone's bar: the same photo through the web app, notes compared |
| M2 score view | the page drawn as a staff, tappable | 🚧 **built 2026-10-29**: the web's own `SheetView` in a WebView, fitted to the phone like the web's phone view, a tapped bar reported to the app ("N. ölçü seçildi"). Checked in Chromium at 390 px and 1200 px (no sideways scroll, staves inside the box) — ✅ **drawn on the owner's Android phone the same day**. ⏭ Not yet confirmed there: the right edge and a tapped bar. A native engraver is planned for later ([plan.md](#mobile-plan--what-is-reused-what-is-rewritten-and-what-must-be-decided-first) §Open #3) |
| M3 playback | 53-koma playback with makam and usul, screen-off playback | — |
| M4 editor | select, move, delete, undo — the web editor's vocabulary from `core/edits.ts` | — |
| M5 parity + stores | instrument views, recent pages; Play (replacing the TWA) and App Store | — |

## Files

Code: [../../apps/mobile/](../../apps/mobile/) — run with `cd apps/mobile && npx expo start`, then scan the QR code with **Expo Go** (it must support the same Expo SDK as `apps/mobile/package.json`).

| File | What it holds |
|---|---|
| [../../apps/mobile/AGENTS.md](../../apps/mobile/AGENTS.md) | Expo's template notes for agents: use `npx expo install`, versioned docs, development builds |
| [README.md § Mobile plan — what is reused, what is rewritten, and what must be…](#mobile-plan--what-is-reused-what-is-rewritten-and-what-must-be-decided-first) | the milestones in detail, what is reused and what is rewritten, the rules the app inherits, and the open questions |

**Merged into this file on 2026-11-20:**

- [Mobile plan — what is reused, what is rewritten, and what must be decided first](#mobile-plan--what-is-reused-what-is-rewritten-and-what-must-be-decided-first) — was `docs/mobile/README.md`


## Mobile plan — what is reused, what is rewritten, and what must be decided first

*Was `docs/mobile/README.md` (last updated on branch `native-app`).*

> Part of the mobile track — index: [README.md](README.md). Current state and next action are NOT
> here: see [../STATUS.md](../STATUS.md).

### What carries over, and what does not

Measured against the tree on 2026-10-11, not guessed:

| Piece today | Where | On the phone | Why |
|---|---|---|---|
| Note model, tuning, makam, usul, scheduling, edits, fingering, kanun, clarinet | `packages/core` (17 files) | ✅ **reused as is** | Plain TypeScript, no DOM: the only `document`/`window` hits are the word "document" in comments. It was kept platform-free for exactly this (`AudioBackend` is already an adapter interface). |
| Decode | Cloud Run `/decode` | ✅ **same server** | The app POSTs finished crops like the browser does. ⛔ Never a second decoder ([../../CLAUDE.md](../../CLAUDE.md) group 3). `ALLOWED_ORIGINS` only sets a CORS header (`apps/server/src/index.ts`) and refuses nothing — CORS binds browsers, so a native client is admitted as is, under the same rate limit. |
| Server client | `apps/web/src/omr/remote.ts` | 🟡 mostly reusable | `fetch` exists in React Native; the warm-up and retry logic should carry. |
| Crop preprocessing (resize to 409×583) | `apps/web/src/omr/preprocess.ts` | ✅ **on the server** — `apps/server/src/donut.ts` (2026-10-11) | A port of training's own `DonutImageProcessor`, **byte-identical** on every strip checked — closer to training than the web's canvas ever was ([METRICS.md § the server's page path](../METRICS.md#metrics--the-servers-page-path-post-page)). The phone does no image work at all. |
| Slicer (staff rows, barlines, windows) | `apps/web/src/omr/slicer/` + opencv.js (~13 MB wasm) | ✅ **on the server** — the SAME TS slicer, run in Node (`apps/server/src/slicePage.ts`) | The phone POSTs the page image to **`POST /page`**. The web app keeps slicing in the browser. Not deployed yet. |
| Score drawing | `SheetView.tsx` (3,728 lines) on VexFlow | ✅ **reused, in a WebView** (2026-10-29) — a native engraver later (§Open #3) | VexFlow draws into a DOM SVG. ⛔ **The web SheetView stays the training-strip source** whatever the phone does — `render.ts` screenshots it; the phone's drawing must never feed training. |
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

### Choices before M1 and M2 — all three made

1. ✅ **Expo or bare React Native? → Expo, run in Expo Go for M0** (owner, 2026-10-11). This Mac
   has neither Xcode nor the Android SDK, and Expo Go needs neither. Native modules (camera, scanner,
   background audio) will need a **development build** (`eas build --profile development`) from M1
   or M3 on — the code stays the same.
2. ✅ **Where does a phone slice a page? → on the server** (owner, 2026-10-11). Built the same day
   on `native-app`: `POST /page` takes the raw JPEG/PNG (EXIF orientation honoured), slices with the
   web's own TS slicer in Node, preprocesses with a byte-exact port of training's processor, and
   returns `/decode`'s reply plus the geometry. The numbers, and what is still unmeasured, are in [METRICS.md § the server's page path](../METRICS.md#metrics--the-servers-page-path-post-page). ⏭ To
   reach the phone it needs a Cloud Run deploy — owner's call. Rejected: a native OpenCV binding
   (a third slicer to hold in parity) and opencv.js in a hidden WebView (13 MB on the phone).
3. ✅ **How is the score drawn? → (a) now, the web SheetView in a WebView; (b) a native engraver
   LATER** (owner, 2026-10-29: *"a yı yapalım ama b de ileride yapılacak"*). Built the same day:
   `apps/web/score-view.html` + `src/scoreView/` mount the web's own `SheetView` with a reader's
   defaults, `build:score-view` inlines it — code, stylesheet, fonts, Bravura — into ONE file the
   phone loads as `source={{ html }}` (no network, no hosting), and the phone hands it the page
   through `window.__komaLoad`.
   ⏭ **(b) is planned, not cancelled.** A native engraver (react-native-svg or Skia) would scroll
   and respond more smoothly and drop the 2.25 MB page from the app. What makes it cheaper than it
   was: `public/fonts/glyph-outlines/` (every music glyph as a path, 2026-10-17) and
   `exportCanvas.ts` (the score replayed shape by shape) already turn the drawing into plain
   paths. What keeps it big: it is a SECOND engraver beside a 3,728-line one, to hold in parity.
   Start it when (a) is measured too slow on a real phone, or when the editor (M4) needs native
   touch handling — whichever comes first.

⚠ **Workspace trap — closed at M0 (2026-10-11):** the web app is on React 18, Expo SDK 57 ships
React 19.2. So `apps/mobile` is **NOT an npm workspace**: the root `workspaces` names `apps/web` and
`apps/server` instead of `apps/*`, the mobile app has its own `node_modules`, and it reaches core
through `"@turkish-omr/core": "file:../../packages/core"` plus `watchFolders` in
`apps/mobile/metro.config.js`. ⛔ Never put `apps/*` back in the root `workspaces`. Checked after
the change: root `typecheck`, `npm test` and `build:app` pass; the lockfile changed only in the
workspace list.
