/**
 * The post-decode makam prompt.
 *
 * A decoded page carries no metadata, so the app guesses the makam from the score's own
 * signature and karar (`detectMakam`) and asks. Why ask at all: the guess changes what the piece
 * SOUNDS like — Uşşak's segah is played flatter than the page spells it — and a wrong makam bends
 * pitches that should have stayed put. Cheaper to confirm once than to have someone wonder why
 * playback is out of tune.
 *
 * Shows its own reasoning on purpose (the signature it matched, the karar it used), because
 * "Hüzzam" with no evidence behind it is not something a user can sanity-check.
 *
 * ⭐ TAP A MAKAM (owner, 2026-11-25, UI review item 4). The makams that fit the page are big
 * buttons, the guess first and highlighted; one tap chooses and closes. Below them, "another makam"
 * as a list, and one way out: "Bilmiyorum — yazıldığı gibi çal". The evidence stays on screen above
 * the buttons, readable: the signature as perde names with their real accidental signs (it used to
 * be the raw label code, `\bakiyeFlat b \bakiyeSharp c`), and the karar as a perde name.
 * ⛔ No "Bunu kullan" any more: with "yok" chosen it did exactly what the other button did.
 *
 * ⚠ The window is modal (ui/kit/Modal.tsx), so Playwright cannot click past it. `tools/checks/
 * app-smoke.ts` and `page-smoke.ts` dismiss it via `#makam-confirm` before touching the
 * transport — keep those ids if this file is restyled. `#makam-confirm` is the GUESS button, or
 * "Bilmiyorum" when there is no guess: either way it accepts what the app itself concluded.
 */

import {
  accidentalLabel,
  makamDisplay,
  makamOptions,
  solfegeLetter,
  SIG_TOKEN_BY_ALTER,
  type MakamDetection,
} from "@turkish-omr/core";
import { accidentalChar } from "../accidentals";
import { TR } from "../strings";
import { Modal } from "../kit/Modal";

/** `"\\bakiyeFlat b \\bakiyeSharp c"` → [{ letter: "B", alter: -4 }, …]. Unknown tokens are skipped. */
const ALTER_BY_TOKEN = Object.fromEntries(
  Object.entries(SIG_TOKEN_BY_ALTER).map(([alter, tok]) => [tok, Number(alter)]),
);
function parseSignature(sig: string): { letter: string; alter: number }[] {
  const parts = sig.trim().split(/\s+/).filter(Boolean);
  const out: { letter: string; alter: number }[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const alter = ALTER_BY_TOKEN[parts[i]!];
    if (alter !== undefined) out.push({ letter: parts[i + 1]!.toUpperCase(), alter });
  }
  return out;
}

/** "Si" plus the accidental the page prints, as its own glyph — the way MakamIntonation names a perde. */
function Perde({ letter, alter }: { letter: string; alter: number }) {
  return (
    <span className="kv-makam__perde" title={alter ? accidentalLabel(alter) : undefined}>
      {solfegeLetter(letter)}
      {alter !== 0 && (
        <span className="kv-glyph" aria-hidden="true">
          {accidentalChar(alter)}
        </span>
      )}
    </span>
  );
}

export function MakamModal({
  detection,
  onConfirm,
  onDismiss,
}: {
  detection: MakamDetection;
  onConfirm: (slug: string) => void;
  onDismiss: () => void;
}) {
  const options = makamOptions();
  const guess = detection.slug;
  const candidates = [...(guess ? [guess] : []), ...detection.alternatives.filter((s) => s !== guess)];
  const sig = parseSignature(detection.signature);

  return (
    <Modal
      id="makam-modal"
      onDismiss={onDismiss}
      title={guess ? TR.makamModal.titleGuess(makamDisplay(guess)) : TR.makamModal.titleUnknown}
      lead={
        guess
          ? TR.makamModal.leadGuess
          : candidates.length
            ? TR.makamModal.leadChoose
            : TR.makamModal.leadUnknown
      }
      actions={
        <button
          id={guess ? undefined : "makam-confirm"}
          type="button"
          className="kv-btn"
          onClick={() => onConfirm("")}
        >
          {TR.makamModal.playAsWritten}
        </button>
      }
    >
      {/* The evidence — why the app thinks what it thinks — in perde names, not label code. */}
      <div className="kv-evidence">
        <div>
          <span className="kv-evidence__label">{TR.makamModal.signature}</span>
          {sig.length ? (
            <span className="kv-evidence__perdes">
              {sig.map((e, i) => (
                <Perde key={i} letter={e.letter} alter={e.alter} />
              ))}
            </span>
          ) : (
            <em>{TR.makamModal.signatureNone}</em>
          )}
        </div>
        <div>
          <span className="kv-evidence__label">{TR.makamModal.karar}</span>
          {detection.karar ? (
            <Perde letter={detection.karar.letter} alter={detection.karar.alterCommas} />
          ) : (
            <em>{TR.makamModal.kararNone}</em>
          )}
        </div>
      </div>

      {candidates.length > 0 && (
        <>
          <p className="kv-makam-pick__lead">{TR.makamModal.fits}</p>
          <div className="kv-makam-pick" data-omr="makam-candidates">
            {candidates.map((m) => (
              <button
                key={m}
                id={m === guess ? "makam-confirm" : undefined}
                type="button"
                data-makam={m}
                className={`kv-btn${m === guess ? " kv-btn--primary" : ""}`}
                onClick={() => onConfirm(m)}
              >
                {makamDisplay(m)}
              </button>
            ))}
          </div>
        </>
      )}

      <label className="kv-field kv-makam-pick__other">
        <span>{TR.makamModal.other}</span>
        {/* Choosing here IS the answer — one tap, like the buttons above. */}
        <select
          id="makam-modal-select"
          value=""
          onChange={(e) => {
            if (e.target.value) onConfirm(e.target.value);
          }}
        >
          <option value="">{TR.makamModal.otherPlaceholder}</option>
          {options.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.label}
              {m.hasIntonation ? " ♪" : ""}
            </option>
          ))}
        </select>
      </label>
    </Modal>
  );
}
