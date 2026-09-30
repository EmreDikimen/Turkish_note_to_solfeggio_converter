/**
 * The player bar — always on screen once a score is open, like the "now playing" bar of a music
 * app. (UI rebuild, 2026-09-30.)
 *
 * Left: what is open (the page's name, its makam and usul). Middle: stop, the round play button,
 * the tempo. Right: follow-the-playhead and the settings. On a phone the left side shrinks away and
 * the bar sits above the tab bar.
 *
 * ⚠ Ids are the DOM contract: `#play[data-play-state]`, `#stop`, `#follow-playhead[data-follow]`,
 * `#settings-open` (new; it opens `#transport-settings`). `#transport-pinned` is kept on the bar
 * because it is still the box that stays on screen while the score scrolls.
 * ⚠ It publishes its height as `--player-h` on <html>, so the page leaves room for it at the bottom
 * and the right-hand settings panel stops above it.
 * ⚠ "İmleci takip et" stays a WORD on a real checkbox (`.kv-toggle`), shortened to "Takip": the
 * owner wants it on screen while the page scrolls (2026-09-28), and this bar is the one thing that
 * always is.
 */
import { useEffect, useRef } from "react";
import { Pause, Play, SlidersHorizontal, Square } from "lucide-react";
import { TR } from "../ui/strings";
import { TempoControl } from "./TempoControl";

export function PlayerBar({
  title,
  meta,
  canPlay,
  playState,
  onPlayPause,
  onStop,
  bpm,
  naturalBpm,
  onBpm,
  follow,
  onFollow,
  settingsOpen,
  onSettings,
  phone,
  voice,
  voiceState,
}: {
  /** The voice that plays, mirrored here because the picker lives in the (unmounted) settings
   *  panel — a check reads `#transport-pinned[data-instrument]`. */
  voice: string;
  voiceState: string;
  title: string;
  meta: string;
  canPlay: boolean;
  playState: "stopped" | "playing" | "paused";
  onPlayPause: () => void;
  onStop: () => void;
  bpm: number;
  naturalBpm: number;
  onBpm: (v: number) => void;
  /** Absent where there is nothing to follow (the instrument view draws its own cursor). */
  follow?: boolean;
  onFollow: (v: boolean) => void;
  settingsOpen: boolean;
  onSettings: () => void;
  phone: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const write = () => {
      const h = `${Math.round(el.offsetHeight)}px`;
      document.documentElement.style.setProperty("--player-h", h);
      // The old name, still read by `.kv-card`'s scroll-margin and the measure card.
      document.documentElement.style.setProperty("--pinned-h", "0px");
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--player-h");
      document.documentElement.style.removeProperty("--pinned-h");
    };
  }, []);

  const playing = playState === "playing";
  const playLabel = playing ? TR.transport.pause : playState === "paused" ? TR.transport.resume : TR.transport.play;

  return (
    <div
      ref={ref}
      id="transport-pinned"
      data-instrument={voice}
      data-voice-state={voiceState}
      role="region"
      aria-label={TR.player.label}
      className={
        "kv-player fixed inset-x-0 z-[50] border-t border-rule bg-raised/95 backdrop-blur-md " +
        (phone ? "bottom-(--tabs-h,0px)" : "bottom-0 pb-[env(safe-area-inset-bottom,0px)]")
      }
    >
      {/* the gold hairline along the top edge — the bar is a page's foot rule */}
      <div aria-hidden="true" className="absolute inset-x-0 -top-px h-px bg-linear-to-r from-transparent via-gold/60 to-transparent" />
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center gap-4 px-4 phone:h-[64px] phone:gap-2 phone:px-3">
        {/* what is open */}
        {!phone && (
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-(length:--text-lg) font-semibold leading-tight text-ink">{title}</div>
            <div className="truncate text-(length:--text-xs) text-ink-faint">{meta}</div>
          </div>
        )}

        {/* transport */}
        <div className={`flex items-center gap-2 phone:gap-1 ${phone ? "" : "justify-center"}`}>
          <button
            id="stop"
            type="button"
            onClick={onStop}
            disabled={playState === "stopped"}
            title={TR.transport.stop}
            aria-label={TR.transport.stop}
            className="grid size-(--control-h) appearance-none place-items-center rounded-full border-0 bg-transparent p-0 text-ink-soft transition-colors hover:bg-sunken hover:text-ink disabled:opacity-35 phone:size-10"
          >
            <Square size={16} fill="currentColor" aria-hidden="true" />
          </button>
          <button
            id="play"
            type="button"
            data-play-state={playState}
            onClick={onPlayPause}
            disabled={!canPlay}
            title={playLabel}
            aria-label={playLabel}
            className="grid size-12 shrink-0 appearance-none place-items-center rounded-full border-0 p-0 bg-accent bg-linear-to-b from-white/10 to-transparent text-accent-on shadow-(--shadow-card) ring-1 ring-gold/40 transition-transform hover:bg-accent-hover active:scale-95 disabled:opacity-40"
          >
            {playing ? (
              <Pause size={22} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={22} fill="currentColor" className="translate-x-px" aria-hidden="true" />
            )}
          </button>
        </div>

        <TempoControl bpm={bpm} naturalBpm={naturalBpm} onBpm={onBpm} disabled={!canPlay} compact={phone} />

        <div className={`flex items-center gap-2 phone:gap-1 ${phone ? "ml-auto" : "flex-1 justify-end"}`}>
          {follow !== undefined && (
            <label className="kv-toggle" title={TR.card.followTitle}>
              <input
                id="follow-playhead"
                type="checkbox"
                className="kv-toggle__input"
                data-follow={follow ? "on" : "off"}
                checked={follow}
                onChange={(e) => onFollow(e.target.checked)}
              />
              <span>{phone ? TR.player.follow : TR.card.follow}</span>
            </label>
          )}
          <button
            id="settings-open"
            type="button"
            onClick={onSettings}
            aria-expanded={settingsOpen}
            aria-controls="settings-panel"
            title={TR.player.settingsTitle}
            className={
              "flex h-(--control-h) shrink-0 appearance-none items-center gap-2 rounded-(--radius) border-0 bg-transparent px-3 text-(length:--text-sm) font-medium transition-colors phone:px-2 " +
              (settingsOpen ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-sunken hover:text-ink")
            }
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            {!phone && <span>{TR.player.settings}</span>}
            {phone && <span className="kv-visually-hidden">{TR.player.settings}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
