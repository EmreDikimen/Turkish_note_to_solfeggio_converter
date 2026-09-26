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
 * ⚠ **Çalma is PINNED TO THE TOP OF THE PAGE and the other two are not** (owner, 2026-09-05:
 * *"aşağı kaydırdıkça kaybolmasın, sayfanın üstünde sabitlensin"*). That is why the bar is TWO
 * boxes in the DOM and not one: `position: sticky` is bounded by the element's own parent, so a
 * row inside a three-row box can only travel that box's ~190px. The pinned row is therefore its
 * own `.kv-transport`, a direct child of `.kv-page`, which spans the whole document — so it rides
 * the entire score. ⚠ Both boxes keep the `kv-transport` class: every control size, select width
 * and phone rule in `app.css` is scoped to it, and a bare wrapper would drop them all.
 * ⚠ Ritim and Perde deliberately stay in the flow. They are set once, before playing; pinning all
 * three would hold a third of the window over the music this is meant to keep you reading.
 *
 * `#play` carries `data-play-state` and `#stop` its id because the deploy checks drive them; the
 * LABELS are copy and are free to change. See apps/web/src/ui/status.ts for the reasoning.
 * `data-play-state` also names `#palette-play` in the editor's toolbox — a check must say which
 * one it means.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { findUsul, USULS, type MakamOption, type MakamRuleUse } from "@turkish-omr/core";
import { KITS, type KitId } from "../audio/strokeKits";
import { VOICES, type VoiceId } from "../audio/instruments";
import type { VoiceStatus } from "../webAudioBackend";
import type { AccidentalMode } from "../SheetView";
import { Segmented } from "./Segmented";
import { MakamIntonation } from "./MakamIntonation";
import { TR } from "./strings";

/** The tempo box's range. ⚠ ONE pair of numbers for the `min`/`max` attributes AND the commit
 *  guard below — they were written twice and a guard that disagrees with the attribute is a box
 *  that rejects what it advertises. */
const BPM_MIN = 20;
const BPM_MAX = 400;

/** How long a finger must rest on ± before it starts repeating, and how fast it then repeats. */
const STEP_HOLD_MS = 450;
const STEP_REPEAT_MS = 110;

/**
 * One of the tempo box's ± buttons. Steps once on a tap and keeps stepping while held.
 *
 * ⚠ **IT REPORTS THE STEPS AND NOT THE VALUE, AND THE PARENT COMMITS ON RELEASE** — because
 * `WebAudioBackend.play()` re-schedules the WHOLE timeline and builds fresh gain nodes every call,
 * so committing on each repeat tick would re-schedule playback nine times a second. The number
 * under the finger moves on every tick (it is the draft); the SOUND changes once, when the finger
 * lifts. A tap lifts immediately, so a tap still feels instant.
 *
 * ⚠ `onPointerDown`, not `onClick`: a hold has to start before the finger comes up. Pointer capture
 * is what guarantees the matching up event even if the finger slides off the button — without it a
 * slide would leave the interval running forever.
 *
 * ⚠ `onStep`/`onEnd` are read through a ref. They close over the current tempo and are rebuilt
 * every render, and an interval captures whatever it was given ONCE — so calling the prop directly
 * would keep adding to the tempo as it was when the finger landed, i.e. the value would move by one
 * and then stick.
 */
function StepButton({
  id,
  dir,
  label,
  title,
  disabled,
  onStep,
  onEnd,
}: {
  id: string;
  dir: 1 | -1;
  label: string;
  title: string;
  disabled: boolean;
  onStep: (dir: number) => void;
  onEnd: () => void;
}) {
  const live = useRef({ onStep, onEnd });
  live.current = { onStep, onEnd };
  const timers = useRef<{ hold?: number; repeat?: number }>({});

  const stop = useCallback(() => {
    const t = timers.current;
    if (t.hold != null) window.clearTimeout(t.hold);
    if (t.repeat != null) window.clearInterval(t.repeat);
    timers.current = {};
  }, []);

  // ⚠ A button can be unmounted mid-hold — `canPlay` flips when a score is replaced — and an
  // interval outliving its button would go on stepping a tempo nobody is touching.
  useEffect(() => stop, [stop]);

  const end = useCallback(() => {
    stop();
    live.current.onEnd();
  }, [stop]);

  return (
    <button
      id={id}
      type="button"
      className="kv-btn kv-step"
      data-step={dir > 0 ? "up" : "down"}
      title={title}
      disabled={disabled}
      aria-label={title}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        // No focus steal, no text selection, and no scroll started from the button.
        e.preventDefault();
        live.current.onStep(dir);
        timers.current.hold = window.setTimeout(() => {
          timers.current.repeat = window.setInterval(() => live.current.onStep(dir), STEP_REPEAT_MS);
        }, STEP_HOLD_MS);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      {label}
    </button>
  );
}

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
  makamUsage,
  transpose,
  transposeOptions,
  onTranspose,
  keepSheet,
  onKeepSheet,
  accidentalMode,
  pitchOpen,
  onPitch,
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
  /** The chosen makam's rules against THIS score, for the line beside the picker. */
  makamUsage: readonly MakamRuleUse[];
  /** Transposition in commas. 0 is the score as written. */
  transpose: number;
  transposeOptions: readonly (readonly [number, string])[];
  onTranspose: (commas: number) => void;
  /** Transposing instruments: move the SOUND, leave the staff where it is. */
  keepSheet: boolean;
  onKeepSheet: (v: boolean) => void;
  accidentalMode: AccidentalMode;
  /** Phone, Nota tab only: is the Perde section expanded? Undefined everywhere else. */
  pitchOpen?: boolean;
  /** Phone, Nota tab only: expand/collapse it. Undefined means the section is not foldable. */
  onPitch?: () => void;
  onAccidentalMode: (m: AccidentalMode) => void;
}) {
  // How many strokes the SELECTED usul has. 0 means its pattern has not been written yet
  // (packages/core/src/usul.ts) — the checkbox says so instead of silently playing nothing, and
  // `data-usul-strokes` is how a headless check reads that without matching the sentence.
  const strokeCount = findUsul(usulName)?.strokes?.length ?? 0;
  // How tall the pinned row is, published to CSS as `--pinned-h`. Only one thing reads it — the
  // voice toast, which is `fixed` at the top-centre and would otherwise land on Çal and Dur. It is
  // measured rather than guessed because the row wraps: one line on a wide window, three on a
  // phone. ⚠ A ResizeObserver, not a scroll listener — this changes when the WINDOW changes, not
  // when the reader scrolls.
  /** What the reader is TYPING in the tempo box, or null to show the tempo that is set.
   *
   *  ⚠ It exists so half-typed values survive a render — see the box's own comment. Cleared on
   *  blur, which is also what makes the ⟲ reset button and a newly loaded score show through: both
   *  move focus or replace the document, and neither leaves a draft behind. */
  const [bpmDraft, setBpmDraft] = useState<string | null>(null);
  /** ⚠ The same draft, readable without a re-render. The ± buttons step from the value ALREADY on
   *  screen and commit it when the finger lifts, and both run from a pointer handler that would
   *  otherwise read whatever the draft was when the hold began. */
  const draftRef = useRef<string | null>(null);
  const setDraft = useCallback((v: string | null) => {
    draftRef.current = v;
    setBpmDraft(v);
  }, []);

  /** The tempo the ± buttons count from: what is on screen if it is usable, else what is playing. */
  const shownBpm = useCallback(() => {
    const d = Math.round(Number(draftRef.current));
    return draftRef.current != null && Number.isFinite(d) ? d : bpm;
  }, [bpm]);

  const stepBpm = useCallback(
    (dir: number) => {
      const next = Math.min(BPM_MAX, Math.max(BPM_MIN, shownBpm() + dir));
      setDraft(String(next));
    },
    [shownBpm, setDraft],
  );

  /** The finger lifted: the number on screen becomes the tempo that plays. */
  const commitStep = useCallback(() => {
    const v = Math.round(Number(draftRef.current));
    setDraft(null);
    if (Number.isFinite(v) && v >= BPM_MIN && v <= BPM_MAX && v !== bpm) onBpm(v);
  }, [bpm, onBpm, setDraft]);

  const pinnedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pinnedRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const write = () =>
      document.documentElement.style.setProperty("--pinned-h", `${Math.round(el.offsetHeight)}px`);
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--pinned-h");
    };
  }, []);

  /** The fold's handle. Built once and mounted either above or below the settings — see there. */
  const foldHandle = (
    <button
      id="pitch-toggle"
      type="button"
      className="kv-transport__more"
      aria-expanded={!!pitchOpen}
      aria-controls="transport-settings"
      onClick={onPitch}
    >
      <span className="kv-transport__more-label">
        {pitchOpen ? TR.mobile.settingsLess : TR.mobile.settingsMore}
      </span>
      {/* ⚠ A drawn chevron, not the "▾" character: a glyph is whatever the reader's font decides —
          weight, size and baseline all move — where a 2px stroke with round caps is the same mark
          on every phone, and `currentColor` makes it follow the label. Inline SVG for the reason
          the tab bar's icons are (`ui/MobileTabs.tsx`): borrowing Bravura would tie this to the
          score's font rules. It TURNS rather than being swapped for a second glyph. */}
      <svg
        className="kv-transport__more-chev"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M6 9.5l6 6 6-6" />
      </svg>
    </button>
  );

  return (
    <>
    {/* ── Çalma — PINNED (see the note at the top of this file) ─────────────────────────────── */}
    <div className="kv-transport kv-transport--pinned" id="transport-pinned" ref={pinnedRef}>
      <div className="kv-transport__row">
        <span className="kv-transport__caption">{TR.transport.groupPlay}</span>
        <div className="kv-transport__items">
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
            className={`kv-field kv-field--tempo${canPlay ? "" : " is-disabled"}`}
            title={naturalBpm ? TR.transport.tempoTitle(naturalBpm) : undefined}
          >
            <span>{TR.transport.tempo}</span>
            {/* ⚠ **A CONTROLLED NUMBER BOX MUST ACCEPT THE HALF-TYPED STATES, OR IT CANNOT BE
                TYPED IN AT ALL** (owner, 2026-09-26: *"telefonda parça hızını değiştiremiyorum,
                input kutusuna bir şey yazamıyorum"*). This used to commit straight from the event
                and render `value={bpm}`, so every keystroke that passed through an out-of-range
                value was refused and the box snapped back: from 80 you could not reach 120,
                because the first keystroke is "1"; you could not clear it, because "" is 0; and
                once it held 180 you could not add a digit, because 1802 is over 400. Measured with
                a probe at 375×667 — "1" gave 180, then "2" and "0" changed nothing.
                ⚠ It looked like a TOUCH bug and was not. A desktop number input has spinner
                arrows, which only ever produce in-range values, so the box worked there by
                accident; a phone has no arrows, so the same field is read-only in practice.
                ⭐ The draft is what the reader is typing; `bpm` is what plays. A valid draft
                commits as it is typed (so the tempo still follows the box live), an invalid one is
                simply not committed, and BLUR drops the draft so the box goes back to showing the
                tempo that is actually set — no silent half-edit left on screen. */}
            {/* ⚠ FLANKING the box, not stacked beside it (owner, 2026-09-26: *"yanına artırıp
                azaltabileceğim oklar da ekle"*). − left, + right, reading order, each a full
                `--control-h` square so it is a 44px target under a finger. They replace the OS
                spinner rather than joining it — see the stylesheet: two sets of arrows on one box
                is the "half the controls speak macOS" problem the 2026-09-03 control pass removed.
                ⚠ A `<button>` inside a `<label>` is interactive content, so the label does NOT
                forward the tap to the input — holding + does not pop the keyboard. Same reason the
                ⟲ below has always been safe here. */}
            <StepButton
              id="bpm-down"
              dir={-1}
              label="−"
              title={TR.transport.tempoDown}
              disabled={!canPlay || shownBpm() <= BPM_MIN}
              onStep={stepBpm}
              onEnd={commitStep}
            />
            <input
              id="bpm"
              type="number"
              // The plain digit pad on a phone, rather than the full numeric keyboard.
              inputMode="numeric"
              min={BPM_MIN}
              max={BPM_MAX}
              value={bpmDraft ?? String(bpm)}
              disabled={!canPlay}
              onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                const v = Math.round(Number(raw));
                if (raw.trim() !== "" && Number.isFinite(v) && v >= BPM_MIN && v <= BPM_MAX) onBpm(v);
              }}
              onBlur={() => setDraft(null)}
            />
            <StepButton
              id="bpm-up"
              dir={1}
              label="+"
              title={TR.transport.tempoUp}
              disabled={!canPlay || shownBpm() >= BPM_MAX}
              onStep={stepBpm}
              onEnd={commitStep}
            />
            {/* ⚠ **IT KEEPS ITS PLACE WHEN IT HAS NOTHING TO DO** (owner, 2026-09-26: *"metronom
                120 olduğunda Çal/Duraklat kısmının sağında oluyor ama değiştirdiğimde alta iniyor…
                hep sağında kalsın"*). It used to be mounted only when the tempo differed from the
                written one, so the tempo group grew by this button's 18px plus a gap AT THE MOMENT
                the tempo was changed — and on a 393px phone that pushed the whole group onto a
                second line, under Çal/Dur, exactly while the reader was looking at it. Reserving
                the space is what makes the row a fixed width: the jump cannot happen if nothing
                appears. The shrinking beside it (`app.css`) is what then makes that fixed width
                fit on one line.
                ⚠ Hidden with `visibility`, not `display`, because `display: none` gives the space
                back and brings the jump with it. `disabled` + `aria-hidden` + `tabIndex={-1}` keep
                it out of the tab order and off a screen reader while it is not a control. */}
            {naturalBpm > 0 && (
              <button
                type="button"
                className="kv-btn kv-btn--tiny kv-tempo-reset"
                title={TR.transport.tempoResetTitle(naturalBpm)}
                onClick={() => onBpm(naturalBpm)}
                disabled={bpm === naturalBpm}
                aria-hidden={bpm === naturalBpm}
                tabIndex={bpm === naturalBpm ? -1 : undefined}
                data-idle={bpm === naturalBpm ? "1" : undefined}
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
          {/* ⚠ The id is the phone layout's handle on it: the voice is set ONCE before playing, so
              on a phone it belongs to the Çal tab and not over the music. Nothing else reads it. */}
          <label
            id="voice-field"
            className={`kv-field${canPlay ? "" : " is-disabled"}`}
            title={TR.transport.voiceTitle}
          >
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
    </div>

    {/* ⚠ The id is what the phone's tab layout hides — Ritim and Perde are the Çal tab, while the
        PINNED box above stays on screen in every tab that can play (`app.css`, the `[data-mtab]`
        rules). A structural `.kv-transport--pinned + .kv-transport` selector would have done the
        same job and broken silently the day a third box appeared. */}
    {/* ⚠ **THE HANDLE SITS UNDER ÇAL / DUR / TEMPO WHEN SHUT, AND UNDER THE SETTINGS WHEN OPEN**
        (owner, 2026-09-26: *"Çal/Dur ve metronom hızının olduğu yerin hemen altı genişletilebilir
        olsun"*, then *"tıkladığımızda ayarları gizle kısmı altta kalmalı"*). What it opens is
        everything the Çal tab used to be. Closing it is the last thing you do after reading down a
        515px stack, so the way out waits at the bottom where the thumb already is — rather than
        making you scroll back up past what you just set.
        ⚠ Two mount points, never two buttons: one is rendered at a time, so `#pitch-toggle` stays a
        single id and there is no state to keep in step.
        ⛔ The settings are NOT shown open: measured at 393px that is 515px of controls, and on an
        800px screen it leaves no music at all. Folded, the cost is this one row.
        ⚠ Rendered only where it is needed — `App` passes the handler on a phone's Nota tab and
        nowhere else, so every wide window shows the settings open exactly as before. */}
    {onPitch && !pitchOpen && foldHandle}

    <div className="kv-transport" id="transport-settings">
      {/* ⚠ A wrapper that is `display: contents` everywhere but the phone's fold, so it changes no
          layout: the rows stay flex items of `.kv-transport`. The fold animates ONE grid row from
          0fr to 1fr, and two siblings cannot collapse together without something to hold them. */}
      <div className="kv-transport__body">
      {/* ── Ritim ─────────────────────────────────────────────────────────────────────────── */}
      {/* The usul heads this row rather than the makam's: it is what the metronome and the strokes
          below it are counting, so the two drum controls are its consequences, not its neighbours. */}
      {/* ⚠ The two rows carry ids so the phone can show them on DIFFERENT tabs (2026-09-26). Ritim
          is a sound setting and stays on Çal; Perde below is on Çal AND on Nota — see the id. */}
      <div className="kv-transport__row" id="row-rhythm">
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
      {/* ⚠ **PERDE IS ON THE NOTA TAB TOO** (owner, 2026-09-26, asking for the accidental dropdown,
          then transposition, then makam — which is this whole row). All three decide what the page
          you are looking at SAYS and SOUNDS: the makam bends its perdes, the transposition moves
          it, and the accidental mode is pure notation — how the staff is written. You choose them
          with the score in front of you, not on a settings screen.
          ⚠ ONE element shown on two tabs, never a copy: the tab rules hide and show, so nothing is
          duplicated and there is no second control to keep in step. */}
      <div className="kv-transport__row" id="row-pitch">
        <span className="kv-transport__caption">{TR.transport.groupPitch}</span>
        <div className="kv-transport__items">
          {/* ⚠ The picker and its footnote are ONE group, like the transposition below: the ♪ in
              the list says something moves without saying what, and the answer to that is only an
              answer while it is beside the control that raised the question. It also has to be
              able to WRAP away from the row (`.kv-makam`) — it is prose, and the row's other items
              are fixed-width controls that cannot give way for it. */}
          <div className="kv-transport__group">
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
            <MakamIntonation slug={makamSlug} usage={makamUsage} />
          </div>

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
    </div>

    {onPitch && pitchOpen && foldHandle}
    </>
  );
}
