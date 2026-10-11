# Mobile — the React Native app

purpose: the one-paragraph plan, the state table and the file map for the native mobile app track
audience: anyone starting work on apps/mobile, or deciding what the native app may and may not do
updated: 2026-10-11

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
a document-scanner camera, playback with the screen locked, a "Share → KomaVision" target, and no
"Running in Chrome" notice. None of these changes reading accuracy; the model is the same model.

## State

| Milestone | What it proves | State |
|---|---|---|
| M0 skeleton | `apps/mobile` builds and runs on one Android phone, importing `@turkish-omr/core` | 🚧 **built on branch `native-app` 2026-10-11** — Expo SDK 57, `tsc` clean, `expo-doctor` 21/21, Android bundle exports (597 modules). ⏭ Not yet opened on the owner's phone in Expo Go. iPhone deferred: no device |
| M1 read a page | photo → strips → server decode → notes on screen, same notes as the web app on the same photo | 🚧 **server half built 2026-10-11** on `native-app`: `POST /page` slices and decodes a whole page ([../METRICS-SERVER-PAGE.md](../METRICS-SERVER-PAGE.md)). ⏭ Not deployed; the phone client (camera/gallery → upload → notes) is not written |
| M2 score view | the page drawn as a staff, tappable | — |
| M3 playback | 53-koma playback with makam and usul, screen-off playback | — |
| M4 editor | select, move, delete, undo — the web editor's vocabulary from `core/edits.ts` | — |
| M5 parity + stores | instrument views, recent pages; Play (replacing the TWA) and App Store | — |

## Files

Code: [../../apps/mobile/](../../apps/mobile/) — run with `cd apps/mobile && npx expo start`, then scan the QR code with **Expo Go** (it must support the same Expo SDK as `apps/mobile/package.json`).


| File | What it holds |
|---|---|
| [../../apps/mobile/AGENTS.md](../../apps/mobile/AGENTS.md) | Expo's template notes for agents: use `npx expo install`, versioned docs, development builds |
| [plan.md](plan.md) | the milestones in detail, what is reused and what is rewritten, the rules the app inherits, and the open questions |
