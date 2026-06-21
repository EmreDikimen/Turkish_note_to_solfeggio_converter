/**
 * Note-model types — the data contract produced by the Python exporter
 * (`src/symbtr/export_json.py`, schemaVersion 1) and consumed across the app.
 *
 * Keep these in sync with the Python exporter. The web harness and the mobile
 * product both read this same shape.
 */

export type EventKind = "note" | "rest" | "meta";

export interface TuningParams {
  /** Tuning system identifier, e.g. "53tet". */
  system: string;
  /** Frequency (Hz) of the reference comma. */
  refFreqHz: number;
  /** Comma value that sounds at `refFreqHz` (SymbTr Koma53 numbering). */
  refKoma: number;
  /** Commas per octave (53 for the Holdrian/AEU system). */
  commasPerOctave: number;
}

export interface DurationBeats {
  num: number;
  den: number;
}

export interface NoteEvent {
  /** 1-based row index from the original SymbTr score. */
  index: number;
  kind: EventKind;
  /** Absolute Holdrian comma; -1 for rests. */
  koma53: number;
  /** 53-TET Turkish solfege name (e.g. "Do5"), or "Es" for a rest. */
  noteName: string;
  /** Arel-Ezgi name (e.g. "C5"). */
  noteAE: string;
  /** Nominal duration in milliseconds. */
  durationMs: number;
  /** Duration as a fraction of a whole note. */
  durationBeats: DurationBeats;
  /** Convenience/validation frequency for notes; null for rests/meta. Core recomputes. */
  freqHz: number | null;
  /** Lyric syllable, if any. */
  lyric: string;
  /** End time of the event in beats. */
  offset: number;
  /** Raw SymbTr `Kod` — present only on meta events (e.g. 51 = usul change). */
  code?: number;
}

export interface NoteModelDocument {
  schemaVersion: number;
  name: string;
  makam: string;
  form: string;
  usul: string;
  title: string;
  composer: string;
  tuning: TuningParams;
  events: NoteEvent[];
}
