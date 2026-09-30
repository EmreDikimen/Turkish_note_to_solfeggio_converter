/**
 * The settings the player bar opens: Ses, Ritim, Perde. (UI rebuild, 2026-09-30.)
 *
 * One component, two presentations, one Base UI Drawer:
 *   - a PHONE gets a bottom sheet you can swipe down (modal, with a backdrop — the score behind it is
 *     not being read while you set a makam);
 *   - a WIDE window gets a panel sliding in from the right, NON-modal and without a backdrop, so the
 *     player bar keeps working while you adjust — you hear the change as you make it.
 *
 * What is in here was the old transport's fold, control for control, and the ids are the DOM
 * contract's: `#transport-settings`, `#row-sound`, `#row-rhythm`, `#row-pitch`, `#voice-field`,
 * `#instrument`, `#percussion`, `#percussion-volume`, `#percussion-kit`, `#makam-select`.
 * ⚠ The panel is NOT mounted while closed — a check must open `#settings-open` first.
 *
 * Every rule the old controls carried still holds: real checkboxes (`.kv-toggle`), native selects
 * (`.kv-field`), the percussion level can be set before the percussion is on, "Yalnızca ses" can be
 * chosen before the interval, and the voice's download state is readable as `data-voice-state`.
 */
import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { findUsul, USULS, type MakamOption, type MakamRuleUse } from "@turkish-omr/core";
import { KITS, type KitId } from "../audio/strokeKits";
import { VOICES, type VoiceId } from "../audio/instruments";
import type { VoiceStatus } from "../webAudioBackend";
import type { AccidentalMode } from "../SheetView";
import { Segmented } from "../ui/Segmented";
import { MakamIntonation } from "../ui/MakamIntonation";
import { TR } from "../ui/strings";
import { Star } from "../ui/ornament/Star";

export interface SettingsProps {
  canPlay: boolean;
  voice: VoiceId;
  onVoice: (v: VoiceId) => void;
  voiceStatus: VoiceStatus;
  usulName: string;
  onUsul: (v: string) => void;
  metronome: boolean;
  onMetronome: (v: boolean) => void;
  percussion: boolean;
  onPercussion: (v: boolean) => void;
  percussionVolume: number;
  onPercussionVolume: (v: number) => void;
  percussionKit: KitId;
  onPercussionKit: (v: KitId) => void;
  makamSlug: string;
  onMakam: (slug: string) => void;
  makamOptions: readonly MakamOption[];
  makamUsage: readonly MakamRuleUse[];
  transpose: number;
  transposeOptions: readonly (readonly [number, string])[];
  onTranspose: (commas: number) => void;
  keepSheet: boolean;
  onKeepSheet: (v: boolean) => void;
  accidentalMode: AccidentalMode;
  onAccidentalMode: (m: AccidentalMode) => void;
}

function voiceLabel(id: VoiceId): string {
  return VOICES.find((v) => v.id === id)?.label ?? id;
}

/** A titled group with the illuminator's knot beside its caption. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="kv-settings__section border-t border-rule py-5 first:border-t-0 first:pt-1">
      <h3 className="mb-3 flex items-center gap-2 font-sans text-(length:--text-xs) font-semibold tracking-[0.12em] text-ink-faint uppercase">
        <Star size={9} className="text-gold" />
        {title}
      </h3>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

/** A caption and its control on one line; the control takes the rest of the row. */
function Row({ label, title, disabled, children, id }: { label: string; title?: string; disabled?: boolean; children: ReactNode; id?: string }) {
  return (
    <label
      id={id}
      title={title}
      className={`kv-field kv-settings__row grid! grid-cols-[7.5rem_1fr] items-center gap-3 whitespace-normal ${disabled ? "is-disabled" : ""} [&_select]:w-full [&_select]:min-w-0`}
    >
      <span className="text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export function SettingsBody(p: SettingsProps) {
  const strokeCount = findUsul(p.usulName)?.strokes?.length ?? 0;
  return (
    <div id="transport-settings" className="kv-settings">
      <Section id="row-sound" title={TR.transport.groupSound}>
        <Row id="voice-field" label={TR.transport.voice} title={TR.transport.voiceTitle} disabled={!p.canPlay}>
          <select
            id="instrument"
            data-instrument={p.voice}
            data-voice-state={p.voiceStatus.state}
            data-voice-sounding={p.voiceStatus.sounding}
            value={p.voice}
            disabled={!p.canPlay}
            onChange={(e) => p.onVoice(e.target.value as VoiceId)}
          >
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </Row>
        {p.voiceStatus.state === "loading" && (
          <small className="kv-hint -mt-1 pl-[8.25rem] text-(length:--text-xs) text-ink-faint">
            {p.voiceStatus.sounding === "sine"
              ? TR.transport.voiceLoading(p.voiceStatus.loaded, p.voiceStatus.total)
              : TR.transport.voiceSwitchHeld(p.voiceStatus.loaded, p.voiceStatus.total, voiceLabel(p.voiceStatus.sounding))}
          </small>
        )}
        {p.voiceStatus.state === "failed" && (
          <small className="kv-hint -mt-1 pl-[8.25rem] text-(length:--text-xs) text-danger">
            {p.voiceStatus.sounding === "sine"
              ? TR.transport.voiceFailed
              : TR.transport.voiceFailedHeld(voiceLabel(p.voiceStatus.sounding))}
          </small>
        )}
      </Section>

      <Section id="row-rhythm" title={TR.transport.groupRhythm}>
        <Row label={TR.transport.usul} title={TR.transport.usulTitle} disabled={!p.canPlay}>
          <select value={p.usulName} onChange={(e) => p.onUsul(e.target.value)} disabled={!p.canPlay}>
            {USULS.map((u) => (
              <option key={u.name} value={u.name}>
                {u.label} ({u.num}/{u.den})
              </option>
            ))}
          </select>
        </Row>
        <div className="flex flex-wrap gap-2">
          <label className="kv-toggle">
            <input
              type="checkbox"
              className="kv-toggle__input"
              checked={p.metronome}
              disabled={!p.canPlay}
              onChange={(e) => p.onMetronome(e.target.checked)}
            />
            <span>{TR.transport.metronome}</span>
          </label>
          <label className="kv-toggle" title={strokeCount ? TR.transport.percussionTitle : TR.transport.percussionUnavailable}>
            <input
              id="percussion"
              type="checkbox"
              className="kv-toggle__input"
              data-usul-strokes={strokeCount}
              checked={p.percussion && strokeCount > 0}
              disabled={!p.canPlay || strokeCount === 0}
              onChange={(e) => p.onPercussion(e.target.checked)}
            />
            <span>{TR.transport.percussion}</span>
          </label>
        </div>
        {/* ⚠ Enabled whenever the usul HAS strokes, not only while percussion is on: people set a
            level and THEN turn the thing on. It rides a gain node, so dragging never re-schedules. */}
        <Row label={TR.transport.percussionVolume} title={TR.transport.percussionVolumeTitle} disabled={!p.canPlay || !strokeCount}>
          <input
            id="percussion-volume"
            type="range"
            min={0}
            max={200}
            step={5}
            data-percussion-volume={p.percussionVolume}
            value={Math.round(p.percussionVolume * 100)}
            disabled={!p.canPlay || strokeCount === 0}
            onChange={(e) => p.onPercussionVolume(Number(e.target.value) / 100)}
            className="w-full!"
          />
        </Row>
        <Row label={TR.transport.percussionKit} title={TR.transport.percussionKitTitle} disabled={!p.canPlay || !strokeCount}>
          <select
            id="percussion-kit"
            data-percussion-kit={p.percussionKit}
            value={p.percussionKit}
            disabled={!p.canPlay || strokeCount === 0}
            onChange={(e) => p.onPercussionKit(e.target.value as KitId)}
          >
            {KITS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section id="row-pitch" title={TR.transport.groupPitch}>
        <Row label={TR.transport.makam} title={TR.transport.makamTitle} disabled={!p.canPlay}>
          <select id="makam-select" value={p.makamSlug} onChange={(e) => p.onMakam(e.target.value)} disabled={!p.canPlay}>
            <option value="">{TR.transport.makamNone}</option>
            {p.makamOptions.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.label}
                {m.hasIntonation ? " ♪" : ""}
              </option>
            ))}
          </select>
        </Row>
        <MakamIntonation slug={p.makamSlug} usage={p.makamUsage} />
        <Row label={TR.transport.transpose} title={TR.transport.transposeTitle}>
          <select value={p.transpose} onChange={(e) => p.onTranspose(Number(e.target.value))}>
            {p.transposeOptions.map(([commas, label]) => (
              <option key={commas} value={commas}>
                {label}
              </option>
            ))}
          </select>
        </Row>
        {/* A MODE of transposing (sounding vs written pitch), so it sits under the interval. Not
            disabled at transpose 0: a player picks "yalnızca ses" and THEN the interval. */}
        <div className="pl-[8.25rem] phone:pl-0">
          <Segmented
            value={p.keepSheet ? "keep" : "move"}
            onChange={(v) => p.onKeepSheet(v === "keep")}
            items={[
              { value: "move", label: TR.transport.keepSheetMove, title: TR.transport.keepSheetMoveTitle },
              { value: "keep", label: TR.transport.keepSheetKeep, title: TR.transport.keepSheetKeepTitle },
            ]}
          />
        </div>
        <Row label={TR.transport.accidentals} title={TR.transport.accidentalsTitle}>
          <select value={p.accidentalMode} onChange={(e) => p.onAccidentalMode(e.target.value as AccidentalMode)}>
            <option value="every">{TR.transport.accidentalsEvery}</option>
            <option value="keysig">{TR.transport.accidentalsKeysig}</option>
            <option value="measure">{TR.transport.accidentalsMeasure}</option>
          </select>
        </Row>
      </Section>
    </div>
  );
}

export function SettingsPanel({
  open,
  onOpenChange,
  phone,
  ...settings
}: SettingsProps & { open: boolean; onOpenChange: (v: boolean) => void; phone: boolean }) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection={phone ? "down" : "right"}
      modal={phone}
    >
      <Drawer.Portal>
        {phone && (
          <Drawer.Backdrop className="fixed inset-0 z-[70] bg-(--backdrop) opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        )}
        <Drawer.Viewport
          className={
            phone
              ? "pointer-events-none fixed inset-0 z-[71] flex items-end"
              : "pointer-events-none fixed top-0 right-0 bottom-(--player-h) z-[45] flex justify-end"
          }
        >
          <Drawer.Popup
            id="settings-panel"
            className={
              "kv-settings-panel pointer-events-auto flex flex-col bg-raised text-ink outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 " +
              (phone
                ? "max-h-[85dvh] w-full rounded-t-(--radius-lg) border-t border-rule shadow-(--shadow-modal) [transform:translateY(var(--drawer-swipe-movement-y,0px))] data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]"
                : "h-full w-[380px] max-w-[92vw] border-l border-rule shadow-(--shadow-modal) [transform:translateX(var(--drawer-swipe-movement-x,0px))] data-ending-style:[transform:translateX(100%)] data-starting-style:[transform:translateX(100%)]")
            }
          >
            {phone && <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-rule-strong" />}
            <div className="flex items-start gap-3 px-5 pt-4 pb-2">
              <div className="min-w-0 flex-1">
                <Drawer.Title className="font-serif text-(length:--text-xl) font-semibold leading-tight">
                  {TR.player.settings}
                </Drawer.Title>
                <Drawer.Description className="mt-1 text-(length:--text-xs) text-ink-faint">
                  {TR.player.settingsLead}
                </Drawer.Description>
              </div>
              <Drawer.Close
                id="settings-close"
                aria-label={TR.player.close}
                title={TR.player.close}
                className="grid size-(--control-h) shrink-0 appearance-none place-items-center rounded-full border-0 bg-transparent p-0 text-ink-soft hover:bg-sunken hover:text-ink"
              >
                <X size={18} aria-hidden="true" />
              </Drawer.Close>
            </div>
            <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
              <SettingsBody {...settings} />
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
