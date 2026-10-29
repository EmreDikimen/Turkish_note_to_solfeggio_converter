/**
 * The native app's score, drawn by the web app's own engraver inside a WebView (M2, option (a) of
 * docs/mobile/plan.md §Open #3 — owner, 2026-10-29; a native engraver stays planned for later).
 *
 * ⭐ ONE ENGRAVER. This mounts `SheetView` — the component the web app, the strip renderer and the
 * training data all draw with — with the props `App.tsx` gives a reader's page, so the phone shows
 * what the web shows. Nothing is re-decided here.
 *
 * The bridge to React Native is two calls and nothing else:
 *   - the phone calls `window.__komaLoad({ doc, structure })` (via `injectJavaScript`) to show a page;
 *   - this page posts `{ type: "ready" }` once it can take one, and `{ type: "measure", index }`
 *     when a bar is tapped, through `window.ReactNativeWebView.postMessage`.
 *
 * ⚠ Width: the engraving is fitted to the phone the way the web's phone view does it — a narrower
 * `contentWidth`, never a transform on `.kv-score` (CLAUDE.md group 4).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { groupMeasures, type NoteModelDocument } from "@turkish-omr/core";
import { SheetView, SHEET_CONTENT_WIDTH, SHEET_SIDE_MARGIN } from "../SheetView";
import { navMarksFromStructure, repeatSpansFromStructure } from "../../../../tools/render/structure-view";
import type { ScoreStructure } from "../../../../tools/render/stitch";

interface Payload {
  doc: NoteModelDocument;
  structure?: ScoreStructure;
}

type Native = { ReactNativeWebView?: { postMessage(msg: string): void } };
type Loader = { __komaLoad?: (p: Payload) => void };

function post(msg: object): void {
  (window as unknown as Native).ReactNativeWebView?.postMessage(JSON.stringify(msg));
}

/**
 * App.tsx's phone rule: fit the engraving to the `.kv-score` box's CONTENT width (inside its
 * padding), never narrower than 240, only ever narrower than the default. ⚠ The content box, not the
 * window — the first build used `innerWidth` and every staff ran 14 px off the right edge.
 */
function fitWidth(boxContentW: number): number | undefined {
  const fit = Math.max(240, Math.round(boxContentW) - SHEET_SIDE_MARGIN * 2);
  return fit >= SHEET_CONTENT_WIDTH ? undefined : Math.round(fit / 8) * 8;
}

export function ScoreView() {
  const [payload, setPayload] = useState<Payload | null>(null);
  // `null` until the box is measured; then `{ w }`, where `w` undefined means "the default width"
  // (a screen wide enough to need no fitting — a tablet).
  const [fit, setFit] = useState<{ w: number | undefined } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as unknown as Loader).__komaLoad = (p) => setPayload(p);
    post({ type: "ready" });
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      const inner = e ? (e.contentBoxSize?.[0]?.inlineSize ?? e.contentRect.width) : 0;
      if (inner > 0) setFit({ w: fitWidth(inner) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const doc = payload?.doc ?? null;
  const structure = payload?.structure;
  // The same two derivations App.tsx makes for a decoded page (written score, not written out).
  const repeatSpans = useMemo(
    () => (doc && structure ? repeatSpansFromStructure(structure, groupMeasures(doc).length) : undefined),
    [doc, structure],
  );
  const navMarks = useMemo(() => (structure ? navMarksFromStructure(structure) : undefined), [structure]);

  return (
    <div ref={box} className="kv-score kv-paper">
      {doc && fit && (
      <SheetView
        doc={doc}
        contentWidth={fit.w}
        // App.tsx's defaults for a reader's page: per-measure accidentals, the staff says what it
        // plays (SIG_TOLERANT is off for a human), no lyrics unless asked.
        accidentalMode="measure"
        sigTolerant={false}
        showLyrics={false}
        lyricHyphens={false}
        repeatSpans={repeatSpans}
        navMarks={navMarks}
        editMode={false}
        playing={false}
        getPositionMs={() => null}
        onSeekToMeasure={(m) => post({ type: "measure", index: m.index })}
      />
      )}
    </div>
  );
}
