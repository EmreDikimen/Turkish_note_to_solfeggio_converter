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
    <div id="makam-modal" onClick={onDismiss} style={backdrop}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <h3 style={{ margin: "0 0 4px" }}>
          {detection.slug ? `This looks like ${makamDisplay(detection.slug)}` : "Which makam is this?"}
        </h3>

        <div style={{ color: "#666", fontSize: 13, margin: "4px 0 14px", lineHeight: 1.5 }}>
          {detection.slug
            ? "The makam sets how the piece is PLAYED — some perdes sound away from where they are written. It does not change the notes on the staff."
            : "No makam prints this signature, so playback will use the notes exactly as written. Pick one if you know it."}
        </div>

        {/* The evidence. Without it "Hüzzam" is just an assertion. */}
        <div style={evidence}>
          <div>
            <span style={evidenceLabel}>signature read</span>
            {detection.signature ? <code>{detection.signature}</code> : <em>none (no accidentals)</em>}
          </div>
          <div>
            <span style={evidenceLabel}>ends on</span>
            {detection.karar ? (
              <code>
                {detection.karar.letter}
                {detection.karar.alterCommas === 0
                  ? ""
                  : `${detection.karar.alterCommas > 0 ? "+" : "−"}${Math.abs(detection.karar.alterCommas)} koma`}
              </code>
            ) : (
              <em>nothing readable</em>
            )}
            {detection.karar && !detection.kararMatched && detection.slug ? (
              <span style={{ color: "#a16207", marginLeft: 8 }}>— did not narrow the guess</span>
            ) : null}
          </div>
          {detection.alternatives.length > 0 ? (
            <div>
              <span style={evidenceLabel}>same signature</span>
              {detection.alternatives.map((s) => makamDisplay(s)).join(", ")}
            </div>
          ) : null}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 0" }}>
          <span style={{ fontWeight: 600 }}>Makam:</span>
          <select
            id="makam-modal-select"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={{ flex: 1, padding: 4 }}
          >
            <option value="">none — play exactly as written</option>
            {options.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.label}
                {m.hasIntonation ? " ♪" : ""}
              </option>
            ))}
          </select>
        </label>

        <div style={{ minHeight: 54, marginTop: 12, fontSize: 13, color: "#444", lineHeight: 1.5 }}>
          {rules.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {rules.map((r) => (
                <li key={`${r.letter}${r.alterCommas}`}>
                  <strong>
                    {r.deltaCommas > 0 ? "+" : "−"}
                    {Math.abs(r.deltaCommas)} koma
                  </strong>{" "}
                  on the written {r.letter}
                  {r.alterCommas === 0 ? "" : ` (${r.alterCommas > 0 ? "+" : "−"}${Math.abs(r.alterCommas)})`} —{" "}
                  {r.why}
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ color: "#888" }}>
              {slug
                ? "No performed deviation is recorded for this makam — it plays as written."
                : "Playback will use the notes exactly as the page spells them."}
            </span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={() => onConfirm("")}>Play as written</button>
          <button id="makam-confirm" onClick={() => onConfirm(slug)} style={{ fontWeight: 600 }}>
            Use this
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};
const panel: React.CSSProperties = {
  background: "#fff", borderRadius: 8, padding: 20, width: 560, maxWidth: "94vw",
  maxHeight: "85vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
  fontFamily: "system-ui, sans-serif",
};
const evidence: React.CSSProperties = {
  background: "#f7f7f8", border: "1px solid #eee", borderRadius: 6, padding: "8px 10px",
  fontSize: 12.5, color: "#555", display: "grid", gap: 4,
};
const evidenceLabel: React.CSSProperties = {
  display: "inline-block", width: 108, color: "#999",
};
