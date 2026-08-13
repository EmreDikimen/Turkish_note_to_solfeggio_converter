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
import { loadInstrument, type VoiceBuffer } from "./audio/loadInstrument";
import {
  DEFAULT_VOICE,
  findVoice,
  pickSample,
  type SamplePick,
  type Voice,
  type VoiceId,
} from "./audio/instruments";

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

/**
 * How long a sampled note fades in, and out, in real seconds.
 *
 * ⚠ These are NOT the synth's envelope and must not be tuned to match it. The release is longer than
 * the synth's 0.03 because a sustained bowed tone chopped in 30 ms sounds cut rather than ended.
 *
 * ⚠ **The fade-in stopped being a pure declick on 2026-08-13.** It used to open on the recording's
 * own attack, so 6 ms was plenty; a short note now starts inside the sustain (`toneS`), which is a
 * splice into a moving waveform and wants a slightly softer edge. A long note still opens on the
 * recorded attack (`MAX_ATTACK_SHARE`), where the fade is doing nothing much.
 */
const SAMPLE_FADE_IN_S = 0.012;

/**
 * The note lengths (REAL seconds, so tempo is already in them) between which a sampled note slides
 * from "start at the settled tone" to "start at the recorded attack".
 *
 * ⚠ Real seconds, not note values, is the point — the owner asked for this to be "calculated by
 * metronome speed and note duration", and `dur` is already `durationMs / speed`. A 16th at 60 BPM is
 * a quarter at 240; what decides whether an attack fits is how long the note actually lasts.
 *
 * The rule: **include the recording's own attack only when it is a small enough share of the note**,
 * otherwise start at the settled tone. All-or-nothing, per note.
 *
 * ⚠ It is not a smooth blend, and that was tried first and measured wrong. Interpolating the start
 * point between "attack" and "tone" lands *inside* the transient for anything with a long one —
 * violin C7's bow-bite runs 300 ms, so a quarter note came out starting at 64% harmonic and a half
 * note at 33%, i.e. exactly the creak the owner complained about, reintroduced in the middle of the
 * range while both ends looked fine. Either the whole attack fits or none of it is used; there is no
 * setting at which a note begins halfway through a scrape.
 *
 * ⚠ 0.25 is conservative on purpose, because of what these recordings ARE: VSCO's `susLong` and
 * `Arco Vib` are **sustained** takes, so their opening is a slow swell, not a crisp articulation. It
 * reads as shape on a long note and as a mistake on a short one.
 */
const MAX_ATTACK_SHARE = 0.25;
const SAMPLE_RELEASE_S = 0.06;

/** Transport state, mirrored by the UI to pick the right play/pause/stop affordances. */
export type PlaybackState = "stopped" | "playing" | "paused";

/** What the picker shows about the chosen voice. `idle` means nothing has been asked for yet. */
export type VoiceState = "idle" | "loading" | "ready" | "failed";

/**
 * Everything the UI and the headless checks can know about the voice.
 *
 * ⚠ `sampled` and `synth` are the only way to prove a real recording is playing: a sampled note and
 * a synthesised one are indistinguishable from the DOM, exactly as a sampled stroke was
 * (`percussionInfo`). `sampled > 0 && synth === 0` is what `editor-smoke.ts` asserts on.
 */
export interface VoiceStatus {
  voice: VoiceId;
  state: VoiceState;
  /** Samples decoded so far, out of the voice's total. Both 0 for the synthesised voice. */
  loaded: number;
  total: number;
  /** Notes scheduled this playback, by which path sounded them. */
  sampled: number;
  synth: number;
  /** Notes that outlasted their recording and were faded out early. See `scheduleSampledNote`. */
  truncated: number;
}

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
  /**
   * Which instrument sounds the notes. Its samples are large (20–35 MB), so they are downloaded only
   * when the user picks one and `play()` does NOT wait for them — until they arrive the notes are
   * synthesised, per note, as they are scheduled (see `scheduleNote`).
   */
  voice?: VoiceId;
}

/**
 * One thing to sound, at a MUSICAL ms that is already clamped to the playback start — so the
 * look-ahead loop only ever compares `at` against the horizon and never re-derives anything.
 */
type Pending =
  | { at: number; kind: "note"; freqHz: number; durMs: number; intoMs: number }
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
  /**
   * The loaded instrument voice, cached with the same lifetime as `strokeBuffers` and for the same
   * reason. ⚠ Exactly ONE voice at a time: a decoded violin is ~47 MB of Float32, so `ensureVoice`
   * drops the previous one rather than keeping both. Cache Storage is what makes switching back
   * cheap (`loadInstrument.ts`).
   */
  private voiceBuffers: VoiceBuffer[] | null = null;
  private voiceDef: Voice | null = null;
  private voice: VoiceId = DEFAULT_VOICE;
  /** What the last `ensureVoice` asked for — the same out-of-order guard `strokeKitWanted` is. */
  private voiceWanted: VoiceId | null = null;
  private voiceState: VoiceState = "idle";
  private voiceLoaded = 0;
  private voiceTotal = 0;
  private onVoiceCb: ((s: VoiceStatus) => void) | null = null;
  /** Per-playback counters, reset in `scheduleFrom`. See `VoiceStatus`. */
  private sampledNotes = 0;
  private synthNotes = 0;
  private truncatedNotes = 0;
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

    // ⚠ Deliberately NOT awaited, unlike the drum kit above. `KIT_LOAD_BUDGET_MS` exists because a
    // drum has no visible loading state, so the wait-or-synthesise decision has to be made before
    // the first stroke; a voice has a picker that shows its own progress, and 20–35 MB is not
    // something the Play button may ever block on. The download normally started when the user
    // chose the instrument; whatever has arrived by each note is what that note uses.
    void this.ensureVoice(opts.voice ?? DEFAULT_VOICE);

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
   * Notes that already ended before `fromMs` are dropped; one straddling the offset carries a
   * non-zero `intoMs`, so it starts at full gain with no attack and seeking into a held note doesn't
   * re-articulate it. Clicks before the offset are dropped outright.
   *
   * ⚠ `intoMs` is HOW FAR into the note, not just whether — the synth only needs the boolean, but a
   * sampled voice has to start the recording that far in, or seeking into a held note would replay
   * its attack.
   *
   * All times here are MUSICAL ms; `toReal()` maps them to AudioContext seconds via the speed
   * factor, so tempo scaling applies uniformly to notes and the metronome.
   */
  private scheduleFrom(fromMs: number, opts: PlayOptions): void {
    const ctx = this.ctx!;
    const timeline = this.timeline!;
    this.startCtxTime = ctx.currentTime + 0.05; // small lead-in
    this.startMs = fromMs;

    this.sampledNotes = 0;
    this.synthNotes = 0;
    this.truncatedNotes = 0;

    const pending: Pending[] = [];
    for (const n of timeline.notes) {
      if (n.isRest || !Number.isFinite(n.freqHz)) continue;
      const noteEnd = n.startMs + n.durationMs;
      if (noteEnd <= fromMs) continue; // already over by the time we start
      const at = Math.max(n.startMs, fromMs);
      pending.push({ at, kind: "note", freqHz: n.freqHz, durMs: noteEnd - at, intoMs: at - n.startMs });
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
      if (p.kind === "note") this.scheduleNote(this.toReal(p.at), p.freqHz, p.durMs, p.intoMs);
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
   * `intoMs > 0` means playback seeked into the middle of this note, so it opens at full gain with
   * no attack rather than re-articulating.
   *
   * ⚠ The voice decision is made HERE, per note, not once per playback — the same shape
   * `scheduleStroke` uses. Two consequences, both wanted: a voice that finishes downloading
   * mid-piece starts sounding at the very next note without a re-schedule (which is what lets
   * `play()` refuse to wait for it), and a note outside the instrument's recorded range falls back
   * to synthesis on its own rather than dragging the whole piece down with it.
   */
  private scheduleNote(start: number, freqHz: number, durMs: number, intoMs: number): void {
    const ctx = this.ctx!;
    const master = this.master!;

    if (this.voiceBuffers?.length && this.voiceDef) {
      const pick = pickSample(this.voiceDef, freqHz);
      if (pick) {
        this.sampledNotes++;
        this.scheduleSampledNote(start, pick, durMs, intoMs);
        return;
      }
    }
    this.synthNotes++;

    const midNote = intoMs > 0;
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
   * Schedule one note as a RECORDING, resampled to the exact 53-TET frequency.
   *
   * `playbackRate` is what makes 53 pitches out of 11–15 recordings: the rate is the frequency
   * ratio, so the nearest sample is nudged onto the wanted koma. It changes the recording's length
   * too (~12% at the worst shift this manifest allows), which is why nothing here reads
   * `buffer.duration` without dividing by the rate.
   *
   * ⚠ **Where the level lives.** The files ship byte-identical to the library's originals, so a
   * voice cannot be levelled in its file the way a drum stroke is (`prepare_strokes.py`). It is
   * levelled here instead, by the manifest's per-voice `gain`, set so `gain × peak` stays under full
   * scale — i.e. a sampled note never peaks above where the synthesised note it replaces peaked.
   * That is what keeps F1 out of the limiter and stops the F2 clipping bug recurring: there a drum
   * was ADDED to a note at 1.0, here a recording REPLACES one, and the arithmetic differs.
   *
   * ⚠ **When a note outlasts its recording** it is faded out where the recording ends, rather than
   * looped (the samples are 7–16 s sustains, so nothing needs looping — owner, 2026-08-11) or cut
   * dead. It is reachable in ordinary use despite that length, because `dur` is REAL seconds: a
   * whole note at the tempo box's floor, or at 0.5× speed, passes it easily. Counted, so a listener
   * reporting "the long notes stop early" has a number rather than a mystery.
   */
  private scheduleSampledNote(start: number, pick: SamplePick, durMs: number, intoMs: number): void {
    const ctx = this.ctx!;
    const master = this.master!;
    const buffer = this.voiceBuffers?.find((b) => b.hz === pick.sample.hz)?.buffer;
    if (!buffer) {
      // The manifest and the decoded set disagreed — can only happen mid-swap. Silence would look
      // like a broken feature, so hand it back to the tone that always works.
      this.sampledNotes--;
      this.synthNotes++;
      this.scheduleNote(start, pick.sample.hz * pick.playbackRate, durMs, intoMs);
      return;
    }

    const dur = durMs / 1000 / this.speed; // real seconds, tempo-scaled, exactly as the synth does
    const rate = pick.playbackRate;

    // ⚠ **How much of the recorded attack to keep depends on how long this note is** (owner,
    // 2026-08-13: *"maybe we can trim differently for different duration of the notes"*). A 16th
    // note has no time to develop, so it starts at `toneS` and speaks immediately; a note long
    // enough to carry the recorded swell starts at `attackS` and keeps the real articulation, which
    // is what stops the whole line sounding slurred. See `MAX_ATTACK_SHARE` for why this is a
    // threshold rather than a smooth blend.
    //
    // Costs nothing, which is the answer to "if it does not make the app slow": one subtraction and
    // one comparison on numbers the manifest already carries, per note, at schedule time. No extra
    // buffer, no second decode, nothing that touches memory — unlike the obvious alternative of
    // storing two differently-trimmed copies of every sample, which would double the download.
    const preTone = Math.max(0, pick.sample.toneS - pick.sample.attackS);
    const windowFrom = preTone <= dur * MAX_ATTACK_SHARE ? pick.sample.attackS : pick.sample.toneS;

    const from = Math.max(0, Math.min(windowFrom, buffer.duration - 0.05));
    const until = Math.min(pick.sample.endS, buffer.duration);

    // Seeking into a held note advances inside the BUFFER's timebase, which `playbackRate` does not
    // affect — one real second consumes `rate` buffer seconds, so the elapsed musical time has to be
    // converted through both `speed` and `rate` to land in the right place.
    const intoBuf = Math.max(0, intoMs / 1000 / this.speed) * rate;
    const offset = Math.min(from + intoBuf, Math.max(from, until - 0.05));
    const available = (until - offset) / rate;
    const sound = Math.min(dur, available);
    if (sound <= 0) return;
    if (sound < dur - 1e-3) this.truncatedNotes++;

    const g = this.voiceDef?.gain ?? 1;
    const fade = Math.min(SAMPLE_FADE_IN_S, sound / 2);
    const release = Math.min(SAMPLE_RELEASE_S, sound / 3);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;

    const env = ctx.createGain();
    // Seeking into a held note opens at level with no fade, for the same reason the synth path does:
    // re-articulating a note the listener is already hearing is the audible bug.
    env.gain.setValueAtTime(intoMs > 0 ? g : 0, start);
    if (intoMs <= 0) env.gain.linearRampToValueAtTime(g, start + fade);
    env.gain.setValueAtTime(g, Math.max(start + fade, start + sound - release));
    env.gain.linearRampToValueAtTime(0, start + sound);

    // → master, never percGain: that node is the `Vuruş sesi` slider's, and a note is not a stroke.
    src.connect(env).connect(master);
    src.start(start, offset);
    src.stop(start + sound + 0.02);
    this.own(src);
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
   * Start loading an instrument voice, and report progress to whoever is listening.
   *
   * ⚠ **No timeout, and nothing awaits this** — the opposite of `ensureKit` above, for a reason
   * worth keeping straight. A drum kit is 660 KB with no visible loading state, so it is worth
   * blocking `play()` for a moment and then giving up. A voice is 20–35 MB and the picker shows its
   * own progress, so blocking the transport would be indefensible: notes are synthesised until the
   * samples land, per note, and the piece switches over mid-phrase without a re-schedule.
   *
   * ⚠ A failure is **reported**, not swallowed the way a kit's is. Nobody asked for the darbuka
   * specifically — it is the default — but a voice is something the user went and chose, so silence
   * about it would read as the app ignoring them.
   */
  async ensureVoice(id: VoiceId): Promise<void> {
    const ctx = this.ctx ?? (this.ctx = new AudioContext());
    this.voice = id;
    this.voiceWanted = id;

    const def = findVoice(id);
    if (!def || !def.samples.length) {
      // The synthesised voice: nothing to load, and switching to it must drop what is held, since
      // ~47 MB of decoded violin has no business surviving a switch back to the default tone.
      this.voiceBuffers = null;
      this.voiceDef = null;
      this.voiceLoaded = 0;
      this.voiceTotal = 0;
      this.voiceState = "idle";
      this.emitVoice();
      return;
    }

    if (this.voiceDef?.id === id && this.voiceBuffers?.length) return; // already here

    // Anything loaded belongs to the other instrument. Drop it before the new one arrives rather
    // than after, so two voices are never decoded at once.
    this.voiceBuffers = null;
    this.voiceDef = null;
    this.voiceLoaded = 0;
    this.voiceTotal = def.samples.length;
    this.voiceState = "loading";
    this.emitVoice();

    try {
      const bufs = await loadInstrument(ctx, id, (done, total) => {
        if (this.voiceWanted !== id) return;
        this.voiceLoaded = done;
        this.voiceTotal = total;
        this.emitVoice();
      });
      // The same out-of-order guard `strokeKitWanted` is: a slow load for voice A must not install
      // itself after the user has moved to voice B.
      if (this.voiceWanted !== id) return;
      this.voiceBuffers = bufs;
      this.voiceDef = def;
      this.voiceState = "ready";
    } catch {
      if (this.voiceWanted !== id) return;
      this.voiceState = "failed";
    }
    this.emitVoice();
  }

  /** Register a callback fired whenever the voice's load state moves. */
  setOnVoiceStatus(cb: ((s: VoiceStatus) => void) | null): void {
    this.onVoiceCb = cb;
  }

  private emitVoice(): void {
    this.onVoiceCb?.(this.voiceInfo());
  }

  /**
   * Which voice is loaded, how far, and which path actually sounded this playback's notes.
   *
   * For the UI (the picker's progress) and the headless checks. ⚠ The counters are the only proof
   * that a RECORDING played: a sampled note and a synthesised one are identical from the DOM, the
   * same blind spot `percussionInfo` exists for. `sampled > 0 && synth === 0` is the assertion.
   */
  voiceInfo(): VoiceStatus {
    return {
      voice: this.voice,
      state: this.voiceState,
      loaded: this.voiceLoaded,
      total: this.voiceTotal,
      sampled: this.sampledNotes,
      synth: this.synthNotes,
      truncated: this.truncatedNotes,
    };
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
