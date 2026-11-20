/**
 * Reading a page: the three ways in (a page image, a set of strip images, or a note-model JSON),
 * each ending in `loadDoc`. The status, busy and raw-decode STATE stays in App, because the recent
 * pages share it; only the handlers live here. Moved out of App.tsx on 2026-11-20, unchanged.
 */
import { type NoteModelDocument, detectMakam, type MakamDetection } from "@turkish-omr/core";
import { toAppError, ReadError, type AppError } from "../ui/errors";
import { busy as busyStatus, readingStatus, stripsSummary, whereOf, pageSummary, type OmrStatus } from "../ui/status";
import { TR } from "../ui/strings";
import { type StripInput, positionFromName, stitchDecoded } from "./pipeline";
import { loadImage } from "./preprocess";
import { decodeStripsRouted } from "./remote";
import { newPageId } from "../browser/recentPages";
import { noteVisit } from "../browser/visits";
import { DENSE_BUDGET } from "../browser/urlParams";
import { isStaleChunkError, claimReload } from "../browser/staleBuild";
import type { ScoreStructure } from "@turkish-omr/core/labels/stitch";
import type { RawDecode } from "../ui/DecodePanel";
import type { SetStateAction } from "react";

export function useReadPage({
  loadDoc,
  onStop,
  setError,
  setMakamPrompt,
  setOmrBusy,
  setOmrStatus,
  setRawDecode,
  setReadStartedAt,
  setSampleFile,
  setSaved,
}: {
  loadDoc: (raw: NoteModelDocument, detected?: MakamDetection, structure?: ScoreStructure) => void;
  onStop: () => void;
  setError: (value: SetStateAction<AppError | null>) => void;
  setMakamPrompt: (value: SetStateAction<MakamDetection | null>) => void;
  setOmrBusy: (value: SetStateAction<boolean>) => void;
  setOmrStatus: (value: SetStateAction<OmrStatus | null>) => void;
  setRawDecode: (value: SetStateAction<RawDecode | null>) => void;
  setReadStartedAt: (value: SetStateAction<number | null>) => void;
  setSampleFile: (value: SetStateAction<string>) => void;
  setSaved: (value: SetStateAction<{ id: string; name: string; createdAt: number; } | null>) => void;
}) {

  // Load a note-model JSON the user picked from disk. Reads the file as text, parses it,
  // checks the schema version (so we fail clearly on an incompatible format), stops any
  // current playback, and swaps in the new score. Any error is shown instead of crashing.
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((t) => {
        const parsed = JSON.parse(t) as NoteModelDocument;
        if (parsed.schemaVersion !== 1) throw new Error(`unsupported schemaVersion ${parsed.schemaVersion}`);
        onStop();
        loadDoc(parsed);
        setRawDecode(null); // this score did not come from the model — see the state's comment
        setSaved(null); // nor is it a page this browser read — see `saved`
        setSampleFile(""); // a user-picked file isn't one of the bundled samples
        setError(null);
      })
      .catch((err) => setError(toAppError(err, "file")));
  }

  /**
   * Read strip images with the OMR model and load the result as a score.
   *
   * This is the product path end to end, minus the slicer (which arrives at W6): the same
   * `preprocessCanvas` + `greedyDecode` the browser gate validates, then `stitchStrips`, then the
   * ordinary `loadDoc`. Pick the `*_sNN_wNN.png` crops of one page and the whole page is read.
   *
   * Strips are ordered by their filename's row/crop suffix rather than by pick order, because a
   * file input's order is the OS's, not the page's — and the stitcher builds the music from
   * `system`/`window`.
   */
  function onStrips(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = ""; // re-picking the same folder must fire change again
    if (!files.length) return;

    files.sort((a, b) => a.name.localeCompare(b.name));
    setError(null);
    setOmrBusy(true);
    setReadStartedAt(Date.now());
    setOmrStatus(busyStatus("strips", "model", TR.status.loadingModel));

    void (async () => {
      const urls: string[] = [];
      try {
        setOmrStatus(busyStatus("strips", "decode", TR.status.readingStrips(files.length)));
        const strips: StripInput[] = [];
        for (const [i, f] of files.entries()) {
          const url = URL.createObjectURL(f);
          urls.push(url);
          strips.push({ ...positionFromName(f.name, i), image: await loadImage(url), name: f.name });
        }

        const pageName = files[0]!.name.replace(/_s\d+_w\d+\.\w+$/, "") || "decoded-page";
        const t0 = performance.now();
        const routed = await decodeStripsRouted(strips, {
          onProgress: (done, total, current) =>
            setOmrStatus(readingStatus("strips", done, total, current)),
        });
        const totalMs = performance.now() - t0;
        // `expand: false` — keep the page as it is WRITTEN and take the repeats at playback time.
        const result = stitchDecoded(routed.strips, pageName, { expand: false });
        setRawDecode({
          name: pageName,
          where: routed.where,
          strips: routed.strips,
          warnings: result.warnings,
        });

        const notes = result.doc.events.filter((ev) => ev.kind === "note").length;
        if (!result.doc.events.length)
          throw new ReadError("read-failed", TR.errors.nothingReadStrips);

        // Nothing decoded carries metadata, so the makam is guessed from the notes themselves and
        // then confirmed by the user — it decides how the piece SOUNDS, not just how it is filed.
        const detected = detectMakam(result.doc);
        onStop();
        loadDoc(result.doc, detected, result.structure);
        // A page was READ: open a record for it. The write itself is the effect above — see `saved`.
        setSaved({ id: newPageId(), name: pageName, createdAt: Date.now() });
        noteVisit("read"); // the one event that means a person really read music (analytics/visits.ts)
        setMakamPrompt(detected);
        setSampleFile("");
        setOmrStatus(
          stripsSummary({
            strips: strips.length,
            notes,
            measures: result.writtenMeasures,
            totalMs,
            detected,
            where: whereOf(routed),
            warnings: result.warnings.length,
          })
        );
        // Warnings are the stitcher's "this construct was malformed" notes; a mostly-right score in
        // the editor IS the point, so they inform rather than block.
        if (result.warnings.length) console.warn("stitch warnings:", result.warnings);
      } catch (err) {
        setError(toAppError(err, "read-failed"));
        setOmrStatus(null);
      } finally {
        urls.forEach(URL.revokeObjectURL);
        setOmrBusy(false);
        setReadStartedAt(null);
      }
    })();
  }

  /**
   * Read a WHOLE PAGE: slice it in the browser, then read every strip it cut (MVP W7).
   *
   * This is the product path with nothing left out — the same slicer W6 checked against Python over
   * the corpus, feeding the same `decodeStripsToDoc` "Read strips" uses. It shares that handler's
   * shape on purpose; what it adds is the slice, and the honest wait in front of it.
   *
   * ⚠ It is SLOW, and knowingly so: the deskew sweep is 41 full-page rotations (~35 s), then ~1.1 s
   * a strip. The sweep yields between rotations so the tab stays alive and the count keeps moving,
   * but a straight screenshot still pays the whole search to learn it is straight — the latency
   * work is written up in docs/STATUS.md and is a behaviour change with its own measurement.
   *
   * The slicer is imported lazily so opening the harness does not download opencv.js.
   */
  function readPageFile(file: File) {
    setError(null);
    setOmrBusy(true);
    setReadStartedAt(Date.now());
    setOmrStatus(busyStatus("page", "model", TR.status.loadingModel));

    void (async () => {
      const url = URL.createObjectURL(file);
      try {
        const { slicePage } = await import("./page");

        const stem = file.name.replace(/\.[^.]+$/, "") || "page";
        setOmrStatus(busyStatus("page", "slice", TR.status.slicing));
        const sliced = await slicePage(url, stem, {
          tokenBudget: DENSE_BUDGET, // ⚠ experiment, `?dense=` — undefined in a normal visit
          onProgress: (phase, done, total) => {
            // The slicer reports its phases in English; the UI names them in Turkish.
            const name = TR.phases[phase] ?? phase;
            setOmrStatus(
              busyStatus("page", "slice", done != null ? `${name}… ${done}/${total}` : `${name}…`)
            );
          },
        });
        if (!sliced.strips.length) throw new ReadError("no-staves", TR.errors.noStaves);

        const t0 = performance.now();
        const routed = await decodeStripsRouted(sliced.strips, {
          onProgress: (done, total, current) =>
            setOmrStatus(readingStatus("page", done, total, current)),
        });
        const decodeMs = performance.now() - t0;
        const result = stitchDecoded(routed.strips, stem, { expand: false });
        setRawDecode({
          name: stem,
          where: routed.where,
          strips: routed.strips,
          warnings: result.warnings,
        });

        const notes = result.doc.events.filter((ev) => ev.kind === "note").length;
        if (!result.doc.events.length)
          throw new ReadError("read-failed", TR.errors.nothingRead);

        const detected = detectMakam(result.doc);
        onStop();
        loadDoc(result.doc, detected, result.structure);
        // A page was READ: open a record for it. The write itself is the effect above — see `saved`.
        setSaved({ id: newPageId(), name: stem, createdAt: Date.now() });
        noteVisit("read"); // the one event that means a person really read music (analytics/visits.ts)
        setMakamPrompt(detected);
        setSampleFile("");
        setOmrStatus(
          pageSummary({
            staves: sliced.nStaves,
            strips: sliced.strips.length,
            notes,
            measures: result.writtenMeasures,
            sliceMs: sliced.totalMs,
            skewDeg: sliced.skewDeg,
            decodeMs,
            detected,
            where: whereOf(routed),
            warnings: result.warnings.length,
          })
        );
        if (result.warnings.length) console.warn("stitch warnings:", result.warnings);
      } catch (err) {
        // A tab older than the live deploy cannot fetch the slicer chunk it was built against:
        // say so and reload once, rather than show a read error that no retry can fix (staleBuild.ts).
        if (isStaleChunkError(err) && claimReload()) {
          setOmrStatus(busyStatus("page", "slice", TR.status.appUpdated));
          window.setTimeout(() => window.location.reload(), 1200);
          return;
        }
        setError(toAppError(err, "read-failed"));
        setOmrStatus(null);
      } finally {
        URL.revokeObjectURL(url);
        setOmrBusy(false);
        setReadStartedAt(null);
      }
    })();
  }

  return { onFile, onStrips, readPageFile };
}
