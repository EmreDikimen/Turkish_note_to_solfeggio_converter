# Status log — what happened, when

purpose: append-only dated record of completed work; the raw material behind STATUS.md
audience: agents reconstructing why the code looks the way it does
updated: 2026-08-08

**Newest first.** This file is history: it records what was true on a date, not what to do now.
Current state → [../STATUS.md](../STATUS.md). Abandoned plans → [superseded.md](superseded.md).

## 2026-08-08 (latest) — the "one giant note" was a grace note's bounding box

Owner, from a real upload: in edit mode a huge tinted rectangle covered much of the page, and nothing
could be edited until it was deleted with the ✕. Not a decode problem and not a stray note — a
**geometry bug in the editor's click targets**, and the notes people deleted to escape it were real.

**Cause.** `SheetView`'s `noteBoxOf` trusted `StaveNote.getBoundingBox()`, which VexFlow computes by
**merging every modifier's box** into the note's. `GraceNoteGroup` never overrides
`Element.getBoundingBox()`, and that reads `this.x`/`this.y` — still **0**, because the group
positions its inner notes and never itself. Merging a box at the SVG origin stretches the note's box
from the top-left of the score all the way down to the note. So the bug fires on exactly one thing:
**a note carrying a grace note**, which is why no bundled sample showed it and no check caught it.

**Measured before fixing, on `beyati-delisin.json`** (the one bundled score with grace notes, 14 of
them): 14 boxes anchored at the origin, largest 949×1805 px, and **126 of 134 on-screen boxes had
their own centre stolen** by a giant box lying over them. That last number is the report restated —
almost every click in that region went to the wrong note. Numbers: [../METRICS.md](../METRICS.md).

**Fix.** A box that reaches the origin is rejected, and the note's own ink is used instead —
noteheads plus stem, from `getNoteHeadBounds()` / `getStemExtents()` / `getGlyphWidth()`, all of which
report real positioned geometry. ⚠ **The test has no tunable threshold in it, deliberately**: a drawn
note has a clef to its left and a title above it, so nothing legitimate can sit at x ≤ 0 or y ≤ 0 —
only an unpositioned modifier can. If VexFlow ever fixes `GraceNoteGroup`, the branch stops firing on
its own. Ordinary notes keep VexFlow's box, so their click targets are byte-identical (median 18×47
before and after).

**`smoke:editor` now covers it, on a score that HAS grace notes** — the default sample has none, which
is precisely why the bug shipped. Two assertions, neither tunable: no box may sit at the sheet's
origin, and clicking a box's centre must land on that box. Confirmed to fail without the fix
(126 violations) and pass with it, because a check that cannot fail proves nothing.

## 2026-08-08 — a cold server is now waited for, not abandoned

Owner, immediately after the redeploy found it: fix the cold-start fallback. Built, checked and
deployed the same day — Netlify `6a771a5cc56797b5dfe8e246`.

**Client-only, which is the part worth remembering.** The server's behaviour was already right: it
listens before loading so Cloud Run does not read a slow boot as a failed start, answers `/health`
with `ready: false`, and reserves 503 for a load that genuinely failed. The bug was entirely in
[`apps/web/src/omr/remote.ts`](../../apps/web/src/omr/remote.ts), which treated that honest 503 like a
dead server. So no image rebuild, no Cloud Run redeploy, no Hub upload — and `decode.ts` was not
touched, so nothing moved in parity.

Two halves, in the order they matter:

1. **The retry (the correctness half).** A `ready: false` 503 now raises a distinct
   `ServerWarmingError`; the router polls `/health` for up to **40 s** and re-POSTs once ready. The
   180 s budget already allowed this — the old code fell back rather than spend 9 s of it.
2. **The warm-up ping (the polish half).** `warmDecodeServer()` fires one `/health` when the app
   opens, so a container is usually ready before a file has been chosen. Fire-and-forget; it cannot
   delay first paint or fail visibly.

⚠ **The half that keeps it honest: only `ready: false` is waited on.** `model failed to load` and
every other failure — offline, CORS, 500, 413, 429, a malformed reply — still fall back immediately.
"Retry any 503" would strand a user behind a broken container for the full 40 s, which is a worse bug
than the one being fixed and would have looked like a hang.

**`npm run check:coldstart` is the new check, and it exists because nothing else could have caught
this**: every other check runs against an already-warm server, which is exactly why `smoke:live` — the
only one that talks to a service that scales to zero — was what found it. It puts a deliberately-cold
proxy in front of a real decode server so the cold window is a **parameter, not a race**: cold for
12 s and the page still finishes on the server (9/26/399/26); a failed load draws one `/decode` and
zero follow-up polls. That second run is the regression guard on the paragraph above.

Also corrected while in the strings file, owner-reported: the upload hint promised **"yaklaşık 20
saniye"**, which was never measured and undersold a page by half. It now says **35–55 sn**, the same
range the app's own `expectServer` already used — one number, two places, now agreeing. The
cold-start hint moved from "10–30 sn" to "10–15 sn", which is true now that the wait is real.

Green before shipping: `typecheck`, `npm test`, `check:coldstart`, `smoke:build` (both paths,
`9/26/399/26`), and `smoke:live` after the deploy (server 48.4 s, fallback 72.5 s, same score).
⚠ **Still owed: one live run against a genuinely idle container.** It was armed as a 21-minute wait
and cancelled — the owner wanted to record a demo video, and any use of the app warms the service and
voids the test. The mechanism is proven locally; this would only confirm it on the real one.

## 2026-08-08 — the redeploy: makam selection, the style pass and the editor go live

One build carrying everything since 2026-08-06: **makam selection**, **the style pass** and **the
editor, steps 1–8 + 10**. Netlify deploy `6a7713bc1830de6894e19afe` replaces
`6a74d71557de4c1a2264d10e`; the CDN moved **4 files**. <https://komavision.netlify.app>.

**Nothing server-side was touched, and that was checked rather than assumed.** `git diff
4fd91c9..HEAD` reaches nothing under `apps/server/` or `apps/web/src/omr/`, and `apps/server/` has no
dependency on `packages/core` (where the diff actually landed) — so no Cloud Run rebuild and no Hub
re-upload were needed. A frontend-only redeploy is two commands, and knowing *that* is what kept it
to two.

Pre-flight, in this order: `typecheck`, `npm test`, then `smoke:build` against a local `dev:server`
(the live server refuses a preview origin by design). It came out **9/26/399/26 on both paths —
identical to the 2026-08-06 run**, which is the reassurance STATUS asked for: the palette's follow-up
fixes and steps 5–8 changed nothing the built artifact reads. ⚠ The `dist/` that `smoke:build` leaves
behind is baked with `localhost:8080` and a throwaway weights port, so the shipping artifact is a
*second* build with both real URLs — verified by grepping the bundle for them, and for the absence of
`localhost`.

**The editor was driven on the deployed bundle, not just on dev.** `smoke:editor` uses Vite's
`createServer` and `smoke:live` only exercises decode, so steps 1–8 had never run in a production
build on the real host — the exact "what ships was never what was tested" shape that cost W9 a day.
A throwaway Playwright pass (scratchpad, nothing added to `package.json`, because `#save-json` is
about to be deleted) found it all working: 27 tools arming, glyphs inside their buttons against the
real Bravura, select/delete/undo, ghost-previewed insert, the palette's Çal and its playhead.

### ⛔ And it found a real one: a cold container does not delay the server path, it CANCELS it

`smoke:live`'s **first** run failed — `data-where=local-fallback` where `server` was wanted, with a
503 in the console. Not a deploy fault and not flakiness to retry past:

- Cloud Run routes traffic as soon as the container **listens**, which `apps/server/src/index.ts`
  does before loading its graphs (deliberate: `/health` then answers `ready: false`, and a 503 is
  reserved for a load that genuinely failed).
- So a `/decode` arriving in that ~9.5 s window gets `503 model still loading`.
- `remote.ts` treats **any** error as "fall back", with no retry — while holding a 180 s timeout
  budget it would happily have spent waiting 9 s.

Consequence: **a friend's first upload after any idle period is read on their own machine** and pulls
211 MB of weights, silently. At n=2 friends uploading occasionally, that is not the edge case — it is
close to the common case, and it undoes the one thing the server was built for (a cool laptop). The
docs said a cold start costs "about 10 seconds extra"; that was never measured and is wrong.

Corrected in [../METRICS.md](../METRICS.md), [../mvp/latency.md](../mvp/latency.md) (option 1 is now
a correctness fix, and needs a client that retries a `ready: false` 503) and
[../mvp/hosting-setup.md](../mvp/hosting-setup.md) (the owner will see "read on your machine" on a
first upload and should know nothing is broken). **Left unbuilt on purpose** — the current behaviour
is what `index.ts` and `remote.ts` were each deliberately designed to do, so changing the contract
between them is an owner call, not a tidy-up. Re-run warm, `smoke:live` passes on both paths.

## 2026-08-08 — gamzedeyim deva is the default sample; aldanma leaves the dropdown

Owner: the page should open on **gamzedeyim deva** (uşşak · sofyan), and **aldanma dünya** should
not be offered at all. The Sample dropdown is now two entries — gamzedeyim first, so it is what
loads on startup, then safalar getirdiniz.

⚠ **`apps/web/public/sample.json` (aldanma) is still on disk, deliberately.** It is out of the UI,
not out of the repo: `npm test`'s round-trip corpus reads it **by name**
(`tools/render/stitch-test.ts`), and the manual checks drive it through `?score=/sample.json`.
Deleting the file would break the test corpus for no gain — it is gitignored anyway (SymbTr-derived,
not redistributed).

⚠ **`smoke:editor` drives whatever loads first, so this changed what it tests** — from a 274-event
acem düyek score to a 541-event uşşak sofyan one. It passes unchanged, which is worth noting: every
target it picks (a note carrying an accidental, a note in the last system, three equal plain notes
in an interior bar, a gap between two noteheads) is *searched for* in the loaded document rather
than hardcoded, so swapping the sample exercised that and found nothing brittle.

## 2026-08-08 — three controls come up out of Gelişmiş, and the transposition list speaks komas

**Owner: transposition, *porte değişmesin* and the accidental mode do not belong in a drawer
labelled "geliştirici ayarları".** They are now in the **transport bar**, as a second cluster
beside the listening controls. The reasoning is the same one that put the style pass in front of
W10: a ney player transposing a score is using the app exactly as intended, and burying that under
a developer panel says the opposite. What stays in `Gelişmiş` is genuinely for the project —
sample/JSON loading, the strip exporter, the slice inspector, the repeat preview.

**Two renames, both to what the thing is actually called:** *Aktarım* → **Transpozisyon**, and
*Değiştirme işaretleri* → **Arıza işaretleri**.

**The transposition list is now in komas, named by scale degree where one lands.** It used to read
"−Dörtlü (−22)"; it now reads **"−4 ses (22 koma)"**. The unit is the koma because that is what the
app is about and what `transposeDoc` and `?transpose=` take; the degree goes first because a player
thinks "up a fourth". The comma counts are the çargâh scale in AEU — 9 + 9 + 4 + 9 + 9 + 9 + 4 = 53
— so 2 ses = 9, 3 ses = 18, 4 ses = 22, 5 ses = 31, 6 ses = 40, 7 ses = 49, 8 ses = 53. Below a
degree the label is plain commas (1, 4, 5, 8 — the four AEU accidental sizes), which is the step
size that actually gets used. Eleven magnitudes each way instead of seven, and regular rather than
curated.

Two small decisions while placing them, both visible in the screenshot and both reversals of a
first attempt:

- **A vertical rule between the two clusters was tried and removed.** The bar wraps, and a divider
  left dangling at the end of a line reads as a mistake. The reading three are wrapped in their own
  flex group instead, so they stay together and never interleave with the listening controls.
- **"Porte değişmesin" is NOT disabled at transposition 0**, though it does nothing there. A player
  ticks "keep the staff" and *then* picks the interval; a checkbox that only wakes up afterwards
  makes that order impossible.

Green: `typecheck`, `npm test`, `smoke:editor`, `smoke:app`, `smoke:page`. No check drove any of the
three controls, so nothing needed rewiring — which is the `data-*` contract paying off again.

## 2026-08-08 — rests and the numbered koma signs move into the palette

**Owner, straight after the modal was deleted: put rests and the other koma signs in the palette.**
Two of the four capabilities the deletion cost are therefore back the same day; only lyric editing
and exact koma/Hz entry are still gone ([../mvp/editor.md](../mvp/editor.md)).

**Rests are the SAME tool as a note value, with `rest: true`** — not a new kind. They insert and
re-value through exactly the same paths, so there is no second insert path to keep in step and
"arm a thing, click a target" stays true of the whole palette. An **Es** row of six rest glyphs sits
under the note values; arm one and click blank staff to insert a rest, or click a note to turn it
into one. Two new core primitives: `toRest`, which clears the **whole** pitch side (koma, both
names, `freqHz`, and the lyric — nothing sings on a rest), and `toNote`, its inverse.

⚠ **`toNote` needs a spelling handed to it, because a rest has none to keep** — so the editor takes
it from the **click's height**, the same mapping the insert ghost uses. That makes "the model read a
rest where a note belongs" a one-click fix instead of a delete-and-reinsert. The rest preview
deliberately does NOT follow the pointer up and down: a rest goes mid-staff, and a ghost that
tracked the pointer would promise a pitch the insert then ignores.

**All thirteen alterations are now in the accidental row**, not seven. The palette had been carrying
the AEU signs only, on the argument that the numbered ±2/±3 would need text labels and make the row
unreadable — **that argument did not survive checking**: every one of them has its own Bravura sign
(`accidental2CommaSharp` and friends), so they read as signs like the rest. ±8 (büyük mücennep) had
been missing from the palette too, which was simply a gap.

⚠ **A ±2/±3 is stored exactly and DRAWN SNAPPED.** `toAeuAlter` prints the nearest standard sign,
because that is what a Turkish edition prints — so those two tools move the sound exactly and the
printed sign only approximately. The tooltip names the comma count so the difference is visible
before you click, and `smoke:editor` asserts on the stored comma (+2) rather than on the glyph.

The palette is 27 armable tools now, and `smoke:editor` still arms **every one** and measures
**every glyph's ink** against the real font — the check that exists because a Bravura glyph paints
outside its em box and one tool's ink once stole its neighbour's clicks. Both passed first try with
the twenty new buttons, including the two widest signs in the set (the numbered sharps, ~45 units
wide against 23–34 for the others).

Green: `typecheck`, `npm test` (217/217 both modes + new `toRest`/`toNote` cases), `smoke:editor`,
`smoke:app`, `smoke:page`.

## 2026-08-08 — the per-measure modal is deleted

**Editor step 10, taken out of order at the owner's request** (step 9, `Save JSON`, is still owed).
`apps/web/src/MeasureEditModal.tsx` is gone, and `apps/web/src/AccidentalSelect.tsx` with it (both
deleted, not moved) — the modal was that dropdown's only caller, and the palette's accidentals come from `ui/accidentals.ts`. With nothing armed, a
click on blank staff now clears the selection; **no window can appear over the score any more.**
Also gone: `onSaveMeasure` and the `editing` state in `App`, `onMeasureClick` in `SheetView`, the
`measureModal` strings, and the modal-only CSS (`.kv-table`, `.kv-modal__panel--wide`).

**Four capabilities went with it, and none has a replacement**, which is worth saying plainly
because each existed this morning:

| Gone | Was |
|---|---|
| Adding a **rest**, or turning a note into one | the row-type dropdown. Deleting a rest still works; only creating one is gone |
| Editing a **lyric syllable** | the `Hece` column — the app's only lyric editor |
| Exact **koma / Hz** entry | the Gelişmiş tab's two numeric fields |
| The numbered **±2/±3/±8** alterations | `AccidentalSelect`'s dropdown; the palette carries the AEU signs only |

The judgement on each is in [../mvp/editor.md](../mvp/editor.md); the rest is the likeliest to come
back, as a tool in the palette's duration row.

⚠ **`isMeasureValid` (core) now has no consumer.** It was the modal's Save gate, and the editor's
off-meter mark deliberately does not use it — the length you would naturally hand it,
`Measure.lengthBeats`, is computed from the bar's own contents, so the answer is true by
construction. Kept, with that written into its docstring, because the predicate is sound with a
reference length from outside the bar.

⚠ **A flake in `smoke:editor` surfaced on this run and is now fixed properly.** "A bar-1 target
plays from the top of the sheet" read the playhead 300 ms after the FIRST Çal of the run — which is
also when the WebAudio context starts, and in headless Chromium that can take over a second. The
playhead is hidden until the clock returns a position, so the check read "hidden" and looked exactly
like a broken seek. It now polls for the playhead instead of sleeping. Not caused by the deletion,
but found by it.

Green after the deletion: `typecheck`, `npm test` (217/217 both modes), `smoke:editor`, `smoke:app`,
`smoke:page`.

## 2026-08-08 — the tuplet tool, and the bar that says it does not add up

**Editor steps 7 and 8 are built and green** ([../mvp/editor.md](../mvp/editor.md), build notes in
[../mvp/editor-built.md](../mvp/editor-built.md)). They shipped together on purpose: applying a
triplet turns 3 × 1/8 into 3 × 1/12, so it leaves a short bar **every single time**, and step 8 is
the only thing on screen that says so.

**Step 7 — one tool, both directions.** Arm ÜÇLEME, click a note and the note two along: the three
become a triplet. Click **any member** of an existing one and it comes apart again (owner's call —
a note already inside a triplet cannot mean "start a new run", so the removal needs no second
click). Dimming starts **the moment the tool is armed**, not after the first click: anything that
cannot begin a legal run is pale and `pointer-events: none`, so the page refuses it instead of
swallowing a click that does nothing.

**The rule that took the thinking: a member must be a PLAIN `1/2^k` value.** Not dotted, not a
tie-split, not already a tuplet. This is arithmetic, not fastidiousness — three equal members at ×⅔
sum to `2v`, and a group only closes when its sum lands on a plain value, so `2v` is plain exactly
when `v` is. Three dotted 8ths would sum to 9/16, never close, and draw the *incomplete-group*
bracket — which exists to flag a MODEL mistake. Letting the editor produce that mark by hand would
have quietly destroyed its meaning. The same reasoning is why only a **closed** three-member group
can be removed: `tupletGroupsIn` also yields the model's unclosed runs, and ×³⁄₂ on one of those
invents a rhythm nobody read.

**Where the code went, and why it is split in two.** "Which notes" lives in `tools/render/rhythm.ts`
(`plainTupletBase`, `tupletRunFrom`, `closedTupletAt`), beside the functions that draw the bracket
and write the `\tup3` label — a second copy in the app is exactly the pixels-vs-labels divergence
the one-code-path rule exists to prevent. The rewrite is one core primitive, `scaleDurations`. Both
existing rhythm functions are **untouched**: 217/217 label round-trips, both modes, so no strip and
no label moved.

⚠ **Nothing about a tuplet is stored**, so no attribute can prove one was made — `smoke:editor`
counts the marks the **engraver drew**. The first version counted only the curved arc's italic "3"
and read 0: the sample happened to draw VexFlow's bracket instead, and the style is a per-piece
coin. It now counts both.

**Step 8 — the off-meter mark.** A `+` / `−` badge at the bar's top-right in the edit overlay,
against the **derived meter** (never `Measure.lengthBeats`, which is computed from the bar's own
contents and is therefore true by construction). Three calls inside it: **edit mode only** (a friend
opening a decoded page should not meet eight warnings before touching anything), **the first and
last bar warn only when OVER** (a pickup and a closing bar are legitimately short), and **the
modal's Save is no longer gated on it** — over- and under-full bars are ordinary, reachable states
of the document now, so locking someone inside a modal over one would be wrong the same way a ✕ that
refuses to work is wrong.

⚠ That exemption is load-bearing for anyone writing a check, and it cost a debugging round here: a
triplet made in **bar 1** produces no mark, which reads exactly like a broken indicator. The smoke
check now picks its run from an **interior** bar.

Green: `typecheck`, `npm test` (217/217 + 90/90 + the new tuplet unit cases), `smoke:editor`,
`smoke:app`, `smoke:page`. The brief's step list is down to the two deletions — `Save JSON`, then
`MeasureEditModal`.

## 2026-08-08 — the interface is repainted İznik turquoise

**Owner, on seeing the style pass: it looks like Claude's website.** Fair — the W9.6 direction was
warm cream paper with a terracotta accent, which is a well-known house style and not ours. The
palette is now **İznik**: the white ground and turquoise of Turkish çini. Cool ivory surfaces
(`--paper #f6f8f7`, the score itself on pure white so nothing on the page is lighter than the
music), near-black ink carrying a trace of the accent's green, and one accent at `#0f766e`.

**Tokens only** — `apps/web/src/styles/tokens.css` plus one hardcoded modal backdrop that had been
missed in `app.css`. No layout, no component, no copy and no check moved; the accent was already
used exclusively through `var(--accent)`, which is what made this a ten-line change.

Two things the turquoise buys beyond not being terracotta: it belongs to the repertoire the app is
for, and **the editor's overlays were already teal** (selection, hover, the playhead, the insert
ghost), so the accent now agrees with them instead of arguing. Those overlays keep their brighter
`#14b8a6` on purpose: they are drawn over black notation and have to out-shout it, which a token
sized for buttons on paper cannot do.

⚠ **`--accent` may not be lightened.** The primary button is the one place this palette has to clear
a contrast bar (white on `#0f766e` ≈ 4.8:1), and it is the only reason that particular teal was
picked over a prettier lighter one.

⚠ **The engraved SVG is untouched**, as it must be: its `#222` ink is training-strip pixels, not
chrome.

## 2026-08-08 — the palette inserts, and the bar absorbs it

**Editor step 6 is built and green** ([../mvp/editor.md](../mvp/editor.md)). Arm a note value, click
blank staff, and a note lands there: **pitch from the click's height**, duration from the tool. That
completes the note-value row's meaning — until now arming 1/8 and clicking blank staff opened the
old measure modal, which is not what a palette promises.

**One new core primitive**, `insertInMeasure` — the mirror of `deleteEvent`: it splices into the
bar, stamps that bar's own number on the new event, renumbers, and **checks no total**. The bar comes
out over its length exactly as a delete leaves one short, because edits absorb and bar lines never
move. Its companion `insertIndexIn` exists for an unobvious reason: `renumber` rebuilds every event,
so the object just spliced in cannot be found again by identity, and the caller has to *ask* which
index it ended up with in order to select it.

**Three rules keep the splice honest**, and each was a way it could have gone quietly wrong:

- **The position is resolved inside the target measure only.** `groupMeasures` starts a new measure
  wherever the `bar` number CHANGES, so a note stamped bar 7 spliced outside bar 7's own run cuts one
  bar into two on the page — bar lines moving, the one thing the absorb rule exists to prevent.
- **A leading grace run belongs to the note that follows it**, so an insert before a note goes before
  its graces too — but never past the measure's first event. When the run reaches the bar's head the
  new note simply becomes the bar's first event.
- **A doc with no `bar` numbers is run through `assignBars` first.** `groupMeasures` derives bars on
  the fly and discards the copies, so stamping only the new event would leave one numbered event in
  an unnumbered array. The app assigns bars at load; this makes the primitive safe standalone.

**Two owner calls, taken before building.** A **ghost notehead** previews the insert (a teal oval,
moved by mutating the element like the playhead — never state, because a preview that re-rendered the
overlay per mouse-move is the cost that got the measure hover highlight removed in slice 1). And an
inserted note takes the **key signature's** alteration for its letter, so it is born koma-flat under
a koma-bemol signature and the engraver prints nothing on it; natural would have printed a ♮ nobody
asked for.

⚠ **A preview cannot check the mapping it shares.** The ghost and the insert come out of one
function, so "they agree" proves self-consistency and nothing else — an origin off by a line would
agree with itself while putting every note a third out. `smoke:editor` pins the origin against the
**playhead** instead: it spans the staff symmetrically, so its vertical centre is the middle staff
line, which in treble is **B4**. No constant of the test's own.

⚠ **Two false trails while writing that check, both the same shape: `elementFromPoint` answers null
off-screen**, which reads exactly like "the ghost is broken". The gap-finder now scrolls the sheet in
first and treats a null hit as off-screen rather than as blank staff — and the playhead check scrolls
to the **playhead**, not to the top of the sheet, because Çal starts at the last edited bar and the
earlier section had left that at bar 31.

Green: `typecheck`, `npm test` (18 new `insertInMeasure` checks), `smoke:editor`, `smoke:app`,
`smoke:page`.

## 2026-08-08 — Çal from the bar you just fixed

**Editor step 5 is built and green** ([../mvp/editor.md](../mvp/editor.md)). The palette has its own
Çal/Dur, and Çal plays from the **last edited bar**. The reason it is needed at all is easy to miss:
in edit mode a click on the sheet selects or inserts, so `SheetView` binds its click-to-seek handler
only when `!editMode` — entering edit mode silently removes the only way to hear one bar. This is
what replaces it.

**It cost almost nothing, because the pieces existed.** One core primitive (`measureOfEvent`, over
the same `groupMeasures` the sheet and the modal use), one number in `App` (`lastEditMeasure`), and
two buttons calling the existing `onSeekMs` / `onStop`. No new backend code and no second notion of
where a bar starts — `Measure.startMs` is what non-edit-mode click-to-seek already hands to
`onSeekMs`.

**Three decisions, all owner-approved before building:**

- **Çal always restarts from that bar**; pause/resume is not duplicated in the palette, because the
  transport bar is still on screen in edit mode.
- **An edit still stops playback.** editor.md's "rebuild the timeline and resume from the same
  millisecond" constraint is therefore **not built**, and now says so in the brief rather than
  reading as done. It is also self-consistent: Çal-from-last-edit exists *because* you stop, fix,
  and press Çal. Picking it up later means firing on gesture end, which the pitch drag (an edit per
  animation frame) does not currently signal.
- **Undo/redo do not move the remembered bar**, unlike the selection, which they clear. The bar you
  were working in is still the bar you want to hear.

**The remembered value is a measure number, not an event index** — a delete renumbers every event.
⚠ And it can outrun the score: deleting a bar's last note removes that measure, so the lookup falls
back to the top rather than throwing.

**The check that matters is on the playhead, not on the attribute.** `data-play-from` says which bar
Çal *aims* at; it cannot say the audio *began* there — a wrong `startMs` would leave it green. So
`smoke:editor` measures the playhead's position down `#sheet-surface`: aimed at bar 1 it sits 0.050
down, aimed at bar 31 of the sample it sits 0.946. This works even with a suspended AudioContext,
because `getPositionMs` is `startMs + elapsed`, and `startMs` is exactly the seek under test.

⚠ **One check had to move, and the reason is the undo decision above.** "Nothing edited yet → no bar
named" was written into the new section, where it failed: the sections above it had already edited
bar 1, and `rewindAll` undoes the document without moving the pointer — by design. The assertion
belongs at the one honest place for it, right after entering edit mode on a freshly loaded score,
and that is where it now lives. The failure was the check's assumption, not the code's behaviour.

Palette geometry is unchanged: still **136 px**, still **0 px** of sheet cut off at a 1280 px window,
so editor.md's measured cut-off table still holds. Verified: `typecheck`, `npm test`,
`smoke:editor` ALL PASS, `smoke:app`, `smoke:page`.

## 2026-08-08 — the armed palette, and the glyph that stole its neighbour's clicks

**Editor step 4 is built and green** ([../mvp/editor.md](../mvp/editor.md)). A column beside the
sheet holds six note values (Bravura glyphs) and the AEU accidentals; arm one, click a note, the
note takes it. `Esc` and **↖ Seçim** disarm, leaving edit mode disarms, and with nothing armed the
sheet behaves exactly as slice 1 left it. One new core primitive, `withAlter` — the mirror of
`nudgePitch`: the alteration moves and the staff position does not.

**A Bravura glyph paints outside its em box, and that broke clicking.** The 1/32 tool's ink overhung
the 1/8 tool above it, so `elementFromPoint` in the *centre* of the 1/8 button returned the 1/32 one
and a click there armed the wrong value. It was found because the new smoke assertions failed on the
armed id, and it reproduces by hand — this was a real UI bug, not a Playwright artifact. Fixed with
`overflow: hidden` on the button and `pointer-events: none` on the glyph span, so ink is clipped and
clicks resolve to the button that owns the pixel. Worth remembering for any future glyph button.

**A music glyph's ink is nowhere near its baseline, and that is why the notes broke out of their
buttons.** Measured off the shipped Bravura: a stemmed note draws **87–102 units up and ~14 down**
per 100 of font-size; an accidental is balanced (34/34). Centring the *line box* therefore pushed
the stems out through the top while the space under the notehead sat empty — the ink was never too
big (~30 px inside a 38 px button). `EditPalette` now carries the measured table and shifts each
glyph onto its own ink, and `smoke:editor` measures ink-vs-button against the real font so a font
swap cannot quietly undo it. ⚠ The first attempt at this — clipping with `overflow: hidden` — was
reverted: it cut off the stems and flags, which is the only thing the tools are read by.

**The palette also cost room the page did not have, found by looking at it.** `--page-max` was
sized so the 1020 px engraved sheet fits exactly, so a 164 px palette in the same row pushed the end
of every system off the paper. The **page** now grows by that footprint while editing; the sheet
cannot shrink, because its width is also the training-strip geometry. Edit mode therefore wants a
window ≥ ~1250 px (measured: 1090 → 160 px still cut, 1280 → 0, 1470 → 0), and the owner's call was
to keep the palette beside the sheet and widen the window rather than float it over the paper.

**An absolute edit is not transpose-safe the way a relative one is.** `onNudgePitch` never needed to
think about the transposed staff, because ±1 diatonic step means the same thing in both spaces. An
accidental does not: it is applied in DISPLAY space and the single event is mapped back with the
same `transposeDoc(…, -transpose)` round-trip `onSaveMeasure` already used.

**Deliberately not done, so the bar stays honest.** An edit still absorbs into its bar and bar lines
never move, so a re-valued note leaves its bar over or under length with **no warning yet** — that
is step 8, and it needs the derived meter rather than `Measure.lengthBeats` (which is computed from
the bar's own contents and so is true by construction). The measure modal, `Save JSON` and the piano
roll all still work; the modal is deleted last, at step 10.

⚠ **The editor smoke reads the document through `#save-json`.** Step 9 deletes that button, so it
has to grow another handle first — do not remove the download without moving the harness.

Green on: `typecheck`, `npm test` (incl. new `withAlter` cases), `smoke:editor`, `smoke:app`,
`smoke:page` (7 porte → 16 şerit → 344 nota), `gate:browser` 27/28.

## 2026-08-07 — the editor's first slice, and the bug the refactor found

**Steps 1–3 of [../mvp/editor.md](../mvp/editor.md) are built and green.** In edit mode a click on
a note selects it, an **✕** deletes it, **dragging it** moves its pitch, and **undo/redo**
works (buttons + Ctrl/⌘+Z). The measure modal, `Save JSON` and the piano roll all still work —
step 10 deletes the modal *last*, so there is always a working way to edit.

**The refactor was the load-bearing part, and it found a live bug.** The app had grown two disjoint
edit vocabularies over one document: the piano-roll patched `koma53` + `freqHz`, the modal rebuilt
events from an explicit `{letter, octave, alter}` spelling. Since the sheet reads its staff position
from `parseNoteName(ev.noteName)`, and `updateEvent` **never wrote `noteName`**, *dragging a note in
the roll moved the sound and left the notehead where it was.* Both paths now compose
`packages/core/src/edits.ts`, so a pitch edit cannot half-apply. Pinned by a unit test that asserts
`noteName` moves, and by `smoke:editor` in the real app.

**Two things were deliberately NOT fixed, and saying so is the point.** The roll's *duration* drag
still writes `durationMs` alone and leaves `durationBeats` (what the sheet engraves) stale — the
same bug shape, but fixing it means snapping a continuous drag to a note value, which is the
palette's job. And `noteAE` stays exact rather than AEU-snapped: the Python exporter snaps it (152
of 2,297 notes in the bundled scores), `stitch.ts` and the modal never did, and `withPitch` matches
the two TS producers. Nothing reads `noteAE` but a hover label.

**The brief said to push per-note rects through `onLayout`; that was wrong and they don't.**
`onLayout`'s payload is the contract `stripExport.ts` and `tools/render/render.ts` crop training
strips by, the only consumer of per-note geometry is the overlay in the same file, and `onLayout` is
an engrave dependency — a second non-stable callback prop would re-engrave forever. They are local
`NoteBox[]` state instead, filled in the walk that already records the playhead's positions.

**A trap worth keeping.** `data-edit-mode` ended up
on *two* elements (the toggle button and the sheet), so a check matching the attribute alone picks
the wrong one; the sheet got `id="sheet-surface"` for that reason, found by the smoke failing.

### Owner feedback, same day: DRAG, not the wheel — and no measure hover

**The brief said "scroll it up and down to change its pitch". It is now a DRAG** (owner). The wheel
version shipped first and was thrown away, and the reasons are worth keeping because they are why
a wheel is the wrong instrument here:

- **It fights the page.** The handler has to `preventDefault`, which means it cannot be a React
  `onWheel` prop at all (React registers wheel on the root as **passive**); it has to be a native
  listener attached by ref with `{passive: false}`.
- **It moves the note in jumps, not under your finger.** A mouse notch is one event of ±100–120,
  but a **trackpad swipe is dozens of events of ±2–10** — and every pitch step re-engraves the whole
  score. Acting per event gave **12 steps and 12 re-engraves for 12 synthetic trackpad deltas**, so
  a real swipe threw the note off the staff and stalled the tab on a fanless M4. Accumulating travel
  fixed the symptom, but only by adding a second thing to tune.
- **And the accumulator was fragile in two ways that each looked like "the wheel is dead":** a `let`
  inside the effect is wiped every re-attach (**~6 times during one swipe**), and a time-based
  "gesture gap" is exactly backwards on a slow machine — a step re-engraves, so every event arrives
  "late" and the accumulator resets each time.

**The drag has none of that.** `setPointerCapture` on pointerdown (the note leaves the pointer on
the first step, so without capture the gesture dies), steps measured from where the pointer went
down rather than from the previous event (no accumulated rounding drift), and
`DRAG_PX_PER_STEP = STAFF_SPACE / 2` so the notehead tracks the pointer exactly. Verified:
`Si4b2` dragged up 15 px becomes `Mi5b2` — **exactly three staff steps**, across the octave seam,
carrying its 2-comma flat, and **one undo reverses the whole drag**.

⚠ **A test bug wasted a round in the middle of this.** After `save()` clicks the header button,
Playwright scrolls it into view and pushes the sheet off-screen; the cached bounding box then
pointed outside the viewport, `mouse.move` put the cursor off-page, and **no pointer events were
delivered at all**. That reads identically to "the interaction is broken". `hoverNote` now scrolls
the note into view, re-reads the box, and **asserts the pointer is actually over the intended note**
before acting — so this failure can never masquerade as an app bug again.

**Measure hover is gone in edit mode** (owner): editing is whole-score, so framing a bar says the
wrong thing about what a click does. Note hover moved to CSS (`.kv-note-hit`) rather than React
state, so it costs no re-render — teal on hover, amber + ✕ when selected. Clicking empty space
still opens the measure modal, which is still the only way to insert a note until step 4.

Re-verified after the rework: `npm test` 217/217, `smoke:app`, `smoke:page`, `smoke:editor` all
pass, and the 302 strip PNGs are **still byte-identical** (the new CSS is scoped to overlay divs).

**Undo coalesces by gesture.** `apply(fn, {coalesce})` merges same-keyed edits inside 600 ms, so one
wheel gesture — or one piano-roll drag, which emits an edit per pointer-move — is one undo entry.

**The engraving did not move:** 2 pieces re-rendered before and after, **302 strip PNGs and every
label byte-identical** (only the `.done` marker's timestamp differs). `npm test` 217/217 unchanged,
`smoke:app` and `smoke:page` pass with the same counts (7 staves → 16 strips → 344 notes / 28
measures).

## 2026-08-07 (later) — the editor is specified, and five docs pulled back from the cap

**The modal is going, and the owner specified what replaces it:** press **Düzenle**, the sheet
zooms, a **palette appears beside it**, and you **arm a tool** — a note value, an accidental, the
tuplet sign — then click the score. Clicking a note selects it, shows an **✕** to delete, and the
**scroll wheel** moves its pitch, carrying its accidental. Inserting a note = arm a value and click
empty space, pitch from the click's height. **Playback stays live while editing.** Mus2's shape,
which the owner uses. Brief: [../mvp/editor.md](../mvp/editor.md).

**Reading the code settled three design questions, and two went against the first draft of the
brief.** The owner's instinct was that the sheet is rendered from the model's decoded tokens and
editing should just edit those and re-render — and the tokens *are* real (`\tup3`, `\tupend`,
`\repstart`, `\repend`, parsed in `stitch.ts`). But **`stitchStrips` consumes them**: tuplet members
come out as written × 2/3 durations, and `expandRepeats` **duplicates** the repeated measures into a
playing order ("Output is FLATTENED — what the editor and playback want"). So by the time the sheet
is engraved there are no tokens left. Token-editing was then **rejected on the owner's own
reasoning**: playback needs the flattened doc, and a repeated passage renders twice from one token,
so a click cannot be attributed to a pass.

That resolved the rest. **Repeats stay uneditable** — inserting a repeat barline into already
unfolded music would corrupt it — which also **dissolved the schema fork** an earlier draft raised.
**Tuplets stay editable**, because `\tup3` is arithmetic and not an object: `isTupletMember` is
literally "the duration's denominator is divisible by 3", so the tool multiplies each member by ⅔
and needs no schema change. Two rules the owner set: members must share a duration, and the run must
be contiguous.

**`Save JSON` is deleted, and that retires the rationale this page had been using.** Earlier drafts
justified the rework as "the editor is the Rung-3 labeling loop's tool, so seconds per correction is
labelling throughput". With the export gone that is false, and it was corrected rather than left to
rot. It is a defensible deletion — the labelling loop's primary path is `scripts/rung3/review_ui.py`,
not the web app — and the honest remaining reason is simply that a friend with a wrong note should
be able to fix it.

**The owner then closed three of the four open questions.** Tuplet selection is **first note, then
last note** — and the page must **refuse** any end note that would not make a valid tuplet rather
than erroring after the fact. Reading the draw code turned that into a hard rule: the tuplet digit
is **hardcoded `"3"`** (`SheetView.tsx:392`), so a six-member run — which *would* satisfy
`tupletGroupsIn`, since it also sums to a plain value — would draw a bracket that lies about the
rhythm. **Exactly three members** until that digit is derived from the group size. "Empty space"
means **anywhere** (between notes, before the first, after the last), editing is **whole-score and
never measure-scoped**, and **zoom is dropped** as unnecessary — which conveniently removes the
re-engrave trap it would have created, though the underlying rule stands: no transform on the score
container, because `render.ts` crops training strips from that SVG by rect and `onLayout`'s boxes
*are* those crop rects.

**And one addition solved a problem this page had flagged.** The palette carries its own **Çal/Dur**,
and **Çal starts from the last edited measure**. Edit mode necessarily consumes click-to-seek (a
click now selects or inserts), which would have removed "play from this bar" exactly when you are
hunting for a wrong note; playing from the last edit answers it directly — fix a note, press Çal,
hear the bar. It costs one tracked number.

**The last question closed the same day: the bar ABSORBS.** An insert over-fills its bar, a delete
leaves it short, **bar lines never move**, and a bar that is over *or* under its length **warns**
rather than blocking — rippling was rejected because on a decoded page the bar lines came from the
model's own `|` tokens, and re-flowing rewrites the structure a corrected page most wants to keep.

**Writing that warning up found a circularity, and then something better.** The obvious reference
length is `Measure.lengthBeats` — but it is computed **from the bar's own contents**
(`measures.ts:123`), so `isMeasureValid` is **true by construction** on any freshly loaded score and
can only ever mean "you have changed this bar". A first attempt to measure how often decoded pages
have bad bars returned a meaningless 0/28 for exactly that reason. The honest reference is the
**derived meter** (`deriveTimeSignature`) — and against that, interior bars off-meter run **0/32,
0/60 and 0/108 on three clean SymbTr scores** but **8/28 on a real decoded page**. So the warning is
silent on correct music and lights up where the model misread a duration: **error localisation, as a
side effect of a warning the editor needs anyway** — the half of the 2026-07-27 goal that W8 was
dropped without delivering. ⚠ n = 1 decoded page, the 8 are *candidates* rather than confirmed
errors, and a mid-piece usul change (`Kod` 51) is a known false-positive source. Verify before
promising it.

Also cheap, and worth knowing: **per-note rects are nearly free** — `attachTitles`
(`SheetView.tsx:285`) already walks every drawn note calling `getSVGElement()`, so the same walk
records a rect.

**Then the docs were refactored, not squeezed.** Four files sat at exactly **399** lines and one at
397, against a 400 cap — every one of them one line from failing `check_docs.py`, which is a trap
rather than a limit. Split by genre, each leaving a pointer behind:
`STATUS.md` **404 → 279** (its three "Previously" blocks were real-page-track context, now
[../rung3/standing.md](../rung3/standing.md)); `MANUAL_CHECKS.md` **399 → 225** (corpus/renderer
checks 1–8 out); `mvp/rungs.md` **397 → 192** (W0–W3 out); `mvp/deploy.md` **399 → 340** (the
commands out, so *why* and *how* stop sharing a page); `rung3/labeling.md` **399 → 304** (the two
review queues out). Nothing above 384 now. ⚠ The moves needed link-depth rewriting in both
directions — a `docs/`-relative link does not survive a move into `docs/rung3/` — and
`check_docs.py` caught every one.

## 2026-08-07 — the style pass: the harness became KomaVision

_The prerequisite W10 grew on 2026-08-06, now paid. The release exists to ask two friends about the
**interface**, and there were only two first impressions to spend — an unstyled page would have
bought back feedback we already had._

**The problem that had to be solved first, and it was not a visual one.** Five Playwright tools
drove this DOM by matching English prose: `text=Turkish OMR`, `/read a page:/`, `/read \d+ strips/`,
`/read on the server/`, `/(\d+) staves → (\d+) strips → …/`, and button names like `/Save JSON/`.
That made the user-facing copy load-bearing — a Turkish UI would have broken every one of them at
once, and translating the regexes would only have moved the coupling one step and broken again at
the next rewording. **Rewording is what a style pass IS.** So the facts were separated from the
sentence: `apps/web/src/ui/status.ts` now returns `{ text, state, kind, where, counts }`, and
`#omr-status` renders the non-text half as `data-*`. The checks assert on that; the copy is free.
This landed as **step 0, before anything was styled**, so the tools went green against the OLD UI
first — and from then on any red was unambiguously the redesign's fault. It also made the fallback
assertion *stricter*: `data-where="local-fallback"` proves the configured server was tried and
missed, where `/read on your machine/` also matched a build with no decode server at all.

**What the friend now sees.** Warm editorial paper — ivory, warm near-black ink, one terracotta
accent used only on the primary button, focus rings and the active toggle; hairline rules instead
of shadows, so the chrome sits *below* the engraved score in visual weight. The display serif is
the one `SheetView` already engraves its header in (Georgia), so page and notation read as one
object rather than two typefaces arguing. A webfont was never an option regardless: **COEP
`require-corp` blocks a font CDN outright**, which is worth remembering before anyone proposes one.

**The restructure is what actually stops it reading as a harness**, not the colour. Upload became
the hero and takes drag, drop or **paste** (the real gesture for someone screenshotting a PDF); the
transport kept only the six controls a musician touches; the other twelve folded into a collapsed
**Gelişmiş**. Three blocks of developer prose were deleted, including an empty state that told the
user to run a Python script. Progress is honest — a determinate bar only where a real count exists
(the 41-rotation deskew sweep, the browser's per-strip decode), a moving stripe and an elapsed clock
for the server's single batched request, never an invented percentage.

**Two traps worth writing down.** The elapsed clock must live OUTSIDE `#omr-status`, or
`page-smoke`'s "progress actually moved ≥3 distinct lines" passes for free (it reported 13, which is
real). And `#strips-input` now sits inside a collapsed `<details>`, whose subtree is hidden — so
`app-smoke` opens `#advanced` first, and the file inputs use the clip pattern, never `display:none`,
which would drop them from the accessibility tree as well as from Playwright's reach.

**Checked, on the built artifact, not just in dev:** `npm test` (217/217 round-trip, 90/90 signature
vocabulary), `gate:browser` 27/28 as expected, `smoke:app`, `smoke:page`, and `smoke:build` green on
**both** paths with identical scores. Not deployed yet — that one redeploy carries the style pass
and makam selection together.

## 2026-08-07 — makam selection: the app plays the makam, not the notation

_Owner request, taken before the style pass. Pipeline stage 9's makam half, designed in
`PIPELINE.md` since June and never built. The reason it jumped the queue: playback sounded every
note exactly where the staff spells it, and for a Turkish listener that is audibly wrong on the most
common makam there is — uşşak's segah is not where AEU writes it. A friend opening the link would
hear that before noticing anything about the interface._

**What the research settled.** AEU has four accidentals and several perdes are performed away from
all of them, because the notation has no sign for where they sit. Four deviations have numbers
behind them and made the table; everything else was left out rather than guessed. Uşşak's segah:
dügâh→segah is 6–7 commas in practice (the *eksik büyük mücennep*), not AEU's 8 — the owner chose
the **−1.5 comma** midpoint. Sabâ's hicaz: Rauf Yektâ's 12/11 puts **2.5** commas of flatness on the
re-bemol, not 4, so **+1.5**. Hüzzam's hisar: the pentachord's augmented second shrinks 12 → ~10.5–11
commas, so **+1**. Segah karar: the Ottoman perde sits about a comma below the Arelian, **−1**. And
the row that is not padding — **hüseyni and muhayyer explicitly do NOT take the uşşak lowering**,
which is written into the table as an empty rule list so nobody "completes" it by symmetry.
Sources are in [../mvp/makam.md](../mvp/makam.md); the literature disagrees on magnitudes and the
table takes midpoints, saying so.

**Three owner decisions, all narrowing.** Documented deviations only (every makam selectable, only
sourced ones bend anything). Sound only — no key-signature redraw, so the engraving, `Save JSON`
and `buildStrips` are untouched and the OMR never claims to have read something it did not.
`none` is the default.

**Detection, and the thing that made it hard.** A decoded page has no metadata, so the makam is
guessed from the score: derived signature (`deriveKeySignature` → the string
`data/makam_signatures.json` is keyed on) plus the **karar**, the note it ends on. The karar is not
garnish — `\komaFlat b \bakiyeFlat e \bakiyeSharp f` is printed by hüzzam, karcığar AND sûznâk,
three makams with three different intonations behind one signature.

**A measurement changed the design.** Scored over the 213 bundled scores, ranking by corpus weight
whenever the karar failed to narrow gave 7 audibly-wrong pieces. Declining outright when *some*
candidate declares a karar and the piece ends elsewhere traded **2 wrong bends for 2 pieces that
merely stay as written** — 5 wrong, 4 missed, **204/213 (95.8%) audibly correct**. That is the trade
the feature exists to make: a wrong makam detunes notes that should not move, `none` only declines
to help. ⚠ Measured on **clean SymbTr scores, not decoded pages**, so it is an upper bound; the
residual 5 are beyati-vs-hüseyni-shaped pairs that share both signature and karar and are separated
only by seyir, which nothing here reads.

**Two duplications were accepted on purpose, both pinned by tests.** `SIG_TOKEN_BY_ALTER` in core
mirrors `AEU_TOKEN` in `tools/render/lilypond.ts` (core must not depend on `tools/`, and the label
path is load-bearing) — `npm test` now round-trips all **90 signature variants** through both
vocabularies. And `packages/core/src/makamSignatures.ts` mirrors `data/makam_signatures.json`,
because the app ships without `data/` and without Python; one script writes both, and `--from-json`
re-emits the TS without rescanning the manifests, so refreshing the TS copy cannot silently rewrite
the JSON from whatever pools happen to be on the machine.

**The wiring trap.** The rules match a note by its **written** letter + accidental, but
`transposeDoc` respells every note from its koma — so reading the rules after a transpose finds
nothing. The deltas are computed from the base doc and applied **by event index, last**, immediately
before `buildTimeline`, which recomputes frequency from `koma53` and ignores the cached `freqHz`.
That also keeps the fractional komas (−1.5) away from every speller.

**And a trap in the checks.** The new prompt is a modal with a full-viewport backdrop, so
`app-smoke` and `page-smoke` would have failed at their first click after a decode with "element
intercepts pointer events" — a green-to-red that has nothing to do with the feature.
`tools/browser/makamPrompt.ts` is the shared dismissal; `build-smoke`/`live-smoke` read text only
and needed nothing. `smoke:app` passes end to end and reads its real page as **Uşşak**.

⚠ **Not deployed.** The live site plays as written until the next rebuild-and-redeploy, which the
style pass carries anyway. Still open: the **header OCR** half of stage 9, direction-dependent
intonation (the uşşak lowering is strongest in descent; karcığar's hicaz-on-nevâ is an *average* of
ascending and descending), and degree-relative rules for pages written away from a makam's own
perde.
Phases 0–1 in full detail → [HISTORY.md](HISTORY.md). Run-level numbers →
[../METRICS.md](../METRICS.md) and [../../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md).

## 2026-08-06 (night) — W9 is finished: there is a link

**<https://komavision.netlify.app>** serves the app, `Beyaban/omr-weights` holds the 211 MB of
graphs, and `omr-decode-00003-jrl` on Cloud Run reads the music with the door now locked to that one
host. The owner made the two accounts; everything else was driven from here. Recipe and the two
traps: [../mvp/hosting-setup.md](../mvp/hosting-setup.md).

**Two things cost time, and neither was our code.**

*The Hub does not send `access-control-allow-origin: *` for `model.json`.* The three `.onnx` files
do — they are LFS, from a CDN — but the small file comes from the Hub app, which **reflects the
caller's origin** behind `vary: Origin`. A bare `curl` sends no Origin and shows `huggingface.co`,
which reads as broken. It is not, and `model.json` is fetched on **every** page load rather than only
on the fallback, so a wrong conclusion there would have been expensive. `build-smoke.ts` gained
`--weights-url` for exactly this: the local stand-in sends `*` and answers directly, the Hub reflects
and answers through a 307, and only the real thing exercises either.

*A brand-new Netlify site is private and does not say so.* Every path answered **401** with a login
redirect. Account and email were both fine — Netlify now defaults new sites to `sso_login: true`.
Also worth recording: the interactive CLI (`sites:create`, plain `deploy`) is unusable in this
monorepo because it stops to ask which workspace; the `netlify api` calls ask nothing.

**Measured on the way through.** The whole chain passes `smoke:build` on both paths with identical
scores. The fallback costs **69.9 s against 33.2 s** with local weights — a friend's first fallback
pays a **211 MB** download, once. And **`--cpu-boost` did not visibly help**: `loadMs` read
**25,857 ms against 9,500** without it. That is deliberately *not* written up as "cpu-boost is
worse" — n=1 against n=1, both on the first start of a freshly pushed image, and Cloud Run streams
image layers lazily, so a first read of the graphs is partly network. The flag was taken because it
was free on a redeploy and it still has no evidence behind it.

## 2026-08-06 (late) — the host was re-picked on a number, and the built app met the live server

Picking up "host the app and the weights", two things came out of it before either account existed.

**Cloudflare Pages cannot host this build, and the reason is one file.** Pages refuses any single
asset over **25 MiB** (checked against Cloudflare's own limits page, not from memory) and
`dist/ort/ort-wasm-simd-threaded.jsep.wasm` is **26,827,543 bytes = 25.58 MiB** — over by ~613 KB.
The app moved to **Netlify**, which reads the same `public/_headers`; **nothing in the repo changed**,
which is exactly what the 2026-08-02 decision bought by keeping the two hosts interchangeable
instead of picking one. Worth recording that the fix was available and was **not** taken: importing
`onnxruntime-web/wasm` selects the non-jsep binary at **12.86 MiB** and would take `dist/` from 43.3
to ~30 MB, losing nothing in use (`executionProviders: ["wasm"]` is all this app ever asks for) — but
it changes the runtime the fallback loads, so it owes `gate:browser` and `smoke:build`, and a
hosting deadline is the wrong reason to spend that.

**The built app was driven against the LIVE Cloud Run service for the first time** —
`smoke:build --decode-url <service>`, previously only ever run against `localhost:8080`. **PASS on
both paths**: same 26-strip page, **61.2 s reading on the server against 33.2 s in the local
fallback**, identical score (9 staves → 26 strips → 399 notes / 26 measures), `crossOriginIsolated`
true, no page errors. The first run of it that day *failed*, and that is worth keeping: no decode
server was running, so the server path fell back to the browser and the check reported a broken app.
It is doing its job — the header says it needs `dev:server` — but the failure it prints looks like a
product bug rather than a missing prerequisite.

Everything past this point needs accounts the owner has to create, so the session ended with the
walkthrough rather than a deploy: [../mvp/hosting-setup.md](../mvp/hosting-setup.md).

**Closing note, written after the deploy: the last check had to be built, because the lock broke the
existing one.** Setting `ALLOWED_ORIGINS` means a localhost preview is refused by the decode server,
so `smoke:build` — the check written specifically to run the artifact that ships — could no longer
reach the shipped configuration. `npm run smoke:live` (`tools/browser/live-smoke.ts`) drives the
deployed site instead, and it **passed on both paths**: server **49.8 s**, fallback **73.0 s** with
the weights coming from the Hub over the real network, same score, no page errors. The localhost dev
origins were then added back to `ALLOWED_ORIGINS` so `dev:web` still works, which is a convenience
and not a hole — a CORS origin is forgeable outside a browser, and the rate limit, payload caps and
`--max-instances 3` are what actually bound abuse.

**Then W10 grew a prerequisite.** The owner looked at the deployed site and stopped short of sending
the link: it is a working harness and looks like one. A style pass goes first, on the release's own
logic — W10 exists to ask two friends about the *interface*, and there are only two first
impressions to spend.

## 2026-08-06 (evening) — deployed, and two bugs of the same shape stood in the way

The decode server is live on Cloud Run: `omr-decode`, europe-west3, 1 vCPU / 2 GiB / concurrency 1 /
max-instances 3. Google Cloud was set up from nothing in the same sitting — the owner's previous
`gcloud` install turned out to be already deleted, leaving only credentials from a finished job in
`~/.config/gcloud`, which a reinstall would not have cleaned. Walkthrough:
[../mvp/gcloud-setup.md](../mvp/gcloud-setup.md).

**The measurements, which change the story deploy.md told.** A cloud vCPU costs **1.93 vCPU-s per
strip** against 0.55 on an M4 core — **3.5× slower**. So a page is ~40 vCPU-s, the free tier covers
**~4,450 pages/month** (a third of the laptop estimate, still far more than 50 users need), and
**the server is SLOWER than the owner's own browser: 250 s vs 166 s over 128 strips, plus a 10.6 s
cold start.** That is not a disappointment, it is the outcome deploy.md predicted in writing before
any of this was built, and the release was chosen on the thermal argument rather than a speed one.
The prediction holding is worth more than a good number would have been.

Quality survived the move intact: **120/128 strips (93.8%) identical to the browser — the same rate
as the local server** — with divergences on near-ties (median log-prob −0.87).

**Two bugs stood between "built" and "running", and they are the same bug twice: the artifact that
ships was never the artifact under test.**

1. The container exited before binding its port. Cloud Run said only "failed to start and listen on
   PORT"; the logs said `Dynamic require of "util" is not supported`. `pngjs` is CommonJS, the
   bundle is ESM, and esbuild's shim throws. `npm run dev:server` never saw it because `tsx`
   resolves CommonJS natively. Fixed with a `createRequire` banner; `npm run check:bundle` now boots
   the bundled artifact, which is the check that was missing.
2. `check:limits` failed one case against the live service: an oversized body returned **503, not
   413**. The server was destroying the request socket, which reaches a proxy as a backend failure —
   turning a client's mistake into an apparent outage, and sending the app into a slow local
   fallback instead of a clear error. It now answers first and closes after.

That is three for three today, counting the frozen fallback in the built web app this morning. The
pattern is worth naming: **every check in this project ran the convenient artifact — dev server, dev
bundle, `tsx` — and each time the shipped one differed, it differed in a way that was invisible
until something real ran it.**

⚠ Still owed: the $5 budget alert (owner's console), the 413 fix is committed but not redeployed, a
second cold start after genuine idle, and two-at-once uploads.

## 2026-08-06 (later) — the app can be deployed too, and building it found a frozen fallback

The server was only half of W9's title. The other half — hosting the app — turned out to carry the
session's most useful failure.

**What was built:** `npm run build:app` produces a 43.3 MB site (ORT's wasm 25.6, opencv.js 14.8)
out of a `public/` holding 332 MB of ONNX graphs and 220 render-corpus scores. It **fails** if the
output crosses 60 MB or contains an `.onnx`, because deleting a directory by hand is exactly the
step someone forgets. Weights move to `VITE_WEIGHTS_URL` — a Hugging Face Hub repo holding exactly
what `prepare-models.mjs` already emits, so the container, the Hub and a local checkout stay one
artifact set — cached in Cache Storage and fetched only if the fallback fires. `public/_headers`
carries COOP/COEP and is read by both Cloudflare Pages and Netlify, so the host choice stays open.

**Then `smoke:build` found that the built app's fallback hung forever.** Every
`InferenceSession.create` logged `document is not defined` and never resolved. The cause: the
bundler inlines `ort-wasm-simd-threaded.jsep.mjs`, which is *also* ORT's worker script, and a Worker
has no `document`. Fixed by copying ORT's runtime to `public/ort/` and setting
`wasmPaths = "/ort/"` — **in production only**, because dev has never had the bug and dev is the
configuration the browser gate passes at 27/28. A `?url` deep import was tried first and fails:
ORT's package `exports` does not expose `./dist/*.wasm`.

**Why this is the entry worth keeping.** Dev was green. `smoke:page` was green. The gate was 27/28.
Every check the project had said the app worked, while the thing a friend would actually open was
frozen on the path that exists precisely for when the server is cold. The only reason it was caught
is that the new check runs the BUILD, serves it with the real headers, and puts the weights on a
SECOND origin — each of which was a deliberate choice to make the rehearsal harder than the dev run
rather than more convenient.

Both paths now read one page to the same score, 9 staves → 26 strips → 399 notes / 26 measures:
server 8.3 s, cross-origin fallback 34.0 s.

⚠ A smaller lesson, twice: the console error for a failed fetch carries its URL in the message's
*location*, not its text. Both smokes filtered on text, so the error each one provokes on purpose
was being counted as a real failure. `page-smoke` had the same bug and it is fixed there too.

## 2026-08-06 — W9: the decode server is built, checked, and NOT deployed

The whole of `apps/server/` plus the client swap, in one session. Four things are worth keeping,
and two of them are results that went against the plan.

**The design that made it cheap: there is no second decoder.** The server imports
`apps/web/src/omr/decode.ts` — the browser's own module — so the greedy loop, the stopping rule and
the logprob scoring are the same lines on both sides. Paying for that meant getting ORT out from
under `decode.ts`: types now come from `onnxruntime-common` and the `Tensor` constructor travels on
`Sessions`, which is exactly the move `omr/types.ts` predicted for the mobile app. The browser gate
was re-run and is **27/28, unchanged**. Compare the alternative: the slicer port needed W4, W5, W6,
a Python control arm, a paired A/B and a McNemar test to prove a second implementation matched.

**The seam sits after preprocessing, not at the raw crop.** The client rotates/resizes/pads and
uploads a finished 409×583 PNG; the server does only the rescale (`omr/pixels.ts`). Reason: a
server-side resize would be a THIRD resampler — the canvas draw already is not PIL BILINEAR — and
another rung to prove it equal. PNG is lossless, so both runtimes see identical bytes.

**Result 1 — the quality question was answered with the right instrument.** Strip-level agreement
between server and browser is 93.8% (120/128), which is *not* the number that matters: agreement
cannot say which side is right, and it also moves with the batch size (batch 1 gives 93.8% too, but
a different 8 strips). So both arms were scored against the same 267 hand-verified `_realval_v2`
strips with the same scorer, **paired**, the way W6 settled arm A vs arm B: **no detectable
difference** — McNemar exact p = 0.727, total edits 780 vs 768, per-strip sign test p = 0.664. The
divergences sit at tokens the model was on average ~55% sure of.

**Result 2 — batching does not pay, and that withdrew a stated reason for having a server at all.**
`deploy.md` listed "no batching, ever" as a structural advantage over `onnxruntime-web`. Measured:
batch 8 is a few percent SLOWER than batch 1 at 1, 2 and 4 threads, and costs **2.9× the peak
memory** (2,778 MB vs 955 MB on a 38-strip page) — on Cloud Run, a 4 GiB container instead of 1 GiB.
One 409×583 Swin forward already fills the cores. `OMR_MAX_BATCH` defaults to 1 now; the batched
path stays behind the knob because this is one CPU architecture, but the *claim* is gone. The
"smaller upload" reason went the same way: the crops upload is a median 1.7× the page image, not
smaller. What survives as the second reason, and it is a big one: **native ORT is ~4× faster than
wasm on the same laptop** — 6.0 s a page against 24.5 s, with the tab's worst stall dropping
2,358 ms → 29 ms.

**What is NOT done, and why:** nobody has deployed it. `gcloud` is not installed and no project
exists, so cold start and a real cloud vCPU's speed are unmeasured — every number above is from the
dev M4 and is an upper bound on speed, a lower bound on cost. The container has never been built
either: the Docker CLI here comes from Rancher Desktop and its daemon was not running. It is
designed to build in Cloud Build anyway (the Dockerfile is not at the context root, and an Apple
Silicon `docker build` would produce arm64), but that means the first deploy is also the first
build. The **hard billing cap** stays owed — the one safety item that bounds the bill and the one
that cannot be asserted from the repo.

**A cached measurement was destroyed and restored.** `scripts/score_browser_gold.py` wrote its
result to one fixed path, so scoring the server arm overwrote W3's stored browser numbers. The
browser arm was re-run to restore them (it reproduced exactly: SER 0.0818, exact 60.2%), and the
script now takes `--score-out`. Worth recording as a near miss: nothing in the file said it was a
single-arm store, and a second arm was always going to arrive.

## 2026-08-05 (later) — the release is RE-SCOPED, and seven open questions are settled

The owner set the scope of the release, and it changed enough of the surrounding plan that most of
the MVP track's open questions closed at once. **The premise that moved everything: the friends
release tests the INTERFACE, not the model.**

> *"I will make the app in web first. Then I will think about phones. The first release to friends
> only for interface, not for the model. I want some feedback about what should I add as a feature,
> I will continue to upgrade model paralelly without asking to the friends. I just share it with two
> friends at the beginning, then I make round 3 and if result is good, release it to all people, if
> not, make round 4 etc."*

**What follows from it, and why each one is a consequence rather than a separate choice:**

- **Round 3 is UNPAUSED and runs in parallel.** The 2026-08-02 pause existed so Round 3 could be
  *aimed* by real feedback. Feature feedback will not aim it, so the reason for the pause evaporated
  with the scope. The two tracks are now independent: the product track never trains, the model
  track never touches the app.
- **The friends build swaps to a better model whenever one lands** (owner's choice over freezing).
  Cheap now that decode is server-side — a redeploy, no client download. ⚠ **Recorded because it is
  a real cost, not a free lunch:** a friend's decode-quality remark can no longer be attributed to a
  model version. Those remarks are anecdotes. The exam stays the only thing that judges a model.
- **Feedback comes back by talking to them.** No in-app reporting button. The earlier `deploy.md`
  argued one was "worth more to Round 3 than any speedup here" — true at scale, wrong at n=2, where
  a conversation returns feature ideas and a button returns bug reports.
- **Phones are out of scope**, which **removes the strongest argument on the deploy page**. The
  iOS-Safari cache-eviction case (~200 MB re-downloaded every week or two on cellular) was reason #1
  for moving decode off the client, and it does not apply to a web-first release. It is **parked,
  not refuted** — it returns intact when phones do. **So the server now rests on the thermal
  argument alone** — which the owner confirmed later the same day still holds at ~25 s (see the end
  of this entry), so resting on it is sound rather than a gap.
- **The public launch is gated on Round 3's exam result**, so the ladder no longer ends at W10.
  ⚠ That bar is **not written down yet** — `rung3/round3.md` owes it, on the user-effort metric,
  before training starts. It now decides two things (ship Round 3, and open the app), which is more
  weight than a number gets by default.

**W8 (confidence highlighting) is DROPPED.** The pre-registered bar — flag 10% of tokens, catch
≥60% of errors — was not met (best at that budget: 26.3%). A usable soft cut existed
(`min_logprob < -0.5`: 22.6% of strips, 57.1% of edits, 2.5× lift) and was not taken. **Two things
worth recording:** the bar was *not* moved to fit the result, which is the failure mode that has
already cost this project twice on exam headlines; and dropping it leaves half of the 2026-07-27
goal unbuilt, which is said out loud in STATUS, DECISIONS and OVERVIEW rather than quietly dropped.
Nothing is deleted — the measurement, `check:logprobs` and the per-token logprobs all stay.

**The server stack: Node + `onnxruntime-node` importing `apps/web/src/omr/decode.ts`, not Python.**
This is the decision with the most leverage per line of code. A Python service could run
`decode_page.py` nearly verbatim and Modal is built for exactly that — but it would create a **third**
decode implementation to hold in parity with the browser and with Python-ORT. Proving two
implementations agree cost this project an entire rung the last time: W4, W5, W6, a Python control
arm, a paired decode A/B and a McNemar test. Reusing the module that was already validated at W3
(SER 0.0818 vs 0.0821) makes "the server matches the browser" true by construction.
✅ **It also closes, without a change, the open question `CLAUDE.md` was carrying**: "Python is
training/data only and never ships" stands, and nothing under `src/vision/` becomes shippable.

**Hosting: Cloud Run free tier**, adopted with its weakness on the record. A ~1 GB container
cold-starts in 10–30 s and two-friend traffic is sparse, so nearly every upload is cold — **the same
sparse-traffic argument this project uses to reject GPU, which the deploy page had applied to only
one of the two options.** It is survivable because of the fallback below. Hetzner CX22 (~€4/month,
always on) is the named fallback and costs less than keeping Cloud Run warm (~$15–25/month).

**The client falls back to in-browser decode** on failure, timeout or cold start. Near-free (the
path exists and is under test) and it means a server outage never reads as "the app is broken" to a
friend who cannot debug it. **Two consequences that were nearly missed:** the browser must still be
able to *get* the weights, so the HF Hub delivery decision stays LOCKED — with weights fetched
lazily, only if the fallback fires; and **the COOP/COEP host requirement does NOT lapse**, because
the fallback wants wasm threads. Both `deploy.md` and the MVP README had written the opposite
("weights never reach the browser", "COOP/COEP mostly goes away"); both are corrected.

**Two things checked rather than assumed, before any of this was written down:**

1. ✅ **Batched server decode needs no model re-export.** `encoder_model.onnx` and
   `decoder_model.onnx` both carry a dynamic `batch_size` axis. Had it been pinned at 1, the entire
   batching argument would have dragged a re-export and a re-run of the parity chain behind it.
2. ⚠ **The server probably will not make a page faster**, and this is now written down as a
   non-claim in `deploy.md`. A shared cloud vCPU is slower per core than an M4 P-core, and the cold
   start adds 10–30 s. Warm, expect roughly today's ~25 s; cold, worse. **The purchase is a cool
   laptop, not a fast page** — without this stated, the first benchmark reads as a failure.

**Then the thermal question closed too, and the re-test was removed from the plan.** Owner: *"We do
not need to check whether mac still gets hot. We already know this."* The plan above had a
half-hour thermal re-test as the first step of Track A, on the grounds that the original complaint
was made when a page took ~56 s rather than ~25. That reasoning was sound when nobody had used the
app at the new speed; the owner has, and answered from direct experience. **Recorded as an
observation, not an instrumented number — and that is the right standard here**, because the claim
is "this laptop gets hot in normal use", which the person holding the laptop is the authority on.
The docs no longer ask for it, and W9 now starts at the endpoint.

**A doc conflict fixed while here:** `DECISIONS.md` carried two rows dated 2026-08-05 with opposite
status — "DECODE MOVES TO A SERVER … LOCKED" and "PROPOSED — NOT TAKEN … the owner will settle it
once the app is feature-complete". Whoever read it next had a coin flip. The proposal row is now
marked SUPERSEDED, keeping its GPU and ads reasoning, which still stands.

## 2026-08-05 — the backend decision is TAKEN: decode moves to a server

**Owner: "I am sure about deploy the app in a server to protect computers for now."** That settles
the question `docs/mvp/deploy.md` reopened the same day, and it reverses two things that were marked
LOCKED: the 2026-07-02 "No production backend" decision and the `CLAUDE.md` hard rule "No backend,
ever". Both are now marked OVERTURNED with this as the cause, per the rule that a reversed decision
keeps its reasoning rather than being deleted.

**The stated reason is thermal, not capability** — a page burns ~19 s of multi-threaded CPU on the
client, and every user pays that heat on their own machine. Worth recording because it is a
*product* argument, not a speed one: the app already reads a page in ~25 s.

**What does NOT change, and is easy to get wrong:** audio and the editor stay local; the W4–W6
slicer port stays client-side, because slicing is the cheap half and it is what keeps the upload to
~19 small crops instead of a full-resolution photo; and **the in-browser decode path is KEPT**.
`gate:browser`, `parity:armb`, `parity:arma`, `smoke:page` and the W3 browser-vs-gold quality result
all rest on it — and it becomes the reference the server must be shown to match, exactly as local
Python was the reference for the slicer port. Deleting it would silently retire most of the
validation this track has built.

**One implication that is NOT settled and must not be assumed:** a Python decode service would make
part of `src/` shippable for the first time, which cuts across "Python is training/data only". The
hard rule is now split — training stays Python-only-never-ships; the serving half is an open design
question.

⚠ **Adopted with two figures unmeasured, both of which shape the build rather than the decision:**
the thermal complaint has not been re-tested since page latency fell ~56 s → ~25 s (so the size of
the win is unknown, and it is one page of work to find out), and no server has been benchmarked, so
every cost number in deploy.md is an extrapolation from one M4. The build order in STATUS puts the
benchmark first for that reason — it also decides Cloud Run vs Hetzner.

## 2026-08-05 — doc sync: deploy.md was written against a page that no longer exists

**`docs/mvp/deploy.md` (the reopened backend question) was drafted BEFORE the deskew speedup landed
the same day, and three of its load-bearing facts had gone stale.** Corrected rather than deleted,
because the reasoning is still good and only the numbers moved:

- it said the client "still pays the ~35 s sweep" and that W7 made it non-blocking rather than
  cheap. True when written; the sweep is now ~1.1 s and the whole slicer 1.6 s/page.
- it recommended "fix the deskew before building any server", on the ground that prep stays on the
  client in both architectures. **That recommendation was taken** — and it needed none of the
  behaviour change it budgeted for, because the fix turned out to be an exact substitution.
- its priority table ranked the deskew fix above the server on the owner's own complaint. That
  comparison is spent; the table now shows where the remaining ~25 s sits (**~19 s decode, 1.6 s
  slice**), which makes decode the entire remaining case for a server.

**The consequence worth flagging: the thermal complaint that opened that doc was measured against a
~56 s page, and a page is now ~25 s with ~60% less CPU burned.** Whether it still bites is
unmeasured, so "re-test the thermals" was added as the first Open Question, blocking *whether this
doc is needed at all*.

**STATUS was rewritten, not appended to.** Its "Next" still listed the finished latency item and
described W9 as plumbing; W9 is now a decision (settle the hosting question first), W10 carries the
safety checklist, and the corpus-wide estimator validation is re-priced from ~18 h to under an hour.
The file crossed its 400-line cap in the process, so the W0–W3 rung bullets and the Round-3
pre-render section were condensed to summaries — both are owned in full by `mvp/rungs.md` and
`rung3/round3.md`.

## 2026-08-05 — a slur above the staff was shearing the beams below

**Owner report: an uploaded page came back with a crop whose bottom was cut, so "notes and their
times could not be read."** Reproduced on corpus pages via the new slice inspector, and the residual
4.4% bottom clipping turned out to be two unrelated problems.

**85% of it is not a placement bug at all.** Those rows' music genuinely exceeds the frame — short by
a **median 2.31 sp** against a total non-staff budget of 7.2 sp — and they are mostly degraded scans
where `row_music_extent` saturates near its own `6*sp` limit because the row's ink is connected to
lyrics or the next system. No redistribution of a fixed frame can supply 2.3 more line-spaces; only
a scale change could, and scale is the axis the model is most sensitive to (12–15% edits per 1%).

**The remaining 15% was a real bug with a real fix.** `place_band` let ink ABOVE the staff claim room
without limit, so a slur reaching 5.0 sp up pushed the staff down and the frame cut the beams below.
**First answer was wrong and was corrected under challenge.** Bottom-first was measured — bottom
clips 3.0% → 2.7%, top clips 2.7% → 3.1%, total ink lost +1.9% — and reported as "a trade, not a
fix". The owner pushed back on whether it had to be a trade, which was the right question: ink AREA
weighs a slur's apex the same as a beam, and that was already known to be the wrong scale.

**Capping what the top may CLAIM is strictly better than both**, at 3.5 sp — a notehead three ledger
lines up sits ~3.0 sp above, ~3.5 with its accidental, and beyond that the ink is slur/segno/ornament
(the renderer injects slurs as deliberately LABEL-FREE distractors). Over 120 pages / 901 rows:

| | ≤3.5 sp above (real notes) | >3.5 sp (decoration) | below (beams) |
|---|---|---|---|
| old, uncapped | 0 | 19,670 | 19,932 |
| bottom-first | **500** | 23,681 | 16,193 |
| capped (shipped) | **0** | 22,763 | **17,231 (−13.6%)** |

Bottom-first buys beams by destroying real ledger-note ink, which is the harm the rule exists to
prevent. The cap loses nothing the old rule kept, and by construction only moves rows ALREADY in
conflict. Verified by eye on the reproducing row: beams complete, lyrics visible, only the slur's
apex lost. Python and TS moved together, so parity still reads W4/W5/W6 PASS with deskew 20/20, and
`smoke:page` still reads 16 strips / 344 notes / 28 measures.

⚠ **Still an information argument, not a decode result** — at 2.6% of rows an accuracy A/B is
underpowered, the same wall adaptive placement hit. `OMR_VPLACE_TOP_CLAIM=99` restores the old rule
and the slice inspector toggles it, so the claim stays checkable on a real page.

## 2026-08-05 — the skew sweep is 126× cheaper and returns the same answers

**The page latency written up as a W7 problem is closed, and nothing about the estimator's
behaviour changed.** The sweep cost ~35 of the ~36 s a page took, and the plan named two ways out —
an early exit at 0°, or replacing the estimator with a standard one. **Neither was needed**, and
both would have been behaviour changes owing a fresh measurement.

**What it actually was.** Each of the 41 rotations ran `qualifyingLineRows`, whose expensive step is
a page-wide `morphologyEx(MORPH_OPEN)` with a `len`×1 kernel — plus two full-image Mat copies to get
in and out of opencv.js. Because that kernel is one row tall the opening is purely per-row, and a
1-D opening has a closed form: a pixel survives iff it belongs to a run of at least `len`
foreground pixels. `qualifyingLineRows` never uses the opened image — only its ROW SUMS — so the
whole morphology collapses to a run-length scan. **856 ms → 6.8 ms per call, 125.8×.**

**The trap, and why the check sweeps angles.** `morphologyEx` defaults to
`morphologyDefaultBorderValue()`, i.e. it erodes as if everything outside the frame were foreground.
So a run touching the left or right edge survives WHOLE however short it is, while an interior run
must reach `len`. Encode that wrong and the counts differ only on some pages at some angles — a
happy-path test would miss it. `npm run check:deskew` therefore runs both implementations on the
SAME rotated image at every angle the coarse pass evaluates, over real corpus pages: **0
disagreements in 328 evaluations across 8 pages**.

**End-to-end evidence, not just the micro-benchmark.** The parity harness re-run with the REAL
estimator (no `--inject-skew`): **deskew angle identical 20/20**, bars, windows and strip spans all
exact, W4/W5/W6 PASS — at **1.3 s/page against 36.6 s** before, which makes the browser slicer
FASTER than the Python it is a copy of (~1.9 s stage 1). In the app, `npm run smoke:page` reads the
same page to the same 16 strips / 344 notes / 28 measures, sliced in **1.6 s** instead of 36.4 s;
the whole upload is **~25 s**, and **decode is now the bottleneck** at ~1.2 s/strip.

**What this buys beyond speed:** the owed corpus-wide validation of the deskew estimator was priced
at ~18 h of browser time and is now well under an hour, so it stops being a reason to keep injecting
Python's angle.

## 2026-08-05 — a decoded \tup3 that cannot close no longer draws the wrong rhythm

**Reported symptom (owner): "the model emits `\repstart`, `\repend`, `\tup3` but they are not
seen in the rendered sheet."** Measured over the 1,704 decode caches on disk rather than guessed at,
and it split into two different stories.

**Repeats are NOT lost — they are consumed.** `buildDoc` uses the marks to compute a playing order
and then writes only notes: the note model has no field for a repeat, volta, segno or D.C., so the
sheet cannot draw one. What it does instead is UNFOLD, which is what the owner wants (confirmed
2026-08-05: no repeat barlines on the page, unfold with correct voltas, cursor forward only).
`expandRepeats` was traced by hand and is correct for well-formed tokens —
`A B [1.C] :‖ [2.D] E` → `A B C A B D E`. **1,165 of the 1,262 pages carrying a repeat mark unfold
(92.3%)**; the remaining **97 (7.7%)** carry a `\repstart` the model never closed. Left alone on
purpose: on a page-at-a-time flow the matching `:‖` may be on the next page, and guessing "repeat to
the end" would duplicate material that is not repeated.

**Triplets were genuinely broken, and are fixed.** `\tup3` survives stitching as a duration whose
denominator divides by 3, and `tupletGroupsIn` recovers it — but only if a run of such notes sums to
a plain power-of-two value. A run the model could not close (dropped member, stray `\tupend` — the
census counts 354 stray, 423 unclosed, 115 nested) yielded NO group, so every member fell through to
`vexDuration`'s snap-to-nearest: **the page drew a definitely-wrong rhythm with no mark saying so**.
That is **1,287 notes, and 22.9% of `\tup3`-bearing pages losing at least one**. An unclosed run now
keeps its bracket over the members it has → **1,287 → 0**. It is not a guess at the true rhythm; it
is refusing to overwrite what the model read, and it puts a visible "3" where a correction is needed.

**What it cost, stated rather than buried.** `tupletGroupsIn` is shared with the label serializer by
design (CLAUDE.md: pixels and labels from one code path), so both sides moved together — **5
measures in 1 of 190 training pieces**, and only on a future re-render; `strips_v4` on disk is
untouched. Checks: 217/217 round-trip in both modes, all stitcher unit tests, typecheck.
⚠ **`verify-labels.ts` is the wrong instrument here and reported `checked 0`** — it needs the dev
server running, and it inspects ACCIDENTAL glyphs only, so it could never have seen a rhythm change.
The real safety check was rendering the three worst real pages (26/24/21 incomplete groups) through
BOTH draw paths — the curved arc and VexFlow's bracket — with **0 dropped measures and 0 page
errors**, which is what rules out a 1-member group throwing inside `SheetView`'s per-measure `catch`
and silently deleting a whole bar.

## 2026-08-05 — W7: the app reads a whole page

**Upload an image, get a playable score.** `apps/web/src/omr/page.ts` joins the ported slicer to the
decode path — `decodeGray` → guarded skew → `sliceStage3` → crops as canvases → `decodeStripsToDoc`
— and `App.tsx` gained a "Read page" input beside "Read strips". `npm run smoke:page` drives the
real app end to end: **7 staves → 16 strips → 344 notes / 28 measures**, strip count matching local
Python **16 vs 16**, sheet rendering, playback starting, no page errors. Slice **36.4 s**, decode
**19.1 s**. W2's smoke reads Python's own crops of that page and gets the same 344 notes / 28
measures, which is a free (n=1) confirmation through the whole product path.

**The interesting half was the 35-second freeze, not the wiring.** The whole slice ran as one
synchronous block, and a tab that cannot answer JavaScript for 35 s is not shippable. The fix
changes no arithmetic: `estimate_skew` became a **generator** yielding after each of its 41
rotations, with `estimateSkew` (run to completion — the parity path) and `estimateSkewAsync` (step
and yield — the app) as its two drivers, plus `guardedAngle` holding `deskew`'s two guards so the
app's estimate-then-slice order decides identically. **An async copy was the obvious alternative
and was rejected**: two copies of a tuned search drift the first time a gate moves, which is the
duplication CLAUDE.md already names. Verified rather than argued — the parity harness re-run with
the REAL estimator (no `--inject-skew`) on 20 pages, 4 of them rotating, gives **deskew angle
identical 20/20** with W4/W5/W6 all still PASS. What still blocks is one **2.35 s** stretch (ink →
components → staves → rows → barlines → windows), under the 5 s bar and left alone.

**Two traps, both worth the entry.** Vite's dep optimizer discovers opencv.js at the *first upload*
(it is behind a lazy `import()`, invisible to the static scan), re-optimizes, and full-reloads the
tab mid-slice — which throws the upload away and presents as a hang at **0% CPU**, not as an error.
`optimizeDeps.include` makes it a startup cost, and the fix was re-verified against a **cold**
`.vite` cache. And the smoke's strip-count bar was first written against the page's
`_manifest.json`, which would have failed W7's wiring for a W4 reason; it scores against
`slicer_ref.py` now. Third time this project has relearned that agreement with an artifact is not
correctness.

⚠ **The latency is made bearable, not fixed** — a straight screenshot still pays all 41 rotations.
Both candidate fixes are behaviour changes owing their own measurement; see STATUS.

## 2026-08-04 — W6: the slicer port is finished, and the decode arm says the crops are the same

**The last stage is ported and the browser now cuts a page into strips the way Python does.**
`apps/web/src/omr/slicer/windows.ts` transliterates `_span_cap`, `_split_wide` and
`window_measures`; `sliceStage3` adds the driver's pad/trim block and returns crop **spans**, with
`cropStrip` cutting pixels only when a caller wants them. Over the whole corpus — 1,781 pages /
33,805 strips — window fields are exact on **33,783/33,783**, strip count per page on
**1,697/1,697**, `row_x0`/`row_x1` within 2 px on **99.99%**, invariants at Python's own **0**.
Numbers: [../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

**The verdict that mattered was the decode arm, and it was worth building properly.**
`tools/vision/parity/arm-a.ts` slices a page with the port, decodes those crops, decodes Python's
crops for the same page, and compares **pairwise on (system, window)**: **12 A-only against 4 B-only
discordant pairs on 450 strips, McNemar exact p = 0.077**, arm A 87.78% vs arm B 86.00%, **0 strips
unmatched**. The pairing is what makes it readable — the level comparison the plan originally asked
for ("within 1 pp of 86.0%") has a ~1.6 pp standard error at n=450 and could not have resolved
anything. And the decisive detail fell out of the same data: **all 16 discordant strips have
identical crop widths**, so the slicer is ruled out as the cause rather than argued about.

**Two judgement calls, both worth remembering:**

- **The Python control runs the REAL driver.** `slicer_ref.py` calls `page_to_strips` into a temp
  dir rather than re-implementing its ~40-line pad/trim block. The port is transliterated from those
  same lines, so a second hand-written copy in the reference could encode one misreading **twice**
  and then agree with itself — the exact failure this control exists to prevent. Cost: a second
  stage-1 pass, ~4.2 s/page, ~2 h for the corpus. It also validated itself: on the 8-page smoke
  sample its strip entries matched the manifests 106/106.
- **A bar was restated, and both numbers are now printed.** The first corpus run read
  `window fields FAIL 33,799/33,805`. All 6 misses sat on the only two pages whose **bar count**
  differs — the `_terminal_overshoot` near-ties W5 already diagnosed as ±1 grayscale. Windows are
  computed *from* the bars, so a 100% window bar silently demands a 100% bar bar, which W5 itself
  set at 99.0%. The gate now scores rows whose bar list agrees (**33,783/33,783**) and prints the
  raw number beside it. This is the second time a criterion written before the ±1 residue was
  understood has failed a port that agrees with Python — W4's zero-staff bar was the first.

**Two paths that had never run are now measured.** `hasNotehead`, ported at W5 with nothing
exercising it, fires on **861 clef-prefix trims**, identical on both sides — W5's non-claim is
discharged. `_split_wide` cuts **10,246 strips** across 4,414 groups; its escalation loop (raise n
until every piece fits) fires **589 times**, while the `sorted(set(cuts))` collapse it is written to
survive **never happens in this corpus** — kept anyway, because one unbroken beam run would hit it.

**The one difference bigger than 2 px is a gutter, not a cut through ink.**
`benim_serv_i_hiramanim…_p1` s09 has identical bars, flags and pads, but Python cuts its over-wide
measure at 931 and the port at 939: the ±1 grayscale changes which columns read as zero-ink, moving
the chosen gutter **centre** 8 px **inside the same whitespace run**. The two crops differ by 8
columns of blank.

⚠ **Not done, deliberately:** the W0 cv-probe was scheduled for deletion at this rung and was kept —
it is the only thing that would catch an opencv.js version bump changing a primitive under the port.
⚠ **Still owed:** the deskew estimator is validated on 132 pages, not the corpus (every full run
injects Python's angle), and W7 inherits ~36 s/page of slicer latency, ~35 s of it that sweep.

## 2026-08-04 — W5: barlines ported; the trap list paid for itself, and a free check earned its keep

**The riskiest file in the slicer reproduces Python over the whole corpus, on the first run.**
`apps/web/src/omr/slicer/barlines.ts` transliterates `_longest_vertical_run`, `_is_thin_stroke`,
`_cluster_cols`, `_terminal_overshoot`, `detect_barlines` and `_has_notehead`; `sliceStage2` adds
them to the driver. Against local Python on **1,781 pages / 12,123 rows / 51,019 bars**: bar count
exact **12,121/12,123 (99.98%)**, positions within 1 px **51,018/51,019 (100.00%)**, exact
**51,013/51,019 (99.99%)** — all three W5 bars, on the corpus rather than a sample. Numbers:
[../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

**Why it passed first time is the interesting part, and it is not luck.** W4 left
[../mvp/slicer-port.md](../mvp/slicer-port.md) a named list of hazards in this specific file, and
they were transliterated as written instead of rediscovered: `_is_thin_stroke`'s staff-row
`continue` that does **not** reset the run, `_terminal_overshoot`'s four state variables with four
different reset rules, and the three per-ROW `binarize_ink` calls that must not be hoisted into one
Otsu. **Trap 1 was checked rather than trusted** — `30 * 0.35` and `30 * 0.75` really are exactly
10.5 and 22.5 in IEEE doubles, so `Math.round` returns 11 and 23 where Python's half-to-even returns
10 and 22. That is `tol` (gate 1's slack) and `fat_w` (gate 2's width): a naive port silently
retunes both gates and every measure boundary under them, and it would still have *looked* fine.

**Every difference was diagnosed rather than tolerated, and none is the port.** All 8 differing rows
reproduce inside Python under the ±1 grayscale residue: feed it `cvtColor` on the colour read
instead of `imread(IMREAD_GRAYSCALE)` — the two disagree on 3.8–9.5% of these pages' pixels — and
Python emits **the port's exact bar list and reject list**. Three shapes:

- **2 rows differ in bar COUNT, one in each direction.** Both are `_terminal_overshoot` near-ties
  (`birgunbana…_p1` s1, where the port rejects a candidate Python keeps; `kurdilihicazkar…_p2` s2,
  the reverse). The symmetry is the argument: a real bug in that walk would flip one way across many
  rows, not 2 rows out of 12,123 in opposite directions.
- **The one 2 px difference is inherited, not new.** `sayd_eyledi…_nota_p1` s5 is the page W4
  already recorded as having `x0` off by 1 (157 vs 158). `detect_barlines` snaps the first bar to
  `int(staff.x0 * scale)` and that row's scale is exactly 2.0, so 1 page px becomes 2 row px. No
  gate moved.
- **On all 6 rows where a position moved, the reject lists are identical.** No gate disagreed at all.

**The free extra check earned its keep, which is the transferable lesson.** Recording
`detect_barlines`' *rejected* candidates costs nothing — the gates run either way, `debug_info` only
decides whether their verdicts are kept — and it is strictly stronger than the bar list. It found
**9 further rows that produce identical bars while disagreeing about what was thrown out**: 6 where
a rejected candidate's x moves by 1, 2 where a candidate is generated on one side only (it fails
gate 1 rather than being rejected later), and **1 where the same column is rejected for a different
REASON** — `huseyni_saz_semai_rasid_efendi_neyzen_baba_p1` s7 col 956, `gate2_fat` in Python against
`gate3_blob` in the port. Rejected either way, so no output check could ever see it, but it means
two independent gates both sit near their thresholds on that column. Worth having on record before
W6 changes anything upstream.

**Two non-claims, stated rather than glossed.** The corpus run used `--inject-skew`, so like W4 it
validates everything downstream of the deskew estimator and not the estimator. And **`hasNotehead`
is ported but exercised by nothing measured here** — its only caller is `window_measures`, so W6
owns it.

**The manifests stayed the weaker reference and again sat below the bar.** Current Python reproduces
only **11,689/12,099 (96.61%)** of the manifests' `row_bars`; the port reaches 96.55%, 8 rows below,
and those are the same 8 residue rows. Scored against the manifests the port would have read 96.55%
against a 99% bar and looked like a failure — the same trap W4 fell into and documented.

Also: `scripts/slicer_ref.py` now records bars and rejects beside the staves and prints the
manifest-bar ceiling; `slicer-parity.ts` gates the three W5 bars, prints the reject-list agreement
and ranks the worst barline pages. Verification: `npm run typecheck`, `npm test` (217/217 both
modes) and `npm run gate:browser` (27/28, unchanged) all clean.

## 2026-08-04 — W4: the slicer's first half is ported, and two planning assumptions died

**The port reproduces Python's stage 1 exactly, over the whole corpus.** `apps/web/src/omr/slicer/`
now holds `constants.ts` (every constant with its Python line, plus `pyRound`), `cvOps.ts` (the only
opencv.js importer), `prepPage.ts`, `staves.ts`, `rows.ts` and `slicer.ts`. Against local Python on
**1,781 pages / 12,123 systems**: staff count 1,704/1,704, manifest-zero pages 77/77, `scale`
12,122/12,122 — all three W4 bars, on the corpus rather than a sample. Row width and the
outer-lines+median-spacing triple are both 12,123/12,123.

**Everything that differs anywhere is the ±1 grayscale residue, and none of it reaches a crop.**
Seven systems differ by 1 px — six an *interior* staff line's cluster centre, one an `x0` — and
`normalize_row` reads only the outer lines and the median spacing, which are identical on all
12,123 systems. W0 predicted this residue and its fixture was too clean to show it; this is the
first time it has been observed reaching any output. Numbers:
[../METRICS-SLICER-PORT.md](../METRICS-SLICER-PORT.md).

Two scope notes recorded rather than glossed. The corpus run used `--inject-skew` (Python's angle
fed in) to stay affordable, so the **estimator** is validated on 132 pages, 132/132, not the corpus.
And the "zero-staff pages yield zero staves" bar was **restated against the control**: those pages
are identified by an empty manifest, local Python now finds a staff on 1 of the 77, and the port
finds the same one — the original wording failed a port that agreed with Python exactly.

**The interesting part is what the plan had wrong.** Both errors were in the *plan*, both were
found by measuring, and neither was visible by reading the code:

**1. `prepPage` could not be a no-op.** [../mvp/slicer-port.md](../mvp/slicer-port.md) recorded that
every step of the camera path is inert on clean input, so the port started with a stub. It is true
of the perspective crop (0% of pages take one) and false of the deskew: **15.3% of corpus pages
(272/1,781) take a real rotation**, 17.4% on the first sample where the angles ran 0.3–1.1°. The first parity run read 86.7%, with three pages finding *zero*
staves where Python found 7–10; joining the failures against Python's own skew angles showed **22
of the 23 failures were exactly the 23 deskewed pages**. `estimate_skew`/`deskew` are now ported in
full, both guards intact, so an axis-aligned screenshot is still untouched. The lesson is the one
this project keeps re-learning: "documented no-op" was a claim about *code paths*, and the corpus
is what decides whether it holds.

⚠ It costs **~35 s of the ~36 s** a page takes in the browser — 41 rotations, each with a page-wide
`MORPH_OPEN` — against ~1.9 s for Python's whole stage 1. That is a **W7** problem (a screenshot
pays the whole sweep to learn it has no skew) and it is deliberately NOT optimised inside the port,
because a faster estimator is a behaviour change and needs its own measurement. `--inject-skew`
exists so full-corpus runs of everything downstream stay affordable.

**2. The manifests on disk cannot be the acceptance bar, and using them failed a correct port.**
W4's stated acceptance was "against the 1,781 manifests". One page the port failed —
`gozumden_gonlumden_hayali_gitmez_nota_p1`, 7 staves against the manifest's 5 — turned out to match
local Python **line for line**: every line y, x0, x1, spacing. Measured properly, the current
`page_to_strips.py` reproduces only **1,680/1,704 (98.59%)** of those manifests, already below W4's
own 99.5% bar; 1,578 of the 1,781 page dirs were sliced on Colab and the artifact has drifted from the code.

`scripts/slicer_ref.py` now dumps Python's stage 1 and is both the control arm and the *sample
definition* — `slicer-parity.ts --ref` runs exactly the pages in it, so the two sides cannot drift
apart on which pages they ran. Manifest agreement is still printed as the weaker second reference,
and the port reaches that ceiling exactly (1,680/1,704, the same pages as Python). This is the same
mistake W3 caught one rung earlier in a different costume: **agreement with an artifact is not
correctness**, whether the artifact is another decoder's tokens or a manifest on disk.

⚠ **Owed, small:** the deskew estimator is validated on 132 pages, not the corpus. Closing that
costs ~18 h of browser time, so it is only worth doing if W5/W6 turn up a skew-related difference.

## 2026-08-03 — W3: the browser is not worse than Python; the confidence bar is not met

**The release-gating question is answered.** W2 left open whether the ~14% browser-vs-Python
disagreement meant the browser reads *worse* or merely *differently* — agreement with another
decoder cannot tell those apart, and if it were "worse" then friends would get worse results than
every number in METRICS.md claims.

Both sides scored against the **same 261 hand-verified `_realval_v2` strips**, with the **same
scorer** (`eval_omr.align`), on identical strips: **SER 0.0821 → 0.0818, exact-match 60.2% both,
AEU macro recall 94.8% → 94.9%, micro 92.5% both.** Per class everything is within a point and the
two largest moves cancel (`\bakiyeSharp` −0.8 pp, `\komaFlat` +1.5 pp). The disagreement is two ORT
builds splitting near-ties at no quality cost. ⚠ It is a *paired* Δ on real-val: it establishes the
difference, not the absolute level.

**The confidence signal was measured against gold for the first time, and it does not clear its
bar.** Flagged strips genuinely are worse — **8.60 token edits per strip against 2.69** — so the
signal is real. But as an error *locator*:

| flag if min < | % strips | % of edits caught | lift |
|---|---|---|---|
| −1.0 | 3.8% | 11.3% | 3.0× |
| −0.7 | 9.2% | 26.3% | 2.9× |
| −0.5 | 22.6% | 57.1% | 2.5× |
| −0.3 | 33.0% | 64.2% | 1.9× |

The pre-registered rule — flag 10%, catch ≥60% of errors — is **NOT MET**; the ceiling at a 10%
budget is 26.3%. Worth stating plainly because the rule has sat in STATUS unexercised since
2026-07-27, and W8 was going to be built on the assumption it held. It does not. There is a usable
soft cut at −0.5, and W8 now has a real choice: ship it as a hint, pay for per-TOKEN localisation
(the logprobs exist; the cost is threading token identity through the stitcher's tie/tuplet/repeat
folding), or drop the feature. Note also the −1.0 line was validated as a **bad-crop proxy for the
labelling queue** — a different job from locating a user's errors, and W2 already found it does not
fire on a blank crop (those score ≈ −0.84).

**The planned 40-page ceiling sample was dropped, with reasons.** Its purpose was to tell a slicer
difference from a resampler difference; gold has now shown agreement is not a quality proxy at all,
so the ceiling is only a reference level. And its stated ±1 pp bar is not resolvable — SE is ~1.6 pp
at n=450 and ~1.2 pp even at 40 pages. **W6 should compare arm A and arm B pairwise on the same
strips** (a McNemar-style count of strips where exactly one arm matches Python), which is far more
sensitive and needs no extra pages.

## 2026-08-02 — W2: the app reads sheet music, and the resampler hypothesis dies

**"Read strips" works end to end in the real app.** Pick a page's `*_sNN_wNN.png` crops → the model
decodes them in the browser → the stitcher builds a score → the editor loads it, plays it, and
⬇ Save JSON writes a valid `schemaVersion: 1` document. Proven in the app itself rather than a
harness (`npm run smoke:app`): 16 crops → 344 notes / 28 measures, sheet renders, playback starts,
no uncaught errors. **~1.1 s/strip**, so a 20-strip page is 20–30 s — slow but fine behind a
progress line, and it means W7 needs no Web Worker.

Sessions load **sequentially**, unlike the gate's `Promise.all`: three `InferenceSession.create`
calls in flight means three sets of weights plus ORT's copies live at once, and on a phone the
failure mode is memory, not bandwidth.

**A measurement bug worth remembering.** The first arm-B run reported **10%** token agreement while
two of three pages produced *byte-identical scores* — an impossible pair, and the tell. Cause:
`decode_page.py` stores raw HF `decode()` output, which glues added tokens (`\sig\komaFlatb`), while
the browser's `detokenize` emits them spaced. Both streams pass through the stitcher's
`normalizeTokens` before becoming music, so comparing before it measures serialization, not reading.
Normalized: **10% → 96.7%** on that sample, **86.0% over 20 pages / 450 strips**.

**The pre-registered rule fired, and was deliberately not followed.** The plan said "if arm B lands
below ~90%, the resampler gap dominates — spend a day matching PIL's BILINEAR first". 86% is below
90%. But the rule's causal model is wrong, and the data says so plainly:

- strips Python flagged (`min_logprob < -1.0`, n=32): **21.9%** agreement
- strips Python was confident about (n=418): **90.9%** agreement
- crop width, which determines how hard a strip is downscaled and therefore how much a resampler
  difference could bite: **no trend** — 89.3% in the narrowest decile against 83.9% in the widest,
  with 75.0% and 92.9% deciles scattered between. Token count equally flat.

Disagreement tracks **model uncertainty**, not resampling severity: near-ties either ORT build can
tip, the same mechanism as the gate's 27/28 and its measured 69/31 coin-flip. `preprocess.ts` is
unchanged. This is the third time on this project that a plausible mechanism has failed to survive
its first measurement, and the second time the pre-registered response would have wasted a day.

**Unplanned benefit: the first real-data evidence that `min_logprob < -1.0` is a meaningful line.**
W1 had to file a non-claim because the 14 gate strips were all too confident to test the boundary.
Here 32 strips fall below it and behave completely differently from the other 418. It separates
exactly the strips where two runtimes disagree — encouraging for W8.

⚠ **Left open, and it gates the release: is the browser WORSE, or only different?** Agreement with
Python cannot tell those apart. The browser reads slightly *fewer* tokens on disagreeing strips (31
of 63 are −1 or −2 ids), which is suggestive and no more. The decisive test is browser decodes
scored against `_realval_v2`'s 267 hand-verified gold strips versus Python on the same strips —
moved to the front of W3, because it is the only finding so far that could change what ships.

Also measured, and relevant to W8: a blank / black / tiny / wrong-orientation image decodes to 4 ids
and 0 events **without throwing**, but scores `min_logprob ≈ -0.84` — *above* the −1.0 flag. The
confidence threshold does not catch an empty crop; the event count does.

## 2026-08-02 — W1: decode module extracted, and a pre-registered criterion that was wrong

`omrGate.ts` 309 → 164 lines; `greedyDecode` / `preprocessCanvas` / `detokenize` and friends now
live in `apps/web/src/omr/` with real exports. `omr-gate.html` is byte-identical and still reads
27/28 with the same failing strip and the same token stream. `preprocessCanvas` widened to any
`CanvasImageSource` (the slicer emits canvases, not `<img>`); `willReadFrequently` was deliberately
left off its context, since moving rasterization to software could perturb `drawImage` filtering
and the gate's canvas arm with it.

**The interesting part is the failure.** `argmaxLast` now also returns the chosen token's
log-probability, and the pre-registered acceptance was "≤1e-3 per token vs `onnx_parity.py`". It
failed at **8.6e-2**. The diagnosis is worth more than the number: ids agree on 13 of 14 strips, so
the decode is sound — the gap is the **ORT-web vs ORT-Python int8 numerics difference already
recorded under STATUS's open risks**, the same effect that tips `bunca_cevrinle`'s 69/31 near-tie
and drops a `\tup3` there. Feeding both sides bit-identical `.pixels.bin` tensors buys identical
*input*, not identical *logits*. So ≤1e-3 was never a claim about our arithmetic; it was an
untested assumption about two runtimes, and it should not have been written as an acceptance bar.

The check was re-aimed at the thing W8 actually depends on — **does the browser land on the same
side of the validated `min_logprob < -1.0` threshold as Python?** Over 576 token logprobs: 0 tokens
and 0 strips disagree. The raw runtime gap is now reported rather than gated, because it is a
property of the two ORT builds and not something this code can fix.

⚠ **Non-claim, recorded so it is not quoted as stronger than it is:** 0 of those 576 tokens came
within 0.1 of −1.0. All 14 gate strips are confident reads (every min above −0.15), so the fixture
cannot test the boundary — "0 crossings" is partly a property of the data. Owed at W3, on real-page
strips where min-logprob actually approaches the threshold.

## 2026-08-02 — the work switches to the product: MVP track opened, W0 passed

**Owner decision: freeze the model, finish the pipeline, release to friends, then train Round 3
against real feedback.** The argument, recorded because it will be tempting to re-open: Round 3
targets pitch (40%) and duration (28%) of user edits through a synthetic content-mix change — a
real lever, but two rounds have already shipped as "improvement, not pass", and a third would change
nothing a friend would notice. Meanwhile the *product* half of the 2026-07-27 goal (show the user
where the errors are) had never been built, and feedback is unobtainable without a pipeline. New
track: [../mvp/README.md](../mvp/README.md), a W0–W10 ladder with per-rung acceptance checks.

**The gap turned out to be one file, not a phase.** Exploration found decode, Donut preprocessing,
detokenization, stitching, the editor and playback all already browser-safe — `omrGate.ts` simply
never exported its helpers (and grabs DOM nodes at import time, which is what blocks reuse), and
`tools/render/stitch.ts` has no node imports and already typechecks under `apps/web`'s strict
config. The only genuinely missing piece is a TypeScript port of `page_to_strips.py`.

**W0 — opencv.js primitive parity: PASS.** Both sides are OpenCV 5.0.0 (checked, not assumed). The
probe runs two arms and the split is what makes it informative: fed *Python's own grayscale bytes*,
opencv.js is exact on all five primitives (Otsu threshold, ink count, the full 2,339-row MORPH_OPEN
projection, connectedComponents, INTER_AREA column sums). Fed the *browser's own PNG decode*, it
drifts — and that drift is unavoidable, because `cv2.imread(IMREAD_GRAYSCALE)` converts inside the
PNG decoder while a browser only ever sees RGBA afterwards.

**The grayscale question was settled by measurement rather than by picking a tolerance**, which is
worth recording because the first instinct was to write a tolerance. OpenCV's own two paths already
differ by ±1 on 7.4% of a colour page's pixels, and 18% of corpus pages are truly colour. So the
test became: re-run the *whole slicer* under that perturbation. All **119 strips across the 6 most
colour-shifted pages came out bit-identical** — same counts, `row_x0`/`row_x1`, `scale`, `row_bars`,
pads. Sub-quantization noise does not reach the output. Numbers:
[../METRICS-SLICER.md](../METRICS-SLICER.md).

**A side effect worth more than the probe: the browser OMR gate is now a command.**
`window.__gateResult` had been exposed since the gate was written and had never once been used —
the gate was checked by opening a browser and reading it. `tools/browser/run-page.ts` runs any
harness page headlessly. The wrinkle: the gate reports a single boolean, and that boolean has read
`FAIL` ever since the known ORT-web int8 `\tup3` wobble, so it cannot distinguish that from a real
regression. The runner therefore tallies the page's own ✓/✗ marks and the script pins
`--expect 27/28`. Baseline captured before any refactor: **27/28, canvas (product) path clean at
14/14**, sessions ready in 3.0 s, ~0.9 s encoder + ~0.2 s decode per strip.

## 2026-07-31 — the whole re-slice is browsable: the `reslice-all` queue

**One queue over all 33,804 crops / 1,704 pages of `data/real/strips_v2`** (30,049 decoded on
Colab), so the re-slice can be *looked at* rather than only sampled — before this, 165 hard-tier
rows were the only crops anyone had seen. `scripts/rung3/build_reslice_queue.py` builds it,
worst-first, seeding each row with the page cache's decode; the 392 val-side emitted labels are
used where they exist. Contract and warnings: [../rung3/labeling.md](../rung3/labeling.md).

**Two things were deliberately NOT done, and both are the same mistake in different clothes.**
Nothing from the older pools (`strips_nota`, `strips_r1`, `strips_tup`) is joined in, because they
were emitted from crops the old slicer cut: a strip filename survives a re-slice and its pixels do
not, so their labels would caption the new crop with the old crop's truth. And the queue is not
proposed as a labelling target — 33,804 hand checks is not a plan, so it ships as a browsing tool
with nothing consuming it. The 165 already-read `realval-hard-v2` verdicts are carried in, since
those *are* the same crops from the same slicer.

**`review_ui.py` had to learn lazy queues to hold it.** 33.8k rows is 16 MB of JSON and
`/api/state` is re-fetched every time the verdict log opens, so queues over `EAGER_MAX` now ship
counts only and their rows come from `/api/rows` on first open. Verified in a headless browser:
first paint 2.3 s, tab switches clean, images resolving from `strips_v2` (the same page also exists
under the old `data/real/strips`, so `QUEUE_IMG_ROOTS` is load-bearing here, not decorative).

## 2026-07-31 — real-val v2 is built; the practice test is finally harder than the exam

**`_realval_v2`: 267 strips at the exam's own difficulty mix (47 / 110 / 110 = 17.6 / 41.2 / 41.2%),
against the old pool's 59 / 41 / 0.** The owner read all 165 queue rows by hand — 111 ok / 44 fix /
10 bad, 155 usable. Numbers: [../METRICS.md](../METRICS.md).

**The worst-first ordering is settled, not just argued.** The worst half of the queue needed a fix
**46%** of the time, the best half **7%** — a 6.5x concentration. Under the old most-confident-first
ordering half the labelling effort would have gone to rows that needed nothing. The sampled
early-stop was available and went unused; the owner read every row anyway.

**The rebuild worked, and here is its measured size.** Both pools read with the same model on the
same day: SER **0.028 -> 0.079**, which now EXCEEDS the exam's 0.052 — the practice test is harder
per token than the test it predicts. Mean edits/page 3.5 -> 8.6 while the median stayed at 2, the
signature of a restored hard *tail* rather than a uniformly harder set. The headline gap to the
exam closed 16.3pp -> 10.1pp, about 38%.

⚠ **The residual gap is class composition, and no amount of hard-strip labelling fixes it.**
Real-val v2 still carries 6 of 8 accidental classes and zero `\komaSharp` in-signature gold, while
the exam headline is substantially a `\komaSharp` n=14 artifact inside a six-class mean. A per-class
mean cannot be matched by matching difficulty when the classes differ. The lever is more
`\komaSharp`/`\kucukSharp` gold in exam v3.

**Two things fell out of the read.** By source, nota (scanned TRT-era prints) runs **5x** the SER of
neyzen (clean vector PDFs), 0.105 vs 0.021, and the hard tier is nota-dominant — so "hard" here
largely means scan quality and engraving age, not musical density. And the first `--build` did not
carry `source`/`makam` onto the new rows, so `eval_omr.py` filed 110 hand-labelled REAL strips under
"synthetic" in its provenance table; fixed with `piece_provenance()`, headline unaffected.

**The 2% pre-shrink is now dead, and real-val v2 killed it on its first outing.** The result had one
defence left: real-val was the easy pool with no hard tier, so an effect confined to hard pages
could have hidden there. Re-run on `_realval_v2` — 41% hard, SER 0.079, harder per token than the
exam — the same frozen model gives **746 edits at the identity warp and MORE at every scale**:
+2.7% at 1%, +2.7% at 1.5%, +5.2% at 2.5%, +4.4% at 4%. On the exam those same rungs were -13.5%
to -15.5%. The effect does not merely vanish off the exam; it reverses. Four independent scale
values agreeing on the sign was the evidence the original claim rested on, and it now points the
other way. Recorded in [../DECISIONS.md](../DECISIONS.md) as DROPPED, measured twice.

**Consumers repointed.** `degrade_probe.py` and `empty_crop_probe.py` default to `_realval_v2`;
`staff_geometry_probe.py` gained `--strips-dir` (default still the frozen exam).
`make_realval_pool.py` is documented as producing the *base* `--build` extends, not the selection
set — pointing an eval at `_realval` silently restores the no-hard-tier pool and fails silently,
because the number still looks like a real-val number. It also stopped carrying a third verbatim
copy of the val-split hash and now calls `data.is_real_val_piece`; verified behaviour-preserving,
0 of 444 pieces change side.

## 2026-07-31 — the full re-slice landed, after a notebook design flaw cost a whole run

**`data/real/strips_v2` is now the complete new-slicer root: 1,781 page dirs / 1,704 decode caches
/ 35,586 crops**, verified so that every cache passes `window_cache_ok` and records
`round2-stage2-best` — the emitter reuses all 1,704 rather than discarding them. 67 pages (4.2%)
found no staves; about half are `_p2` continuation pages that carry lyrics rather than music, and
the rate matches the 4.6% measured on the val side, so it is the expected tail. The **67 exam page
images were deliberately excluded** — the exam is frozen and its gold describes crops under
`data/real/strips/`, so producing a second set mid-round is how a frozen exam ends up scored on
pictures its gold does not describe. Re-cutting them belongs to exam v3.

**The first full GPU pass was destroyed by the notebook, and the lesson is a general one.** The
unpack cell does `rmtree('/content/tnc')` before re-extracting the package, and the decode output
was written *inside* that tree at `/content/tnc/data/real/strips_v2`. Re-running the unpack cell
after an unrelated error — the documented recovery step — deleted a finished 1,506-page run and
restored the package over the top, leaving the page list present and the output gone, which read
as "nothing was ever written". **Expensive output must never live inside a directory whose stated
job is delete-and-re-extract.** The output now lives at `/content/out/strips_v2`, outside anything
the notebook can delete, and the unpack cell reports existing work instead of removing it, so
`--skip-existing` can genuinely resume across sessions.

Three smaller defects fell out of the same session, all the same shape — a path that depended on
the working directory, which a Colab reconnect silently resets:

- Cells that read the output used relative paths, so after a reconnect they failed with
  `FileNotFoundError` while the data sat intact one directory away. All cells now use absolute
  paths.
- `!cp` from Drive does not stop a notebook when it fails, so a missing or still-syncing zip
  surfaced three cells later as a broken package. The unpack cell is Python now, checks the file
  exists and is ~1.2 GB, and asserts the three paths later cells need.
- `make_decode_zip.sh` copied a custom page list over `decode_pages.txt`, destroying the record of
  the previous run's page set. Lists keep their own filename now, and the script takes an output
  zip name so two runs can coexist.

## 2026-07-29 — real-val rebuilt on the new slicer; the labelling queue reversed

**The re-slice ran and the hard-tier queue is staged and being labelled.** The val-side pool is
**146 pieces / 194 pages**, not the 158 STATUS carried — the ⚠ recount was right to distrust the
old figure, and it moved by far more than the ±1 the stem fix predicted (37 of the page stems had
never been sliced into `strips_v2` at all). `emit_strip_labels.py --val-side` now derives that list
through `data.is_real_val_piece` instead of a hand-made list, so the two consumers of the split
cannot drift apart. Emit: 98 ok / 39 low_coverage / 9 unusable; 392 accepted, 550 review, 2,581
dropped, of which **1,007 are the hard reasons** (row_unaligned 743, nd_high 264) — no shortage of
candidates against the 110 owed. It took ~20 min, not the 45–60 estimated: that estimate came from
adding STATUS's separate slicing and emitting budgets, which double-counts, because
`get_decodes` → `decode_page` slices and decodes in one pass.

**The queue is now ordered WORST-FIRST (owner's call), and may be stopped early on a sampled
check.** Reversing it is what the calibration already implied: the decode is exactly right 80% of
the time above `min_logprob` −0.1 and 4% below −1.0, so the confident head was mostly the reviewer
confirming correct rows. Early evidence agrees — **50% of the first 32 rows needed a fix**, against
~84% `ok` in v1's confident head. The stop is deliberately gated on ~20 rows drawn at random from
the remainder and judged on whether the errors *cluster by kind*: scattered label noise handicaps
every candidate model about equally, but one repeated confusion systematically punishes the model
that fixes it. Rows accepted unread carry `by=tail-accept` so they stay auditable.

**Two silent-staleness traps were found and closed before any labelling happened.** Both are the
same shape — a strip *filename* survives a re-slice but its pixels do not:

- `build_queue` wrote its PNG copies behind `if not dst.exists()`, and **59** of the new candidates
  reuse a v1 filename. Queues are now versioned per re-slice (`_realval_hard_v2/`), the PNG is
  always rewritten, and a queue refuses to overwrite an existing CSV — which also preserves v1's
  130 verdicts instead of destroying them.
- Worse: `review_ui` resolved `/img/` through one global root list with `data/real/strips` first,
  and **129 of the 165** new rows also exist there. The whole queue would have rendered last week's
  crops against this week's rows, with nothing to notice. Image lookup is now keyed by queue
  (`QUEUE_IMG_ROOTS`) and verified end-to-end: v2 serves `strips_v2`, v1 still serves the old root,
  and the two crops differ.

`build_realval_v2.py` also grew the `--build` half its docstring had always promised but never
implemented, and `--strip-root` / `--pools` are flags now rather than constants — pointing the
script at a stale root was a silent wrong answer, not an error.

**Still owed:** 1,578 non-exam pages remain on old-slicer crops (page list in
`data/colab/decode_pages_reslice.txt`). Until that Colab pass runs, Round-3 *training* data is cut
by a different slicer than the one the app ships — real-val is correct either way, since new crops
are what production produces.

## 2026-07-29 — the page-stem collision: one collision, one duplicate, opposite fixes

**Closed the "two source pages collide on one stem" item left open by the windowing session — and
the obvious fix was right for only one of the two.** The proposal was to rename both with a makam
suffix. Checking the bytes first changed the answer:

- `bir_nigah_et_ney` — hicaz and saba PDFs differ, and they match **different SymbTr pieces**:
  Şekerci Cemil Bey / ağıraksak against Zeki Arif Ataergin / aksak. Two unrelated songs whose titles
  slugify the same. A real collision; one page was being destroyed on every slice. → both stems
  qualified with the makam, both pages kept.
- `nesem_emelim_ney` — hicaz and uzzal are **byte-identical**, PDF *and* rendered PNG (same sha256),
  and both rows match the *same* SymbTr piece. neyzen.com serves one upload under two makam
  directories. The "silent overwrite" here was overwriting a file with itself; nothing was ever
  lost. → uzzal copy dropped.

**Why renaming the duplicate would have been actively wrong:** it converts a harmless duplicate into
two real copies of one page in the pool, and near-duplicate pages landing on opposite sides of a
piece-level split is the exact leakage the by-piece split rule exists to prevent. The distinction is
free to compute — same match target means duplicate, different match target means collision — so
`collect_tuplets.neyzen_stems()` now derives stems that way over the whole match CSV, and both the
download and export paths share it so they cannot disagree.

**Scope was measured, not assumed.** Hashing every page image on disk and re-scanning every row of
the match CSV each returned **exactly these two** stems, so the class is closed rather than the two
instances patched. `emit_strip_labels.py` now refuses to slice when two pages resolve to one stem —
the failure was silent for two weeks, which is the part worth preventing.

**Fallout, recorded because it costs something.** The `bir_nigah_et_ney_p1` crops in `strips/` and
`strips_v2/` were cut from an unrecoverable one of the two pages — both are 1653×2338, so geometry
cannot identify the source — and were deleted; the pending re-slice regenerates them. The 5
realval-hard verdicts on that stem (3 ok / 1 fix / 1 bad) are void, which the queue rebuild already
covered. `nesem_emelim_ney_p1` crops were **kept**: both sources are byte-identical, so those crops
are well-defined whichever page produced them. The Colab page lists turned out to have **both**
colliding pages queued into the same strip dir, confirming the bug was live in that job too; fixed.

## 2026-07-29 — the windowing retune: constants stay, two cap bugs fixed

**The retune from the entry below was run to a conclusion, and its premise did not survive.** The
sweep that pointed at `MEASURES_PER_STRIP = 1` had been scored on *usable yield* — does a decode fit
the 59-id budget — which improves monotonically as windows shrink, because it cannot charge for the
near-empty crops shrinking creates. Those crops carry 20.8% of exam corrections. Re-scored with that
cost included, 1 measure/window takes the healthy band **81.6% → 60.4%**. The constant stays at 3.

**Why measure count was the wrong control variable at all:** across 31,968 decoded strips, width
explains only R² 0.54 of a strip's token count (stems + inked columns explain 0.77), the budget is
simultaneously over-run (11.5%) and under-used (28.6% spend ≤25 of 59 ids), and **8.9% of single
measures blow the budget alone** — which no `MEASURES_PER_STRIP` can fix. So a budget-aware packer
was built, decoded head-to-head against legacy on 16 val-side pages, and came back a **wash**
(healthy band 75.8% vs 75.7/76.2%; bad-crop proxy 14.4% vs 14.5/14.0%). It buys +16 usable strips
for +1.6pp more near-empty crops, so it ships OFF behind `OMR_WINDOW_MODE=budget`, like
`drawThinSharps`.

**What was actually broken** — found by measuring the pool, not by reading the file (the rule that
cost two reverted patches last session). The measure cap was unenforced (13 of 3,168 strips) and the
width cap was violated 82 times by **three separate paths**: the `lead` clef prefix re-extending
window 0 after the check, `_split_wide`'s gutter-shifted cuts overrunning, and the driver's crop pad
being added post-check. Both fixed, verified 13 → 0 and 82 → 0 on the affected pages, with measure
coverage invariant across 458 rows — no music gained or lost, at a cost of +7.2% strips on those
pages. Also fixed: decode caches were keyed on `measures_per_strip` alone, so a packing change would
have silently reused crops from different code — the same confound that spoiled the earlier n_ids
read.

**Then the crops stopped overlapping.** The owner spotted that the 6 px left pad has no matching
right trim, so neighbouring strips share pixels and a note could be read twice. The overlap was
real — 74.8% of mid-row strips — but the double-count was not: a notehead is 22 px against a 6 px
band, and on decodes a note repeats across an overlapping boundary **1.3%** of the time against a
**6.85%** within-strip null. (Two geometric estimates on the way to that, 1.2% and 7.8%, were both
wrong — one test window was too wide, the other also fires on beams. The decode test settled it.)
Chasing the edges turned up the reason to make the change anyway: **no label ever names an edge
barline** (0 of 421 start or end with `|`), yet real crops ended on the barline centre and showed a
closing one **61%** of the time against **5%** for the synthetic strips the model trained on. The
trim closes that to 22.5% — the rest is row-final strips, which have no successor to hand the
margin to. Decoded A/B on 16 pages is a wash, so it is kept for structural consistency rather than
accuracy, behind `OMR_EDGE_TRIM`.

**And the frame stopped cutting beams off.** The owner noticed 32nd-note beams sliced by the bottom
edge of a crop. Measured: the 336 px frame allows 4.60 sp above the staff and only 2.60 below, while
real music reaches 2.68 sp below at p90 — **11.6% of real staff rows lost content**, against 1.4% at
the top. Border ink alone would have misled here: 48.6% of real strips have ink on the bottom border,
but only 5.0% of it is the row's own music; 43.5% is a neighbouring system bleeding in, which more
margin would make worse. So the fix redistributes the frame rather than enlarging it — height and
the 30 px spacing stay, only the staff's position inside them moves, per row. Bottom clipping
11.9% → 4.4%. ⚠ Two honest caveats: the decode A/B is neutral (bad-crop proxy 13.8% → 15.0/15.6% at
two doses, no dose-response, so noise at 326 strips), and the "vertical shift is free" result that
first motivated it was measured at ~3 px against the 39 px shift used here — it did not license the
change, which is why the A/B was run. Kept because a clipped beam is destroyed information that a
confidence proxy cannot see; **not** claimed as an accuracy win.

**Left open:** `data/real/strips_v2` was sliced before these fixes and needs re-slicing before the
emit. And two source pages collide on one stem (`bir_nigah_et_ney_p1`, `nesem_emelim_ney_p1` each
exist under two makams), so one page of each pair is silently overwritten — found incidentally,
unfixed. Numbers: [../METRICS-SLICER.md](../METRICS-SLICER.md).

## 2026-07-29 — re-sliced the val-side pages, then found the slicer's windowing is mistuned

**The re-slice happened** — 158 val-side non-exam pages into `data/real/strips_v2` (3,168 strips),
a new root so the existing manifests and the 130 labelled queue rows keep pointing at intact crops.
Decided after the owner labelled the whole first queue and **43 of 130 (33%) turned out to be
unusable crops**, leaving 87 against the 110 needed — a re-slice was required either way.

**Then the emitter probe on one re-sliced page came back `accepted=3 review=2 dropped=25` of 30**,
with `over_budget: 11`. That stopped the full run, and the investigation found something worth
knowing before anyone re-emits.

**The 2026-07-25 slicer fix was right, and its downstream constants were never retuned.** The old
staff-detection kernel lost the ends of staff lines, pushing `x0` 70–490 px right and cutting off
clefs and whole measures; `STAFF_HOR_FRAC = 0.11` stopped that, and slivers fell 10.4% → 1.2%. But
rows now carry more music while `MEASURES_PER_STRIP = 3` and `MAX_STRIP_W = 1450` still assume
truncated rows. Decoding both crop sets with the **same** model (the earlier comparison was
confounded — the two decode caches came from different models): crops over the 59-id label budget
went **20.9% → 31.9%**. The emitter drops those, so content is captured correctly and then thrown
away. Sweeping `MEASURES_PER_STRIP`: 1 → 107 usable strips, 2 → 90, 3 → 79. Monotonic, current value
worst. **Not a licence to set it to 1** — that objective counts budget fit only and ignores lost
context, more stitcher pieces, and a mismatch against a synthetic corpus built at 2–4 measures.

Also found: `MEASURES_PER_STRIP` is not enforced. The sliver-merge checks the width cap but not the
measure cap, so 13 of 3,168 strips carry 4–5 measures.

**The owner's labelling was the source of most of this.** Their read — "the model did a great job,
the old slicer did not, and the fixed strips still have some slicing issues" — is confirmed on every
count: model accuracy tracks the confidence calibration (84% `ok` in the top band against a
predicted 80%), 33% of old hard crops were unusable, and the moderate-quality band is unchanged by
the overhaul (~10% under both slicers).

Also settled: **low confidence predicts a BAD CROP**, 89% below `min_logprob = -1.0` (16 of 18).
This **corrects** an earlier claim in these docs, drawn from the first 7 verdicts, that confidence
could not detect a bad crop. High confidence still does not guarantee a good one (6% of the top
bucket were bad), so it is a screen, not a proof.

## 2026-07-28 — Round 3's checks were run BEFORE rendering. Three of four ideas died; the real win was not on the list

**Why this session mattered:** Round 3 was scoped as a full 40,826-strip re-render plus a paid
training run, aimed at four hypotheses. All four were testable against the already-shipped model for
the price of a decode, so they were tested first. That was worth doing — **three of the four
hypotheses are wrong**, and the change that actually pays is one nobody had proposed.

**The tool that made it all possible.** Decoding the whole exam once (326 strips) reproduces the
known 562-edit total exactly, so per-strip attribution became available for the first time. Every
number below comes off that one decode plus cheap variations of it.

**What died, and why it is worth having killed:**

- **"The model invents a bar when a crop has no notes."** It does not. Only 1 of the 8 note-free
  crops that exist in all our labelled pools invented anything (bar: ≥50%). It simply cannot *read*
  them — essentially every token wrong. The 19-edits-against-8-gold-tokens strip reproduced exactly;
  the page has a circled ④ in frame, so the trigger looks like unfamiliar page furniture, not
  emptiness. The *cost* is real and confirmed (≤3-note crops = 5.5% of strips, 20.8% of edits) but
  the shape is the **slicer's** deliberate trade-off, already halved by the current slicer, so
  teaching the renderer to imitate it is backwards.
- **"Cut the wide crops narrower."** Looked like the biggest single lever (>1200 px crops = 28.6% of
  edits at 2.5× the per-token rate). Splitting them at a zero-ink gutter against identical gold made
  it **worse, +31.8%**. And 19 of 45 have no internal bar-line, so a measure-aligned split is not
  even possible. Killed for the cost of one 45-strip run.
- **"Our beams are too heavy, like our sharps were."** The opposite: ours sit at the engraving
  standard 0.500 S, real print is 0.567–0.765 S. Thinning them would have moved us *away* from real
  print — a change that would have shipped into 40,826 strips on an untested analogy.

**The apparent win that wasn't — the most instructive part of the session.** Testing the
staff-geometry hypothesis showed the model getting *better* under perturbation. Decomposed, the
whole effect sat on **scale**: a ~2% shrink removed **15.5% of all exam corrections** (562 -> 475),
reproducible across four scale values with a clean optimum. It looked like the largest free lever
the project had found, and it was written into six documents as a headline result.

**Then it failed to replicate.** On the real-val holdout the same operation gives 247 -> 243, -1.6%.

**The mistake, stated plainly, because it is the reusable lesson:** ~15 variations were run against
the frozen exam and the best-scoring one was reported as a finding, before any holdout was tried.
That is selection on the test set. A holdout run costs two minutes; it should have come first. A new
process decision now says so ([../DECISIONS.md](../DECISIONS.md)).

No mechanism was ever found either, which in hindsight was the warning sign. Ruled out along the
way: staff-size matching (the exam benefit appears in *every* size bucket — undersized -33%,
already-correct -10%, oversized -16% — not just oversized strips), resampling (down-up 555), blur
(562), ink lighten (565), ink thin (589). Also worth recording: the "identity warp" control used to
rule out resampling was itself invalid — an exact identity matrix makes warpAffine copy pixels
rather than filter, so it never tested what it claimed to.

⚠ Not fully closed: real-val is the EASY pool (0.9 edits/strip against the exam's 1.7) and is
missing the hard tier entirely, so an effect confined to hard pages could hide there. That is one
more reason the real-val rebuild gates everything, and the re-test belongs after it.

**Three wrong diagnoses about one file.** All three were about `page_to_strips.py`; two became
patches and both were reverted.
The first added a forward-merge for leading slivers and was **dead code** — re-slicing 67 pages gave
byte-identical output. The second assumed `MAX_STRIP_W` was blocking the sliver merge; the slicer's
own manifests disproved it (0 of 18 narrow crops were `split_wide`). Both diagnoses were inferred
from reading the file instead of measured against its output. Two detectors inside the probes failed
the same way and were caught only by looking at contact sheets. **The rule that came out of it:
measure the estimator before touching the slicer** ([../DECISIONS.md](../DECISIONS.md)).

**Also learned:** synthetic staff spacing has sd **0.000** — every training strip is identical. The
plan said we shake "five times less than reality"; we shake *not at all* before augmentation. That
makes the uncommitted `staff_jitter` op better motivated than the doc claimed, but the ladder says
variance is not what costs edits today, so it stays **insurance, not a fix**.

**Real-val rebuild started, and labelling immediately taught us something.** The gap is
composition, measured: exam 18/41/41 easy/mid/hard against real-val 59/41/**0**. Hard means the
emitter *dropped* the strip (`row_unaligned` / `nd_high`), so no label was ever written — there is
no pile to filter, the strips have to be labelled. 110 are owed; 130 were staged, seeded with the
current model's decode and ordered by confidence.

The confidence ordering is calibrated, not guessed: on the exam's 145 hand-labelled hard strips the
same model is exactly right 80% of the time above `min_logprob = -0.1` and 4% below −1.0. The live
review agrees (84% `ok` in the top bucket). **But confidence cannot see a bad crop** — 3 of the
owner's 7 `bad` verdicts sit in the highest band, where the model confidently and correctly reads a
frame that is itself wrong.

**Which surfaced the real problem: everything we label and everything we examine on is old-slicer
output.** Strips date 2026-07-15..17; the slicer was overhauled 2026-07-25 and nothing was
re-sliced. Re-slicing 5 queue pages: 0 of 30 crops identical, 2 gone, old 207 px slivers now 1435 px
full rows. The owner's independent read from labelling says the same thing — the model reads well,
the bad crops are the old slicer's, and the current slicer's crops are good. The frozen exam carries
the same stale crops, so exam and real-val stay consistent with each other while both measure a
pipeline we no longer ship. Decision left open in [../DECISIONS.md](../DECISIONS.md); the
recommendation is to re-slice before spending the expensive remaining 61 rows.

Also settled, so nobody re-fixes it: **`f'' 32` is not a decode error.** It tokenises identically to
`f''32`; the tokenizer splits the octave marks from `32` either way. Holds for `32` only — `16` and
`8` genuinely differ.

New probes, each carrying its pre-registered bar and its result in the docstring:
`scripts/rung3/empty_crop_probe.py`, `width_split_probe.py`, `beam_weight_probe.py`,
`staff_geometry_probe.py`. Numbers: [../METRICS.md](../METRICS.md). Detail:
[../rung3/round3.md](../rung3/round3.md).

## 2026-07-27 — Round 2 SHIPPED: `round2-stage2-best` int8 is the live runtime

The re-scoring earlier the same day reopened the "not shipped" call and the owner took the ship. It
is the **same disposition as Round 1: an improvement, not a pass** — the pre-registered macro floor
(≥85%) is still failed at 74.2%, and that stays written down rather than rounded up
([../DECISIONS.md](../DECISIONS.md)). What justified it: micro recall 83.9 → 84.8%, macro≥30 recall
81.4 → 84.8%, micro F1 flat, SER 0.059 → 0.052, exact 50.0 → 52.1%, 9 of 11 floors.

**Ship chain, all green.** ONNX export → int8 (221 MB, same as every rung) → `onnx_parity.py`
**14/14 fp32 and 14/14 int8** → `make_browser_gate.py` → browser gate **27/28**. Details in
[../../src/vision/MODEL_EVAL.md](../../src/vision/MODEL_EVAL.md).

**The gate list had to be rebuilt** — the Colab checkpoint arrived without a `GATE_STRIPS.txt`, same
as Round 1. Built from `strips_v4` **val** pieces (held out from this model's training): 120
candidates decoded, 108 exact, greedy feature cover → 14 strips / 14 pieces / 11 makams covering
`\sig`, all six koma/küçük/bakiye families, `\tup3`, `\tie`, `\grace` and a double dot. *Why the
method matters:* the first attempt compared decoded **strings** and reported 0/120 exact — the
tokenizer eats the spaces around `\`-tokens, so comparisons must happen in id space
(`data.strip_special`). A string compare would have looked like a catastrophically broken model.

**One gate strip still fails, deliberately kept — and this time we measured why.** A
`kurdilihicazkar` strip drops its opening `\tup3` on the **reference** path only; the canvas path —
the actual product path — reads all 14 strips exactly, and Python-ORT int8 reads that strip exactly.
Feeding the browser's own reference tensor back through Python-ORT with per-token confidences shows
the flipped step is a **genuine near-tie**: `\tup3` p=0.689 vs `e` p=0.306, and it is the **only**
token in the strip under 0.99 (next lowest 0.938). So the runtime is not corrupting a confident
prediction — it is tipping a coin the model was already holding. Graph and JS preprocessing both
exonerated. Second instance of the ORT-web wasm int8 wobble (Round 1's was a dropped double dot,
which does **not** reproduce on this model). Not swapped out for a cleaner strip: swapping would
delete the evidence, and the precedent is now a decision.

**Revert path:** the Round-1 runtime is at `data/checkpoints/_public_models_backup_round1/`; the
Round-2 ONNX at `data/checkpoints/round2-stage2-best-onnx/`.

## 2026-07-27 (evening) — Real-pool label review: 30% of the nota pool had a wrong label

The owner worked the `nota-full` queue through every strip where the label and the model's decode
disagreed. Promoted with `promote_labels.py`: **54 corrected labels applied, 7 `bad` strips
removed**, nota pool 1,747 → 1,740, real pools 2,330 strips / 444 pieces, exam guard still clean.

**Hit rate by disagreement level** (checked strips, "wrong" = corrected or removed):

| nd > 0.06 | 0.03–0.06 | 0–0.03 | nd = 0 |
|---|---|---|---|
| 77% (228) | 79% (273) | 80% (112) | 26% (73) |

So ~78% of the labels on disagreeing strips were wrong — an extremely high return on review time,
and far better than labelling new strips from scratch. Combined with pitch being 40% of the model's
remaining errors, this is the same shape as the `sigTolerant` finding: noisy labels sitting in
exactly the class we are trying to improve.

**Two caveats recorded so the number is not over-read.** The 30% is over the REVIEWED population,
which was selected for being suspicious; the 556 strips still unverdicted are all `nd = 0` and were
never flagged, so their rate is unmeasured and probably lower. And **Round 2 already trained on the
earlier 467 corrections** — verified by reading the manifest back out of `tnc_round2_colab.zip`,
which is byte-identical to today's pre-promotion manifest. Only the 54 new ones are new.

**Consequence for Round 3:** its real pool is cleaner than Round 2's. That is one more difference
between the rounds on top of the corpus changes, so attribution gets harder again unless it is
chosen deliberately ([../rung3/round3.md](../rung3/round3.md)).

Also promoted-with-rejects: 24 rows rejected by the mechanical gates — 14 `over_budget` from the
review queue (the deferred recoveries) and 10 `not_in_manifest` (corrections against strips that are
not in the training pool; checked, none are the exam pieces removed earlier the same day).

## 2026-07-27 (end of day) — Round 3 planned: note heights and note lengths

Written up in [../rung3/round3.md](../rung3/round3.md). Two diagnostics shaped it, both from the
Round-2 exam read with no new decoding.

**Note heights (40% of corrections) are off by ONE or TWO positions in 74% of cases** — a
registration problem, not a reading problem. Measured staff geometry, synthetic vs real: mean line
spacing 30.6 vs 31.8 px (the slicer's normalisation works), but real strips vary about **twice** as
much (± 4.9 vs ± 2.7). One note position is ~15 px. Meanwhile `augment.py` shakes each picture by
only ±3% scale and ~3 px translate — roughly **five times narrower than the real variation**. Fix is
an augmenter setting, not a re-render. Flagged as a lead, not a fact: the staff detector used was a
row-darkness heuristic that lyrics and dense beaming can fool, so it needs re-measuring properly.

**Note lengths (28%) are lopsided:** `8→4` ×8 and `16→8` ×6 — the model reads a note as twice as
long, i.e. loses a flag or beam — plus 15 dot errors both ways. Same shape as the sharp-bar finding:
our font's strokes are heavier than real print and thin detail merges after the shrink. The
`sharp_probe` investigation has never been applied to beams, flags or dots.

Round 3 therefore opens with four measurements before anything is rendered (staff registration,
beam/flag/dot fidelity, crop shapes, strip density), and two things to settle before training: the
success number written down first, and a deliberate choice about changing one thing versus several
— Round 2 changed three and its movement still cannot be attributed.

## 2026-07-27 (later still) — Where the user's corrections actually go: accidentals are 13% of them

No training, no new exam read — just the Round-2 exam's 562 edits classified by what a person would
have to fix. Numbers in [../METRICS.md](../METRICS.md).

**pitch 40% · duration 28% · rhythm signs 13% · accidentals 13% · structure 5%.** Two rounds went
into the 13%. The old headline made accidentals look like the whole problem because it *only*
measured accidentals — the same failure mode as the inline-vs-signature mistake, one level up.

**Errors are concentrated AND pervasive.** 42 of 326 strips carry 63% of edits; 12 strips are >50%
wrong and carry 21%. But excluding those 12 barely moves the mix (pitch 36%, duration 29%), so
ordinary strips misread notes and note-values too. 55 of the note-level errors are whole notes
*inserted or deleted* — the model losing count rather than misreading a glyph.

**The catastrophic strips are a crop-shape gap we created.** The worst is a signature-only crop —
clef + donanım, no notes — where the model hallucinated a measure: 19 edits against 8 gold tokens.
`stripExport` builds chunks from whole measures, so that image **cannot occur in training**: 0 of
40,826 strips, while the exam has 4 of 326 and 28% of its strips are short. Third time in three
sessions that a "model problem" has turned out to be an upstream shape we never rendered.

**Negative result worth keeping — gold octave errors are real but NOT a lever.** All 5 octave-only
substitutions are cases where the GOLD leaps ≥4 steps from both neighbours while the model reads the
stepwise line (owner's hypothesis, and it was right). Consistent with the 187:14 adjudication
precedent of siding with the decode. But it is ~1% of edits and the pools are clean (0.1–0.2% of
strips carry an isolated octave spike), so it does not explain the pitch weakness. Theory closed
with a number rather than left open.

**Consequences for Round 3:** aim at pitch and duration, not accidentals; render the crop shapes the
slicer produces first (cheap, no training); and measure the corpus's pitch/duration distribution
against the real pools before designing anything — that method has overturned the plan twice.

The error-localisation UI is **deferred by the owner**. The measurement that would justify it is
still cheap and still owed, with a pre-registered rule: flagging 10% of tokens must catch ≥60% of
errors.

## 2026-07-27 (later) — The goal changed: user effort, not model accuracy

**New goal: ≥90% of pages need ≤5 corrections, and the app shows where they are.** "85% on the
per-class accidental mean" is demoted to a diagnostic. Reasoning in [../DECISIONS.md](../DECISIONS.md);
baseline in [../METRICS.md](../METRICS.md); the goal itself lives in [../../ROADMAP.md](../../ROADMAP.md) §0.

Three things pushed it. The old metric does not track usability — Round 2 got *better* for a user
(fewer edits, more perfect strips) while that metric got worse. We are already at **84.8%** on its
low-n-robust form, so the remaining headroom is two rare classes. And the untouched lever is bigger
than the remaining accuracy: a page is ~95% correct already, but the user must proofread all of it
to find the ~5 wrong marks, which is where the time saving goes.

`eval_omr.py` now reports an `EDITS/PAGE` block so the goal is measured, not aspirational
(`Strip` carries `page`; one edit = one substitution/deletion/insertion). Round-2 baseline over the
46 exam pages: **57% of pages ≤5**, median 5, mean 12.2, 52% of strips already perfect.

**The target was restated once, immediately, and the reason is worth keeping.** It was first written
as "a typical page needs ≤5" — reasoning from the mean (12.2) and assuming that was a ~2.4×
improvement. The baseline then came back with a **median of 5**: the distribution is heavily
right-skewed, so the target as first written was satisfied on the day it was set. Restated on the
*share of pages* (≥90% ≤5), which is where the actual pain is. A goal that is met the moment you
write it measures nothing.

Non-claims attached to it: the exam is a matched upper bound, so real uploads will be worse; and
whether error localisation genuinely saves a user time is unmeasured — that needs a person
correcting real pages with and without the highlights, not a model metric.

## 2026-07-27 — Round 2 read the exam once: headline down, everything else up, diagnosis half-right

Trained on `strips_v4` with Round 1's recipe held fixed (two-stage, `--real-dir …:9` to hold real at
34% of batches). Exam read once on the 326-strip clean set. Numbers: [../METRICS.md](../METRICS.md).

**The result is genuinely mixed, and the headline is the part that got worse.** Against `round1-best`
on the *identical* strips with the *same* re-audited gold: mean AEU F1 **78.0 → 73.9%**, but SER
0.059 → 0.052, exact 50.0 → 52.1%, and 9 of 11 floors improved (Round 2 clears `\komaFlat`
precision, which Round 1 missed). **Not shipped** — Round 1's "improvement, not a pass" argument
does not extend to a model whose headline moved backwards.

**What the fixes actually did.** Küçük-in-signature recall went **50 → 72%**, and küçük overall
58.1 → 69.7% — the label-noise fix worked in exactly the place it was aimed. Its precision fell
100 → 76.7%, the trade registered before the run.

**What they exposed.** The Round-1 error was one-directional: gold küçük decoded as koma, reverse
essentially never — the signature of a fallback bias, which is what 91% of drawn küçüks being
labelled as nothing would produce. That bias is gone. Underneath it is a **symmetric** confusion:
`\kucukSharp → \komaSharp` 8×, `\komaSharp → \kucukSharp` 7×, **all 15 inside the `\sig` block**,
net `\komaSharp` emission **0**. The model is no longer guessing the common class; it genuinely
cannot tell 2 bars from 3 at signature positions.

*(An earlier reading of this — "we flipped the bias" — was wrong, and the confusion counts
disconfirmed it. Net komaSharp emission of 0 is not a bias in either direction.)*

`\komaSharp` collapses to F1 21.4% because n=14: seven wrong swaps is half the class. `\kucukSharp`
takes the same coin flip across 33 gold and still reads 69.7%. A per-class mean over six classes
then carries koma's collapse straight into the headline — the low-n fragility METRICS has warned
about since Round 1, now costing 4pp.

**The lead this opens.** Every glyph-fidelity measurement we have — `sharp_probe`, the 0.300 S bar
weight, küçük's pitch widened to 0.65 S — was taken on **inline** glyphs. Signature glyphs are
packed at `SIG_GLYPH_ADVANCE = 13 px`, were never examined, and hold **32 of the exam's 33 küçük
tokens**. Widening küçük's bars may even hurt there, where horizontal room is fixed. That is Round
3's first measurement, and it should be measured before anything is re-rendered.

Instrumentation added the same day: `eval_omr.py` now reports recall split by print position, which
is how the signature-only confinement was visible at all.

**Then the metric itself was fixed — and it overturned the verdict above.** The headline is a mean
over classes, so a 14-gold class weighs the same as a 145-gold one. `eval_omr.py` now also reports
**MICRO** (pool tokens, not classes) and **MACRO≥30**, and `scripts/rung3/rescore_headline.py`
back-fills both for every past run straight from the stored `per_class` blocks — hits and false
positives are recoverable from gold/recall/precision, so **no model was re-run and no exam re-read**.

On the identical 326 strips:

| | Round 1 | Round 2 |
|---|---|---|
| macro recall (historical headline) | 78.5% | 74.2% |
| micro recall | 83.9% | **84.8%** |
| micro F1 | 85.0% | 84.8% |
| macro≥30 recall | 81.4% | **84.8%** |
| macro≥30 F1 | 83.9% | **84.4%** |

**Round 2 was never a regression** — flat-to-better on every low-n-robust measure, on top of SER,
exact-match and 9 of 11 floors. The "not shipped" decision is overturned and the ship question
reopened.

Two things deliberately NOT done. Micro was **not** promoted to the headline: it was computed after
the fact and happens to flatter us (~85% vs 74%), and swapping the bar to the number that makes the
result look good is how a benchmark stops meaning anything. Macro stays the pre-registered bar —
for a music app, a rare mark misread is still a wrong note — with micro/macro≥30 used to judge
*whether a change helped*. And the 85% target was **not** restated against micro; the real repair is
more `\komaSharp` gold in exam v3, so the strict metric becomes trustworthy instead of replaced.

Retrospective worth keeping: macro has been reporting 66–78% across this project while token-level
accidental accuracy sat at 83–85% for both models. Neither number is wrong; they answer different
questions, and only one of them was ever being quoted.

## 2026-07-26 (later) — The küçük deficit is a SIGNATURE-reading problem, and 5 exam pieces were in the corpus

Two findings while starting the Round-2 re-render, both of which changed what gets rendered.

**1. We had been aiming at the wrong print position.** The Round-1 follow-up said to balance
*inline* küçük frequency (1,887 koma vs 206 küçük strips) and to put the three sharps on
neighbouring notes. Splitting every gold label into `\sig … \sigend` tokens vs note tokens shows the
exam's küçük gold is **1 inline vs 32 in the signature** (photo gold: 3 vs 13), and the scorers
count both. So the whole class is effectively scored at the row start.

It cannot be otherwise, and the reason was already in our own code: `noteToLily`'s `sigTolerant`
branch (`tools/render/lilypond.ts`) prints a note **bare** when its alteration runs the same
direction as the signature's — SymbTr stores the SOUNDING value, so eviç is a 5-comma F♯ printed
bare under a koma-sharp-F signature, which is what real editions do. Confirmed end-to-end: a dry
render of two küçük-heavy pieces (mahur, nisaburek) under real non-küçük signature variants produced
**zero** inline `\kucukSharp` — the mechanism built to force them inline cannot work, by design.

In the context that scores, the corpus was never imbalanced: küçük sits in 1,210 signature strips
against koma's 1,422. The real gap is **diversity** — signature-position küçük comes from just 3
makams in 4 spellings, so "mahur ⇒ küçük-f donanım" is learnable without reading the glyph.

*Why this was missed:* the imbalance was counted with the signature block stripped out, and the
count was never checked against where the gold actually sits. Print position is now a first-class
split in METRICS, and the scorers owe the same split.

**2. `strips_v3` contained 5 exam pieces.** `hisarbuselik--vuslata_nail`, two `kurdilihicazkar`
şarkıs, `mahur--cihani_lal-i`, `nikriz--zeybek`. The train-time disjointness guard added after the
Round-1 contamination only inspects the `--real-dir` pools, so our own synthetic engraving of an
exam piece walked straight past it. `select_pieces.py` now refuses exam pieces by SymbTr id at
selection time.

**Shipped with this:** `select_pieces.py --keep/--boost-class/--per-makam-cap/--sig-table/--exam`
(extend a selection instead of re-rolling it — re-rolling would change the held-out set and
invalidate the split), `data/pieces_v4.json` = 208 pieces (185 kept − 5 exam + 23 küçük-bearing,
capped at 6 per makam and restricted to makams with a real printed signature).

**Dropped before use:** the enharmonic respell `\bakiyeFlat` → `\kucukSharp`. It works mechanically
and is the same trick that manufactures büyük examples, but it prints a spelling real editions
don't use, and küçük precision is already 100% — it could only fall.

**3. Then the dry render showed a strip drawing a sharp its label didn't mark — and it was in the
shipped corpus.** `sigTolerant` (print same-direction alterations bare) was implemented on the
LABEL side only; `SheetView` drew every deviation from the signature. Counted over `strips_v3`:
**18.8% of signature-bearing carry strips draw at least one accidental the label omits** (5,240 /
27,933; 8,485 accidentals, 137 pieces), and the worst-hit class is `\kucukSharp` — **2,369 drawn but
unlabelled against 234 correctly labelled inline, i.e. 91% of the küçük sharps drawn on a notehead
are labelled as nothing.** The model was trained to see the glyph and emit nothing, which is exactly
its measured behaviour: 48% recall at 100% precision.

Fixed in `SheetView` by giving the drawing the same rule (owner decision: fix the pixels, because
real editions print bare — the exam has 1 inline küçük in 352 strips). Verified pixels-only: over a
re-rendered piece all 20 labels are byte-identical, the previously spurious sharp is gone from the
image, and genuine deviations still print. `round1-best` trained on the un-fixed corpus, so its
sharp numbers carry label noise as well as Bravura's bar weight — the two are not separated by any
measurement taken so far.

**4. Built the check whose absence let all of this ship: `tools/render/verify-labels.ts`.** It
re-opens every job from the corpus manifest (which stores the full URL parameter set, so the job
reproduces exactly), reads every accidental glyph out of the live SVG — Bravura glyphs by SMuFL
codepoint, the redrawn AEU sharps by their unique stem/bar counts — assigns each to the crop rect it
falls inside, and compares against that strip's label, signature block included. Glyph identity
comes from the DOM, never from the code under test.

Validated with a POSITIVE CONTROL before being believed: with the `sigTolerant` fix temporarily
reverted it flagged 15 of 30 strips on three known-bad v3 jobs, every delta exactly `\kucukSharp`
drawn-but-unlabelled. A gate that has never been shown to fail proves nothing.

Full `strips_v4` pass: **40,826 of 40,841 exact, 0 label drift, no unrecognised glyphs.** The 15
flagged are crop-boundary bleed — measure boxes don't split exactly between glyphs, so a crop
occasionally clips its neighbour's accidental; they appear as ± pairs on adjacent strips, and the
image shows a cut-off notehead before the barline. Geometric, pre-existing, 0.037%. Excluded from
the manifest rather than trained on (`excluded_boundary_bleed.txt`), so the shipped corpus is 40,826
strips. `make_round2_colab_zip.sh` refuses to build if any flagged strip is still in the manifest.

**5. The Round-2 shakeout refused to start — and it was right to.** `train.py`'s exam-disjointness
guard found **4 real-pool pieces that are also exam pieces** (`huzzam--sevdim_yine`, two
`kurdilihicazkar` şarkıs, `saba--neydin_guzelim`). These are the 2026-07-22 contamination: the guard
was added then, but nobody removed the strips behind it, so they survived into Round 2 and this is
the first run that actually tripped over them. 14 strips dropped (11 nota, 3 tup); real pools are now
2,337 strips / 444 pieces with zero exam overlap. Originals kept as `manifest.jsonl.pre-examclean`.

The lesson is not "the guard works" but that a **guard without a cleanup leaves the bad data in
place** — it only converts a silent problem into a loud one at the next run, which in this case was
four months later. The same shape as finding 3: the check that would have caught it did not exist
where the data was produced.

**Not built: the signature-contrast drill set.** The plan was to generate donanım spellings the 3
real küçük makams don't cover. Dropped after checking the adjudicated real labels: across every
printed signature we have, `\kucukSharp` appears on **f and nowhere else** (104 occurrences), so a
drill would have to print accidental/letter pairs no edition prints — the same objection that killed
the respell. Signature coverage comes from the 23 added pieces instead.

## 2026-07-26 — Microtonal sharps: it was our renderer, fixed at source

Diagnosed in three steps, cheapest first ([../rung3/round2.md](../rung3/round2.md)):
- **Resolution ruled out.** `scripts/rung3/sharp_width_test.py` regroups already-scored strips by
  the encoder's effective scale (Donut thumbnails a 336×579–2472 strip into 409×583, scale
  1.22→0.24). Recall does not fall with scale on either dataset; `\bakiyeSharp` holds 84–94% in
  every bucket. The deficit follows the **symbol**, not the size — so the expensive narrow-strip
  rebuild was never the lever. *(Logged, not chased: ~⅔ of the encoder's input window is blank
  padding, because a 4:1 strip fits a 1.43:1 box.)*
- **One substitution, one direction.** Gold `\kucukSharp` → decoded `\komaSharp`, 11× clean exam /
  10× photos, top error in both; the reverse essentially never.
- **Root cause: Bravura's glyph weight.** The four AEU sharps are one systematic design (1–2 stems
  × 2–3 slanted bars), so reading them *is* counting bars. Measured against two real editions at
  matched staff size, Bravura's bar is too thick and küçük's three bars too tightly packed, leaving
  under half the real white gap (~1–2 px after the shrink) — the bars fuse into a block that IS a
  2-bar koma. Real print also draws küçük's outer bars stubby either side of a full-width middle
  bar; Bravura's three are near-equal, which kills the staircase a reader recognises.

**Shipped opt-in:** `drawThinSharps` (`apps/web/src/SheetView.tsx`) redraws all four AEU sharps as
SVG at real-print bar weight; `?thinsharps=1` / `--thin-sharps`, off by default. Verified in-browser
(every AEU sharp replaced, 0 left on Bravura). Artifacts: `data/real/rung3/sharp_probe/`.
**Still owed:** the frequency imbalance (see [../METRICS.md](../METRICS.md)).

Also this day: the docs were restructured for agents (this file, `CLAUDE.md`, `STATUS.md`,
`METRICS.md`, `DECISIONS.md`, `docs/rung3/*`), and the pointer docs — which had drifted 18 days
behind — were re-synced first.

## 2026-07-25 — Photo axis, and the exam's own answer key

- **Slicer photo front-end.** Raw `page_to_strips.py` yielded 0 strips on 72% of photo pages: its
  `w/4` staff-detection kernel cannot tolerate ~1.5° handheld skew (a skewed line never stays on one
  pixel row for a quarter of the page). Fixed with guarded auto-deskew + crop-to-quad/perspective
  de-warp + `STAFF_HOR_FRAC = 0.11`; all no-ops on clean scans, and the narrower kernel also stopped
  silently dropping faint/bottom systems on clean renders. **Yield 28% → 97%.**
- **Honest photo score.** First a fitting-alignment estimate against borrowed clean gold, then the
  owner hand-labelled **284 photo strips** directly (`build_photo_gold_queue.py` + review UI
  `photo-gold` tab) and `score_photo_gold.py` scored strictly per strip. Photo sits **3–4pp** behind
  clean pages → the photo domain is basically solved by the front-end, and the remaining weakness is
  a clean-domain reading problem.
- **`|` and `\tie` are fine** (90/94% F1) despite the initial impression; the weakness is the
  microtonal sharps.
- **Exam gold re-audited.** The frozen gold was already ~82% reviewed, so a full hand-audit found
  only 13 new label errors — and they ran one way: the human answer key **over-sized** sharps
  (buyuk/koma where the page prints bakiye). Re-scoring lifted the headline, but ~11 of the 12pp is
  a low-n artifact, not model improvement. **Two lessons:** the per-class-mean headline is fragile
  to low-n classes (exam v3 must floor or weight by n), and Round 1's "fail" was partly a label
  artifact — while the koma/küçük-sharp weakness is real.
- New scripts: `decode_photos_exam.py`, `score_photos_exam.py`, `score_clean_baseline.py`,
  `score_photo_gold.py`, `build_photo_gold_queue.py`, `build_exam_fix_queue.py`, `apply_exam_fix.py`,
  `photos_exam_report.py`, `sharp_adjudication_report.py`; `review_ui.py` gained the
  `photo-gold` / `exam-fix` queues and multi-root image serving.

## 2026-07-24 — Carry-sig bug characterized

The synthetic no-regression failure's error dump named a real defect: under a
`\sig \kucukFlat b \sigend` signature the model inserts a spurious inline `\komaFlat` on `b'` —
restating, in the wrong koma family, an alteration the signature already carries. **Carry-mode
accidental/signature interaction is not solidly learned**, it reproduces on synthetic (so it can be
iterated on with perfect labels), and it plausibly explains both the exam's `\komaFlat` precision
miss and the komaSharp↔kucukSharp confusion. Logged in `MODEL_EVAL.md` as "carry-bug".

## 2026-07-23 — Round 1 shipped as "an improvement, not a pass"

- **Disposition.** On the honest exam it missed 5 floors, but it beats the previous live model on
  everything tracked: rhythm-rewriting pathology 77.6% → 0%, SER 0.147 → 0.060, exact 17% → 49%,
  triplet precision 15% → 93%. Keeping the worse model live would hurt users, so it ships with the
  result recorded honestly.
- **Shipped:** `round1-best` int8 is the runtime in `apps/web/public/models/`. Parity 10/10 fp32 +
  10/10 int8. Browser gate **19/20** — one rare double-dot token (`a''2..` → `a''2.`) trips an
  ORT-web int8 numerics wobble that is model-independent (reference *and* canvas fail identically →
  not JS preprocessing; Python-ORT int8 is correct → not the graph) and was never exercised by the
  old gate. Logged as a Round-2 investigation item, not blocking. Previous runtime backed up at
  `data/checkpoints/_public_models_backup_rung22/` (revert = re-stage it).
- **Run-first diagnostics** (items 1–4 of the plan-review addenda; 5/7/9 kept as commitments, 6 & 8
  dropped by the owner):
  - *Item 1* — the 28pp real-val↔exam gap decomposed by difficulty tier: **composition dominates**
    (real-val lacks the 41% hard tier), edition familiarity is small, and a new
    **decode-self-agreement inflation** surfaced (real-val mid is ~45% `acc_disagreement` strips
    whose labels ARE the decode). Cheap residue of dropped item 6 kept: exclude decode-derived
    labels from the rebuilt real-val metric pool.
  - *Item 4* — degrade probe: hallucination is **not** ambiguity-driven (precision and emission rate
    flat clean→OOD), so Round 2 should not chase renderer accidental-rate deconfounding.
  - *Item 2* — train-time exam-disjointness guard shipped in `train.py`; flags exactly the 4 known
    contaminated pieces.
  - *Item 3* — canonical real-val split shipped as `data.is_real_val_piece` (byte-identical to
    Round 1); both Round-2 consumers must reuse it.
- **Plan-review addenda adopted** — see [../rung3/round1.md](../rung3/round1.md) for all nine, and
  [../DECISIONS.md](../DECISIONS.md) for the two that were dropped.

## 2026-07-22 — Round 1 trained, then examined: FAIL on five floors

- **Init A/B done.** Arm A (two-stage) wins on real-val. The triplet catastrophe is fixed — the slur
  distractors did their job. Margin is low-n driven; on ≥30-gold classes the arms tie. A pre-run fix
  is logged: stage 2 first had real at 5.9% (each real strip seen <1× in 2k steps), caught before
  running and corrected to `:8`, else Arm A was merely "Arm B with a warm start".
- **Every-share sweep cancelled** before any run, after first being amended the same day. Grounds
  were measured, not preferred: the largest available intervention moved the amended metric 0.5pp,
  the target pathology was already fixed by the re-render, and the amendment carried a
  stage-1-length confound. Full reasoning: [superseded.md](superseded.md).
- **Exam taken once → does not pass.** Read locally so exam strips never reached the training box;
  pre-flight re-confirmed the freeze from gold labels alone. Five floors missed, five cleared
  (numbers: [../METRICS.md](../METRICS.md)).
- **The lesson that outlived the run: real-val was wildly optimistic** (95.0% → 66.6%, ~28pp)
  despite both pools being piece-disjoint — real-val pieces sit inside editions the model trained
  on. Standing rule: real-val orders candidates, it does not predict the exam.
- **New Round-2 targets from the error dump:** `\komaSharp`↔`\kucukSharp` confusion in both
  directions within one piece, and `\tup3` → `\grace` substitution (the model stopped over-firing
  triplets and now under-reads real ones).
- **Contamination found in post-read verification:** 4 SymbTr pieces / 25 strips (7.1%) had their
  *other* engraving in the training pools. Root cause: the disjointness guard was emit-time only and
  nothing re-validated when the exam GREW. Corrected read on 327 clean strips barely moved the
  numbers, so the verdict stands; `strips_exam_v2_clean/` is the honest reference from here.
  Exam v3 owes a train-time assertion (shipped the next day), re-validation whenever the exam grows,
  and dedupe on SymbTr piece id rather than image stem.

## 2026-07-21 — Round-1 synthetic re-render: `strips_v3`

- **Ordering changed: Round 1 runs first, the additive-only re-slice moves to Round 2** (see
  [../DECISIONS.md](../DECISIONS.md)). Round-1 data scope frozen.
- **Design (locked):** carry mode (`measure`) replaces keysig and is dominant, at transpose 0 only
  so the conventional makam signature matches the notation, bulked via `CARRY_PASSES=4` seeded
  passes; `every` mode is the minority and carries the transpose augmentation. `stripExport.ts`
  gained a carry branch (`\sig` prefix on row-start only — matching how real carry strips are
  labelled).
- **Per-makam conventional printed signatures**: `data/makam_signatures.json` +
  `scripts/build_makam_signatures.py`, built from adjudication-confirmed `\sig` blocks in the
  promoted real labels (theory only as fallback), variants uncapped (hicaz 4, şehnaz 4,
  nisaburek 3), all 49 corpus makams — fed to both the drawn glyphs and the labels.
- **Slur distractors** (`drawSlurArc`): label-free arcs over ≥3 notes with no "3", on a seeded ~35%
  of non-tuplet runs — the fix for "any arc ⇒ `\tup3`". Verified pixels-only (15 drawn with seed vs
  0 without; labels byte-identical).
- **Accidental-distribution measurement:** carry matches real (0.36 vs 0.32 inline accidentals per
  strip) but `every` is 26.7% of strips and 81% of all inline accidentals — 4.4× the real effective
  rate. This produced the `--every-share` decision (and, later, its cancellation).

## 2026-07-20 — The exam baseline and the pre-registered bar

- **Exam v2.1 baseline taken** over the full 352 strips; supersedes the 33-strip 83.3% number as
  THE pre-Round-1 reference. The numbers Round 1 had to move: `\tup3` precision 15.1% (rampant
  hallucination, dominating SER), `\kucukSharp` recall 22.6%, `\tie` 66/61%.
- **Multi-pool loader** in `train.py`: repeatable `--real-dir DIR[:REPEAT]`, stable piece-hash
  real-val split consistent across pools, synth-val pieces forced to val, `--oversample-tup N`, real
  strips train un-augmented unless `--augment-real`, checkpoint selection on the strip-weighted
  synth+real val mix — the exam never consulted.
- **Step 4.0 ship criteria written** before any training and before the exam was seen again: every
  floor stated next to its measured baseline, ties deliberately unfloored, blind spots written down
  as non-claims, and a binding decision rule (real-val selection, exam once, no silent re-roll).
- **Arc-metric code landed first** and the baseline cell was filled by re-running the *spent*
  rung22-stemfix exam read (same frozen model + exam = zero leakage): denominators came out to
  exactly 85/229 and F1 to 57.0%, confirming the pre-registration. Never debug measurement code on
  one-shot exam day.

## 2026-07-19 — Exam v2.1 frozen; slicer hardened

- **tup3 review queue fully adjudicated** by hand (147 rows: 102 fix / 35 ok / 10 bad) plus the full
  78-strip audit (70 ok / 7 fix / 1 bad — 10% auto-accept error, the best pool yet).
- **nota-full quality tier**: +38 model-drafted verdicts. Two rules came out of it — the
  **meter-sum rule** (the label won all 15 duration-only disputes; decode durations break the
  measure meter every time) and the **sig superset/subset rule** (decode won 17 crop-cut cases, the
  label won 5 where the decode hallucinated an extra sig entry; superset sig reads are suspect,
  subset/empty reads are usually crop truth). Promotes applied: **strips_nota 1,742 → 1,758**
  (420 audit fixes in place, 27 promoted, 11 known-bad removed, 24 over-budget → the re-slice
  pool); 126 nota-full pitch/accidental disputes stayed pending as post-Round-1 re-audit work.
- **tup3 exam extension:** 10 holdout tuplet pieces (21 stems, all engraving copies) moved to the
  exam → exam manifest 311 → 352 strips, tup3 gold 4 → 55 groups; training keeps 172 tup3 strips.
  `testset.json` = **v2.1** (45 piece entries). Holdout stems poisoned in the nota queue too.
- `promote_labels.py` now rejects ambiguous source stems (2 title collisions, e.g.
  `bir_nigah_et_ney` = two different songs — their shared page dir is a latent re-slice hazard).
- **Slicer hardened** against real-corpus false positives (stems and G-clefs cut as barlines,
  skew-eaten staff extent, phantom clef+sig lead measure): a third TERMINATION gate walking the
  connected overshoot past the outer lines, raw-ink staff extent, notehead-gated prefix trim, padded
  crops, reject-reason debug overlay, and `scripts/rung3/score_slicer.py` as a regression scorer.

## 2026-07-17/18 — Exam hand-work finished; tuplet collection

- **examv2-full done** (the last exam hand task): all 63 auto-accepted exam strips verdicted —
  31 ok / 32 fix / 0 bad. Fixes were 22 tie-only, 4 volta/repeat, 4 pitch/duration (~6% content
  error), 1 sig-block removal, 1 accidental-class fix. **mahur (18) + suzidilara (16) sig-suspects:
  zero signature corrections** — the voted signatures were confirmed. 31 of 32 applied; the 32nd was
  60 ids (over the 59 cap) and removed as unwinnable. Exam manifest → 311 strips.
- **Targeted tuplet collection** (the response to the measured tuplet gap): SymbTr scanned for
  tuplet pieces (459 found, 267 already held), **293 new tuplet pieces downloaded** (36 nota
  review-promotes + 257 neyzen from the never-downloaded census tail; 60 brand-new SymbTr pieces +
  164 second-engraving copies of pieces already held). Budget analysis showed tup3
  needs 1-measure windows — `OMR_MEASURES_PER_STRIP` knob added; 2,325 tup3 measures / 3,384 groups
  fit at k=1, while 1,512 dense measures still await the sub-measure fragment design. The k=1 decode
  ran on Colab per the fanless-Mac rule.
- **strips_tup trimmed to tup3-only** (owner call): 78 accepted strips / 114 groups (every group
  verified as exactly 3 closed notes) + a 147-row review queue / 205 groups. Review-UI tabs
  `tup-full` / `tup-review` / `tup-audit` wired.

## 2026-07-16 — nota audit, adjudication at scale, exam grown 10×

- **69-strip nota audit** fully adjudicated (29 ok / 40 fix). Decomposition: 8 pure sig-order (now
  no-ops after canonicalization), 1 sig-block, 26 tie/repeat structural, **5 pitch-level = 7.2%
  content error** vs neyzen's 22.6% — the Round-0.5 labeler earned its keep.
- **All 231 sig_mismatch + all 216 acc_disagreement rows verdicted.** Training manifest
  1,262 → 1,435 → 1,742 across two promotes (combined real pool 1,853 after the first, 2,160 after
  the second, neyzen included).
- **The acc_disagreement lesson:** the owner's fixes sided with the decode 187:14 over SymbTr —
  printed editions win accidental disputes, the never-auto-accept rule avoided 187 headline-class
  poisonings, and the labeler's decode is the right *edit draft*.
- Sig-entry order canonicalized everywhere (serializer + ~404 existing labels); 198 sig-less w00
  labels validated and kept (crop-cut dominates, 96%).
- **examv2-review done** (287 rows: 249 promoted / 12 bad / 26 over-budget = unwinnable under the
  59-id cap): exam manifest 63 → 312 strips. `promote_labels.py --exam` added; exam and training
  pools are mutually guarded.
- **The exam measures triplets weakly** — `\tup3` gold was only 4 (budget depletion), which is what
  later forced the tup3 exam extension.
- Sharpness analysis: the review queue is systematically the blurry tail (accepted median 1672 vs
  ~900 Laplacian variance), except `acc_disagreement` rows (1703 — sharp *and* accidental-bearing =
  the best value left). Rare-class real gold is thin (komaSharp 26 / kucukSharp 31 tokens) →
  synthetic oversampling, not queue-grinding.
- **Photo-domain exam prep:** all 25 exam-piece PDFs staged and merged
  (`data/real/rung3/photo_exam_pdfs/`, 38 pp) for print-and-photograph.
- Three slicer defects logged for the re-slice: w00 crops cutting clef/sig, note stems mistaken for
  barlines, bisected noteheads. Review policies logged: a cut note or dangling accidental *inside*
  labeled content = bad, *outside* = ignore the fragment.

## 2026-07-15 — Round-0.5 labeler + the two-source stage

- **Round-0.5 labeler trained + exported** (throwaway, real-only, from `rung22-stemfix-best` on the
  418-strip promoted pool, exam pieces excluded from train AND val): real-val SER 0.086 → 0.021,
  AEU 70 → 91.7%, sig reads 100%; parity 8/8. Never shipped — it exists only to draft labels.
- **notaarsivleri two-source stage complete:** census 20,833 TSM pieces → 966 metadata accepts →
  964 downloaded; **1,227 pages GPU-decoded on Colab**; a fold-search 2ⁿ blow-up fixed
  (`SPAN_SUBSET_CAP=12` + hill-climb). Emit over 938 pieces (440 ok / 338 low_coverage /
  160 missing_pages) → **1,262 accepted nota strips + a 2,671-row review queue + a 69-strip audit
  sample**. Dominant drops: row_unaligned 4,467 / split_wide 3,757 / over_budget 2,108 — the
  `MEASURES_PER_STRIP=2` re-slice is the #1 yield lever.
- **Exam re-frozen as v2**: 25 pieces / 16 makams (23 nota + 2 neyzen), every reachable class ≥44
  gold, no LOW-N; exam emit 63 strips + a 287-row growth queue. Sig clusters flagged but not yet
  adjudicated (mahur, suzidilara).

## 2026-07-14 — Adjudication and the promote script

The 348-row neyzen review queue was hand-adjudicated (341 fix / 4 bad / 3 ok — the conservative gate
was right: nearly everything flagged needed fixing). `scripts/rung3/promote_labels.py` applied the
verdicts through the real gates (≤59-id budget with the training tokenizer + a labels-cli `--check`
round-trip over raw label text): **training pool 84 → 418 real strips**, provenance columns on every
row. 10 rejects: 7 over-budget (60–73 ids — re-slice territory) and 3 split-duration typos. The
script is idempotent, keyed on image.

## 2026-07-12 — The emitter, the first frozen exam, the first real number

- **Strip-label emitter built and calibrated** on the 85 matches (emitter-first order, owner
  decision): carry-mode label serialization + carry-aware decode, persisted slicer measure geometry
  (PNGs byte-identical), per-token logprobs in the ONNX decode, `labels-cli --ranges` batch mode, and
  `emit_strip_labels.py` — D.S./da-capo tail folding (64/85 pieces jump), content-driven monotonic
  row search (editions reorder sections; a cursor can't follow), printed-signature majority vote with
  label override (real pages print the makam's **conventional** signature, not SymbTr's derived
  one — 33/85 overridden), `sigTolerant` written-vs-sounding handling, and a triple gate
  (≤59-id budget, decodeLabel round-trip, decode-disagreement threshold with accidental-class
  disagreements always going to a human).
- **Yield:** 84 auto-accepted training strips + a 348-strip review queue + 33 exam strips.
- **First frozen exam** (`testset.json`, provisional): 20 pieces / 16 makams, all 6 reachable AEU
  floors met, seeded and deterministic. `eval_omr.py` gained per-source blocks and LOW-N markers.
- **First real baseline: the synthetic→real gap became a number.**
- **Review UI** (`review_ui.py`, stdlib server on :8377): queue tabs, one-keystroke ok/fix/bad
  verdicts written atomically into the emit CSVs, solfège display, label-vs-decode token diff,
  Bravura token reference. **Full audit of all 84 accepted strips: 65 ok / 19 fix / 0 bad = 22.6%
  needed correction** (spurious flattened-SymbTr `\repstart` the edition doesn't print; slurs
  decoding as false `\tie`).

## 2026-07-11 — Free labels from name matching

`scripts/rung3/match_symbtr.py` fuzzy-matches the 798 downloaded PDFs against SymbTr (makam alias
table, incipit/composer/form token scoring): **85 auto-accepted pairs**, 28 review-band, exported per
piece as `score.json` (ground-truth note model) + `labels.json` (per-measure tokens via the new
`tools/render/labels-cli.ts`). Written-vs-sounding verified: the `toAeuAlter` snap makes an uşşak
export print `\komaFlat b` like the page does.

## 2026-07-10 — Real corpus collected; the page pipeline works end to end

- **Corpus collected:** `scripts/collect_notalar.py` (census → makam-weighted download →
  PDF→PNG rasterize) pulled **798 engraved PDFs → 1,259 page PNGs at 200 dpi across all 89 makams**
  from neyzen.com's freely-published archive (robots-allowed paths, polite, resumable, seeded).
  Census = 8,442 pieces; downloads proportional to per-makam song count with a floor for variety.
- **Rung-4 stages 1–7 (slicer + page decode):** `page_to_strips.py` — staff systems via
  horizontal-open + row projection, each row scale-normalized to the training geometry, barlines by
  **continuity + thinness** (plain per-column darkness is not enough: stems pass it and real
  barlines fail it), ~3-measure windows, row-starts keeping clef+keysig, over-wide fallback splitting
  at whitespace gutters, `--debug` overlay. Five real-page bugs fixed during verification, including
  **volta brackets clustering as a 6th staff line** (fix: keep the most evenly-spaced 5-line window).
  `decode_page.py` chains the slicer into the int8 ONNX greedy decode. First real page (hicaz şarkı,
  7 rows → 21 strips): keysig read on every row-start, repeat/volta structure captured, accidentals
  decoded. Known rough edges at the time: spurious tuplet tokens on some 16th pairs, occasional
  `\sig` inconsistency — exactly the synthetic→real gap the labeling loop trains away.
- **Rung-4 stage 8 (stitcher + editor feed-in):** `tools/render/stitch.ts` turns decoded strip tokens
  into a schemaVersion-1 note model — joins strips/rows re-inserting the `|` the crop boundary ate,
  resolves bare notes from the row's `\sig` block (an empty block never clears an established
  signature), folds rhythm signs back, then expands structure (repeat/volta passes, D.C. al Fine with
  segno/coda jumps) and emits bar-unit offsets so `assignBars` reproduces the decoded barlines. Model
  noise is normalized and warned, never fatal. Verified: 13 structure unit tests + **194/194 bundled
  scores round-tripping exactly**. The loop closed: `decode_page.py` → `stitch-cli.ts` →
  `apps/web/public/decoded.json` → harness, with a **⬇ Save JSON** button exporting corrections.
  Live proof: the hicaz page gave 21 strips → 23 written / 28 expanded measures and 225 events that
  render and play (headless-verified); a second page (nihavend) gave 25 strips → 29 written / 37
  expanded measures, 288 notes.

## 2026-07-09 — Rung 2.2b: stem fix + triplet expansion

A real neyzen upload misread triplets as `16. 32`. Two fixes: a renderer bug (`new Beam(sub, true)`
forced tuplet stems down, so the "3" engraved below where real scores put it above) and 40
triplet-rich pieces added (150 → 190), rebuilding `strips_v2_2` with 1,487 triplet strips (was 413)
and 89 val triplet strips (was 9). The from-base retrain passed with no regression, and the ONNX
export passed the same day including a **real-strip proof**: the strip that triggered the round now
decodes `\tup3 g''8 f''8 \tupend`. One nav gate strip was fp32-exact but int8-borderline
(`\buyukSharp`→`\bakiyeFlat`) and was swapped for an int8-exact strip.

## 2026-07-08 — Rhythm signs (triplets, ties, grace notes)

Four faithful tokens `\tup3` `\tupend` `\tie` `\grace` (96 → 100 ids, appended at the end), all
**recovered from real SymbTr durations, never injected** (`tools/render/rhythm.ts` — pure per-measure
functions shared by SheetView and the serializer, so pixels == labels by construction). Delivered:
parser/exporter grace kind, core `EventKind "grace"`, triplet groups from reduced exact fractions,
tie pairs (accidental only on the first note; long rests split side-by-side with no tie), grace
glued to its host; tuplet groups / tie pairs / grace+host are unsplittable packing atoms; the
measure editor hides graces and re-attaches them on save. Drawing: triplets beam together with a
hand-drawn curved arc + italic "3" on the notehead side (~70% of pieces by name hash — the printed
Turkish shape, owner-verified) or VexFlow's bracket, `StaveTie` arcs, `GraceNoteGroup` slashed
noteheads. `strips_v2_2` rendered, audit PASS; non-regression: all 8,575 feature-free measures
serialize byte-identical to v2_1. Rung 2.2 retrain and its ONNX export both passed the same day.

## 2026-07-07 — Rung 2 passes; the no-server premise holds on a real model

- **Colab kit:** `docs/COLAB.md` + `notebooks/rung2_colab.ipynb` + `scripts/make_colab_zip.sh` (one
  self-contained 320 MB upload). Plan decision: **Colab Pro, not Pro+** — a full run ≈ 5–10 compute
  units, Pro's 100 covers the campaign.
- **Rung 2 PASSED first try** on `strips_v2_1` (batch 16, lr 3e-5, 6000 steps ≈ 110 min; best val
  loss 0.0045 at step 4000, flat after — no overfit). Nav marks ≥96% each, repeat signs 100%.
  Weakest token `\sig`/`\sigend` at 95.5% recall — largely the known **empty-signature ambiguity**
  (an every-mode row-start crop of a signature-less piece is pixel-identical to a keysig-mode one,
  but only the latter's label has `\sig \sigend`); benign downstream. **The CRNN+CTC fallback is
  retired for accuracy reasons too.**
- **Rung-2 ONNX export passed the same day**, with `src/vision/quantize_onnx.py` now committed.
  Gate strips come from held-out val pieces and carry real Turkish accidentals + repeat/nav tokens.

## 2026-07-06 — Training kit, navigation marks, `strips_v2_1`

- **Training kit:** `augment.py` (two profiles mixed at `PHOTO_SHARE = 0.35` — 65% screenshot,
  35% full camera-photo pipeline; the preview grid is the human gate), `modeling.py` (shared
  model/tokenizer wiring so train and eval can't drift), `train.py` (full fine-tune, AMP,
  warmup+cosine, split-by-piece loaders, per-worker RNG reseeding, checkpoint/resume for Colab),
  `eval_omr.py` (headline per-class AEU accuracy + SER + exact-match via id-space Levenshtein
  alignment). Verified on the Mac: train → resume → eval all run, val loss falling monotonically.
- **Navigation marks:** segno 𝄋 / coda ⊕ / "D.C." / "Son" as 4 faithful tokens — zero in SymbTr
  (like repeats) but routine on real sheets and required for the Phase-4 da-capo expansion. Seeded
  injection (4–6 marks on ~70% of renders, density set by simulating the audit floors *before*
  rendering, never stacked on repeat/volta measures), SheetView drawing, labels at the drawn measure
  edge, decoder round-trip, audit floors.
- **`strips_v2_1` re-rendered** (18,627 strips / 470 MB, all 150 pieces, zero render errors; nav
  floors cleared at train 220–392 / val 25–45 per token, 6.4% nav strips) with the nav tokens and
  the **centered-rest fix** (`alignRests` off —
  rests had been floating near the top line, unlike printed sheets). v2 stays on disk; v2_1
  supersedes it for training.
- **`docs/PIPELINE.md` written**: the full page-photo → strips → decode → stitch → note-model design.

## 2026-07-05 — Rung-2 dataset upgrades (`strips_v2`)

18,624 strips / 466 MB from 150 pieces (47 makams), selected from 2,030 usable corpus files by
`scripts/select_pieces.py` (greedy
max-min over the AEU classes with exact projected counts — the TS spelling math ported to Python).
Everything seeded and reproducible: any strip's manifest row reconstructs its harness URL. Delivered:
token cap 46 → 56 (over-budget single measures dropped as untrainable), 39.9% multi-measure /
40.7% `|` coverage, random repeat injection, transposes (−9…+9 commas), lyric and lyric-free
variants, in-SVG header/footer text noise, low-rate büyük enharmonic respell, split-by-piece
(125 train / 20 val, committed `data/split.json`), and the pass/fail gate `audit_coverage.py`
(per-class floors + a real-tokenizer ≤59-id check). The renderer is URL-param-driven, chunked and
resumable. OpenCV augmentation deliberately NOT baked in.

## 2026-07-02/03 — The de-risk ladder (Rungs 0–1.5)

- **Step-1 model gate:** `Flova/omr_transformer` reads its own sample staves, outputs a LilyPond
  token stream, and its vocab is extendable (`add_tokens` + `resize_token_embeddings` proven).
- **Label serializer + strip renderer** (`tools/render/`): `docToStrips` packs short strips; a
  Playwright script crops PNG+label pairs out of the harness's own live render.
- **Faithful + signature label scheme** implemented and round-trip verified on all sample scores.
- **Rung-1 overfit-10: GO** — 10/10 strips reproduced exactly on the Mac (MPS). The gate caught two
  decode-side wiring bugs (no-EOS labels; generation stopping on "." instead of `</s>`), both fixed
  and carried forward.
- **Repeat signs:** 4 faithful drawn-symbol tokens (the base vocab's structural `\repeat`/`volta` are
  unusable), placement by **duplicate-run detection** verified against a printed score. Also found:
  246/256 rendered strips were single-measure → Rung 2 had to guarantee multi-measure strips.
- **Rung-1.5 ONNX/browser gate: PASS** — the no-server premise proven end to end: `optimum-cli`
  export → int8 dynamic quantization → decoded in a real browser via `onnxruntime-web` with a
  hand-rolled JS greedy loop and a JS port of the Donut preprocessing; 3/3 gate strips reproduced
  their exact label ids. Python parity checked first.

## Phases 0 and 1 (2026-06-20 … 2026-06-28)

Symbolic → microtonal audio with no ML, then the shared TypeScript core + React web harness
(piano-roll, VexFlow sheet with AEU accidentals, transport, editing, usul-aware metronome,
transpose/ahenk, lyrics and header). Full detail: [HISTORY.md](HISTORY.md).
