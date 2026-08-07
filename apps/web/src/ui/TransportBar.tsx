/**
 * The six controls a musician actually touches while listening: play, stop, tempo, metronome,
 * usul, makam.
 *
 * Everything else the app can do lives in the score card's head (what is on screen) or the
 * Gelişmiş panel (developer settings). This bar is deliberately short — it is the only chrome
 * between the upload and the score.
 *
 * `#play` carries `data-play-state` and `#stop` its id because the deploy checks drive them; the
 * LABELS are copy and are free to change. See apps/web/src/ui/status.ts for the reasoning.
 */

import { USULS, type MakamOption } from "@turkish-omr/core";
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
  usulName,
  onUsul,
  makamSlug,
  onMakam,
  makamOptions,
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
  usulName: string;
  onUsul: (v: string) => void;
  makamSlug: string;
  onMakam: (slug: string) => void;
  makamOptions: readonly MakamOption[];
}) {
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
    </div>
  );
}
