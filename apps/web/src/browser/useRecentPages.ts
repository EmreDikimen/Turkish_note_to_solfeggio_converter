/**
 * The pages this browser has already read: the list, the record the score on screen belongs to,
 * and the one save path (a debounced effect — never add a second; CLAUDE.md, group 3). Moved out of
 * App.tsx on 2026-11-20; the statements are unchanged.
 */
import { useState, useEffect, type SetStateAction } from "react";
import { type RecentMeta, listPages, savePage, readPage, deletePage, renamePage, clearPages } from "./recentPages";
import { makamDisplay, type NoteModelDocument, type MakamDetection } from "@turkish-omr/core";
import { SAVE_DEBOUNCE_MS } from "./urlParams";
import type { ScoreStructure } from "@turkish-omr/core/labels/stitch";
import type { AppError } from "../ui/errors";
import type { OmrStatus } from "../ui/status";
import type { RawDecode } from "../ui/DecodePanel";

export function useRecentPages({
  bpm,
  doc,
  loadDoc,
  makamSlug,
  onStop,
  setBpm,
  setError,
  setOmrStatus,
  setRawDecode,
  setSampleFile,
  structure,
}: {
  bpm: number;
  doc: NoteModelDocument | null;
  loadDoc: (raw: NoteModelDocument, detected?: MakamDetection, structure?: ScoreStructure) => void;
  makamSlug: string;
  onStop: () => void;
  setBpm: (value: SetStateAction<number>) => void;
  setError: (value: SetStateAction<AppError | null>) => void;
  setOmrStatus: (value: SetStateAction<OmrStatus | null>) => void;
  setRawDecode: (value: SetStateAction<RawDecode | null>) => void;
  setSampleFile: (value: SetStateAction<string>) => void;
  structure: ScoreStructure | null;
}) {
  // ── The pages this browser has already read (owner, 2026-09-05) ─────────────────────────────
  // A decode costs 35–55 s and a round trip to Cloud Run, and a page refresh used to throw it away.
  // The store, its limits and why it is a CACHE and not a save: apps/web/src/browser/recentPages.ts.
  const [recent, setRecent] = useState<RecentMeta[]>([]);
  // Which stored record the score on screen IS, or null when it came from anywhere else.
  //
  // ⚠ **ONLY A DECODE OPENS A RECORD.** A `?score=` page, a bundled sample and a hand-loaded JSON
  // all set this to null, so nothing that was not read from a photograph is ever written — the list
  // is "pages you have read", not "scores you have opened". That is also why the browser checks
  // load their fixtures through `?score=` without filling a reader's list.
  // `createdAt` rides along because an edit REWRITES the record and must not move its birthday.
  const [saved, setSaved] = useState<{ id: string; name: string; createdAt: number } | null>(null);
  // Whether the list is unfolded. Open on arrival — the app opens with no score and the list is
  // then the only thing on the page worth reading — and folded away by `loadDoc`, because once a
  // score is installed the list is a way back, not the destination.
  const [recentOpen, setRecentOpen] = useState(true);

  /* ── Remembering the page (owner, 2026-09-05) ───────────────────────────────────────────────
   *
   * Three moving parts and nothing else: the list is read once on arrival, the score on screen is
   * written back a moment after the edits stop, and opening a row installs it. The store, its
   * limits, and why every call here can be treated as "there is nothing": recentPages.ts.
   */

  // The list, on arrival. Metas only (~100 bytes a page) — the scores stay in the store until one
  // is opened, which is the whole reason there are two object stores.
  useEffect(() => {
    void listPages().then(setRecent);
  }, []);

  /**
   * Write the score on screen back to its record, a moment after the edits stop.
   *
   * ⚠ **THIS IS THE ONLY SAVE PATH** — there is deliberately no explicit save call after a decode.
   * Holding a record (`saved`) with a document in hand IS what a stored page is, so the first write
   * falls out of the same effect as the thousandth edit and no future load path can install a page
   * the store never hears about. It is also why undo/redo are remembered for free: `history.doc` is
   * a new object per edit, and this effect sees exactly those.
   */
  useEffect(() => {
    if (!saved || !doc) return;
    const t = setTimeout(() => {
      // ⚠ The makam is re-read HERE rather than stamped when the record was opened (owner,
      // 2026-09-05: *"makamı da isme dahil olsun"*). A decode guesses it, the modal confirms it and
      // the transport can change it afterwards — so the only version that is never stale is the one
      // taken at the moment of writing. It is stored BESIDE the name, never inside it: baked into
      // the name string it would go stale on any of those three, and a rename would delete it.
      const makam = makamSlug ? makamDisplay(makamSlug) : "";
      void savePage({ ...saved, makam, doc, structure, bpm }).then(setRecent);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [saved, doc, structure, bpm, makamSlug]);

  /**
   * Install a stored page.
   *
   * ⚠ No `detected` makam is handed to `loadDoc`. The makam was decided when the page was first
   * read and `loadDoc` wrote it into the document, so `resolveMakam` recovers it here; guessing
   * again would silently overrule the answer the reader gave the modal — and raise the modal a
   * second time for a page they have already answered for.
   */
  function openRecent(id: string) {
    void readPage(id).then((p) => {
      if (!p) {
        // It was evicted or cleared in another tab. The list is the answer, not an error.
        void listPages().then(setRecent);
        return;
      }
      onStop();
      loadDoc(p.doc, undefined, p.structure ?? undefined);
      // ⚠ The model's own tokens are NOT stored (recentPages.ts). Clearing this is what stops the
      // decode inspector showing the PREVIOUS page's tokens underneath this page's notes.
      setRawDecode(null);
      setSampleFile("");
      setError(null);
      setOmrStatus(null);
      setSaved({ id: p.id, name: p.name, createdAt: p.createdAt });
      // After `loadDoc`, which sets the piece's own estimate: a tempo the reader chose wins over it.
      if (p.bpm > 0) setBpm(p.bpm);
      // `readPage` touched the record, so the order has changed.
      void listPages().then(setRecent);
    });
  }

  /**
   * Forget one page.
   *
   * ⚠ The score STAYS ON SCREEN when it is the one being removed. The ✕ says "drop this from the
   * list"; closing someone's open page because they tidied a list is not that. Dropping `saved` is
   * what makes it stick — from here on the edits are not written anywhere.
   */
  function removeRecent(id: string) {
    if (saved?.id === id) setSaved(null);
    void deletePage(id).then(setRecent);
  }

  /**
   * Rename a stored page — the one on screen or any other (owner, 2026-09-05).
   *
   * ⚠ **`saved` must move with the store, and that is not tidiness.** The save effect above writes
   * `saved.name` back on the next edit, so a rename that updated only the store would be silently
   * REVERTED two seconds after the reader's next keystroke. One rename, both places.
   *
   * ⚠ The document is deliberately untouched: `doc.name` seeds the per-piece tuplet-style hash in
   * `SheetView`, so renaming through it would re-engrave the triplets. The card's heading reads the
   * stored name instead (`pageName`), which is what keeps the two from drifting.
   */
  function renameRecent(id: string, name: string) {
    const clean = name.trim();
    if (!clean) return;
    setSaved((s) => (s && s.id === id ? { ...s, name: clean } : s));
    void renamePage(id, clean).then(setRecent);
  }

  function clearRecent() {
    setSaved(null);
    void clearPages().then(setRecent);
  }

  return { clearRecent, openRecent, recent, recentOpen, removeRecent, renameRecent, saved, setRecentOpen, setSaved };
}
