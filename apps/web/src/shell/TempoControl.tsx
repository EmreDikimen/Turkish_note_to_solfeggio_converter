/**
 * The tempo: − , the number, + , and ⟲ back to the written tempo. Moved out of the old
 * TransportBar in the UI rebuild (2026-09-30) with its behaviour intact — every rule below was paid
 * for once.
 *
 * ⭐ THE BOX HOLDS A DRAFT WHILE IT IS BEING TYPED (owner, 2026-09-26: *"telefonda parça hızını
 * değiştiremiyorum"*). Committing straight from the event made the box refuse every keystroke that
 * passed through an out-of-range value — from 80 you could not reach 120, because the first
 * keystroke is "1". The draft is what the reader types; `bpm` is what plays. A valid draft commits
 * as it is typed, an invalid one is not, and BLUR drops the draft.
 *
 * ⭐ − AND + REPEAT WHILE HELD, AND COMMIT ON RELEASE: a held + moves only the number on screen, so
 * a long press is one re-schedule of playback, not thirty. `touch-action: none` on the buttons is
 * load-bearing — a thumb resting on + would otherwise start a page scroll. A `<button>` is not
 * inside a `<label>` here, so holding + never pops the keyboard.
 *
 * ⚠ The ⟲ is always LAID OUT and hidden with `visibility` when idle, so changing the tempo never
 * changes the group's width (it used to push the whole group onto a second line on a phone).
 *
 * Ids are the DOM contract: `#bpm`, `#bpm-down`, `#bpm-up`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { TR } from "../ui/strings";

export const BPM_MIN = 20;
export const BPM_MAX = 400;
const STEP_HOLD_MS = 450;
const STEP_REPEAT_MS = 110;

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
  // Latest callbacks in a ref: the repeat interval outlives the render that started it.
  const live = useRef({ onStep, onEnd });
  live.current = { onStep, onEnd };
  const timers = useRef<{ hold?: number; repeat?: number }>({});
  const stop = useCallback(() => {
    const t = timers.current;
    if (t.hold != null) window.clearTimeout(t.hold);
    if (t.repeat != null) window.clearInterval(t.repeat);
    timers.current = {};
  }, []);
  useEffect(() => stop, [stop]);
  const end = useCallback(() => {
    stop();
    live.current.onEnd();
  }, [stop]);

  return (
    <button
      id={id}
      type="button"
      data-step={dir > 0 ? "up" : "down"}
      title={title}
      aria-label={title}
      disabled={disabled}
      className="grid size-(--control-h) touch-none appearance-none border-0 bg-transparent p-0 phone:size-9 place-items-center rounded-full text-lg leading-none text-ink-soft transition-colors select-none hover:bg-sunken hover:text-ink disabled:opacity-40"
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
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

export function TempoControl({
  bpm,
  naturalBpm,
  onBpm,
  disabled,
  compact = false,
}: {
  bpm: number;
  naturalBpm: number;
  onBpm: (v: number) => void;
  disabled: boolean;
  /** The phone's player bar: no ⟲ (it lives in the settings sheet there) and no caption. */
  compact?: boolean;
}) {
  const [bpmDraft, setBpmDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const setDraft = useCallback((v: string | null) => {
    draftRef.current = v;
    setBpmDraft(v);
  }, []);
  const shownBpm = useCallback(() => {
    const d = Math.round(Number(draftRef.current));
    return draftRef.current != null && Number.isFinite(d) ? d : bpm;
  }, [bpm]);
  const stepBpm = useCallback(
    (dir: number) => setDraft(String(Math.min(BPM_MAX, Math.max(BPM_MIN, shownBpm() + dir)))),
    [shownBpm, setDraft],
  );
  const commitStep = useCallback(() => {
    const v = Math.round(Number(draftRef.current));
    setDraft(null);
    if (Number.isFinite(v) && v >= BPM_MIN && v <= BPM_MAX && v !== bpm) onBpm(v);
  }, [bpm, onBpm, setDraft]);

  return (
    <div
      className="kv-tempo flex items-center gap-0.5"
      title={naturalBpm ? TR.transport.tempoTitle(naturalBpm) : undefined}
      data-disabled={disabled ? "1" : undefined}
    >
      {!compact && (
        <span aria-hidden="true" className="mr-1 font-[family-name:var(--font-music)] text-lg leading-none text-ink-faint">
          {""}
        </span>
      )}
      <StepButton
        id="bpm-down"
        dir={-1}
        label="−"
        title={TR.transport.tempoDown}
        disabled={disabled || shownBpm() <= BPM_MIN}
        onStep={stepBpm}
        onEnd={commitStep}
      />
      <label className="kv-visually-hidden" htmlFor="bpm">
        {TR.player.tempoLabel}
      </label>
      <input
        id="bpm"
        type="number"
        inputMode="numeric"
        min={BPM_MIN}
        max={BPM_MAX}
        value={bpmDraft ?? String(bpm)}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const v = Math.round(Number(raw));
          if (raw.trim() !== "" && Number.isFinite(v) && v >= BPM_MIN && v <= BPM_MAX) onBpm(v);
        }}
        onBlur={() => setDraft(null)}
        className="kv-tempo__input h-(--control-h) w-12 phone:w-10 [appearance:textfield] rounded-(--radius) border border-transparent bg-transparent text-center text-base font-semibold text-ink tabular-nums hover:border-rule focus:border-accent focus:outline-none disabled:opacity-50 coarse:text-[16px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <StepButton
        id="bpm-up"
        dir={1}
        label="+"
        title={TR.transport.tempoUp}
        disabled={disabled || shownBpm() >= BPM_MAX}
        onStep={stepBpm}
        onEnd={commitStep}
      />
      {!compact && naturalBpm > 0 && (
        <button
          type="button"
          className="kv-tempo-reset ml-1 appearance-none rounded-(--radius-sm) border-0 bg-transparent px-1.5 py-0.5 text-(length:--text-xs) text-ink-faint hover:bg-sunken hover:text-ink data-idle:invisible"
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
    </div>
  );
}
