/**
 * Gelişmiş — everything that serves the project rather than the listener.
 *
 * What lives here and why: sample/JSON loading and the slice inspector are development inputs;
 * "Şeritleri oku" is the Rung-3 labeling loop's entry; aktarım, değiştirme işaretleri, hece
 * çizgisi and tekrarlar are engraving options a friend has no reason to touch (tekrarlar in
 * particular is a drawn-only Phase-2 preview that changes the notation for no musical reason).
 *
 * It is a plain <details>, collapsed by default. Verbose props on purpose: App owns every piece
 * of state, and this panel holds none of it.
 *
 * ⚠ `#strips-input` is inside here, and a closed <details> hides its subtree — tools/browser/
 * app-smoke.ts opens `#advanced` before setting files on it.
 */

import type { NoteModelDocument } from "@turkish-omr/core";
import type { AccidentalMode } from "../SheetView";
import type { ExportStrip } from "../stripExport";
import { PitchRangeNote } from "./PitchRangeNote";
import { StripPanel } from "./StripPanel";
import { TR } from "./strings";

export function AdvancedPanel({
  doc,
  samples,
  sampleFile,
  onSample,
  onLoadJson,
  onStrips,
  omrBusy,
  transpose,
  transposeOptions,
  onTranspose,
  keepSheet,
  onKeepSheet,
  accidentalMode,
  onAccidentalMode,
  showLyrics,
  lyricHyphens,
  onLyricHyphens,
  showRepeats,
  onShowRepeats,
  sheetView,
  strips,
  selectedStripId,
  onSelectStrip,
}: {
  doc: NoteModelDocument | null;
  samples: readonly { label: string; file: string }[];
  sampleFile: string;
  onSample: (file: string) => void;
  onLoadJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStrips: (e: React.ChangeEvent<HTMLInputElement>) => void;
  omrBusy: boolean;
  transpose: number;
  transposeOptions: readonly (readonly [number, string])[];
  onTranspose: (commas: number) => void;
  keepSheet: boolean;
  onKeepSheet: (v: boolean) => void;
  accidentalMode: AccidentalMode;
  onAccidentalMode: (m: AccidentalMode) => void;
  showLyrics: boolean;
  lyricHyphens: boolean;
  onLyricHyphens: (v: boolean) => void;
  showRepeats: boolean;
  onShowRepeats: (v: boolean) => void;
  /** The strip exporter's preview only makes sense while the sheet is engraved. */
  sheetView: boolean;
  strips: ExportStrip[];
  selectedStripId: string | null;
  onSelectStrip: (id: string | null) => void;
}) {
  return (
    <details id="advanced" className="kv-advanced">
      <summary>
        {TR.advanced.summary} <span className="kv-advanced__note">{TR.advanced.note}</span>
      </summary>

      <div className="kv-advanced__body">
        <div className="kv-advanced__row">
          <label className="kv-field">
            <span>{TR.advanced.sample}</span>
            <select value={sampleFile} onChange={(e) => e.target.value && onSample(e.target.value)}>
              <option value="" disabled>
                {TR.advanced.sampleLoaded}
              </option>
              {samples.map((s) => (
                <option key={s.file} value={s.file}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="kv-field">
            <span>{TR.advanced.loadJson}</span>
            <input type="file" accept="application/json,.json" onChange={onLoadJson} />
          </label>

          <label className="kv-field" title={TR.advanced.readStripsTitle}>
            <span>{TR.advanced.readStrips}</span>
            <input
              id="strips-input"
              type="file"
              accept="image/*"
              multiple
              onChange={onStrips}
              disabled={omrBusy}
            />
          </label>

          {/* A separate page on purpose (owner, 2026-08-05): a diagnostic view that loads no model
              and makes no score, so it can never disturb what is loaded here. */}
          <a href="/slices.html" title={TR.advanced.sliceInspectorTitle}>
            {TR.advanced.sliceInspector}
          </a>
        </div>

        <div className="kv-advanced__row">
          <label className="kv-field" title={TR.advanced.transposeTitle}>
            <span>{TR.advanced.transpose}</span>
            <select value={transpose} onChange={(e) => onTranspose(Number(e.target.value))}>
              {transposeOptions.map(([commas, label]) => (
                <option key={commas} value={commas}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="kv-field" title={TR.advanced.keepSheetTitle}>
            <input
              type="checkbox"
              checked={keepSheet}
              onChange={(e) => onKeepSheet(e.target.checked)}
            />
            <span>{TR.advanced.keepSheet}</span>
          </label>

          <label className="kv-field" title={TR.advanced.accidentalsTitle}>
            <span>{TR.advanced.accidentals}</span>
            <select
              value={accidentalMode}
              onChange={(e) => onAccidentalMode(e.target.value as AccidentalMode)}
            >
              <option value="every">{TR.advanced.accidentalsEvery}</option>
              <option value="keysig">{TR.advanced.accidentalsKeysig}</option>
              <option value="measure">{TR.advanced.accidentalsMeasure}</option>
            </select>
          </label>

          <label
            className={`kv-field${showLyrics ? "" : " is-disabled"}`}
            title={TR.advanced.hyphensTitle}
          >
            <input
              type="checkbox"
              checked={lyricHyphens}
              disabled={!showLyrics}
              onChange={(e) => onLyricHyphens(e.target.checked)}
            />
            <span>{TR.advanced.hyphens}</span>
          </label>

          <label className="kv-field" title={TR.advanced.repeatsTitle}>
            <input
              type="checkbox"
              checked={showRepeats}
              onChange={(e) => onShowRepeats(e.target.checked)}
            />
            <span>{TR.advanced.repeats}</span>
          </label>
        </div>

        {sheetView && (
          <StripPanel
            strips={strips}
            selectedId={selectedStripId}
            onSelect={onSelectStrip}
            mode={accidentalMode === "keysig" ? "keysig" : "every"}
            onMode={(m) => {
              onAccidentalMode(m);
              onSelectStrip(null);
            }}
          />
        )}

        <PitchRangeNote doc={doc} />
      </div>
    </details>
  );
}
