/**
 * "Keman sesi indirilsin mi?" — asked before a recorded voice is downloaded.
 *
 * ⭐ WHY (owner, 2026-09-27: *"sesi indirmeden önce bir modalla kullanıcıya emin olup olmadığını
 * sorsun"*). A sampled voice is a real download — measured on disk, clarinet 19 MB, kanun 9.9 MB,
 * violin 34 MB — and most visitors are on a phone, often on mobile data. Since 2026-09-04 merely
 * OPENING the instrument tab asks for its voice, so without this a tap on a tab could spend 34 MB
 * nobody agreed to.
 *
 * ⚠ The size is a RANGE, not a per-voice number. Every number in `audio/instruments.ts` is emitted
 * by `scripts/prepare_voices.py` and none of them is a byte count; a per-voice figure typed here
 * would drift the first time a sample set changes.
 *
 * ⚠ The decision lives in `App.requestVoice`, not here — this file only asks. Clicking the backdrop
 * is a "no", the same as `#voice-cancel`.
 *
 * ⚠ The backdrop covers the page, so a browser check must answer it before clicking anything else:
 * `tools/browser/voicePrompt.ts`, the way `makamPrompt.ts` does for the makam prompt.
 */

import type { VoiceId } from "./audio/instruments";
import { TR } from "./ui/strings";

export function VoiceDownloadModal({
  voice,
  label,
  onConfirm,
  onCancel,
}: {
  voice: VoiceId;
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div id="voice-modal" data-voice={voice} onClick={onCancel} className="kv-modal">
      <div onClick={(e) => e.stopPropagation()} className="kv-modal__panel" role="dialog">
        <h3 className="kv-modal__title">{TR.voiceModal.title(label)}</h3>
        <p className="kv-modal__lead">{TR.voiceModal.lead}</p>
        <div className="kv-modal__actions">
          <button id="voice-cancel" type="button" className="kv-btn" onClick={onCancel}>
            {TR.voiceModal.cancel}
          </button>
          <button
            id="voice-confirm"
            type="button"
            className="kv-btn kv-btn--primary"
            onClick={onConfirm}
          >
            {TR.voiceModal.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
