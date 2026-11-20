/**
 * "Transpozisyon — gelişmiş": move the STAFF and the SOUND by two different amounts.
 *
 * ⭐ WHY (owner, 2026-10-27). A transposing instrument — a "4 ses" ney, a kız or mansur ney — reads
 * one note and sounds another. The transport's one picker moves both together, which is the
 * ordinary case and stays the default; this dialog is where a player sets them apart. The old
 * "Yalnızca ses" mode is the case staff = 0 here.
 *
 * ⚠ It only edits two numbers in commas; what they do is `App.tsx`'s (`displayDoc` takes the staff
 * shift, `perf` moves the tuning anchor by the difference). Nothing here builds a timeline.
 */
import { TR } from "../strings";
import { Modal } from "../kit/Modal";

export function TransposeModal({
  sheet,
  sound,
  options,
  onChange,
  onClose,
}: {
  /** Staff shift in commas. */
  sheet: number;
  /** Sound shift in commas. */
  sound: number;
  options: readonly (readonly [number, string])[];
  onChange: (sheet: number, sound: number) => void;
  onClose: () => void;
}) {
  const select = (id: string, value: number, set: (v: number) => void) => (
    <select id={id} value={value} onChange={(e) => set(Number(e.target.value))}>
      {options.map(([commas, label]) => (
        <option key={commas} value={commas}>
          {label}
        </option>
      ))}
    </select>
  );
  return (
    <Modal
      id="transpose-modal"
      data={{ "data-sheet": String(sheet), "data-sound": String(sound) }}
      onDismiss={onClose}
      title={TR.transport.transposeAdvancedTitle}
      lead={TR.transport.transposeAdvancedLead}
      actions={
        <>
          <button
            id="transpose-reset"
            type="button"
            className="kv-btn"
            disabled={sheet === 0 && sound === 0}
            onClick={() => onChange(0, 0)}
          >
            {TR.transport.transposeAdvancedReset}
          </button>
          <button id="transpose-done" type="button" className="kv-btn kv-btn--primary" onClick={onClose}>
            {TR.transport.transposeAdvancedDone}
          </button>
        </>
      }
    >
      <div className="kv-tuning">
        <label className="kv-tuning__row" htmlFor="transpose-sheet">
          <span className="kv-tuning__name">{TR.transport.transposeSheet}</span>
          {select("transpose-sheet", sheet, (v) => onChange(v, sound))}
        </label>
        <label className="kv-tuning__row" htmlFor="transpose-sound">
          <span className="kv-tuning__name">{TR.transport.transposeSound}</span>
          {select("transpose-sound", sound, (v) => onChange(sheet, v))}
        </label>
      </div>
    </Modal>
  );
}
