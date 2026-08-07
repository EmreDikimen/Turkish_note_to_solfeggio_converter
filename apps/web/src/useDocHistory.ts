import { useCallback, useMemo, useRef, useState } from "react";
import type { NoteModelDocument } from "@turkish-omr/core";

/** How long after an edit a same-keyed edit still counts as part of the same gesture. One
 *  wheel-scroll or one piano-roll drag emits dozens of edits; they must undo as one. */
const COALESCE_MS = 600;
/** Deepest the past stack goes. A score is a few hundred KB, so this is bounded memory. */
const MAX_PAST = 100;

interface HistoryState {
  present: NoteModelDocument | null;
  past: NoteModelDocument[];
  future: NoteModelDocument[];
}

export interface DocHistory {
  doc: NoteModelDocument | null;
  /** Install a freshly loaded score. Clears the history — you cannot undo past a new file. */
  reset: (d: NoteModelDocument) => void;
  /** Make an edit. `coalesce` merges consecutive same-keyed edits into one undo entry. */
  apply: (fn: (prev: NoteModelDocument) => NoteModelDocument, opts?: { coalesce?: string }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Undo/redo for the score document.
 *
 * The app already rebuilt `doc` immutably on every edit, which is the whole requirement — this
 * hook just keeps the discarded versions. It ships WITH the direct editor rather than after it:
 * clicking a note and pressing ✕ with no way back is worse than the modal it replaces, which at
 * least had Cancel.
 *
 * ⚠ Undo restores the DOCUMENT, not the selection. Deletes renumber every event's `index`, so an
 * index held across an undo can name a different note; the caller clears its selection instead of
 * guessing (see `App`'s undo/redo handlers).
 */
export function useDocHistory(): DocHistory {
  const [state, setState] = useState<HistoryState>({ present: null, past: [], future: [] });
  // When the last coalescing edit happened, and under which key. Refs, not state: they only
  // decide how the NEXT edit records itself and must never cause a render of their own.
  const lastKey = useRef<string | null>(null);
  const lastAt = useRef(0);

  const reset = useCallback((d: NoteModelDocument) => {
    lastKey.current = null;
    setState({ present: d, past: [], future: [] });
  }, []);

  const apply = useCallback(
    (fn: (prev: NoteModelDocument) => NoteModelDocument, opts?: { coalesce?: string }) => {
      const key = opts?.coalesce ?? null;
      const now = Date.now();
      // Same gesture, still warm → the top of `past` is already this gesture's starting point,
      // so amend the present in place instead of pushing another entry.
      const merge = key != null && key === lastKey.current && now - lastAt.current < COALESCE_MS;
      lastKey.current = key;
      lastAt.current = now;
      setState((s) => {
        if (!s.present) return s;
        const next = fn(s.present);
        if (next === s.present) return s; // a no-op edit is not a history entry
        const past = merge ? s.past : [...s.past, s.present].slice(-MAX_PAST);
        return { present: next, past, future: [] };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    lastKey.current = null; // an undo always ends the current gesture
    setState((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev || !s.present) return s;
      return { present: prev, past: s.past.slice(0, -1), future: [s.present, ...s.future] };
    });
  }, []);

  const redo = useCallback(() => {
    lastKey.current = null;
    setState((s) => {
      const next = s.future[0];
      if (!next || !s.present) return s;
      return { present: next, past: [...s.past, s.present], future: s.future.slice(1) };
    });
  }, []);

  return useMemo(
    () => ({
      doc: state.present,
      reset,
      apply,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [state, reset, apply, undo, redo],
  );
}
