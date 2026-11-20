/** The one audio backend the whole app plays through, plus the read-only hooks the headless checks
 * use to see inside it. Moved out of App.tsx on 2026-11-20, unchanged. */
import { type VoiceStatus, WebAudioBackend } from "./webAudioBackend";

// One shared audio backend for the whole app. Created once at module load (not per render)
// so Play/Stop always talk to the same instance.
export const backend = new WebAudioBackend();

// The look-ahead scheduler's progress, for the headless checks only (tools/checks/editor-smoke.ts),
// alongside the `window.__omr*` hooks further down. It has to be read from the backend rather than
// from the screen: the playhead is driven by the audio clock, so it keeps moving even if the
// scheduler stalled and the page fell silent — only this counter can tell those two apart.
(window as unknown as { __omrAudio?: () => { scheduled: number; total: number } }).__omrAudio = () =>
  backend.scheduleProgress();

// Which drum kit actually decoded, for the same checks and for the same reason: a sampled stroke
// and a synthesised one are indistinguishable from the DOM, so without this nothing could prove the
// samples are being played rather than the fallback.
(
  window as unknown as { __omrPercussion?: () => { kit: string | null; loaded: number } }
).__omrPercussion = () => backend.percussionInfo();

// Which instrument voice decoded, and which path actually sounded this playback's notes. Same
// blind spot as the drums, one step worse: a note is a note on screen whether a recording or an
// oscillator made it, so `sampled`/`synth` is the only evidence that F1 is doing anything at all.
(window as unknown as { __omrVoice?: () => VoiceStatus }).__omrVoice = () => backend.voiceInfo();
