/**
 * The controls a musician actually touches, in two clusters separated by a rule.
 *
 *  - **Listening:** play, stop, tempo, metronome, usul, makam.
 *  - **Reading:** transposition, keep-the-staff, and which accidentals the staff prints.
 *
 * The reading three moved up from `Gelişmiş` on 2026-08-08 (owner): they change what a player sees
 * and hears, which is not a developer setting — a ney player transposing a score is using the app
 * exactly as intended, and having to open a panel called "geliştirici ayarları" to do it said the
 * opposite. What stays down there is genuinely for the project: sample/JSON loading, the strip
 * exporter, the repeat preview.
 *
 * `#play` carries `data-play-state` and `#stop` its id because the deploy checks drive them; the
 * LABELS are copy and are free to change. See apps/web/src/ui/status.ts for the reasoning.
 */

import { findUsul, USULS, type MakamOption } from "@turkish-omr/core";
import { KITS, type KitId } from "../audio/strokeKits";
import type { AccidentalMode } from "../SheetView";
import { TR } from "./strings";

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

  return (
    <div className="kv-transport">
      <div className="kv-transport__group">
        <button
          id="play"
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

      <label className={`kv-field${canPlay ? "" : " is-disabled"}`}>
        <input
          type="checkbox"
          checked={metronome}
          disabled={!canPlay}
          onChange={(e) => onMetronome(e.target.checked)}
        />
        <span>{TR.transport.metronome}</span>
      </label>

      <label
        className={`kv-field${canPlay && strokeCount ? "" : " is-disabled"}`}
        title={strokeCount ? TR.transport.percussionTitle : TR.transport.percussionUnavailable}
      >
        <input
          id="percussion"
          type="checkbox"
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

      {/* The reading cluster, wrapped as a GROUP so the three stay together when the bar wraps —
          they read as one thought, and interleaving them with the listening controls on a narrow
          window would lose that. ⚠ A vertical rule between the clusters was tried and removed: when
          the row wraps it is left dangling at the end of a line, which reads as a mistake. */}
      <div className="kv-transport__group kv-transport__group--reading">
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

        {/* ⚠ NOT disabled at transpose 0, though it does nothing there: a player ticks "keep the
            staff" and THEN picks the interval, and a checkbox that only wakes up afterwards makes
            that order impossible. */}
        <label className="kv-field" title={TR.transport.keepSheetTitle}>
          <input type="checkbox" checked={keepSheet} onChange={(e) => onKeepSheet(e.target.checked)} />
          <span>{TR.transport.keepSheet}</span>
        </label>

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
  );
}
