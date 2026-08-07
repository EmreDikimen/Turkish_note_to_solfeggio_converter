/**
 * The piece's pitch span, lowest to highest comma.
 *
 * A quick orientation aid — it confirms the data covers the range you expect. It lives in the
 * Gelişmiş panel because that is what it is: a check, not something a listener needs.
 */

import { centsAboveRef, type NoteModelDocument } from "@turkish-omr/core";
import { TR } from "./strings";

export function PitchRangeNote({ doc }: { doc: NoteModelDocument | null }) {
  if (!doc) return null;
  const komas = doc.events.filter((e) => e.kind === "note").map((n) => n.koma53);
  if (!komas.length) return null;
  const lo = Math.min(...komas);
  const hi = Math.max(...komas);
  const span = centsAboveRef(
    hi - lo + doc.tuning.refKoma,
    doc.tuning.refKoma,
    doc.tuning.commasPerOctave
  );
  return <p className="kv-advanced__note">{TR.advanced.pitchRange(lo, hi, Math.round(span))}</p>;
}
