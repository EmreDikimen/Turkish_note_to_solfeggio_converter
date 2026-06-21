/**
 * Web Audio implementation of the core's `AudioBackend` adapter.
 *
 * This is platform-specific glue (it lives in the web app, NOT in @turkish-omr/core).
 * On mobile, a native backend implements the same interface; the core's scheduling
 * logic is reused unchanged.
 */

import type { AudioBackend, Timeline } from "@turkish-omr/core";

// A gently decaying harmonic spectrum — same idea as the Python reference synth,
// less harsh than a pure sine.
const HARMONIC_GAINS = [1.0, 0.45, 0.25, 0.12, 0.06];

/**
 * Build a custom oscillator waveform with harmonics (the browser's version of the Python
 * synth's harmonic mixing).
 *
 * What/why: the browser's built-in oscillator types ("sine", "sawtooth", ...) sound either
 * too plain or too harsh. The Web Audio API lets us define a custom tone by listing the
 * amplitude of each harmonic; a `PeriodicWave` made once and reused for every note is much
 * cheaper than summing sines by hand per note (which is what the Python reference does).
 * How it works: Web Audio describes a wave as Fourier coefficients in two arrays — `real`
 * (cosine parts) and `imag` (sine parts). Index i is the i-th harmonic. We put our harmonic
 * gains into `imag` (so they're sine components; index 0 is DC/unused) and leave `real` at
 * zero. The browser then synthesizes that exact timbre at whatever frequency we set.
 */
function buildPeriodicWave(ctx: AudioContext): PeriodicWave {
  const real = new Float32Array(HARMONIC_GAINS.length + 1);
  const imag = new Float32Array(HARMONIC_GAINS.length + 1);
  HARMONIC_GAINS.forEach((g, i) => {
    imag[i + 1] = g; // sine components
  });
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

export class WebAudioBackend implements AudioBackend {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Play a whole timeline through the browser speakers. This is the web's implementation
   * of the core `AudioBackend.play` contract.
   *
   * What/why: the core decided *what* plays and *when* (the Timeline); this turns that into
   * actual sound using Web Audio. On mobile a different class implements the same method
   * with native audio — the core never changes.
   * How it works:
   *   * Make an `AudioContext` (the browser's audio engine) and a master gain (overall
   *     volume). Browsers block audio until a user gesture, so we `resume()` it (the Play
   *     button click is that gesture).
   *   * Web Audio is *scheduled ahead of time*: instead of a loop that waits, we tell the
   *     engine "play this note at time T" for every note up front, and the hardware runs it
   *     precisely. `t0` is a small lead-in so the first note isn't cut off.
   *   * For each non-rest note we create an oscillator (set to our harmonic wave and the
   *     note's frequency) and a per-note gain used as an envelope: ramp 0→1 (attack), hold,
   *     then 1→0 (release) — same anti-click idea as the Python `_envelope`.
   *   * Return a Promise that resolves when the piece finishes, so the UI can flip the Play
   *     button back. (We call `stop()` first so a second Play cancels any current playback.)
   * Important: each note gets its OWN oscillator — in Web Audio oscillators are one-shot
   * (start once, stop once), not reused.
   */
  async play(timeline: Timeline): Promise<void> {
    this.stop();
    const ctx = new AudioContext();
    this.ctx = ctx;
    await ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    this.master = master;

    const wave = buildPeriodicWave(ctx);
    const t0 = ctx.currentTime + 0.05; // small lead-in
    const attack = 0.01;
    const release = 0.03;

    for (const n of timeline.notes) {
      if (n.isRest || !Number.isFinite(n.freqHz)) continue;
      const start = t0 + n.startMs / 1000;
      const dur = n.durationMs / 1000;

      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave);
      osc.frequency.value = n.freqHz;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(1, start + Math.min(attack, dur / 2));
      env.gain.setValueAtTime(1, Math.max(start + attack, start + dur - release));
      env.gain.linearRampToValueAtTime(0, start + dur);

      osc.connect(env).connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }

    return new Promise<void>((resolve) => {
      this.stopTimer = setTimeout(() => {
        this.stop();
        resolve();
      }, timeline.totalMs + 200);
    });
  }

  /**
   * Stop playback immediately and release audio resources.
   *
   * What/why: the user hits Stop, or starts a new piece, or leaves — we must silence any
   * scheduled notes and free the audio engine (leaking AudioContexts will eventually make
   * the browser refuse to create more).
   * How it works: cancel the "playback finished" timer (so its callback doesn't fire late),
   * then `close()` the AudioContext, which kills every oscillator scheduled on it at once.
   * Null out the references so a later `play()` starts cleanly. Safe to call anytime, even
   * if nothing is playing.
   */
  stop(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }
}
