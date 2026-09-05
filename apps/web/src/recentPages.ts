/**
 * The pages this browser has already read, kept on the reader's own machine.
 *
 * What it is for: a decode costs 35–55 s and, since 2026-09-04, a round trip to Cloud Run. Losing
 * that to a page refresh is the one failure a reader cannot work around — so the score a decode
 * produced, and every edit made to it afterwards, is written to the browser's own store and offered
 * back by name the next time the app opens (owner, 2026-09-05).
 *
 * ⚠ **IT IS A CACHE, NOT A SAVE, AND THE UI SAYS SO.** Nothing here is a promise: a browser evicts
 * script-written storage on its own terms (Safari clears a site untouched for seven days, every
 * engine clears under disk pressure, a private window keeps nothing), and the store belongs to ONE
 * browser on ONE device — a page read on the phone is not there on the laptop. `TR.recent.note` is
 * that sentence in the interface, and it is not decoration.
 *
 * ⚠ **NOTES ONLY — NO IMAGE IS EVER WRITTEN HERE** (owner, 2026-09-05, choosing against it). The
 * uploaded photograph is 2–5 MB against the ~60–125 KB of the score it produced, so keeping it
 * would cost fifty times the space for a picture the reader already has. Two things follow. The
 * footer's `privacy` line stays literally true either way (it speaks about the SERVER), but the
 * reason there is nothing to qualify is this decision — put an image in here and that line needs
 * re-reading. And a restored page cannot be re-decoded or re-sliced from what is stored: the crops
 * are gone, so `rawDecode` (the model's own tokens, ui/DecodePanel.tsx) is deliberately NOT kept
 * and the panel is empty for a restored page rather than showing the previous page's tokens.
 *
 * Why IndexedDB and not `localStorage`, which the app already uses for three settings: the store is
 * written on every edit (debounced), and `localStorage` is SYNCHRONOUS — a 120 KB write blocks the
 * main thread while someone is dragging a note. Its ~5 MB is also one budget shared with those
 * settings, so filling it up would break them and not this. Size is not the reason; 30 scores are
 * about 3.6 MB at the observed 60–125 KB each.
 *
 * ⚠ **EVERY FUNCTION HERE SWALLOWS EVERYTHING AND RESOLVES TO A SAFE VALUE.** Same rule the
 * `localStorage` readers follow (App.tsx, EditPalette.tsx): storage is not merely empty in a
 * private window, it can THROW, and a browser that cannot remember pages must still read them.
 * A caller may treat every result as "there is nothing", never as an error to show.
 *
 * Two stores, not one, and that split is the whole design: `pageMeta` holds the few facts the list
 * draws (name, dates, counts) and `pageBody` holds the score. Listing 30 pages therefore reads ~3 KB
 * instead of ~3.6 MB, because IndexedDB has no way to read half a record.
 */
import type { NoteModelDocument } from "@turkish-omr/core";
import type { ScoreStructure } from "../../../tools/render/stitch";

const DB_NAME = "komavision";
const DB_VERSION = 1;
const META = "pageMeta";
const BODY = "pageBody";

/** How many pages are kept. The 31st read drops the least recently opened (owner, 2026-09-05). */
export const MAX_PAGES = 30;
/**
 * Total cap on the stored scores, and a safety belt rather than the real limit — 30 pages at the
 * observed 60–125 KB is ~3.6 MB, so this only ever fires on a page that decoded pathologically
 * large. It is enforced BEFORE the page count, so one such page cannot evict twenty-nine good ones.
 */
export const MAX_BYTES = 20 * 1024 * 1024;

/** What the list draws. Small on purpose — see the two-store note in the header. */
export interface RecentMeta {
  id: string;
  /**
   * What the reader calls this page. Starts as the page stem the decode was named after — the
   * uploaded file's name without its suffix — and is **renameable** (owner, 2026-09-05).
   *
   * ⚠ It is NOT `doc.name`, and the two must not be merged. `doc.name` seeds a per-piece hash that
   * decides which tuplet mark `SheetView` draws (bracket or curved arc), so renaming a page through
   * the document would silently change how its triplets are engraved. This field is the label; the
   * document keeps its own identity.
   */
  name: string;
  /**
   * The makam, ready to display ("Hicaz"), or "" for a page playing as written.
   *
   * ⚠ **Stored beside the name and never inside it** (owner, 2026-09-05: *"makamı da isme dahil
   * olsun"*). It is re-derived on every save from the score itself, so it survives a rename and
   * follows the reader changing the makam later — a makam baked into the name string would go stale
   * the moment either of those happened, and a rename would delete it outright.
   */
  makam: string;
  /** When it was first read. Never moves. */
  createdAt: number;
  /** Last edited OR last opened — this is what eviction sorts on, so it is a true LRU. */
  updatedAt: number;
  notes: number;
  /** Written measures: bars as the page prints them, so a repeat counts once. */
  measures: number;
  /** Size of the stored score in bytes, for `MAX_BYTES`. */
  bytes: number;
}

/** A stored page, opened. The score plus the two settings that are the reader's and not the doc's. */
export interface RecentPage extends RecentMeta {
  doc: NoteModelDocument;
  /** The signs a decoded page carries. Null for a page whose decode found none. */
  structure: ScoreStructure | null;
  bpm: number;
}

/** What a caller hands in to write a page. `id` and `createdAt` identify the record it updates. */
export interface RecentInput {
  id: string;
  name: string;
  makam: string;
  createdAt: number;
  doc: NoteModelDocument;
  structure: ScoreStructure | null;
  bpm: number;
}

/**
 * The LRU clock: `Date.now()`, forced to move.
 *
 * ⚠ **A BARE `Date.now()` IS NOT ENOUGH AND THIS WAS MEASURED.** Two records written in the same
 * millisecond get the same `updatedAt`, and `sort` then falls back to the order `getAll` returned —
 * which is IndexedDB key order, i.e. alphabetical by id ("fake-30" before "fake-31"). The list is
 * then in the wrong order and eviction drops the wrong page. Real use never writes twice in a
 * millisecond (the save is debounced by two seconds), but a check that stores thirty pages in a
 * loop does, and so would any future bulk write. One counter removes the whole class of it.
 */
let lastStamp = 0;
function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

/** A fresh record id. `randomUUID` needs a secure context, which a plain-http harness is not. */
export function newPageId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `p${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ── The IndexedDB plumbing ──────────────────────────────────────────────────────────────────── */

function ask<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * The database, opened once and remembered.
 *
 * ⚠ Resolves to `null` rather than rejecting when there is no store to open — a private window, a
 * browser with site data blocked, or an `open` that simply never answers because another tab holds
 * an older version (`onblocked`). Every function below treats `null` as "there is nothing", which
 * is the same answer an empty store gives.
 */
let opening: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === "undefined" || indexedDB === null) return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
        if (!db.objectStoreNames.contains(BODY)) db.createObjectStore(BODY, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

/** Is there a store at all? For the UI, which hides the list entirely rather than showing an empty one. */
export function recentAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/* ── Reading ─────────────────────────────────────────────────────────────────────────────────── */

/** Every stored page, most recently touched first. `[]` when there is no store or it is empty. */
export async function listPages(): Promise<RecentMeta[]> {
  try {
    const db = await openDb();
    if (!db) return [];
    const tx = db.transaction(META, "readonly");
    const all = await ask(tx.objectStore(META).getAll() as IDBRequest<RecentMeta[]>);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Open one stored page.
 *
 * ⚠ It also TOUCHES the record — `updatedAt` becomes now — which is what makes eviction a true
 * LRU: the page you came back to yesterday outlives one decoded last week and never looked at
 * since. Returning the page matters more than the touch, so a failed touch is not an error.
 */
export async function readPage(id: string): Promise<RecentPage | null> {
  try {
    const db = await openDb();
    if (!db) return null;
    const tx = db.transaction([META, BODY], "readonly");
    const meta = await ask(tx.objectStore(META).get(id) as IDBRequest<RecentMeta | undefined>);
    const body = await ask(
      tx.objectStore(BODY).get(id) as IDBRequest<{ id: string; json: string } | undefined>,
    );
    if (!meta || !body) return null;
    const parsed = JSON.parse(body.json) as {
      doc: NoteModelDocument;
      structure: ScoreStructure | null;
      bpm: number;
    };
    await touchPage(id);
    return { ...meta, doc: parsed.doc, structure: parsed.structure ?? null, bpm: parsed.bpm };
  } catch {
    return null;
  }
}

/** Move a record to the front of the LRU without rewriting its score. */
async function touchPage(id: string): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(META, "readwrite");
    const store = tx.objectStore(META);
    const meta = await ask(store.get(id) as IDBRequest<RecentMeta | undefined>);
    if (meta) store.put({ ...meta, updatedAt: stamp() });
    await finished(tx);
  } catch {
    /* the page still opened */
  }
}

/* ── Writing ─────────────────────────────────────────────────────────────────────────────────── */

/** Written measures: the highest bar number the document carries. Repeats are written once. */
function measuresOf(doc: NoteModelDocument): number {
  let max = 0;
  for (const ev of doc.events) if ((ev.bar ?? 0) > max) max = ev.bar ?? 0;
  return max;
}

/**
 * Write a page, then bring the store back inside its limits.
 *
 * The score goes in as a JSON STRING rather than a live object: it is cheaper to clone into the
 * store, it cannot trip over a value the structured-clone algorithm dislikes, and its `.length` IS
 * the byte figure `MAX_BYTES` needs — measuring it any other way would mean serialising twice.
 *
 * ⚠ A quota error is not fatal: the oldest page is dropped and the write is tried once more, and if
 * that fails too the caller keeps working with nothing stored. The alternative — telling a reader
 * their edit could not be remembered while they are mid-edit — interrupts the one thing they are
 * doing for something they did not ask for.
 */
export async function savePage(input: RecentInput): Promise<RecentMeta[]> {
  try {
    const db = await openDb();
    if (!db) return [];
    const json = JSON.stringify({
      doc: input.doc,
      structure: input.structure,
      bpm: input.bpm,
    });
    const meta: RecentMeta = {
      id: input.id,
      name: input.name,
      makam: input.makam,
      createdAt: input.createdAt,
      updatedAt: stamp(),
      notes: input.doc.events.filter((e) => e.kind === "note").length,
      measures: measuresOf(input.doc),
      bytes: json.length,
    };

    const write = async () => {
      const tx = db.transaction([META, BODY], "readwrite");
      tx.objectStore(META).put(meta);
      tx.objectStore(BODY).put({ id: input.id, json });
      await finished(tx);
    };

    try {
      await write();
    } catch {
      await dropOldest(db, 1);
      await write(); // one retry; if it throws again the outer catch keeps the app running
    }

    await enforceLimits(db, input.id);
    return await listPages();
  } catch {
    return await listPages();
  }
}

/** Drop the least recently touched `n` records. Used by the quota retry above. */
async function dropOldest(db: IDBDatabase, n: number): Promise<void> {
  const tx = db.transaction(META, "readonly");
  const all = await ask(tx.objectStore(META).getAll() as IDBRequest<RecentMeta[]>);
  const doomed = all.sort((a, b) => a.updatedAt - b.updatedAt).slice(0, n);
  for (const m of doomed) await deletePage(m.id);
}

/**
 * Bring the store back inside `MAX_PAGES` and `MAX_BYTES`, oldest first.
 *
 * ⚠ `keep` is the page just written, and it is never evicted even when it alone breaks `MAX_BYTES`
 * — dropping the score that is on screen would leave the reader looking at a document the app has
 * just decided not to remember, which is worse than being over a cap we chose.
 */
async function enforceLimits(db: IDBDatabase, keep: string): Promise<void> {
  const tx = db.transaction(META, "readonly");
  const all = await ask(tx.objectStore(META).getAll() as IDBRequest<RecentMeta[]>);
  const byRecent = all.sort((a, b) => b.updatedAt - a.updatedAt);

  const doomed: string[] = [];
  let bytes = 0;
  byRecent.forEach((m, i) => {
    bytes += m.bytes;
    if (m.id === keep) return;
    if (i >= MAX_PAGES || bytes > MAX_BYTES) doomed.push(m.id);
  });
  for (const id of doomed) await deletePage(id);
}

/** Longest name kept. A pasted paragraph would make one row taller than the list. */
export const MAX_NAME = 120;

/**
 * Rename a page (owner, 2026-09-05).
 *
 * ⚠ **It writes `pageMeta` only** — the score is not touched, so renaming a 120 KB page costs a
 * ~100-byte write and cannot fail on quota.
 *
 * ⚠ **`updatedAt` is deliberately NOT bumped.** Everywhere else a touch means *the reader used this
 * page*, and it decides eviction; here it would also re-sort the list under the cursor at the exact
 * moment the reader is looking at the row they just typed into. Renaming is labelling, not use.
 *
 * ⚠ An empty or whitespace-only name is REFUSED, and the old one is kept: a nameless row cannot be
 * told from another nameless row, and there is no undo here to get the old one back with.
 */
export async function renamePage(id: string, name: string): Promise<RecentMeta[]> {
  const clean = name.trim().slice(0, MAX_NAME);
  if (!clean) return await listPages();
  try {
    const db = await openDb();
    if (!db) return [];
    const tx = db.transaction(META, "readwrite");
    const store = tx.objectStore(META);
    const meta = await ask(store.get(id) as IDBRequest<RecentMeta | undefined>);
    if (meta) store.put({ ...meta, name: clean });
    await finished(tx);
  } catch {
    /* fall through to the listing, which is the caller's answer either way */
  }
  return await listPages();
}

/** Forget one page. Both stores, one transaction — a body with no meta would be unreachable bytes. */
export async function deletePage(id: string): Promise<RecentMeta[]> {
  try {
    const db = await openDb();
    if (!db) return [];
    const tx = db.transaction([META, BODY], "readwrite");
    tx.objectStore(META).delete(id);
    tx.objectStore(BODY).delete(id);
    await finished(tx);
  } catch {
    /* fall through to the listing, which is the caller's answer either way */
  }
  return await listPages();
}

/** Forget everything. The user-facing "hepsini sil". */
export async function clearPages(): Promise<RecentMeta[]> {
  try {
    const db = await openDb();
    if (!db) return [];
    const tx = db.transaction([META, BODY], "readwrite");
    tx.objectStore(META).clear();
    tx.objectStore(BODY).clear();
    await finished(tx);
  } catch {
    /* fall through */
  }
  return await listPages();
}
