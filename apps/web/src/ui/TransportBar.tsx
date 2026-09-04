/**
 * The controls a musician actually touches, in three named ROWS.
 *
 *  - **Çalma:** play, stop, tempo, and which instrument sounds the notes.
 *  - **Ritim:** usul, metronome, the usul's own strokes, their loudness and their drum.
 *  - **Perde:** makam, transposition, keep-the-staff, and which accidentals the staff prints.
 *
 * ⚠ The rows are explicit, not a `flex-wrap` that breaks wherever it runs out of width — that is
 * what this was until 2026-09-03 and it read as a pile: the first line ran flush to the right edge,
 * the second held two controls and half a page of gap, and nothing said which control belonged
 * with which. A row also fails predictably — a narrow window costs ONE group a second line instead
 * of reshuffling all twelve controls. The separator between rows is horizontal and belongs to the
 * row; a VERTICAL rule between clusters was tried once and removed, because it dangled at the end
 * of a wrapped line and read as a mistake.
 *
 * The reading three moved up from `Gelişmiş` on 2026-08-08 (owner): they change what a player sees
 * and hears, which is not a developer setting — a ney player transposing a score is using the app
 * exactly as intended, and having to open a panel called "geliştirici ayarları" to do it said the
 * opposite. What stays down there is genuinely for the project: sample/JSON loading, the strip
 * exporter, the repeat preview.
 *
 * `#play` carries `data-play-state` and `#stop` its id because the deploy checks drive them; the
 * LABELS are copy and are free to change. See apps/web/src/ui/status.ts for the reasoning.
 * ⚠ `#play-sticky` / `#stop-sticky` are the SAME transport pinned to the corner once this bar has
 * scrolled off (see `StickyTransport` at the bottom), so `data-play-state` now names two buttons
 * here as well as `#palette-play` in the editor's toolbox — a check must say which one it means.
 */

import { useEffect, useRef, useState } from "react";
import { findUsul, USULS, type MakamOption } from "@turkish-omr/core";
import { KITS, type KitId } from "../audio/strokeKits";
import { VOICES, type VoiceId } from "../audio/instruments";
import type { VoiceStatus } from "../webAudioBackend";
import type { AccidentalMode } from "../SheetView";
import { Segmented } from "./Segmented";
import { TR } from "./strings";

/** The picker's own name for a voice, for the hints that have to say which one is sounding. */
function voiceLabel(id: VoiceId): string {
  return VOICES.find((v) => v.id === id)?.label ?? id;
}

export function TransportBar({
  canPlay,
  playState,
  onPlayPause,
  onStop,
  bpm,
  naturalBpm,
  onBpm,
  metronome,
  onMetronome,
  percussion,
  onPercussion,
  percussionVolume,
  onPercussionVolume,
  percussionKit,
  onPercussionKit,
  voice,
  onVoice,
  voiceStatus,
  usulName,
  onUsul,
  makamSlug,
  onMakam,
  makamOptions,
  transpose,
  transposeOptions,
  onTranspose,
  keepSheet,
  onKeepSheet,
  accidentalMode,
  onAccidentalMode,
}: {
  canPlay: boolean;
  playState: "stopped" | "playing" | "paused";
  onPlayPause: () => void;
  onStop: () => void;
  bpm: number;
  /** The piece's own tempo; 0 when unknown. Drives the "back to natural" button. */
  naturalBpm: number;
  onBpm: (v: number) => void;
  metronome: boolean;
  onMetronome: (v: boolean) => void;
  /** Play the usul's own düm/tek/ke strokes. Independent of the metronome, not a replacement. */
  percussion: boolean;
  onPercussion: (v: boolean) => void;
  /** Stroke loudness against the notes; 1 = the default balance. Applies live, mid-playback. */
  percussionVolume: number;
  onPercussionVolume: (v: number) => void;
  /** Which drum the strokes are played on. Real CC0 recordings, one set per kit. */
  percussionKit: KitId;
  onPercussionKit: (v: KitId) => void;
  /** Which instrument sounds the notes. `sine` is the built-in tone and needs no download. */
  voice: VoiceId;
  onVoice: (v: VoiceId) => void;
  /** Load progress for the chosen voice, so the picker can say why nothing has changed yet. */
  voiceStatus: VoiceStatus;
  usulName: string;
  onUsul: (v: string) => void;
  makamSlug: string;
  onMakam: (slug: string) => void;
  makamOptions: readonly MakamOption[];
  /** Transposition in commas. 0 is the score as written. */
  transpose: number;
  transposeOptions: readonly (readonly [number, string])[];
  onTranspose: (commas: number) => void;
  /** Transposing instruments: move the SOUND, leave the staff where it is. */
  keepSheet: boolean;
  onKeepSheet: (v: boolean) => void;
  accidentalMode: AccidentalMode;
  onAccidentalMode: (m: AccidentalMode) => void;
}) {
  // How many strokes the SELECTED usul has. 0 means its pattern has not been written yet
  // (packages/core/src/usul.ts) — the checkbox says so instead of silently playing nothing, and
  // `data-usul-strokes` is how a headless check reads that without matching the sentence.
  const strokeCount = findUsul(usulName)?.strokes?.length ?? 0;
  // The real Çal button, watched by the pinned pair below so it only appears once this one is gone.
  const playRef = useRef<HTMLButtonElement>(null);

  return (
    <>
    <div className="kv-transport">
      {/* ── Çalma ─────────────────────────────────────────────────────────────────────────── */}
      <div className="kv-transport__row">
        <span className="kv-transport__caption">{TR.transport.groupPlay}</span>
        <div className="kv-transport__items">
          <div className="kv-transport__group">
            <button
              id="play"
              ref={playRef}
              type="button"
              data-play-state={playState}
              className="kv-btn kv-btn--primary"
              onClick={onPlayPause}
              disabled={!canPlay}
            >
              {playState === "playing"
                ? TR.transport.pause
                : playState === "paused"
                  ? TR.transport.resume
                  : TR.transport.play}
            </button>
            <button
              id="stop"
              type="button"
              className="kv-btn"
              onClick={onStop}
              disabled={playState === "stopped"}
            >
              {TR.transport.stop}
            </button>
          </div>

          <label
            className={`kv-field${canPlay ? "" : " is-disabled"}`}
            title={naturalBpm ? TR.transport.tempoTitle(naturalBpm) : undefined}
          >
            <span>{TR.transport.tempo}</span>
            <input
              id="bpm"
              type="number"
              min={20}
              max={400}
              value={bpm}
              disabled={!canPlay}
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                if (Number.isFinite(v) && v >= 20 && v <= 400) onBpm(v);
              }}
            />
            {naturalBpm > 0 && bpm !== naturalBpm && (
              <button
                type="button"
                className="kv-btn kv-btn--tiny"
                title={TR.transport.tempoResetTitle(naturalBpm)}
                onClick={() => onBpm(naturalBpm)}
              >
                {TR.transport.tempoReset}
              </button>
            )}
          </label>

          {/* ⚠ Unlike the kit picker below, this one offers its synthesised option and is NOT gated
              on the usul: an instrument has nothing to do with the rhythm, and the default tone is
              the only thing that plays before a 20–35 MB download finishes, so hiding it would be
              hiding the one choice that always works. `data-voice-state` is how a headless check
              reads the load without matching Turkish copy — and how it can tell a working fallback
              from a broken feature. */}
          <label className={`kv-field${canPlay ? "" : " is-disabled"}`} title={TR.transport.voiceTitle}>
            <span>{TR.transport.voice}</span>
            <select
              id="instrument"
              data-instrument={voice}
              data-voice-state={voiceStatus.state}
              // ⚠ What is actually coming out of the speaker, which is NOT `voice` for the whole of
              // a switch made mid-playback (`webAudioBackend.ensureVoice`). It is the only way a
              // headless check can tell "the old voice bridged the download" from "the new one
              // arrived instantly" — both leave the picker reading the new instrument.
              data-voice-sounding={voiceStatus.sounding}
              value={voice}
              disabled={!canPlay}
              onChange={(e) => onVoice(e.target.value as VoiceId)}
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            {voiceStatus.state === "loading" && (
              <small className="kv-hint">
                {voiceStatus.sounding === "sine"
                  ? TR.transport.voiceLoading(voiceStatus.loaded, voiceStatus.total)
                  : TR.transport.voiceSwitchHeld(
                      voiceStatus.loaded,
                      voiceStatus.total,
                      voiceLabel(voiceStatus.sounding),
                    )}
              </small>
            )}
            {/* ⚠ `sounding`, not `state`, picks the sentence. A failed load leaves the OLD recording
                playing when a switch was bridging one, so the flat "varsayılan sesle çalıyor" was
                true before 2026-09-04 and is now only true when nothing was held. */}
            {voiceStatus.state === "failed" && (
              <small className="kv-hint">
                {voiceStatus.sounding === "sine"
                  ? TR.transport.voiceFailed
                  : TR.transport.voiceFailedHeld(voiceLabel(voiceStatus.sounding))}
              </small>
            )}
          </label>
        </div>
      </div>

      {/* ── Ritim ─────────────────────────────────────────────────────────────────────────── */}
      {/* The usul heads this row rather than the makam's: it is what the metronome and the strokes
          below it are counting, so the two drum controls are its consequences, not its neighbours. */}
      <div className="kv-transport__row">
        <span className="kv-transport__caption">{TR.transport.groupRhythm}</span>
        <div className="kv-transport__items">
          <label className={`kv-field${canPlay ? "" : " is-disabled"}`} title={TR.transport.usulTitle}>
            <span>{TR.transport.usul}</span>
            <select value={usulName} onChange={(e) => onUsul(e.target.value)} disabled={!canPlay}>
              {USULS.map((u) => (
                <option key={u.name} value={u.name}>
                  {u.label} ({u.num}/{u.den})
                </option>
              ))}
            </select>
          </label>

          <label className="kv-toggle">
            <input
              type="checkbox"
              className="kv-toggle__input"
              checked={metronome}
              disabled={!canPlay}
              onChange={(e) => onMetronome(e.target.checked)}
            />
            <span>{TR.transport.metronome}</span>
          </label>

          <label
            className="kv-toggle"
            title={strokeCount ? TR.transport.percussionTitle : TR.transport.percussionUnavailable}
          >
            <input
              id="percussion"
              type="checkbox"
              className="kv-toggle__input"
              data-usul-strokes={strokeCount}
              checked={percussion && strokeCount > 0}
              disabled={!canPlay || strokeCount === 0}
              onChange={(e) => onPercussion(e.target.checked)}
            />
            <span>{TR.transport.percussion}</span>
          </label>

          {/* ⚠ NOT disabled when percussion is off, for the same reason `keepSheet` isn't disabled at
              transpose 0: people set a level and THEN turn the thing on. Dragging it does NOT
              re-schedule playback — it rides a gain node, so it is smooth mid-piece. */}
          <label
            className={`kv-field${canPlay && strokeCount ? "" : " is-disabled"}`}
            title={TR.transport.percussionVolumeTitle}
          >
            <span>{TR.transport.percussionVolume}</span>
            <input
              id="percussion-volume"
              type="range"
              min={0}
              max={200}
              step={5}
              data-percussion-volume={percussionVolume}
              value={Math.round(percussionVolume * 100)}
              disabled={!canPlay || strokeCount === 0}
              onChange={(e) => onPercussionVolume(Number(e.target.value) / 100)}
            />
          </label>

          {/* No "synthesised" option: that sound was rejected by ear (owner, 2026-08-11) and survives
              only as the fallback for a kit that has not downloaded. Offering it would be offering
              something nobody should pick. */}
          <label
            className={`kv-field${canPlay && strokeCount ? "" : " is-disabled"}`}
            title={TR.transport.percussionKitTitle}
          >
            <span>{TR.transport.percussionKit}</span>
            <select
              id="percussion-kit"
              data-percussion-kit={percussionKit}
              value={percussionKit}
              disabled={!canPlay || strokeCount === 0}
              onChange={(e) => onPercussionKit(e.target.value as KitId)}
            >
              {KITS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ── Perde ─────────────────────────────────────────────────────────────────────────── */}
      {/* Everything that decides which pitch is heard or drawn, in the order a reader meets it:
          the makam bends the sound, the transposition moves it, and the accidental mode says how
          the staff prints what is left. The three used to be split across two clusters. */}
      <div className="kv-transport__row">
        <span className="kv-transport__caption">{TR.transport.groupPitch}</span>
        <div className="kv-transport__items">
          <label className={`kv-field${canPlay ? "" : " is-disabled"}`} title={TR.transport.makamTitle}>
            <span>{TR.transport.makam}</span>
            <select
              id="makam-select"
              value={makamSlug}
              onChange={(e) => onMakam(e.target.value)}
              disabled={!canPlay}
            >
              <option value="">{TR.transport.makamNone}</option>
              {makamOptions.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.label}
                  {m.hasIntonation ? " ♪" : ""}
                </option>
              ))}
            </select>
          </label>

          {/* The interval and its mode are ONE control, so they sit in a group with the group's
              tighter gap — 8px against the row's 16px. Without it the mode segmented reads as a
              third, unrelated thing on the row, which is the mistake the checkbox made. */}
          <div className="kv-transport__group">
            <label className="kv-field" title={TR.transport.transposeTitle}>
              <span>{TR.transport.transpose}</span>
              <select value={transpose} onChange={(e) => onTranspose(Number(e.target.value))}>
                {transposeOptions.map(([commas, label]) => (
                  <option key={commas} value={commas}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

          {/* ⚠ TWO SEGMENTS OF THE TRANSPOSITION, not a loose toggle beside it. "Keep the staff"
              is a MODE of transposing and means nothing on its own — a notation program asks the
              same question inside its transpose dialog (sounding pitch vs written pitch), and as a
              checkbox sitting next to the interval it read as an unrelated option.
              ⚠ Still NOT disabled at transpose 0, though it does nothing there: a player picks
              "yalnızca ses" and THEN picks the interval, and a control that only wakes up
              afterwards makes that order impossible. */}
          <Segmented
            value={keepSheet ? "keep" : "move"}
            onChange={(v) => onKeepSheet(v === "keep")}
            items={[
              { value: "move", label: TR.transport.keepSheetMove, title: TR.transport.keepSheetMoveTitle },
              { value: "keep", label: TR.transport.keepSheetKeep, title: TR.transport.keepSheetKeepTitle },
            ]}
          />
          </div>

          <label className="kv-field" title={TR.transport.accidentalsTitle}>
            <span>{TR.transport.accidentals}</span>
            <select
              value={accidentalMode}
              onChange={(e) => onAccidentalMode(e.target.value as AccidentalMode)}
            >
              <option value="every">{TR.transport.accidentalsEvery}</option>
              <option value="keysig">{TR.transport.accidentalsKeysig}</option>
              <option value="measure">{TR.transport.accidentalsMeasure}</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    {/* The same two buttons, pinned to the corner while the real ones are off screen. */}
    <StickyTransport
      anchor={playRef}
      canPlay={canPlay}
      playState={playState}
      onPlayPause={onPlayPause}
      onStop={onStop}
    />
    </>
  );
}

/**
 * ▶ Çal and ■ Dur, pinned to the bottom-right corner once the transport itself has scrolled away
 * (owner, 2026-09-03: *"Çal ve dur tuşu sayfaya yapışık olsun, biz scrolladığımızda kaybolmasın"*).
 *
 * Three decisions worth keeping:
 *
 *  - **Only these two.** Making the whole transport `sticky` was the obvious move and is wrong: it
 *    wraps to two or three rows on a laptop, so it would pin a third of the window and hide the
 *    music it is meant to keep you reading. Tempo, usul and makam are set once, before playing.
 *  - **Only when the real pair is off screen**, watched with an `IntersectionObserver` on the real
 *    `#play` — not a scroll listener (no work per frame), and not a fixed scroll threshold (the
 *    transport's own height changes with the window). With both on screen a second pair would just
 *    be a duplicate control saying the same thing twice.
 *  - **Bottom-right, and it never moves.** The same corner-parking bargain the edit toolbox makes:
 *    a floating box can cover music, and the answer is that it sits in a corner the score does not
 *    use. It is BELOW the toolbox in z-order, because the toolbox is the one you can drag.
 *
 * ⚠ Its state comes from the same props as the real buttons — there is one transport, shown twice.
 * `#play-sticky` carries `data-play-state` like `#play`, so a check must name the one it means.
 */
function StickyTransport({
  anchor,
  canPlay,
  playState,
  onPlayPause,
  onStop,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>;
  canPlay: boolean;
  playState: "stopped" | "playing" | "paused";
  onPlayPause: () => void;
  onStop: () => void;
}) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = anchor.current;
    // ⚠ Both guards are real: the harness renders this view in environments without an observer,
    // and without one the honest answer is "never show it" — a pinned pair that cannot tell whether
    // the real one is visible would sit over the score forever.
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setAway(!!entry && !entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [anchor]);

  if (!away || !canPlay) return null;
  return (
    <div className="kv-mini-transport" id="sticky-transport">
      <button
        id="play-sticky"
        type="button"
        data-play-state={playState}
        className="kv-btn kv-btn--primary"
        onClick={onPlayPause}
      >
        {playState === "playing"
          ? TR.transport.pause
          : playState === "paused"
            ? TR.transport.resume
            : TR.transport.play}
      </button>
      <button
        id="stop-sticky"
        type="button"
        className="kv-btn"
        onClick={onStop}
        disabled={playState === "stopped"}
      >
        {TR.transport.stop}
      </button>
    </div>
  );
}
