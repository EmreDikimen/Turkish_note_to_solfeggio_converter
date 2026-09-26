/**
 * Full screen on a phone — the music, the whole screen, and nothing else.
 *
 * WHY (owner, 2026-09-11: *"kullanıcı sayfayı isterse tam ekran yapabilsin, width olarak tam
 * sığsın, yan çevirmesi de dahil"*). Even with the tab layout, the Nota tab spends its top ~130px
 * on the transport and the card's head, and the engraving is wider than any phone, so reading
 * along means dragging the sheet sideways with one hand while it plays. Full screen answers both:
 * everything but the score is hidden, and App re-engraves the page to the screen's width.
 *
 * ⚠ **FIT IS A RE-ENGRAVE, NOT A ZOOM.** `.kv-score` may never be scaled — that SVG is the source
 * the training strips are cut from, and `render.ts` screenshots it by rect (docs/APP-RULES.md).
 * The width comes from `SheetView`'s own `contentWidth` prop, the same knob the measure card uses:
 * fewer bars per system, notes the same size. Which is also why landscape needs no special case —
 * the page is re-engraved at whatever width the screen now is.
 *
 * ⚠ **It is not the Fullscreen API.** `requestFullscreen` does not exist on iPhone Safari, so a
 * button that promised the browser's own chrome would go away would be a button that does nothing
 * on half the phones this is for. This hides the app's own furniture, which works everywhere.
 *
 * ⚠ **The page stays the only vertical scroller.** Nothing here gains an `overflow` — the playhead
 * follow depends on that (docs/APP-RULES.md), and following the music is most of the point of
 * reading full screen.
 *
 * ⚠ **The way IN is not here.** `#fullscreen-on` is a button in the score card's own tools
 * (`ui/ScoreCard.tsx`), moved there 2026-09-26: it used to be a row at the end of the page, which
 * only worked while it was shown on the short Çal tab. This file is the way OUT and the transport
 * that replaces the hidden one.
 *
 * The contract: `#fullscreen-on` (in the card), and in the bar `#fs-play[data-play-state]`,
 * `#fs-stop`, `#fs-exit`. ⚠ `#play` / `#stop` keep meaning the PAGE's transport — a check must say which
 * pair it means, exactly as it already must for `#palette-play` (docs/DOM-CONTRACT.md).
 */
import { TR } from "./strings";

/**
 * The way OUT, and the transport that replaces the hidden one: Çal / Dur / Çık, bottom right.
 *
 * ⚠ Bottom RIGHT and small, because the alternative — a bar across the bottom — is the furniture
 * this mode exists to remove. Choosing where to play from is not this bar's job: tapping a bar in
 * the score already seeks AND starts (`onSeekMs` in App), which is the gesture the owner asked to
 * keep working here.
 */
export function FullScreenBar({
  playState,
  canPlay,
  onPlayPause,
  onStop,
  onExit,
}: {
  playState: "stopped" | "playing" | "paused";
  canPlay: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onExit: () => void;
}) {
  return (
    <div className="kv-fsbar" id="fullscreen-bar">
      <button
        id="fs-play"
        type="button"
        className="kv-btn kv-btn--primary kv-fsbar__btn"
        data-play-state={playState}
        disabled={!canPlay}
        onClick={onPlayPause}
        title={playState === "playing" ? TR.transport.pause : TR.transport.play}
      >
        {playState === "playing" ? "⏸" : "▶"}
      </button>
      <button
        id="fs-stop"
        type="button"
        className="kv-btn kv-fsbar__btn"
        disabled={playState === "stopped"}
        onClick={onStop}
        title={TR.transport.stop}
      >
        ■
      </button>
      <button
        id="fs-exit"
        type="button"
        className="kv-btn kv-fsbar__btn kv-fsbar__btn--exit"
        onClick={onExit}
        title={TR.mobile.fullscreenExitTitle}
      >
        ✕
      </button>
    </div>
  );
}
