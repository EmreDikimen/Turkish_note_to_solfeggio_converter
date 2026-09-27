/**
 * The violin tuning prompt — "Tel akordunu değiştir".
 *
 * ⭐ WHY IT EXISTS AND WHY IT OFFERS TWELVE NOTES AND NOT FIFTY-THREE (owner, 2026-09-27): the
 * picker this replaces was a list of whole named tunings, hidden because only one shipped
 * (docs/DECISIONS.md, 2026-08-16 — naming a scordatura is a repertoire claim). Letting the person
 * turn one peg at a time makes that claim unnecessary. The owner then narrowed it twice, and both
 * narrowings are the design: *"the user should only be able to change that string's note with a
 * dropdown"* — so there is no free Hz box, no ± nudge and no drag — and *"there is no need for a
 * match between a koma and a note, let it be tunable to the twelve tones of Western music"*,
 * because *"tuning by koma is much too advanced a feature, beginners will use this app"*.
 *
 * So this file shows note NAMES. `tuningChoices` in `packages/core/src/fingering.ts` owns every
 * comma, and nothing here does pitch arithmetic — a second opinion about where Fa♯3 is would be a
 * second tuning model.
 *
 * ⚠ A ROW IS NAMED BY ITS STRING NUMBER, NEVER BY ITS NOTE. The label moves with the pitch (a
 * string retuned to Fa is labelled Fa), so a row titled "Sol" would rename itself under the
 * person's finger mid-edit. Violin numbering is highest-first — Mi is the 1st string, Sol the 4th —
 * while `tuning.strings` is lowest-first, which is the order the photo draws them in.
 *
 * ⚠ Changes apply as they are made, not on a confirm. There is nothing to lose and nothing to undo:
 * the modal's own "Standart akorda dön" is the way back, and the fingerboard redraws behind it so
 * the person can see what the choice did.
 *
 * ⚠ The backdrop covers the page, so a browser check cannot click through it — close it by
 * `#tuning-done` before touching anything underneath, the way the makam prompt is dismissed via
 * `#makam-confirm`.
 *
 * ⚠ IT IS PORTALLED TO `document.body`, AND THAT IS NOT A STYLE CHOICE. `Fingerboard` renders
 * inside `.kv-score` — the container `tools/render/render.ts` screenshots BY RECT to cut training
 * strips, and which carries `overflow-y: clip` (docs/APP-RULES.md). A modal left in that subtree
 * puts a fixed, full-page box inside the one element in the app that must stay a plain rectangle of
 * music. The portal costs nothing and takes the whole question away. Its React tree is unchanged, so
 * the props above still flow normally.
 */

import { createPortal } from "react-dom";
import {
  DEFAULT_VIOLIN_TUNING,
  choiceOfString,
  tuningChoices,
  type ViolinTuning,
} from "@turkish-omr/core";
import { TR } from "./ui/strings";

export function TuningModal({
  tuning,
  onRetune,
  onReset,
  onClose,
}: {
  tuning: ViolinTuning;
  /** Move one string to one of `tuningChoices(stringId)`. */
  onRetune: (stringId: string, choiceId: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <div id="tuning-modal" onClick={onClose} className="kv-modal" data-tuning={tuning.id}>
      <div onClick={(e) => e.stopPropagation()} className="kv-modal__panel" role="dialog">
        <h3 className="kv-modal__title">{TR.fingerboard.tuningTitle}</h3>
        <p className="kv-modal__lead">{TR.fingerboard.tuningLead}</p>

        <div className="kv-tuning">
          {tuning.strings.map((s, i) => {
            const standard = DEFAULT_VIOLIN_TUNING.strings[i]!;
            // Highest string is the 1st. `strings` is lowest-first, so count back from the end.
            const number = tuning.strings.length - i;
            const current = choiceOfString(s);
            return (
              <label className="kv-tuning__row" key={s.id} htmlFor={`tuning-${s.id}`}>
                <span className="kv-tuning__name">
                  {TR.fingerboard.tuningString(number, standard.label)}
                </span>
                <select
                  id={`tuning-${s.id}`}
                  className="kv-tuning__select"
                  data-string={s.id}
                  data-koma={s.concertKoma}
                  value={current?.id ?? ""}
                  onChange={(e) => onRetune(s.id, e.target.value)}
                >
                  {tuningChoices(s.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {/* The frequency is the one number a beginner can check against a tuner app, so it
                    is shown — but as a caption, not a control: it is derived from the note, and
                    nothing here lets it be typed. ⚠ One decimal, because this grid's La is 440.0
                    exactly while its Sol is 195.6 rather than a tuner's 196.0 (fingering.ts). */}
                <span className="kv-tuning__hz">{s.openHz.toFixed(1)} Hz</span>
              </label>
            );
          })}
        </div>

        <div className="kv-modal__actions">
          <button
            id="tuning-reset"
            type="button"
            className="kv-btn"
            disabled={tuning.id === "standard"}
            onClick={onReset}
          >
            {TR.fingerboard.tuningReset}
          </button>
          <button
            id="tuning-done"
            type="button"
            className="kv-btn kv-btn--primary"
            onClick={onClose}
          >
            {TR.fingerboard.tuningDone}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
