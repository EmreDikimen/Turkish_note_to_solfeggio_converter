# F5 — the pages this browser has already read

purpose: the design and the decisions behind the browser-side store of decoded pages, and the limits it enforces
audience: agents and the owner, before changing what is stored, how long it is kept, or where a page comes back from
updated: 2026-09-05

> Current state is in [../STATUS.md](../STATUS.md). The decisions are one line each in
> [../DECISIONS.md](../DECISIONS.md); the track index is [README.md](README.md). The editor whose
> edits this remembers is [../mvp/editor.md](../mvp/editor.md).

Keep a decoded page on the reader's own machine, so a refresh does not throw it away.

## Why it exists

A read costs **35–55 seconds** and, since 2026-09-04, a round trip to Cloud Run. Before this, a page
refresh — or a phone putting the tab to sleep, or a mis-tapped back gesture — lost every one of
those seconds and every edit made afterwards, and the only recovery was to upload the photograph
and read it again.

The owner asked on **2026-09-05**, and framed the constraint in the same sentence: *"database
bağlamak maliyetli olabilir ama tarayıcıda tutabiliriz"* — a database would cost money, the browser
would not. That is the whole shape of the feature. **No server, no account, no bill.**

## What it is

Three files:

* `apps/web/src/recentPages.ts` — the store. Two IndexedDB object stores, the limits, the eviction.
* `apps/web/src/ui/RecentPages.tsx` — `#recent`, the list between the upload box and the score.
* `App.tsx` — three moving parts: read the list on arrival, write the score back after the edits
  stop, install a row when it is clicked.

## The four decisions the owner made

| | Decision | Why |
|---|---|---|
| **Notes only** | The score is stored; **the uploaded image never is.** | A phone photograph is 2–5 MB against the ~60–125 KB of the score it produced — fifty times the space for a picture the reader already has on their phone. |
| **The edited state** | Not the raw decode: whatever the score is now, corrections included. | The decode is the cheap half of the reader's investment. Losing the corrections would lose the expensive half. |
| **30 pages** | The 31st read drops the least recently opened. | Not a storage limit — 30 scores is ~3.6 MB. It is a **list** limit: a list of 200 pages is not a list anybody reads. One constant, `MAX_PAGES`. |
| **No download button** | Offered and declined. | — |
| **Renameable** | The page on screen **and** any older one. | A file stem like `IMG_20260905_142233` tells you nothing about which piece it is (owner, same day: *"kullanıcı sayfalarını rename edebilsin. hem current olanı hem de eskileri"*). |
| **The makam rides along** | Drawn **beside** the name, never inside it (owner: *"makamı da isme dahil olsun"*). | It is re-read from the score on every save, so it survives a rename and follows the reader changing the makam later. Baked into the name string it would go stale on any of those, and a rename would delete it. |

## How it works

**Where.** IndexedDB, not `localStorage`, and size is **not** the reason. Two reasons that are:

1. *"The edited state"* means writing on every edit (debounced two seconds). `localStorage` is
   **synchronous** — a ~100 KB write blocks the main thread while someone is dragging a note.
2. `localStorage`'s ~5 MB is **one budget shared** with the three settings the app already keeps
   there (the follow toggle, the toolbox's spot, the decode-URL override). Filling it would break
   those and not this.

**Two object stores, and the split is the design.** `pageMeta` holds the few facts the list draws
(name, dates, note and bar counts, size); `pageBody` holds the score as a JSON string. Listing 30
pages therefore reads ~3 KB and not ~3.6 MB — IndexedDB has no way to read half a record.

**One save path.** There is deliberately **no explicit save call after a decode.** A decode opens a
record (`saved` in `App.tsx`); an effect writes whatever document is on screen back to that record
two seconds after it last changed. The first write and the thousandth edit are the same line of
code, so no future load path can install a page the store never hears about — and undo/redo are
remembered for free, because `history.doc` is a new object per edit and the effect sees exactly
those.

**Only a decode opens a record.** A `?score=` page, a bundled sample and a hand-loaded JSON all
clear it. The list is *pages you have read*, not *scores you have opened* — which is also what stops
the browser checks' own fixtures filling a reader's list.

**Eviction is a true LRU.** `readPage` touches `updatedAt`, so the page you came back to yesterday
outlives one decoded last week and never looked at since.

## Renaming

Two places, one box. `ui/RenameField.tsx` owns the keyboard rules — **Enter commits, Esc cancels,
blur commits**, an empty name is a cancel, and the contents are selected on mount because a rename
is usually a replacement. Each caller owns only whether it is editing:

* **a row in `#recent`** — ✎ swaps the row for the box;
* **the score card's heading** — `#score-rename` swaps the title for the box, which is how the page
  you are *looking at* is renamed without opening the list.

⚠ **The heading shows the STORED name (`pageName`), not `doc.name`, and that is what stops a rename
drifting.** Renaming through the document was the other option and is a trap: `doc.name` seeds a
per-piece hash that decides whether `SheetView` draws a tuplet as a bracket or as a curved arc, so
renaming a page would silently re-engrave its triplets. The document keeps its identity; the record
carries the label. A score that is not a stored page passes `pageId: null` and the heading falls back
to `doc.title || doc.name` exactly as before, with no pencil — absent, not disabled.

⚠ **`renamePage` writes `pageMeta` only** (~100 bytes, cannot fail on quota) and deliberately does
**not** bump `updatedAt`. Everywhere else a touch means *the reader used this page* and decides
eviction; here it would re-sort the list under the cursor at the moment someone is looking at the row
they just typed into. Renaming is labelling, not use.

## The traps, all of them paid for

⚠ **`Date.now()` alone is not a clock.** Two records written in the same millisecond share an
`updatedAt`, and `sort` then falls back to what `getAll` returned — IndexedDB **key order**, i.e.
alphabetical by id. The list comes out wrong and eviction drops the wrong page. Measured: storing 30
pages in a loop kept `page-30 … page-4` instead of `page-31 … page-2`. The fix is a counter that
forces the stamp to move (`stamp()`).

⚠ **Everything in `recentPages.ts` swallows and returns a safe value** — the same rule the
`localStorage` readers already follow. Storage is not merely empty in a private window; it can
**throw**, and a browser that cannot remember pages must still read them. A caller may treat every
result as *there is nothing*, never as an error to show.

⚠ **The model's raw tokens are NOT stored**, so `openRecent` clears `rawDecode`. Without that, the
decode inspector shows the *previous* page's tokens underneath this page's notes.

⚠ **A restored page must not raise the makam modal again.** The makam was answered for when the page
was first read and `loadDoc` wrote it into the document, so `openRecent` hands in no fresh guess and
`resolveMakam` recovers the answer. A second modal would also block every later click.

⚠ **The ✕ leaves the score on screen.** It says *drop this from the list*; closing someone's open
page because they tidied a list is not that. Dropping `saved` is what makes it stick.

⚠ **A stored page's bar count is real only because the document is post-`assignBars`.** A raw score
JSON carries no `bar` field — `loadDoc` assigns them — so anything written to the store must come
from `history.doc` and never from a fetched file. Verified: 8 bars, not 0.

⚠ **A rename must move `saved` as well as the store, or the next keystroke undoes it.** The save
effect writes `saved.name` back with the document, so a rename that reached only IndexedDB would be
silently REVERTED two seconds after the reader's next edit. `renameRecent` sets both. The check for
it is deliberately *rename → edit → wait past the debounce → re-read*, because every assertion made
before that edit passes either way.

⚠ **A grid item's `min-width` is `auto`, and that killed every truncation below it** (measured). The
row is a grid item; it refused to shrink below its longest page name and pushed the whole document
wider — **623 px of page in a 390 px phone**, with the name running off the right edge and no
ellipsis anywhere. `min-width: 0` on `.kv-recent__item` is what makes `.kv-recent__stem`'s ellipsis
fire at all. ⚠ It was invisible to `smoke:phone`, which loads its fixture through `?score=` and
therefore never draws this list.

⚠ **The rename box is a text input, so it needs the phone's 16px rule.** It is listed inside the
`(pointer: coarse)` block beside `.kv-field`'s inputs: under 16px iOS Safari zooms the whole app in
on focus and never back.

## What it is NOT

⛔ **It is a cache, not a save, and the interface says so** (`TR.recent.note`). No browser storage
can promise otherwise: Safari clears a site untouched for seven days, every engine clears under disk
pressure, a private window keeps nothing. It also belongs to **one browser on one device** — a page
read on the phone is not there on the laptop.

⛔ **A restored page cannot be re-decoded or re-sliced.** The crops are gone with the image.

⚠ **The footer's `privacy` line is untouched and still literally true** — it speaks about the
server, and nothing here reaches the server. But the reason there is nothing to qualify is the
notes-only decision above: **put an image in this store and that line needs re-reading.**

## Where the checks are

`smoke:app` is the **only** check that can see this at all, because the store is written for a
decode and for nothing else — `smoke:editor` loads its fixture through `?score=` and is blind to it
by design. Its arm decodes a page, reloads the browser, and asserts the page is listed, reopens with
the same note count, is marked `data-current`, and raises no makam modal — then renames it from the
score card's heading and **reloads a second time**, because a rename that reached only React state
or only the store would pass everything asserted before that line.

The DOM contract, which is what those assertions read (never the copy):
`#recent[data-omr="recent"][data-count][data-open][data-current]`, one
`[data-omr="recent-item"][data-page-id][data-page-name][data-page-makam]` per row carrying
`[data-omr="recent-open"]`, `[data-omr="recent-rename"]` and `[data-omr="recent-remove"]`, plus
`#recent-toggle`, `#recent-clear`, `#score-rename`, `[data-omr="score-name"]` and the box itself,
`[data-omr="rename-input"][data-page-id]`. **`data-count` is the load-bearing one** — it is the only
proof a page was stored at all — and **`data-page-name` is what a rename is asserted on**: a page
name is user DATA, not copy, so reading it off an attribute is the standing rule rather than an
exception to it.
