import {
  type Measure,
  type NoteModelDocument,
  type Timeline,
} from "@turkish-omr/core";
import { Fingerboard } from "./Fingerboard";
import { Kanun } from "./Kanun";
import { Clarinet } from "./Clarinet";
import { MeasureCard } from "./MeasureCard";
import type { PlayStep } from "./SheetView";
import { VOICES, type VoiceId } from "./audio/instruments";
import type { VoiceStatus } from "./webAudioBackend";
import { TR } from "./ui/strings";

/** The picker's own name for a voice — the hints have to name the one that is actually sounding. */
function voiceLabel(id: VoiceId): string {
  return VOICES.find((v) => v.id === id)?.label ?? id;
}

/**
 * "Enstrüman üzerinde" — the one page that shows where the music falls on a real instrument
 * (feature F3).
 *
 * ⚠ **This replaced two separate tabs on 2026-08-29** (owner: *"bunu keman page'iyle birleştirip
 * tek sayfa haline getirir misin"*). Keman and Kanun were built as two views because they are two
 * genuinely different problems — a violin position is a fact about one note, a kanun mandal is a
 * lever that stays where it is put — and that split is real and stays real **inside** the code
 * (`fingering.ts` vs `kanun.ts`, `Fingerboard.tsx` vs `Kanun.tsx`). It was never a reason to make
 * the user choose between two tabs: from the outside there is one question, *where do I play this*,
 * and the instrument is an answer to it rather than a different question.
 *
 * ⭐ **Picking an instrument here also picks the SOUND** (owner: *"ses de ona göre otomatik
 * ayarlanacak"*), which is the reason the merge is worth more than tidiness: you now see and hear
 * the same instrument without having to know that two different controls existed.
 *
 * ⭐ **OPENING THE TAB SETS THE VOICE TOO, SINCE 2026-09-04** (owner), reversing the rule that used
 * to stand here. It said the download must wait for an explicit pick, because a sampled voice is a
 * 20–35 MB fetch from the Hub ([docs/features/README.md](../../docs/features/README.md), F1) and
 * "load only on selection" is a requirement there. The price it charged was a page that drew a
 * violin while the default tone played, resolved only by touching a control nobody had been told
 * about; the owner judged that the worse half of the bargain. So arriving here now starts the
 * download for whatever this picker already shows, and `App`'s `applyViewMode` owns it — not this
 * file, which still only reports what it is handed.
 *
 * ⚠ The consequence to expect is the one the loading note below describes: the samples take a
 * moment, so the first bars after opening the tab can still sound with the previous voice (or the
 * default tone), and the note says which.
 */

/** The instruments this view can draw, and the voice each one selects. */
export const INSTRUMENTS = [
  { id: "violin", label: "Keman", voice: "violin" },
  { id: "kanun", label: "Kanun", voice: "kanun" },
  { id: "clarinet", label: "Sol klarnet", voice: "clarinet" },
] as const;

export type InstrumentId = (typeof INSTRUMENTS)[number]["id"];

/** The voice a chosen instrument should sound with. */
export function voiceForInstrument(id: InstrumentId): VoiceId {
  return (INSTRUMENTS.find((i) => i.id === id)?.voice ?? "sine") as VoiceId;
}

/**
 * Which instrument to show for a voice, or `null` when the voice is not one we can draw.
 *
 * Used only to pick the picker's OPENING value, so that someone who already chose Kanun in the
 * transport does not find a violin here. It is deliberately not a live two-way binding: choosing
 * Klarnet in the transport must not blank this page, and drawing a violin while a clarinet plays is
 * odd but harmless, where an empty instrument page would look broken.
 */
export function instrumentForVoice(voice: VoiceId): InstrumentId | null {
  return (INSTRUMENTS.find((i) => i.voice === voice)?.id as InstrumentId | undefined) ?? null;
}

export function InstrumentView({
  doc,
  sheetDoc,
  timeline,
  playPlan,
  makamDeltas,
  playing,
  getPositionMs,
  instrument,
  onInstrument,
  voiceStatus,
  canPlay,
  editMode,
  onPlayMeasure,
  onEditMeasure,
  renderBar,
}: {
  /** The PERFORMANCE document — what the three instrument drawings read. See the ⚠ at the call
   *  site in App: on a folded score the written page has no event under a second-pass index. */
  doc: NoteModelDocument;
  /** The WRITTEN score, for the measure card beside the instrument. ⚠ NOT the same document as
   *  `doc` above, and the two must not be swapped: a bar inside a repeat is drawn once. */
  sheetDoc: NoteModelDocument;
  timeline: Timeline;
  /** One step per sounding event, naming the written note it belongs to. ⚠ Always passed, folded
   *  score or not — the card draws a slice whose own clock starts at zero. See `MeasureCard`. */
  playPlan: readonly PlayStep[];
  makamDeltas: ReadonlyMap<number, number>;
  playing: boolean;
  getPositionMs: () => number | null;
  instrument: InstrumentId;
  onInstrument: (id: InstrumentId) => void;
  voiceStatus: VoiceStatus;
  canPlay: boolean;
  editMode: boolean;
  onPlayMeasure: (m: Measure) => void;
  onEditMeasure: (m: Measure, on: boolean) => void;
  /** Draws the bar — a `SheetView`, supplied by App. See the ⭐ at the top of `MeasureCard.tsx`. */
  renderBar: React.ComponentProps<typeof MeasureCard>["renderBar"];
}) {
  // ⚠ The load note is shown only for the instrument actually chosen here. `voiceStatus` reports
  // whatever the transport last asked for, so without this a clarinet download would appear to be
  // this page's doing.
  const loadingThis = voiceStatus.voice === voiceForInstrument(instrument);

  return (
    <div id="instrument-view" className="kv-instrument" data-omr="instrument-view" data-instrument={instrument}>
      <div className="kv-instrument__picker">
        <label className="kv-field" htmlFor="instrument-pick">
          <span>{TR.instrument.pick}</span>
          {/* ⚠ `#instrument-pick`, NOT `#instrument` — the transport's voice picker already owns
              that id. Two elements answering to one id is exactly the kind of thing the DOM-state
              contract in CLAUDE.md exists to keep out. */}
          <select
            id="instrument-pick"
            data-instrument={instrument}
            data-voice-state={loadingThis ? voiceStatus.state : "idle"}
            value={instrument}
            onChange={(e) => onInstrument(e.target.value as InstrumentId)}
          >
            {INSTRUMENTS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        {/* ⚠ Both lines say what is SOUNDING, not what this picker shows. Since 2026-09-04 a switch
            made while the piece plays keeps the previous recording going until the new one lands
            (`webAudioBackend.ensureVoice`), so during a download — and after a FAILED one — the two
            are different, and only `sounding` is true about what the listener hears. */}
        {loadingThis && voiceStatus.state === "loading" && (
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
        {loadingThis && voiceStatus.state === "failed" && (
          <small className="kv-hint">
            {voiceStatus.sounding === "sine"
              ? TR.transport.voiceFailed
              : TR.transport.voiceFailedHeld(voiceLabel(voiceStatus.sounding))}
          </small>
        )}
      </div>

      {/* ⭐ **The instrument on the left, the bar being played on the right** (owner, 2026-09-04).
          Two columns, because the two halves answer the two halves of one question — the drawing
          says WHERE to put your fingers and the card says WHAT you are playing — and a player
          reading one has to be able to glance at the other without scrolling.
          ⚠ **The kanun stacks instead, and that is not a phone rule.** A kanun is a wide trapezoid
          sized by WIDTH (`.kv-kanun__svg`), so half a row is half an instrument; the violin and the
          clarinet are tall slivers sized by height and lose nothing. The switch is in `app.css`,
          keyed off this container's own `data-instrument`. */}
      <div className="kv-instrument__pair">
        <div className="kv-instrument__stage">
          {instrument === "clarinet" ? (
            <Clarinet
              doc={doc}
              timeline={timeline}
              makamDeltas={makamDeltas}
              playing={playing}
              getPositionMs={getPositionMs}
            />
          ) : instrument === "kanun" ? (
            <Kanun
              doc={doc}
              timeline={timeline}
              makamDeltas={makamDeltas}
              playing={playing}
              getPositionMs={getPositionMs}
            />
          ) : (
            // ⚠ The violin takes the TIMELINE and the kanun takes the DOCUMENT, and that
            // asymmetry is correct rather than an oversight: a fingerboard cares only what a note
            // sounds, while a kanun course is a written note. Both files say why in their headers.
            <Fingerboard timeline={timeline} playing={playing} getPositionMs={getPositionMs} />
          )}
        </div>

        {/* ⚠ The WRITTEN score goes in, never `doc` — see the two props' comments above. */}
        <MeasureCard
          doc={sheetDoc}
          timeline={timeline}
          playPlan={playPlan}
          playing={playing}
          getPositionMs={getPositionMs}
          canPlay={canPlay}
          editMode={editMode}
          onPlayMeasure={onPlayMeasure}
          onEditMeasure={onEditMeasure}
          renderBar={renderBar}
        />
      </div>

      <p className="kv-instrument__hint">
        {instrument === "clarinet"
          ? TR.instrument.hintClarinet
          : instrument === "kanun"
            ? TR.instrument.hintKanun
            : TR.instrument.hintViolin}
      </p>
    </div>
  );
}
