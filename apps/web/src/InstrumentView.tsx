import {
  type NoteModelDocument,
  type Timeline,
} from "@turkish-omr/core";
import { Fingerboard } from "./Fingerboard";
import { Kanun } from "./Kanun";
import { Clarinet } from "./Clarinet";
import type { VoiceId } from "./audio/instruments";
import type { VoiceStatus } from "./webAudioBackend";
import { TR } from "./ui/strings";

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
 * ⚠ **It does NOT set the voice merely by being opened, and that is deliberate.** A sampled voice
 * is a 20–35 MB download from the Hub ([docs/features/README.md](../../docs/features/README.md), F1),
 * and "load only on selection" is a requirement there rather than an optimisation. So opening this
 * tab draws an instrument without fetching one; the download starts when the picker is *changed*.
 * The consequence to expect: on a first visit the picture can be a violin while the sound is still
 * the default tone. Touching the picker resolves it, and the loading note below says so.
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
  timeline,
  makamDeltas,
  playing,
  getPositionMs,
  instrument,
  onInstrument,
  voiceStatus,
}: {
  doc: NoteModelDocument;
  timeline: Timeline;
  makamDeltas: ReadonlyMap<number, number>;
  playing: boolean;
  getPositionMs: () => number | null;
  instrument: InstrumentId;
  onInstrument: (id: InstrumentId) => void;
  voiceStatus: VoiceStatus;
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
        {loadingThis && voiceStatus.state === "loading" && (
          <small className="kv-hint">
            {TR.transport.voiceLoading(voiceStatus.loaded, voiceStatus.total)}
          </small>
        )}
        {loadingThis && voiceStatus.state === "failed" && (
          <small className="kv-hint">{TR.transport.voiceFailed}</small>
        )}
      </div>

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
        // ⚠ The violin takes the TIMELINE and the kanun takes the DOCUMENT, and that asymmetry is
        // correct rather than an oversight: a fingerboard cares only what a note sounds, while a
        // kanun course is a written note. Both files say why in their own headers.
        <Fingerboard timeline={timeline} playing={playing} getPositionMs={getPositionMs} />
      )}

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
