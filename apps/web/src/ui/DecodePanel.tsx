/**
 * The raw decode inspector: every token the model produced for the last page it read.
 *
 * WHY it is not the strip panel next to it. `StripPanel` lists `buildStrips` output — labels
 * RE-SERIALIZED from the score currently on the sheet, in the current accidental mode. That is the
 * right tool for "would this page train", and the wrong one for "what did the model actually say":
 * by the time a score is drawn, `stitchStrips` has merged the strips, dropped what it could not
 * parse, and the editor may have changed the rest. Nothing downstream keeps the model's own
 * sentence, so it was simply not visible anywhere — hence this panel (owner request, 2026-08-09).
 *
 * What it shows per strip: the detokenized line, then EVERY token in order with the model's
 * log-probability for it, plus the stitcher's warnings for the page. `</s>` is absent on purpose —
 * `summarizeDecode` (omr/decode.ts) strips it before anything downstream sees it, and a strip that
 * never produced one is flagged as `hitCap` instead, which is the fact worth reading.
 *
 * Token strings come from the model's own `id2token` (`getMeta`, ~12 KB, already fetched by every
 * decode path), so they are the vocabulary's spelling — `\komaFlat`, `c`, `'`, `8</w>` — not a
 * prettified version of it.
 */

import { useEffect, useMemo, useState } from "react";
import type { DecodedStripResult } from "../omr/pipeline";
import { getMeta } from "../omr/session";
import { TR } from "./strings";

/** The last page read, kept by App purely for this panel. */
export interface RawDecode {
  /** Page/file stem the strips came from. */
  name: string;
  where: "server" | "browser";
  strips: DecodedStripResult[];
  /** `stitchStrips` warnings — the model said something the stitcher could not use. */
  warnings: string[];
}

/** Confidence bucket for one token, from its natural-log probability. The thresholds are the
 *  labelling loop's (docs/rung3): above −0.1 the decode is right ~80% of the time, below −1.0
 *  almost never. Colour is a hint for the eye, never the claim itself — the number is printed. */
function bucket(lp: number): "sure" | "unsure" | "doubt" {
  if (lp > -0.1) return "sure";
  if (lp > -1.0) return "unsure";
  return "doubt";
}

const fmt = (lp: number) => lp.toFixed(2);

export function DecodePanel({ decode }: { decode: RawDecode | null }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [id2token, setId2token] = useState<Record<string, string> | null>(null);

  // The vocabulary, for spelling the ids. Fetched once, only when this panel is on screen — it is
  // the same ~12 KB `model.json` the decode already pulled, so this is a cache hit in practice.
  useEffect(() => {
    if (!decode || id2token) return;
    let live = true;
    void getMeta()
      .then((m) => live && setId2token(m.id2token))
      .catch(() => undefined); // the ids are still printable without it
    return () => {
      live = false;
    };
  }, [decode, id2token]);

  // A new page resets the selection; keeping an index into the previous page's strips would show
  // the wrong strip's tokens under the new page's name.
  useEffect(() => setSelected(null), [decode]);

  const totalTokens = useMemo(
    () => (decode ? decode.strips.reduce((n, s) => n + s.ids.length, 0) : 0),
    [decode]
  );

  if (!decode) {
    return (
      <div className="kv-decode" id="decode-panel" data-decode="empty">
        <div className="kv-advanced__row">
          <strong>{TR.decode.title}</strong>
        </div>
        <p className="kv-advanced__note">{TR.decode.empty}</p>
      </div>
    );
  }

  const sel = selected != null ? (decode.strips[selected] ?? null) : null;
  const where = decode.where === "server" ? TR.decode.whereServer : TR.decode.whereBrowser;

  /** The whole raw decode as one file — the shape a labelling session wants, not a screenshot. */
  function onDownload() {
    if (!decode) return;
    const payload = {
      page: decode.name,
      where: decode.where,
      warnings: decode.warnings,
      strips: decode.strips.map((s) => ({
        name: s.name,
        system: s.system,
        window: s.window,
        tokens: s.tokens,
        ids: s.ids,
        tokenTexts: id2token ? s.ids.map((i) => id2token[String(i)] ?? `<${i}?>`) : undefined,
        logprobs: s.logprobs,
        hitCap: s.hitCap,
        minLogprob: s.minLogprob,
        meanLogprob: s.meanLogprob,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${decode.name || "decode"}-tokens.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div
      className="kv-decode"
      id="decode-panel"
      data-decode="ready"
      data-decode-strips={decode.strips.length}
      data-decode-tokens={totalTokens}
      data-decode-where={decode.where}
    >
      <div className="kv-advanced__row">
        <strong>{TR.decode.title}</strong>
        <span className="kv-advanced__note">
          {TR.decode.summary(decode.strips.length, totalTokens, where)}
        </span>
        <button
          type="button"
          id="decode-download"
          className="kv-btn kv-btn--ghost"
          title={TR.decode.downloadTitle}
          onClick={onDownload}
        >
          {TR.decode.download}
        </button>
      </div>
      <p className="kv-advanced__note">{TR.decode.subtitle}</p>

      <div className="kv-advanced__row" style={{ alignItems: "flex-start" }}>
        <div className="kv-strips__list" style={{ flex: "0 0 200px", maxHeight: 140, overflowY: "auto" }}>
          {decode.strips.map((s, i) => (
            <button
              key={`${s.system}-${s.window}-${i}`}
              type="button"
              className={`kv-strips__chip${i === selected ? " is-active" : ""}`}
              data-decode-strip={i}
              data-hit-cap={s.hitCap ? "1" : undefined}
              // The FILE name is useless as a label here — every crop of one page shares a long
              // stem and the differing part is the tail, so a row of chips reads as one repeated
              // word. The position is what tells them apart; the name goes in the tooltip.
              title={s.name}
              onClick={() => setSelected(i)}
            >
              {`s${s.system}w${s.window}`}
              {s.hitCap ? " ⚠" : ""}
            </button>
          ))}
        </div>

        <div className="kv-strips__detail" style={{ flex: 1, minWidth: 0 }}>
          {sel ? (
            <>
              <div className="kv-decode__meta">
                <span>{TR.decode.stripLine(sel.system, sel.window)}</span>
                <span>{TR.decode.tokenCount(sel.ids.length)}</span>
                <span>{TR.decode.confidence(fmt(sel.meanLogprob), fmt(sel.minLogprob))}</span>
              </div>
              {sel.hitCap && <div className="kv-decode__cap">{TR.decode.hitCap}</div>}

              <div>
                <span className="kv-strips__label">{TR.decode.text} </span>
                <code className="kv-decode__line">{sel.tokens}</code>
              </div>

              <div className="kv-strips__label" style={{ marginTop: "var(--space-2)" }}>
                {TR.decode.tokenList}
              </div>
              <ol className="kv-decode__tokens" data-token-count={sel.ids.length}>
                {sel.ids.map((id, i) => (
                  <li key={i} className="kv-decode__token" data-conf={bucket(sel.logprobs[i] ?? 0)}>
                    <span className="kv-decode__tok">{id2token?.[String(id)] ?? `#${id}`}</span>
                    <span className="kv-decode__lp">{fmt(sel.logprobs[i] ?? 0)}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="kv-advanced__note">{TR.decode.empty2}</p>
          )}
        </div>
      </div>

      {decode.warnings.length > 0 && (
        <details className="kv-decode__warnings" data-warnings={decode.warnings.length}>
          <summary>{TR.decode.warnings(decode.warnings.length)}</summary>
          <p className="kv-advanced__note">{TR.decode.warningsNote}</p>
          <ul>
            {decode.warnings.map((w, i) => (
              <li key={i}>
                <code>{w}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
