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
 * ⚠ The backdrop covers the page, so Playwright cannot click through it. `tools/browser/
 * app-smoke.ts` and `page-smoke.ts` dismiss it via `#makam-confirm` before touching the
 * transport — keep those ids if this file is restyled.
 */

import { useMemo, useState } from "react";
import {
  makamDisplay,
  makamOptions,
  makamRuleUsage,
  type MakamDetection,
  type NoteModelDocument,
} from "@turkish-omr/core";
import { MakamIntonation } from "./ui/MakamIntonation";
import { TR } from "./ui/strings";

export function MakamModal({
  detection,
  doc,
  onConfirm,
  onDismiss,
}: {
  detection: MakamDetection;
  /** The page just read, so the prompt can say how many of ITS notes each rule reaches. The makam
   *  is chosen here, so this cannot be precomputed outside — it changes with the dropdown. */
  doc: NoteModelDocument | null;
  /** Apply this makam (empty string = none, play as written). */
  onConfirm: (slug: string) => void;
  /** Close without changing the current selection. */
  onDismiss: () => void;
}) {
  const [slug, setSlug] = useState(detection.slug ?? "");
  const usage = useMemo(() => makamRuleUsage(doc, slug), [doc, slug]);
  const options = makamOptions();

  return (
    <div id="makam-modal" onClick={onDismiss} className="kv-modal">
      <div onClick={(e) => e.stopPropagation()} className="kv-modal__panel" role="dialog">
        <h3 className="kv-modal__title">
          {detection.slug
            ? TR.makamModal.titleGuess(makamDisplay(detection.slug))
            : TR.makamModal.titleUnknown}
        </h3>

        <p className="kv-modal__lead">
          {detection.slug ? TR.makamModal.leadGuess : TR.makamModal.leadUnknown}
        </p>

        {/* The evidence. Without it "Hüzzam" is just an assertion. */}
        <div className="kv-evidence">
          <div>
            <span className="kv-evidence__label">{TR.makamModal.signature}</span>
            {detection.signature ? (
              <code>{detection.signature}</code>
            ) : (
              <em>{TR.makamModal.signatureNone}</em>
            )}
          </div>
          <div>
            <span className="kv-evidence__label">{TR.makamModal.karar}</span>
            {detection.karar ? (
              <code>
                {detection.karar.letter}
                {detection.karar.alterCommas === 0
                  ? ""
                  : `${detection.karar.alterCommas > 0 ? "+" : "−"}${Math.abs(detection.karar.alterCommas)} koma`}
              </code>
            ) : (
              <em>{TR.makamModal.kararNone}</em>
            )}
            {detection.karar && !detection.kararMatched && detection.slug ? (
              <span style={{ color: "var(--warn)", marginLeft: 8 }}>
                {TR.makamModal.kararNoHelp}
              </span>
            ) : null}
          </div>
          {detection.alternatives.length > 0 ? (
            <div>
              <span className="kv-evidence__label">{TR.makamModal.alternatives}</span>
              {detection.alternatives.map((s) => makamDisplay(s)).join(", ")}
            </div>
          ) : null}
        </div>

        <label className="kv-field" style={{ display: "flex", marginTop: "var(--space-4)" }}>
          <span style={{ fontWeight: 600 }}>{TR.makamModal.makam}</span>
          <select
            id="makam-modal-select"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">{TR.makamModal.none}</option>
            {options.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.label}
                {m.hasIntonation ? " ♪" : ""}
              </option>
            ))}
          </select>
        </label>

        {/* ⚠ The SAME component the transport bar shows beside the picker, so the prompt and the
            control can never describe one makam two ways — only the reasoning is unfolded here,
            where there is room for it. `minHeight` keeps the buttons still as the answer changes
            length. */}
        <div style={{ minHeight: 54, marginTop: "var(--space-3)" }}>
          {slug ? (
            <MakamIntonation slug={slug} usage={usage} open />
          ) : (
            <span
              style={{ fontSize: "var(--text-sm)", color: "var(--ink-faint)" }}
            >
              {TR.makamModal.asWritten}
            </span>
          )}
        </div>

        <div className="kv-modal__actions">
          <button type="button" className="kv-btn" onClick={() => onConfirm("")}>
            {TR.makamModal.playAsWritten}
          </button>
          <button
            id="makam-confirm"
            type="button"
            className="kv-btn kv-btn--primary"
            onClick={() => onConfirm(slug)}
          >
            {TR.makamModal.useThis}
          </button>
        </div>
      </div>
    </div>
  );
}
