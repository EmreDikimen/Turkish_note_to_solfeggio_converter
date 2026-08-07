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

import { useState } from "react";
import { makamDisplay, makamIntonation, makamOptions, type MakamDetection } from "@turkish-omr/core";
import { TR } from "./ui/strings";

export function MakamModal({
  detection,
  onConfirm,
  onDismiss,
}: {
  detection: MakamDetection;
  /** Apply this makam (empty string = none, play as written). */
  onConfirm: (slug: string) => void;
  /** Close without changing the current selection. */
  onDismiss: () => void;
}) {
  const [slug, setSlug] = useState(detection.slug ?? "");
  const rules = makamIntonation(slug);
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

        <div
          style={{
            minHeight: 54,
            marginTop: "var(--space-3)",
            fontSize: "var(--text-sm)",
            color: "var(--ink-soft)",
          }}
        >
          {rules.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
              {rules.map((r) => (
                <li key={`${r.letter}${r.alterCommas}`}>
                  <strong>
                    {TR.makamModal.rule(
                      // Turkish writes 1,5 — and these deltas are fractional on purpose.
                      `${r.deltaCommas > 0 ? "+" : "−"}${String(Math.abs(r.deltaCommas)).replace(".", ",")}`,
                      r.letter,
                      r.alterCommas === 0
                        ? ""
                        : ` (${r.alterCommas > 0 ? "+" : "−"}${Math.abs(r.alterCommas)})`
                    )}
                  </strong>{" "}
                  — {r.why}
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ color: "var(--ink-faint)" }}>
              {slug ? TR.makamModal.noDeviation : TR.makamModal.asWritten}
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
