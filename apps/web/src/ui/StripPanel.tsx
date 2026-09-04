/**
 * Step-2c strip panel: lists the training strips for the current score + mode, highlights the
 * selected strip's crop rectangle on the live sheet (via SheetView's `highlightRect`), and shows
 * its LilyPond label + decoded notes — the manual image-vs-label check.
 *
 * The actual PNG files are produced by the Playwright batch exporter (tools/render/render.ts),
 * which reads `window.__omrStrips`. This is a developer tool and lives in the Gelişmiş panel.
 */

import type { ExportStrip } from "../stripExport";
import { Segmented } from "./Segmented";
import { TR } from "./strings";

export function StripPanel({
  strips,
  selectedId,
  onSelect,
  mode,
  onMode,
}: {
  strips: ExportStrip[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  mode: "every" | "keysig";
  onMode: (m: "every" | "keysig") => void;
}) {
  const sel = strips.find((s) => s.id === selectedId) ?? null;
  return (
    <div className="kv-strips">
      <div className="kv-advanced__row">
        <strong>{TR.strips.title}</strong>
        <Segmented
          value={mode}
          onChange={onMode}
          items={[
            { value: "every", label: TR.strips.modeEvery },
            { value: "keysig", label: TR.strips.modeKeysig },
          ]}
        />
        <span className="kv-advanced__note">{TR.strips.count(strips.length)}</span>
      </div>

      <div className="kv-advanced__row kv-advanced__row--top">
        <div className="kv-strips__list">
          {strips.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`kv-strips__chip${s.id === selectedId ? " is-active" : ""}`}
              onClick={() => onSelect(s.id)}
            >
              {s.id}
            </button>
          ))}
        </div>
        <div className="kv-strips__detail">
          {sel ? (
            <>
              <div>
                <span className="kv-strips__label">{TR.strips.label} </span>
                <code className="kv-strips__code">{sel.label}</code>
              </div>
              <div>
                <span className="kv-strips__label">{TR.strips.decoded} </span>
                {sel.decoded}
              </div>
            </>
          ) : (
            <span className="kv-strips__label">{TR.strips.empty}</span>
          )}
        </div>
      </div>
    </div>
  );
}
