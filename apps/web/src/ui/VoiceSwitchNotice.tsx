/**
 * The floating notice that says an instrument voice is being downloaded, and what is sounding
 * meanwhile (owner, 2026-09-04).
 *
 * ⚠ **It exists because the switch cannot be made instant and the wait had no voice.** Choosing an
 * instrument starts a 10–35 MB download — 11 files for the clarinet, 15 for the violin, 36 for the
 * kanun, fetched one at a time (`loadInstrument.ts`) — and until 2026-09-04 the music dropped to the
 * synthesised tone for the whole of it. `ensureVoice` now keeps the old recording sounding instead,
 * so the only thing left to fix was that nothing on screen explained the delay: the picker already
 * showed the new instrument's name while the old one was still coming out of the speakers, which
 * reads as the app ignoring the click.
 *
 * ⚠ **Three rules it must not break.**
 * 1. **It says what is SOUNDING, never what the picker shows.** Both are in `VoiceStatus`, and they
 *    disagree for the whole of a switch — that disagreement IS the message. Reading `voice` here
 *    would print "Klarnet sesiyle çalıyor" over a violin.
 * 2. **It renders outside `#omr-status`.** Its counter ticks, and `page-smoke` proves the page's
 *    read progress moved by counting DISTINCT texts inside that element — a second ticking number
 *    in there would make that count meaningless (CLAUDE.md).
 * 3. **It is `position: fixed` and rendered from `App`**, for the reason the edit toolbox is: a
 *    `.kv-card` ancestor sets `overflow: hidden`, and one that ever gained a transform or a filter
 *    would become the containing block for anything fixed inside it and clip the notice to the
 *    paper. It sits at the TOP of the viewport because the bottom is taken twice over — by the
 *    pinned transport (`.kv-mini-transport`) and, on a phone, by the docked toolbox.
 *
 * The DOM contract, as everywhere else in this app, is attributes rather than the Turkish copy:
 * `#voice-notice[data-omr="voice-switch"]` carries `data-voice-to`, `data-voice-sounding`,
 * `data-voice-state` and the counts, so a headless check can read WHICH voice is being heard during
 * a switch without matching a single word (CLAUDE.md's deploy-check rule).
 */
import { useEffect, useRef, useState } from "react";
import { VOICES, type VoiceId } from "../audio/instruments";
import type { VoiceStatus } from "../webAudioBackend";
import { TR } from "./strings";

/** How long the "hazır" / "indirilemedi" line stays up before the notice takes itself away. */
const SETTLED_MS = 3200;

function labelOf(id: VoiceId): string {
  return VOICES.find((v) => v.id === id)?.label ?? id;
}

export function VoiceSwitchNotice({ status }: { status: VoiceStatus }) {
  /**
   * Which phase to draw. Deliberately NOT `status.state` itself: "ready" is the resting state of
   * every loaded voice, so drawing on it alone would leave a confirmation pinned to the screen for
   * the rest of the session. Only a load this component actually WATCHED start earns an outcome.
   */
  const [phase, setPhase] = useState<"hidden" | "loading" | "settled">("hidden");
  /** Frozen at the moment the outcome lands, so the fading line cannot re-render into a later load. */
  const [settled, setSettled] = useState<{ text: string; failed: boolean } | null>(null);
  /** The voice this component last saw a load START for — the guard behind "watched" above. */
  const watching = useRef<VoiceId | null>(null);
  /** Set when the reader closes the notice, so the same load cannot put it back on the next tick. */
  const dismissed = useRef<VoiceId | null>(null);

  const { voice, sounding, state, loaded, total } = status;

  useEffect(() => {
    if (state === "loading") {
      watching.current = voice;
      // A NEW load re-opens a notice the reader closed for the previous one; the same load does not.
      if (dismissed.current !== voice) setPhase("loading");
      return;
    }
    // Anything else is an outcome, and it is only ours if we saw its load begin.
    if (watching.current !== voice) return;
    watching.current = null;
    if (dismissed.current === voice) return;
    setSettled(
      state === "failed"
        ? {
            // ⚠ `sounding` is what decides the wording, not `state`: a failed load leaves the OLD
            // recording playing when there was one to keep, and only falls to the built-in tone when
            // there was not. One `state`, two different true sentences.
            text:
              sounding === "sine"
                ? TR.transport.voiceFailed
                : TR.transport.voiceFailedHeld(labelOf(sounding)),
            failed: true,
          }
        : { text: TR.transport.voiceSwitchReady(labelOf(voice)), failed: false },
    );
    setPhase("settled");
  }, [voice, sounding, state]);

  // The outcome line takes itself away. Keyed on the phase AND the text, so a second switch that
  // settles while the first line is still up restarts the clock instead of inheriting its remainder.
  useEffect(() => {
    if (phase !== "settled") return;
    const t = setTimeout(() => setPhase("hidden"), SETTLED_MS);
    return () => clearTimeout(t);
  }, [phase, settled]);

  if (phase === "hidden") return null;

  const switching = phase === "loading";
  return (
    <div
      id="voice-notice"
      className={`kv-voice-notice${settled?.failed && !switching ? " is-failed" : ""}`}
      data-omr="voice-switch"
      data-voice-to={voice}
      data-voice-sounding={sounding}
      data-voice-state={state}
      data-voice-loaded={loaded}
      data-voice-total={total}
      // `polite`, not `assertive`: it is progress, and a screen reader must not be interrupted by a
      // counter. The counts live in attributes, so only the two sentences are ever announced.
      role="status"
      aria-live="polite"
    >
      <div className="kv-voice-notice__text">
        {switching ? (
          <>
            <strong>{TR.transport.voiceSwitchTitle(labelOf(voice))}</strong>
            <small>
              {/* ⚠ Only when something is actually being heard. Switching FROM the built-in tone is
                  the ordinary first pick, and "şimdilik varsayılan sesle çalıyor" there would be
                  telling a reader that nothing changed — which is the opposite of the news. */}
              {sounding === "sine"
                ? TR.transport.voiceLoading(loaded, total)
                : TR.transport.voiceSwitchHeld(loaded, total, labelOf(sounding))}
            </small>
          </>
        ) : (
          <strong>{settled?.text}</strong>
        )}
      </div>
      <button
        type="button"
        className="kv-voice-notice__close"
        title={TR.transport.voiceSwitchDismiss}
        aria-label={TR.transport.voiceSwitchDismiss}
        onClick={() => {
          dismissed.current = voice;
          setPhase("hidden");
        }}
      >
        ✕
      </button>
    </div>
  );
}
