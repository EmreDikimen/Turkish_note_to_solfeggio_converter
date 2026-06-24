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

/** Transport state, mirrored by the UI to pick the right play/pause/stop affordances. */
export type PlaybackState = "stopped" | "playing" | "paused";

/** Per-playback options: tempo scaling and an optional metronome click track. */
export interface PlayOptions {
  /** Playback speed multiplier (1 = the score's natural tempo; 2 = twice as fast). */
  speed?: number;
  /**
   * Metronome clicks to play, in MUSICAL ms (at the natural tempo). Built by the core from the
   * selected usul (`buildMetronomeTrack`) so clicks land on the usul's beats; `accent` marks a
   * measure downbeat. Omit/empty for no metronome.
   */
  clicks?: { ms: number; accent: boolean }[];
}

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
  private timeline: Timeline | null = null;
  /** AudioContext time (seconds) when playback started, and the musical ms it began at. */
  private startCtxTime = 0;
  private startMs = 0;
  /** Playback speed multiplier — maps musical ms to real time (real = musical / speed). */
  private speed = 1;
  /** Polls the audio clock to detect the natural end of the piece (pause-aware). */
  private endCheck: ReturnType<typeof setInterval> | null = null;
  private onEndedCb: (() => void) | null = null;
  private state: PlaybackState = "stopped";

  getState(): PlaybackState {
    return this.state;
  }

  /** Register a callback fired once when the piece reaches its end on its own. */
  setOnEnded(cb: (() => void) | null): void {
    this.onEndedCb = cb;
  }

  /**
   * Current playback position in **musical** milliseconds (at natural tempo), or null when
   * stopped. Derived from the AudioContext clock — the same clock the notes are scheduled
   * against — scaled back up by `speed`, so it's tempo-independent and matches the sheet's
   * note timeline. While paused the clock is frozen, so the position holds steady.
   */
  getPositionMs(): number | null {
    if (!this.ctx) return null;
    return this.startMs + (this.ctx.currentTime - this.startCtxTime) * 1000 * this.speed;
  }

  /**
   * Play a timeline through the browser speakers, optionally starting partway in (`fromMs`).
   * This is the web's implementation of the core `AudioBackend.play` contract.
   *
   * What/why: the core decided *what* plays and *when* (the Timeline); this turns that into
   * actual sound using Web Audio. `fromMs` lets the UI seek (click a measure to play from
   * there) by simply re-scheduling from that offset.
   * How it works: make a fresh `AudioContext` + master gain, `resume()` it (the click is the
   * required user gesture), then schedule every note ahead of time relative to `fromMs`.
   * `opts.speed` scales playback tempo; `opts.metronome` adds a click track.
   */
  async play(timeline: Timeline, fromMs = 0, opts: PlayOptions = {}): Promise<void> {
    this.stop();
    this.timeline = timeline;
    this.speed = opts.speed && opts.speed > 0 ? opts.speed : 1;
    const ctx = new AudioContext();
    this.ctx = ctx;
    await ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    this.master = master;

    this.scheduleFrom(Math.max(0, fromMs), opts);
    this.state = "playing";
  }

  /**
   * Schedule every sounding note relative to a start offset. Notes that already ended before
   * `fromMs` are skipped; one straddling the offset is started mid-note at full gain (no
   * attack) so seeking into a held note doesn't re-articulate it. Each note gets its OWN
   * oscillator — Web Audio oscillators are one-shot (start once, stop once).
   *
   * All input times are MUSICAL ms; `toReal(musicalMs)` maps them to AudioContext seconds via
   * the speed factor, so tempo scaling is applied uniformly to notes and the metronome.
   */
  private scheduleFrom(fromMs: number, opts: PlayOptions): void {
    const ctx = this.ctx!;
    const master = this.master!;
    const timeline = this.timeline!;
    const wave = buildPeriodicWave(ctx);
    const t0 = ctx.currentTime + 0.05; // small lead-in
    this.startCtxTime = t0;
    this.startMs = fromMs;
    const speed = this.speed;
    const toReal = (musicalMs: number) => t0 + (musicalMs - fromMs) / 1000 / speed;
    const attack = 0.01;
    const release = 0.03;

    for (const n of timeline.notes) {
      if (n.isRest || !Number.isFinite(n.freqHz)) continue;
      const noteEnd = n.startMs + n.durationMs;
      if (noteEnd <= fromMs) continue; // already over by the time we start

      const playStartMs = Math.max(n.startMs, fromMs);
      const start = toReal(playStartMs);
      const dur = (noteEnd - playStartMs) / 1000 / speed; // real seconds, tempo-scaled
      const midNote = playStartMs > n.startMs; // seeked into the middle of this note

      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave);
      osc.frequency.value = n.freqHz;

      const env = ctx.createGain();
      const a = midNote ? 0 : Math.min(attack, dur / 2);
      env.gain.setValueAtTime(midNote ? 1 : 0, start);
      if (!midNote) env.gain.linearRampToValueAtTime(1, start + a);
      env.gain.setValueAtTime(1, Math.max(start + a, start + dur - release));
      env.gain.linearRampToValueAtTime(0, start + dur);

      osc.connect(env).connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }

    // Metronome: play the usul's click track (built by the core, in musical ms). Clicks before
    // the start offset are skipped; the rest are scheduled in real time via toReal, and a
    // downbeat (`accent`) gets a louder, higher click.
    if (opts.clicks) {
      for (const c of opts.clicks) {
        if (c.ms < fromMs - 1e-6) continue;
        this.scheduleClick(ctx, master, toReal(c.ms), c.accent);
      }
    }

    // Detect the natural end by watching the audio clock. Using the clock (not a wall-clock
    // timer) makes this automatically pause-aware: currentTime freezes while suspended.
    this.endCheck = setInterval(() => {
      const pos = this.getPositionMs();
      if (pos != null && pos >= timeline.totalMs) {
        const cb = this.onEndedCb;
        this.stop();
        cb?.();
      }
    }, 100);
  }

  /**
   * Schedule one short metronome tick (a fast-decaying blip) at AudioContext time `when`.
   * Accented (downbeat) ticks are higher and louder so the start of each measure stands out.
   */
  private scheduleClick(ctx: AudioContext, master: GainNode, when: number, accent = false): void {
    const osc = ctx.createOscillator();
    osc.frequency.value = accent ? 1600 : 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.6 : 0.4, when + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(g).connect(master);
    osc.start(when);
    osc.stop(when + 0.06);
  }

  /** Pause playback, keeping the position so it can be resumed. */
  pause(): void {
    if (this.state !== "playing" || !this.ctx) return;
    void this.ctx.suspend();
    this.state = "paused";
  }

  /** Resume from where pause() left off. */
  resume(): void {
    if (this.state !== "paused" || !this.ctx) return;
    void this.ctx.resume();
    this.state = "playing";
  }

  /**
   * Stop playback immediately and release audio resources.
   *
   * What/why: the user hits Stop, or starts a new piece, or leaves — we must silence any
   * scheduled notes and free the audio engine (leaking AudioContexts will eventually make
   * the browser refuse to create more).
   * How it works: cancel the end-check, then `close()` the AudioContext, which kills every
   * oscillator scheduled on it at once. Null out the references so a later `play()` starts
   * cleanly. Safe to call anytime, even if nothing is playing.
   */
  stop(): void {
    if (this.endCheck) {
      clearInterval(this.endCheck);
      this.endCheck = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
    this.state = "stopped";
  }
}
