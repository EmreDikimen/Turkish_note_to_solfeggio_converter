# Rung-2 dataset & training upgrades — manual checking guide

purpose: see-it-yourself checks: run each feature and look at the result
audience: anyone verifying a feature by hand rather than by test
updated: 2026-08-08

How to verify each upgrade **with your own eyes**, step by step. Everything here runs locally.
Prerequisite for the browser checks: the dev harness running —

```bash
npm run dev:web        # → http://localhost:5173
```

The harness now accepts **render-automation URL parameters** (this is how the batch renderer
drives it, and how you can reproduce any render exactly):

| param | meaning | example |
|---|---|---|
| `score` | score JSON under `apps/web/public/` | `score=/sample.json` (still on disk, though it left the Sample dropdown on 2026-08-08) |
| `mode` | accidental mode: `every` or `keysig` | `mode=keysig` |
| `lyrics` | `1` draw lyrics, `0` hide | `lyrics=0` |
| `transpose` | chromatic shift in commas | `transpose=-4` |
| `repseed` | integer → inject seeded repeat signs | `repseed=42` |
| `navseed` | integer → inject seeded navigation marks (segno 𝄋 / coda ⊕ / "D.C." / "Son") | `navseed=1` |
| `textseed` | integer → seeded distractor text | `textseed=7` |
| `respellseed` | integer → seeded low-rate büyük-enharmonic respell (the batch renderer always sets it) | `respellseed=5` |

---

> **Checks 1–8 (the synthetic corpus and the renderer)** moved to
> **[MANUAL_CHECKS-CORPUS.md](MANUAL_CHECKS-CORPUS.md)** on 2026-08-07, at the 400-line cap. What
> follows is the **app** side: the in-browser gate, page upload, the slice inspector, and makam
> playback.

## Check 9 — in-browser OMR gate (the exported model, with your own eyes)

This is how you watch the **shipped form** of the model — int8 ONNX, decoded by
`onnxruntime-web` in a real browser, no Python anywhere — read Turkish notation. It exercises
the exact runtime path the product will use (Rung 4).

One-time prep (skip what's already done — after the Rung-2 export these all exist):

```bash
# 1. export the checkpoint to ONNX (encoder / decoder / decoder-with-past graphs)
.venv-ml/bin/optimum-cli export onnx --model data/checkpoints/rung2-best \
    --task image-to-text-with-past data/checkpoints/rung2-best-onnx
# 2. quantize to int8 (830 MB fp32 → 221 MB)
.venv-ml/bin/python src/vision/quantize_onnx.py --onnx-dir data/checkpoints/rung2-best-onnx
# 3. stage the gate assets into apps/web/public/models/ (gitignored)
.venv-ml/bin/python src/vision/make_browser_gate.py --checkpoint data/checkpoints/rung2-best \
    --onnx-dir data/checkpoints/rung2-best-onnx --strips-dir data/synthetic/strips_v2_1 --n 5
```

Then:

```bash
npm run dev:web
```

> open **http://localhost:5173/omr-gate.html**

The page loads the three int8 graphs (~3 s), then decodes each gate strip **twice**: once from
Python's reference pixel tensors (proves ONNX-in-browser), once from live canvas preprocessing
of the PNG (proves the real product path — the JS DonutImageProcessor port).

- **Look for:** the tab title flipping to **"OMR gate — PASS"**, the log turning green, and
  every strip showing `✓ reference` **and** `✓ canvas`. Each strip's PNG is rendered on the
  page — compare it to its printed `label` line: the accidentals (`\komaFlat`, `\bakiyeSharp`,
  …), barlines, repeat/nav tokens must all correspond to what you see drawn. Typical speed on
  an M-series Mac: ~0.85 s encoder + ~0.1–0.25 s decode per strip.
- **Wrong looks like:** a red **FAIL** with a `got:` line under some strip (the decode
  differs from the label — reference-only failures mean the export/quantization is broken;
  canvas-only failures mean the JS preprocessing drifted), or an early `ERROR:` line (usually
  the staged assets are missing/stale — re-run step 3).
- The same 5 strips must already pass in Python (`onnx_parity.py … --suffix _int8`) — if the
  browser disagrees with Python, suspect the JS side, not the model.
- **Try your own image — the upload box at the top of the page:** drop (or pick) any strip
  image and it runs the exact product path — canvas preprocessing → int8 ONNX greedy decode —
  and prints the **read** token line (no ✓/✗: an upload has no ground-truth label, so *you*
  compare the tokens against the picture). Keep it to **one staff, ~2–4 measures** — a full
  page or multi-line photo isn't segmented yet (that's Rung-4 staff isolation), and typically
  ends in the `⚠ hit the 100-token cap` warning. A screenshot crop of a real (non-VexFlow)
  score is a fun preview of Rung 3: expect some misreads — that's exactly the synthetic→real
  gap Rung 3 exists to close.
- **Swapping in different strips:** the gate reads `data/checkpoints/rung2-best/GATE_STRIPS.txt`
  (plain strip filenames from the strips dir). Edit it and re-run step 3 — but note the pass
  criterion is exact-match, so pick strips the PyTorch model decodes exactly (the eval is
  96.8% exact-match, so most val strips qualify; verify with `eval_omr.py`/`onnx_parity.py`
  before blaming the export).

## Check 10 — page → editor: the stage-8 stitcher (Rung-4 feed-in, the Rung-3 labeling loop)

Goal: see a REAL page travel the whole pipeline — slice → decode → stitch → editable score.

1. Decode a page (slicer + int8 ONNX; writes strips + `<page>_decode.json`):
   ```
   .venv-ml/bin/python src/vision/decode_page.py data/real/images/hicaz/ben_bir_garip_kusum_p1.png \
       --checkpoint data/checkpoints/rung22-stemfix-best \
       --onnx-dir data/checkpoints/rung22-stemfix-best-onnx --suffix _int8
   ```
2. Stitch the tokens into a note model (prints per-bar notes + every recovered decode glitch):
   ```
   npx --yes tsx tools/render/stitch-cli.ts \
       data/real/strips/ben_bir_garip_kusum_p1/ben_bir_garip_kusum_p1_decode.json \
       -o apps/web/public/decoded.json
   ```
   Expect on this page: 21 strips → 23 written measures, **28 after repeat/volta expansion**,
   `\sig \bakiyeFlat a` resolving the bare `b'`/`a'` notes, and a handful of warnings (stray
   `\tupend`, tie pitch mismatches) — model noise being tolerated, not fatal.
3. `npm run dev:web`, open `http://localhost:5173/?score=/decoded.json` — the decoded page is
   engraved, playable, and **editable** (✎ Edit → click a measure). Compare against the source
   PNG side by side; fix a wrong note; **⬇ Save JSON** downloads the corrected score. That
   correct-and-save cycle IS the Rung-3 model-assisted labeling loop (`docs/PIPELINE.md` §3.2).
4. Stitcher regression suite (structure unit tests + label round-trip on all bundled scores):
   ```
   npx --yes tsx tools/render/stitch-test.ts     # expect: ALL PASS, 194/194 round-trip
   ```

## Check 13 — see how a page was sliced (the slice inspector, 2026-08-05)

Goal: look at the crops themselves. Check 12 asks whether a page reads; this asks **what the model
was actually handed**, which is the first thing to look at when a page reads badly.

1. `npm run dev:web`, then open `http://localhost:5173/slices.html` (or click **🔍 Slice inspector**
   in the app).
2. **Add page(s)** — one or several photos/screenshots. No model is loaded, so a page takes ~1.6 s.
3. Each upload becomes a thumbnail. **Click a thumbnail to see that page's strips.** Every strip is
   captioned with the slicer's own decisions: `row 0, crop 1 · 765×336 px · x 924–1689 · pad 0/-6 ·
   measures 0–0 of 2 · split-wide`.
4. **✖ delete** drops a strip from the list, **⬇ save** downloads it as a PNG, **remove page** drops
   a whole page. **actual size** switches between fit-to-width and 1:1 pixels — use 1:1 when judging
   whether a crop is cut too tight.

5. Strips are **decoded automatically** and each label is printed under its crop, with note names
   substituted — `\sig \komaFlat si \sigend la'16 sol'16 la'16 si'16` — the model's raw
   tokens in grey beneath, and the strip's lowest token confidence on the right. Untick *read with
   the model* to slice only (~1.6 s a page against ~1.2 s a strip).
6. Every crop prints its **vertical placement** — `music 3.3↑/1.9↓ sp, frame 4.60↑/2.60↓` — turning
   red with the shortfall when a side is cut. `music` is how far the row's ink actually reaches;
   `frame` is what the fixed 7.2 line-space budget gave it. That is the first thing to read when a
   crop looks wrong, and it distinguishes the two causes: a conflict the placement lost, or music
   that genuinely exceeds the frame (which no placement can fix).

What to look for: music cut in half at a crop edge, **beams or ledger notes clipped off the top or
bottom** (durations become unreadable), a crop that is nearly empty, a staff missed entirely (the
strip count will be low for the number of staves), or a page that reports 0 staves.

**old placement (ornaments outrank beams)** re-slices every page under the pre-2026-08-05 rule, where ink above the staff could claim room without limit and shear the beams below. Tick it on a page with a slur or segno above a beamed run and compare the bottom edge.

⚠ It is **view-only by design** (owner, 2026-08-05): deleting a strip changes nothing outside this
page — no score is built here, and nothing is written to disk. A reload starts empty.

## Check 15 — editing a note on the sheet (editor slice 1, 2026-08-07)

Goal: see the direct editor do what the modal did, without the modal. Scripted version:
`npm run smoke:editor` — this is the version you do with your eyes.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; stay on **Nota**.
2. Press **✎ Düzenle**. **Geri al** / **Yinele** appear beside it, both greyed out.
3. **Move the pointer across the sheet.** Notes outline in teal as you pass them; **bars do not
   highlight at all** — editing is whole-score, so there is no measure hover.
4. **Click a note.** An amber ring appears around it and an **✕** above its right shoulder.
   ⚠ **Changed 2026-08-08:** clicking empty space used to open that bar's window. The modal is
   deleted — with nothing armed an empty click now just clears the selection, and with a note value
   armed it inserts a note (check 18).
5. **Drag the note up or down.** The notehead follows your pointer, one line/space at a time, and
   **the page itself must not scroll or select text**. Pick a note with an accidental: the
   accidental moves *with* it — a Si♭ dragged up becomes a Do♭, not a plain Do. Let go anywhere;
   the drag keeps working even though the note has slid out from under the pointer.
6. **Press the ✕.** The note disappears; its bar is now one note short and **the bar lines do not
   move**. That is the intended behaviour — an edit absorbs into its bar.
7. **Geri al** (or Ctrl/⌘+Z) puts it back; pressing it again undoes the pitch change. **One whole
   drag is one undo**, not one per staff step. **Yinele** replays them.
8. ⚠ **Grace notes (çarpma) are not selectable** — they are drawn attached to the note after them
   and have no click target of their own. Deleting their host takes them with it.

## Check 16 — the armed palette (editor step 4, 2026-08-08)

Goal: see Mus2's model working — arm a tool, click a note, the note changes. Scripted version:
`npm run smoke:editor`.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. A **palette appears to the left of the sheet**: a **SÜRE** row of six note glyphs and a
   **DEĞİŞTİRME** row of the AEU signs. Every glyph is whole — no stem or flag cut off by its
   button. The score itself must not move, resize or re-flow when it appears, and the page must not
   gain a sideways scrollbar.
   ⚠ **Do this on a window at least ~1250 px wide.** The sheet is engraved at a fixed 1020 px and
   the palette costs 164 px, so on a narrower window the last measures of each system scroll off the
   paper — expected, not a bug (see [mvp/editor.md](mvp/editor.md), trap 3).
3. **Click the ♪ (1/8).** It takes the accent, the hint under the palette changes, and the pointer
   over a note becomes a *copy* cursor rather than a grab hand.
4. **Click a note that is longer than an eighth.** It re-engraves as an eighth **in place** — its
   bar is now short and **the bar lines do not move**. Nothing else in the bar changes.
   ⚠ With a tool armed a click must **not** drag the pitch: the notehead stays on its line.
5. **Geri al** once puts the whole thing back — one click is one undo entry.
6. **Press Esc.** The armed tool clears (`↖ Seçim` lights up instead) and dragging a note moves its
   pitch again, exactly as in check 15.
7. **Arm a koma bemol and click a note with no accidental.** The sign appears before the notehead,
   the note stays on its line, and the pitch you hear on **Çal** drops by one koma. Clicking it a
   second time with the same sign armed does nothing at all — including nothing to the undo stack.
8. ⚠ Leaving edit mode disarms the palette; re-entering starts on **Seçim**.

## Check 17 — Çal plays from the bar you just fixed (editor step 5, 2026-08-08)

Goal: hear the correction loop. Scripted version: `npm run smoke:editor` (which measures the
playhead, but cannot listen). This one is about the **ears**, so do it with sound on.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. The palette's top group is **DİNLE**, with **▶ Çal** and a greyed **■ Dur**.
3. **Press Çal before editing anything.** It plays from the **top** of the piece — the playhead
   starts on the first system. **Dur** silences it.
4. **Scroll to a bar halfway down**, arm a note value, and click a note there.
5. **Press Çal.** It must start **at that bar**, not at the top — the playhead appears down the page
   where you just worked, and what you hear is that bar. This is the whole feature.
6. **Press Çal again while it is still playing.** It restarts from the same bar. (Pause and resume
   are unchanged and still live in the transport bar above.)
7. **Press Geri al.** The edit reverses, but Çal still starts from that same bar — deliberate: the
   bar you were working in is still the bar you want to hear.
8. ⚠ **An edit stops playback**, as it always has. That is expected in this step: stop, fix, press
   Çal. Resume-in-place is written up as not built ([mvp/editor.md](mvp/editor.md)).

## Check 18 — put a note where there wasn't one (editor step 6, 2026-08-08)

Goal: see the ghost land on the pitch it promised, and see the bar absorb it. Scripted version:
`npm run smoke:editor`, which checks the geometry but not how it *feels* to aim.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. Arm a note value (say the quarter note). Move the pointer over blank staff between two notes: a
   **teal oval** follows it, jumping a step at a time — it is snapped to staff positions, not to the
   pixel, which is what makes aiming possible at all.
3. Move up and down slowly. The oval sits **on lines and in spaces**, never between, and it keeps
   going a few steps past the staff each way before it stops.
4. **Click.** A real note appears exactly where the oval was, with the value you armed, and it is
   **selected** (its ✕ is showing) so you can immediately delete it or give it an accidental.
5. **The bar line to its right has not moved** — the bar simply holds one note more. That is the
   absorb rule; the warning for a bar that no longer adds up is step 8.
6. Under a key signature, insert on a letter the signature alters: the note is born with that
   alteration and the engraver prints **no accidental** on it. It looks like where you clicked.
7. Now arm an **accidental** instead and click blank staff: **nothing happens** (it has nothing to
   attach to), and no window opens. Press **Esc** and click blank staff again: the selection clears
   and **nothing else happens**. ⚠ Until 2026-08-08 that opened the per-measure window; it is
   deleted, and with it the only way to add a **rest**.
8. **Geri al** removes the inserted note in one press.

## Check 21 — rests, and the numbered koma signs (2026-08-08)

Goal: the two things the deleted measure modal used to own, now in the palette.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. The palette now has an **ES** row under **SÜRE**: the same six values, drawn as rests. Arm the
   quarter rest and move over blank staff — the ghost sits **in the middle of the staff and stays
   there** as you move up and down. A rest has no pitch, and the preview must not pretend otherwise.
3. **Click.** A rest appears. The bar absorbs it (a **+** badge appears at the bar's corner) and the
   bar line does not move.
4. **Geri al.** Now, with the rest tool still armed, click an existing **note**: it becomes a rest.
   Its syllable disappears with it — nothing sings on a rest.
5. Arm a **note value** and click that rest at some height on the staff: it becomes a note **at the
   height you clicked**. That is the fix for a rest the model read where a note belongs.
6. The **DEĞİŞTİRME** row now has thirteen signs, not seven: the four AEU flats and sharps, natural,
   and the numbered **2-comma** and **3-comma** ones. Hover them — each tooltip names the comma
   count.
7. Apply **2 koma diyezi** to a plain note. ⚠ Look carefully: the printed sign is the nearest
   standard AEU sign, because that is what a Turkish edition prints — but the **sound** moves by
   exactly two commas. Press **Çal** and listen; then **Geri al** and listen again.

## Check 19 — make a triplet, and take it apart (editor step 7, 2026-08-08)

Goal: see the tool refuse what it cannot do, before you click. Scripted version:
`npm run smoke:editor`.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. Arm **ÜÇLEME** (the italic 3). Immediately, before you click anything: **most notes go pale**.
   The ones still crisp are the ones a triplet can *start* at — three equal, plain notes in a row.
   Try clicking a pale one: nothing happens, and no window opens. That is the refusal, and it is
   deliberately silent (dim, never an error box).
3. Click a crisp note. It turns teal, and now **exactly one** other note in the whole score is
   clickable: the one two positions along. Everything else, including the note between them, is
   pale — a tuplet cannot skip notes.
4. Click that end note. A **bracket with a 3** appears over the three, and the notes are drawn as
   the next value up (three 1/16s become three 1/24s printed as 1/16s under the bracket).
5. **The bar line has not moved**, and a small **−** badge appears at the bar's top-right: the bar
   is now shorter than the usul asks for. That is check 20.
6. Press the palette's **Çal**: playback starts at that bar and the triplet sounds faster than it
   looked. This is the whole loop — fix, listen.
7. With ÜÇLEME still armed, click **any one of the three**. The bracket disappears and the notes go
   back to what they were. One **Geri al** also undoes the whole triplet in a single press.
8. ⚠ Try a dotted note or a note already inside a triplet: they stay pale. Three dotted 8ths would
   draw a bracket that never closes, which is the mark that means *the model misread something*.

## Check 20 — bars that do not add up (editor step 8, 2026-08-08)

Goal: see the editor point at a bar that is the wrong length — and, on a decoded page, notice that
it is also pointing at the model's mistakes.

1. In **✎ Düzenle** on a clean sample: **no badges anywhere.** Leave edit mode: still none (the
   marks are edit-mode only — a friend should not meet eight warnings on their first look).
2. Delete a note from a middle bar (click it, press **✕**). A **−** appears at that bar's top-right.
   Hover it: it tells you the bar's own total and the meter it is being compared against.
3. Insert a note into the same bar instead: the badge becomes **+**.
4. **Geri al** clears it.
5. ⚠ The first and last bar are only marked when they are too LONG. A pickup bar and a closing bar
   are legitimately short, so a triplet made in bar 1 shows nothing — that is correct, not broken.
6. Now load a **decoded page** (upload a photo, or a saved decode). Several interior bars light up.
   Those are candidates for where the model misread a duration — worth checking by ear before
   believing. n = 1 page measured so far ([mvp/editor.md](mvp/editor.md)).

## Check 14 — the makam changes what you HEAR (2026-08-07)

Goal: the only check in this file that needs your ears. A makam is not a label — picking one bends
the sounding pitches to how the makam is actually performed, while the staff stays exactly as
drawn. Table and sources: [mvp/makam.md](mvp/makam.md).

1. `npm run dev:web` → `http://localhost:5173`. From **Sample**, load **"gamzedeyim deva — uşşak ·
   sofyan"**. **Makam** should already read **Uşşak ♪** (the sample carries its own makam; ♪ marks
   the makams that bend something), and **no popup appears** — a sample knows the answer already.
2. Set **Makam** to **none (as written)**, ▶ Play, and listen to the si (B) notes.
3. Switch back to **Uşşak ♪** — playback stops, as for any change that moves pitches — and Play
   again. **Every written si koma-bemol now sounds noticeably flatter**: 1.5 commas ≈ 34 cents, so
   dügâh→segah goes from 181 to ~147 cents — the gap between how AEU spells the note and where an
   uşşak player puts it.
4. Switch to **Hüseyni**, which is deliberately *not* marked ♪ — it is documented as **not** taking
   that lowering, so it plays as written. That contrast is the whole point of the feature.
5. **The staff must not have moved through any of this.** Switch to **Sheet**: same accidentals,
   same noteheads. Confirm it properly with ⬇ **Save JSON** under `none` and again under `Uşşak` —
   the two files may differ in the `makam` field and nowhere else, never a `koma53` or `noteName`.
6. **The popup**, which only a decode raises: follow Check 12 with any page image. When the read
   finishes, a dialog names the makam it guessed **and shows why** — the signature it matched and
   the note the piece ends on. Accept or change it; the status line carries the same guess.

⚠ Fair to notice: the makam is inferred from the notes, not read off the printed header — header
OCR is still open. On a page whose signature matches nothing it says so and plays as written,
which is the intended answer, not a failure.

## Check 12 — upload a whole page in the app (MVP W7, 2026-08-05)

Goal: the product, as a friend will meet it. **No Python, no pre-cut strips** — one page image in,
a playable score out. This is Check 10's journey with every stage running in the browser.

1. `npm run dev:web` → `http://localhost:5173`.
2. Next to **Read page**, pick ONE page image — e.g.
   `data/real/images/muhayyer/Bulbulum_gel_de_dile_cile_bulbulum_cile_p1.png`, or any screenshot of
   Turkish notation. (**Read strips** beside it is the older path that wants pre-cut `_sNN_wNN.png`
   crops; they are different inputs.)
3. Watch the status line. It should move, not freeze: `loading model…` → `reading the image…` →
   `checking the page angle… n/41` counting up → `finding the staves` → `reading strip k of N`.
   **A frozen counter is the bug to report** — the angle check is ~35 s of work and only stays
   watchable because it yields between rotations.
4. Expect on that page: **7 staves → 16 strips → 344 notes, 28 measures**, sliced in ~36 s and read
   in ~19 s. Then switch to **Sheet**, press **▶ Play**, edit a measure (✎ Edit → click one), and
   **⬇ Save JSON**.
5. The same thing, headless and asserted, including a strip-count check against Python:
   ```
   .venv-ml/bin/python scripts/slicer_ref.py --pages 8 --out ref.json
   npm run smoke:page -- --ref ref.json
   ```

⚠ **Two things it is fair to notice.** The whole page takes ~56 s — a straight screenshot still
pays all 41 rotations to learn it is straight, which is written up as the next piece of work. And
the model is `round2-stage2-best` int8: expect real mistakes on the notes, since the point of this
check is the *pipeline*, not the accuracy.

## Check 11 — real-print sharp weight (`?thinsharps=1`, the 2026-07-26 fidelity fix)

Goal: see with your own eyes why the model confused küçük sharp with koma sharp — and that the
redraw fixes it. Bravura draws the sharp bars too thick and packs küçük's three bars too close, so
after the model's input shrink the three bars fuse into a block that IS a 2-bar koma.

1. `npm run dev:web`, open a score with microtonal sharps twice, side by side:
   `http://localhost:5173/` (Bravura, the default) and `http://localhost:5173/?thinsharps=1`.
   Zoom in on a koma / küçük / bakiye sharp: same shapes and positions, thinner bars, and küçük's
   three bars visibly separated. Flats must look **identical** in both (they were left alone).
2. Or just look at the measured artifacts: `data/real/rung3/sharp_probe/all4_final.png`
   (before / after / after the encoder shrink) and `koma_real_vs_bravura_vs_thin.png`
   (our two drawings against real printed editions).
3. Rendering a corpus with the fix: add `--thin-sharps` to `tools/render/render.ts`. It is **off by
   default** so an A/B against `strips_v3` stays possible.

---

**Reproducing any strip later:** its manifest row carries `piece`, `transpose`, `mode` (`measure`
= carry, the majority since `strips_v3`), `lyrics`,
`repseed`, `navseed`, `textseed`, `respellseed`, `slurseed` — paste them into the URL parameters above and you are looking
at the exact render that produced it (`respellseed` matters: the respell changes which accidental
glyphs are drawn, so omitting it can show different signs than the strip's PNG).
