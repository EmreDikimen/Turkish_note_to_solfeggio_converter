/**
 * Web Audio implementation of the core's `AudioBackend` adapter.
 *
 * This is platform-specific glue (it lives in the web app, NOT in @turkish-omr/core).
 * On mobile, a native backend implements the same interface; the core's scheduling
 * logic is reused unchanged.
 *
 * ## Why this is a look-ahead scheduler and not a one-pass one (feature track F0, 2026-08-10)
 *
 * It used to build every note's `OscillatorNode` up front and `stop()` used to `close()` the
 * `AudioContext` — which is what silenced them all at once. Both had to go before any feature
 * could play a *sample*:
 *
 *  - A decoded `AudioBuffer` belongs to the context that decoded it. Closing the context after
 *    every playback throws the buffer away, so a sample cache could never survive a Stop.
 *  - Mobile Safari caps how many `AudioContext`s a page may create; one per Play runs a page out
 *    of audio.
 *
 * So there is now ONE context, created lazily and never closed, and a ~100 ms tick that schedules
 * only the next ~1 s of sound. `stop()` stops and disconnects the live source nodes and throws
 * away the master gain instead of the context.
 *
 * ⚠ The tick is a wall-clock `setInterval`, but it asks `positionMs()` — the AUDIO clock — where
 * the horizon is. While the context is suspended that clock is frozen, so the horizon does not
 * advance and nothing new is scheduled. That is why pausing needs no special case here, and why
 * adding one would be a mistake.
 */

import type { AudioBackend, PercussionHit, Stroke, Timeline } from "@turkish-omr/core";
import { loadStrokeKit, type StrokeBuffers } from "./audio/loadStrokeKit";
import { DEFAULT_KIT, type KitId } from "./audio/strokeKits";

// A gently decaying harmonic spectrum — same idea as the Python reference synth,
// less harsh than a pure sine.
const HARMONIC_GAINS = [1.0, 0.45, 0.25, 0.12, 0.06];

/** How far ahead of the playhead sound is scheduled, in REAL seconds. */
const LOOKAHEAD_S = 1.0;

/** How often the scheduler tops up that window, in wall-clock ms. Must be well under the above. */
const TICK_MS = 100;

/**
 * How long `play()` will wait for a drum kit before starting without it. Long enough for a local or
 * cached fetch of ~660 KB, short enough that a bad line does not make the Play button feel broken.
 */
const KIT_LOAD_BUDGET_MS = 1500;

/**
 * Master level, and the headroom question behind it.
 *
 * Lowered from 0.85 on 2026-08-11, when the drum samples arrived and the mix started clipping
 * (owner: *"darbukanın sesi biraz patlamış"*). A note is a normalised `PeriodicWave` at gain 1.0, so
 * at 0.85 the notes alone used **85% of the available range** and anything played alongside them had
 * nowhere to go. That was survivable while the only companion was a metronome tick and a
 * near-instant synthesised blip; a real drum has a body that sustains for hundreds of ms and
 * overlaps the notes constantly.
 */
const MASTER_GAIN = 0.72;

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
  /**
   * The usul's hand strokes to play, in MUSICAL ms. Built by the core from the selected usul
   * (`buildPercussionTrack`). Independent of `clicks` — a metronome marks the beats, a usul plays
   * a rhythm, and either, both or neither is a reasonable thing to want. Omit/empty for silence.
   */
  percussion?: PercussionHit[];
  /**
   * How loud the strokes are against the notes. 1 = the default balance, 0 = silent, 2 = twice.
   * Only the STARTING value — `setPercussionVolume` changes it live, without re-scheduling, which
   * is what a slider needs (see that method).
   */
  percussionVolume?: number;
  /**
   * Which drum the strokes are played on. Its samples are loaded on demand and cached for the life
   * of the page; until they arrive the strokes are synthesised (see `scheduleStroke`).
   */
  percussionKit?: KitId;
}

/**
 * One thing to sound, at a MUSICAL ms that is already clamped to the playback start — so the
 * look-ahead loop only ever compares `at` against the horizon and never re-derives anything.
 */
type Pending =
  | { at: number; kind: "note"; freqHz: number; durMs: number; midNote: boolean }
  | { at: number; kind: "click"; accent: boolean }
  | { at: number; kind: "stroke"; stroke: Stroke };

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
  /**
   * Created lazily on the first `play()` (the click is the user gesture Web Audio requires) and
   * then kept for the life of the page. ⚠ Never `close()` it — see the module comment.
   */
  private ctx: AudioContext | null = null;
  /** Rebuilt per playback; dropping it is how `stop()` silences anything it fails to catch. */
  private master: GainNode | null = null;
  /** The output limiter. Lives with the context, not the playback — see `limiterNode`. */
  private limiter: DynamicsCompressorNode | null = null;
  /**
   * The percussion's own gain stage, between the strokes and `master`, so the usul can be balanced
   * against the notes while everything plays. Rebuilt per playback like `master`.
   */
  private percGain: GainNode | null = null;
  /** The user's chosen percussion level. Survives stop/play — it is a preference, not per-playback. */
  private percVolume = 1;
  /** Both cached per context, since the context now outlives a playback. */
  private wave: PeriodicWave | null = null;
  private noise: AudioBuffer | null = null;
  /**
   * The loaded drum, and which kit it is. Cached here beside `wave`/`noise` for exactly the same
   * reason and with the same lifetime: `stop()` does not clear them, so the samples are decoded
   * once per page rather than once per Play. This is the cache F0 exists to make possible — on the
   * old backend `stop()` closed the context, and an `AudioBuffer` dies with the context that
   * decoded it.
   */
  private strokeBuffers: StrokeBuffers | null = null;
  private strokeKit: KitId | null = null;
  /** What the last `ensureKit` asked for — see the out-of-order guard there. */
  private strokeKitWanted: KitId | null = null;
  /** Which round-robin each stroke plays next. See `scheduleStroke`. */
  private rr: Record<Stroke, number> = { dum: 0, tek: 0, ka: 0 };
  private timeline: Timeline | null = null;
  /** AudioContext time (seconds) when playback started, and the musical ms it began at. */
  private startCtxTime = 0;
  private startMs = 0;
  /** Playback speed multiplier — maps musical ms to real time (real = musical / speed). */
  private speed = 1;
  /** Everything left to sound, ascending by `at`, and how far into it the scheduler has got. */
  private pending: Pending[] = [];
  private cursor = 0;
  /**
   * Source nodes that are scheduled or sounding, so `stop()` can silence them without closing the
   * context. Self-pruning: each node removes itself from here in its own `onended`.
   */
  private sources = new Set<AudioScheduledSourceNode>();
  /** Drives the look-ahead window AND the end-of-piece check (they poll at the same rate). */
  private ticker: ReturnType<typeof setInterval> | null = null;
  private onEndedCb: (() => void) | null = null;
  private state: PlaybackState = "stopped";

  getState(): PlaybackState {
    return this.state;
  }

  /**
   * How many events have been handed to Web Audio so far, and how many this playback holds in
   * total. Exposed for the headless checks (`tools/browser/editor-smoke.ts`), which cannot prove
   * the scheduler is alive any other way: the playhead is driven by the AUDIO CLOCK, so it keeps
   * gliding across the sheet even if the look-ahead loop died and the page has gone silent.
   * `scheduled < total` while playing is the property F0 exists for.
   */
  scheduleProgress(): { scheduled: number; total: number } {
    return { scheduled: this.cursor, total: this.pending.length };
  }

  /** Register a callback fired once when the piece reaches its end on its own. */
  setOnEnded(cb: (() => void) | null): void {
    this.onEndedCb = cb;
  }

  /**
   * Position on the audio clock, ungated by transport state — what the scheduler itself steers by.
   * `getPositionMs()` is the public, stopped-aware version.
   */
  private positionMs(): number | null {
    if (!this.ctx) return null;
    return this.startMs + (this.ctx.currentTime - this.startCtxTime) * 1000 * this.speed;
  }

  /**
   * Current playback position in **musical** milliseconds (at natural tempo), or null when
   * stopped. Derived from the AudioContext clock — the same clock the notes are scheduled
   * against — scaled back up by `speed`, so it's tempo-independent and matches the sheet's
   * note timeline. While paused the clock is frozen, so the position holds steady.
   *
   * ⚠ The `stopped` guard is load-bearing now that the context is never closed: the clock keeps
   * running after a Stop, and callers (the sheet's playhead) read `null` as "nothing is playing".
   */
  getPositionMs(): number | null {
    if (this.state === "stopped") return null;
    return this.positionMs();
  }

  /**
   * Play a timeline through the browser speakers, optionally starting partway in (`fromMs`).
   * This is the web's implementation of the core `AudioBackend.play` contract.
   *
   * What/why: the core decided *what* plays and *when* (the Timeline); this turns that into
   * actual sound using Web Audio. `fromMs` lets the UI seek (click a measure to play from
   * there) by simply re-scheduling from that offset.
   * How it works: reuse the one long-lived `AudioContext`, `resume()` it (the click is the
   * required user gesture), give this playback a fresh master gain, then hand the timeline to the
   * look-ahead scheduler. `opts.speed` scales playback tempo; `opts.clicks` adds a click track.
   */
  async play(timeline: Timeline, fromMs = 0, opts: PlayOptions = {}): Promise<void> {
    this.stop();
    this.timeline = timeline;
    this.speed = opts.speed && opts.speed > 0 ? opts.speed : 1;

    if (!this.ctx) this.ctx = new AudioContext();
    const ctx = this.ctx;
    await ctx.resume();

    const master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(this.limiterNode(ctx));
    this.master = master;

    if (opts.percussionVolume != null) this.percVolume = Math.max(0, opts.percussionVolume);
    const percGain = ctx.createGain();
    percGain.gain.value = this.percVolume;
    percGain.connect(master);
    this.percGain = percGain;

    if (opts.percussion?.length) await this.ensureKit(ctx, opts.percussionKit ?? DEFAULT_KIT);

    // ⚠ Before scheduleFrom, not after: its first tick can legitimately reach the end of the piece
    // (seek past the last note) and call stop(), and a later assignment here would overwrite that
    // back to "playing" with nothing scheduled.
    this.state = "playing";
    this.scheduleFrom(Math.max(0, fromMs), opts);
  }

  /**
   * Turn the timeline and the click track into one ascending `Pending` list starting at `fromMs`,
   * then open the look-ahead window on it.
   *
   * Notes that already ended before `fromMs` are dropped; one straddling the offset is marked
   * `midNote`, so it starts at full gain with no attack and seeking into a held note doesn't
   * re-articulate it. Clicks before the offset are dropped outright.
   *
   * All times here are MUSICAL ms; `toReal()` maps them to AudioContext seconds via the speed
   * factor, so tempo scaling applies uniformly to notes and the metronome.
   */
  private scheduleFrom(fromMs: number, opts: PlayOptions): void {
    const ctx = this.ctx!;
    const timeline = this.timeline!;
    this.startCtxTime = ctx.currentTime + 0.05; // small lead-in
    this.startMs = fromMs;

    const pending: Pending[] = [];
    for (const n of timeline.notes) {
      if (n.isRest || !Number.isFinite(n.freqHz)) continue;
      const noteEnd = n.startMs + n.durationMs;
      if (noteEnd <= fromMs) continue; // already over by the time we start
      const at = Math.max(n.startMs, fromMs);
      pending.push({ at, kind: "note", freqHz: n.freqHz, durMs: noteEnd - at, midNote: at > n.startMs });
    }
    for (const c of opts.clicks ?? []) {
      if (c.ms < fromMs - 1e-6) continue;
      pending.push({ at: c.ms, kind: "click", accent: c.accent });
    }
    for (const h of opts.percussion ?? []) {
      if (h.ms < fromMs - 1e-6) continue;
      pending.push({ at: h.ms, kind: "stroke", stroke: h.stroke });
    }

    // Every input is already ascending (buildTimeline accumulates a monotonic cursor;
    // buildMetronomeTrack and buildPercussionTrack walk the bars in order), so this only
    // interleaves them.
    pending.sort((a, b) => a.at - b.at);
    this.pending = pending;
    this.cursor = 0;

    this.tick(); // fill the first window now, rather than TICK_MS of silence
    this.ticker = setInterval(() => this.tick(), TICK_MS);
  }

  /** Musical ms → AudioContext seconds, for the current playback. */
  private toReal(musicalMs: number): number {
    return this.startCtxTime + (musicalMs - this.startMs) / 1000 / this.speed;
  }

  /**
   * One scheduler step: sound everything that falls inside the look-ahead window, then check
   * whether the piece has run out.
   *
   * The window is expressed in MUSICAL ms (`LOOKAHEAD_S * speed`) because that is the unit
   * `pending` is sorted in — a real second is fewer musical ms the faster you play.
   */
  private tick(): void {
    const pos = this.positionMs();
    if (pos == null) return;

    const horizon = pos + LOOKAHEAD_S * 1000 * this.speed;
    while (this.cursor < this.pending.length && this.pending[this.cursor]!.at <= horizon) {
      const p = this.pending[this.cursor++]!;
      if (p.kind === "note") this.scheduleNote(this.toReal(p.at), p.freqHz, p.durMs, p.midNote);
      else if (p.kind === "stroke") this.scheduleStroke(this.toReal(p.at), p.stroke);
      else this.scheduleClick(this.toReal(p.at), p.accent);
    }

    // Detect the natural end by watching the audio clock. Using the clock (not a wall-clock
    // timer) makes this automatically pause-aware: currentTime freezes while suspended.
    if (this.timeline && pos >= this.timeline.totalMs) {
      const cb = this.onEndedCb;
      this.stop();
      cb?.();
    }
  }

  /** Track a source node so `stop()` can silence it, and forget it once it has finished. */
  private own(node: AudioScheduledSourceNode): void {
    this.sources.add(node);
    node.onended = () => {
      this.sources.delete(node);
    };
  }

  /**
   * Schedule one sounding note at AudioContext time `start`, lasting `durMs` musical ms.
   * `midNote` means playback seeked into the middle of this note, so it opens at full gain with
   * no attack rather than re-articulating.
   */
  private scheduleNote(start: number, freqHz: number, durMs: number, midNote: boolean): void {
    const ctx = this.ctx!;
    const master = this.master!;
    if (!this.wave) this.wave = buildPeriodicWave(ctx);
    const dur = durMs / 1000 / this.speed; // real seconds, tempo-scaled
    const attack = 0.01;
    const release = 0.03;

    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.wave);
    osc.frequency.value = freqHz;

    const env = ctx.createGain();
    const a = midNote ? 0 : Math.min(attack, dur / 2);
    env.gain.setValueAtTime(midNote ? 1 : 0, start);
    if (!midNote) env.gain.linearRampToValueAtTime(1, start + a);
    env.gain.setValueAtTime(1, Math.max(start + a, start + dur - release));
    env.gain.linearRampToValueAtTime(0, start + dur);

    osc.connect(env).connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
    this.own(osc);
  }

  /**
   * Schedule one short metronome tick (a fast-decaying blip) at AudioContext time `when`.
   * Accented (downbeat) ticks are higher and louder so the start of each measure stands out.
   */
  private scheduleClick(when: number, accent = false): void {
    const ctx = this.ctx!;
    const master = this.master!;
    const osc = ctx.createOscillator();
    osc.frequency.value = accent ? 1600 : 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.6 : 0.4, when + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(g).connect(master);
    osc.start(when);
    osc.stop(when + 0.06);
    this.own(osc);
  }

  /**
   * Set how loud the usul's strokes are against the notes — **live, with no re-scheduling**.
   *
   * This is why the percussion has a gain stage of its own. Every other playback control (tempo,
   * usul, the metronome) goes through `applyPlayback`, which re-schedules from the current position
   * — fine for something you change once, wrong for a slider you drag, which would restart the
   * audio on every pixel. Strokes already queued in the look-ahead window pass through this same
   * node, so they follow the new level too.
   *
   * The value is ramped rather than assigned: a step change in gain is a discontinuity in the
   * waveform, which clicks.
   */
  setPercussionVolume(v: number): void {
    this.percVolume = Math.max(0, v);
    if (this.percGain && this.ctx) {
      this.percGain.gain.setTargetAtTime(this.percVolume, this.ctx.currentTime, 0.01);
    }
  }

  /**
   * A quarter-second of white noise, built once per context and reused as the source for every
   * rim stroke. ⚠ This is the codebase's first `AudioBuffer`, and it is exactly what the old
   * `stop()` used to throw away by closing the context — the reason F0 came first.
   */
  /**
   * Have the chosen drum's samples ready, if they can be ready in time.
   *
   * ⚠ **The timeout is the design, not a safety net.** `play()` awaits this, so without a bound a
   * slow line would leave the Play button doing nothing while six files download — the one thing a
   * transport control must never do. Missing the deadline is not a failure: the fetch keeps going,
   * `scheduleStroke` falls back to the synthesised strokes for this playback, and the next Play has
   * the buffers. A failed load is swallowed for the same reason — a drum that will not download is
   * a reason to hear the fallback, not a reason for silence or an error dialog.
   */
  private async ensureKit(ctx: AudioContext, kit: KitId): Promise<void> {
    if (this.strokeKit === kit && this.strokeBuffers) return;
    const load = loadStrokeKit(ctx, kit).then((bufs) => {
      // Guard against a slow load for kit A landing after the user has switched to kit B.
      if (this.strokeKitWanted === kit) {
        this.strokeBuffers = bufs;
        this.strokeKit = kit;
      }
    });
    this.strokeKitWanted = kit;
    // Anything already loaded belongs to the other kit, so stop using it rather than play a mixture.
    if (this.strokeKit !== kit) {
      this.strokeBuffers = null;
      this.strokeKit = null;
    }
    await Promise.race([
      load.catch(() => undefined),
      new Promise<void>((r) => setTimeout(r, KIT_LOAD_BUDGET_MS)),
    ]);
  }

  /**
   * The last thing before the speakers: a limiter, so nothing downstream of a user control can
   * clip.
   *
   * ⚠ **This is a safety net, not a mixing tool, and the levels must not lean on it.** Lowering
   * `MASTER_GAIN` and the stroke peaks is what stops it engaging in normal playback; this catches
   * what arithmetic cannot be asked to guarantee — `Vuruş sesi` goes to 200%, so the user can always
   * ask for more drum than the range holds, and the honest answer to that is to squash the peak
   * rather than to shatter it. Hard clipping is what "patlamış" was.
   *
   * Threshold just under 0 dBFS with a hard knee and a high ratio, which is a limiter rather than a
   * compressor: below the threshold it is mathematically inert, so the notes are untouched until
   * something genuinely runs out of room. Attack 0 because a drum transient is over in
   * milliseconds — a compressor's default 3 ms attack would let the very peak through, which is the
   * one part that matters here.
   *
   * Created once per context and reused; `stop()` drops the master gain feeding it, not this.
   */
  private limiterNode(ctx: AudioContext): DynamicsCompressorNode {
    if (this.limiter) return this.limiter;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -1;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0;
    lim.release.value = 0.15;
    lim.connect(ctx.destination);
    this.limiter = lim;
    return lim;
  }

  /**
   * Which kit is loaded and how many of its strokes decoded. For the headless checks only: nothing
   * user-visible can distinguish a sampled stroke from a synthesised one, so `smoke:editor` has no
   * other way to prove the swap actually happened. Same role as `scheduleProgress`.
   */
  percussionInfo(): { kit: KitId | null; loaded: number } {
    return { kit: this.strokeKit, loaded: this.strokeBuffers?.size ?? 0 };
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const len = Math.ceil(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return buf;
  }

  /**
   * Schedule one usul hand stroke at AudioContext time `when`.
   *
   * A real recording when the kit has loaded, and the synthesis below when it has not. The samples
   * are the point — the synthesised version shipped on 2026-08-10 and the owner rejected it by ear
   * the next day ("we need to use real sounds"), which is worth keeping written down: the plan's
   * bar was that düm and tek be *tellable apart*, the synthesis met that bar, and meeting it is how
   * it failed. Percussion is a timbre problem, and two oscillators can be identifiable without
   * being a drum.
   *
   * ⚠ **The synthesis stays as the fallback and must not be deleted.** A stroke that has not
   * downloaded should sound wrong, not sound like nothing: silence reads as the feature being
   * broken, which is the same reasoning that keeps the in-browser decode fallback alive.
   *
   * The synthesised shapes are the standard percussion-synthesis pair:
   *   - **düm** — the open centre hit: a sine dropping fast in pitch (a real drumhead's tension
   *     falls as it settles) for the body, **plus a short mid-range attack**.
   *   - **tek / ka** — the rim: a bandpassed noise burst, over in a blink. `ka` is the weak hand,
   *     so it is the same sound quieter — which is what makes düyek's "te-ke" read as one gesture
   *     rather than two equal hits.
   *
   * ⚠ **The attack on the düm is not decoration, it is why the düm is audible at all** (owner
   * reported the rhythms were barely there, 2026-08-11). The first version was body only, sweeping
   * 115 → 55 Hz — musically the right shape and nearly inaudible on a laptop, because a MacBook
   * speaker rolls off hard below ~200 Hz. It was numerically the loudest thing in the mix and
   * perceptually the quietest. The body now starts higher and a ~400 Hz click carries the hit on a
   * small speaker; on headphones the low end still does the work. Raising the gain alone would not
   * have fixed this, which is worth remembering before reaching for a level to solve a balance.
   * ⚠ It is also the bar the RECORDINGS had to pass, which is why `scripts/prepare_strokes.py`
   * chooses articulations by measured low-band energy and decay rather than by file name, and
   * levels the three strokes to fixed targets instead of inheriting VCSL's session levels.
   */
  private scheduleStroke(when: number, stroke: Stroke): void {
    const ctx = this.ctx!;
    const out = this.percGain!;

    const takes = this.strokeBuffers?.get(stroke);
    if (takes?.length) {
      const src = ctx.createBufferSource();
      // Round-robin, so a usul striking the same stroke every cycle does not machine-gun. The
      // counter is per stroke, because düm and tek recur at different rates within one cycle.
      src.buffer = takes[this.rr[stroke]++ % takes.length]!;
      // → percGain, never master: that is the node the `Vuruş sesi` slider rides.
      src.connect(out);
      src.start(when);
      this.own(src);
      return;
    }

    if (stroke === "dum") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(190, when);
      osc.frequency.exponentialRampToValueAtTime(62, when + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.95, when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
      osc.connect(g).connect(out);
      osc.start(when);
      osc.stop(when + 0.33);
      this.own(osc);

      // The attack: a brief mid-range thud that survives a small speaker.
      const click = ctx.createBufferSource();
      click.buffer = this.noiseBuffer(ctx);
      const lp = ctx.createBiquadFilter();
      lp.type = "bandpass";
      lp.frequency.value = 400;
      lp.Q.value = 0.8;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, when);
      cg.gain.exponentialRampToValueAtTime(0.6, when + 0.002);
      cg.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
      click.connect(lp).connect(cg).connect(out);
      click.start(when);
      click.stop(when + 0.08);
      this.own(click);
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2200;
    band.Q.value = 1.2;
    const g = ctx.createGain();
    const peak = stroke === "tek" ? 0.7 : 0.36; // `ka` is the weak hand
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    src.connect(band).connect(g).connect(out);
    src.start(when);
    src.stop(when + 0.07);
    this.own(src);
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
   * Stop playback immediately and release this playback's audio resources — but NOT the context.
   *
   * What/why: the user hits Stop, or starts a new piece, or leaves — we must silence everything
   * scheduled. It used to do that by closing the AudioContext; now the context survives (see the
   * module comment), so the silencing is explicit.
   * How it works: drop the ticker, stop and disconnect every live source node, then throw away
   * the master gain. The second half is the belt to the first's braces — anything that slipped
   * through is now connected to an orphaned node and reaches no speaker. Safe to call anytime,
   * even if nothing is playing.
   */
  stop(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    // Snapshot first: stopping a node fires its `onended`, which mutates this set.
    for (const node of Array.from(this.sources)) {
      node.onended = null;
      try {
        node.stop();
      } catch {
        // Already stopped, or never started. Both are normal here.
      }
      node.disconnect();
    }
    this.sources.clear();
    if (this.percGain) {
      this.percGain.disconnect();
      this.percGain = null;
    }
    if (this.master) {
      this.master.disconnect();
      this.master = null;
    }
    this.pending = [];
    this.cursor = 0;
    this.state = "stopped";
  }
}
