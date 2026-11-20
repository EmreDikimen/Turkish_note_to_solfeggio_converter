# Manual checks — see each feature with your own eyes

purpose: see-it-yourself checks: the app, the editor, and the render/corpus side (the ear-and-eye feature checks are in MANUAL_CHECKS-FEATURES.md)
audience: anyone verifying a feature by hand rather than by test
updated: 2026-11-20

How to verify each upgrade **with your own eyes**, step by step. Everything here runs locally.
Prerequisite for the browser checks: the dev harness running —

```bash
npm run dev:cloud      # → http://localhost:5173, decode on Cloud Run (keeps the Mac cool)
npm run dev:web        # the same, decoding in YOUR browser — only for the checks that need it
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
| `slurseed` | integer → seeded label-free phrase slurs (an arc alone is not a triplet) | `slurseed=3` |
| `staccatoseed` | integer → seeded label-free staccato dots (a dot means "longer" only BESIDE the notehead) | `staccatoseed=9` |
| `respellseed` | integer → seeded low-rate büyük-enharmonic respell (the batch renderer always sets it) | `respellseed=5` |

---

> **Checks 1–8 (the synthetic corpus and the renderer)** moved to
> **[MANUAL_CHECKS.md](#manual-checks--the-synthetic-corpus-and-the-renderer)** on 2026-08-07, at the 400-line cap. What
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
.venv-ml/bin/python ml/omr/quantize_onnx.py --onnx-dir data/checkpoints/rung2-best-onnx
# 3. stage the gate assets into apps/web/public/models/ (gitignored)
.venv-ml/bin/python ml/omr/make_browser_gate.py --checkpoint data/checkpoints/rung2-best \
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
   .venv-ml/bin/python ml/omr/decode_page.py data/real/images/hicaz/ben_bir_garip_kusum_p1.png \
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
   PNG side by side and fix a wrong note. ⚠ **`⬇ Save JSON` was removed on 2026-08-30**: to read the
   corrected document, open the console and type `__omrDoc`. The labelling loop's real path is
   `ml/labels/review_ui.py` (`docs/CODE_TOUR.md` §3.2).
4. Stitcher regression suite (structure unit tests + label round-trip on all bundled scores):
   ```
   npx --yes tsx tools/tests/stitch-test.ts     # expect: ALL PASS, 194/194 round-trip
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
⭐ **And a crop that reaches into the system ABOVE it** — that is a staff whose measured spacing was
read wrong, so `normalize_row` under-magnified the row and its fixed-height frame took in the
neighbour. The `frame` figure gives it away: 4.60↑ against a healthy row's ~1. Fixed 2026-08-26, and
worth knowing because it is the failure the crop caption can diagnose on its own.

**staff rescue (find missing rows)** — ⚠ **ticked when the inspector opens, and the app leaves it
OFF.** So this view deliberately shows **more staves than the app cuts**; the status line says which
mode you are in, and unticking gives you exactly what the app does. That asymmetry is the point: a
staff row the slicer never found produces **NO crop at all**, so it is invisible in the strip list,
in every manifest and in every accuracy number — this is the one place a person can see that a row
was lost. Try it on a faint photocopy or a hand-ruled page: `vuslata_nail_de_etse_ger_felek_nota_p2`
finds 4 of its 9 rows without it and 8 with. ⚠ Judge the recovered rows **by eye** — the scorer
structurally cannot grade them, because its truth comes from the old pipeline's decodes and the old
pipeline never saw them ([METRICS-SLICER-STAFF.md](METRICS-SLICER-STAFF.md)).

**old placement (ornaments outrank beams)** re-slices every page under the pre-2026-08-05 rule, where ink above the staff could claim room without limit and shear the beams below. Tick it on a page with a slur or segno above a beamed run and compare the bottom edge.

**debug overlay (debug.png)** draws the whole page with the slicer's decisions on top of it — the
same picture `page_to_strips.py --debug` writes, in the same colours, so the browser's and Python's
can be compared side by side. Green = the staff lines found, blue = the barlines ACCEPTED, red = the
padded crop each strip holds, and four colours for the barline candidates thrown away (orange too
fat, purple runs on past the staff, yellow a notehead/flag/beam over a line, grey outside the
staff). Read it when the crops themselves look wrong for no visible reason: a measure swallowed by
its neighbour shows up here as a barline coloured as a reject rather than accepted, which the crops
alone cannot tell you. **⬇ save debug.png** downloads it as `<page>_debug.png`. Ticking the box
after a page is loaded re-slices that ONE page to draw it (~2.7 s measured, `feryad_kim_ney_p2`,
n=1) — the slicer is deterministic, so the crops and any labels already read are kept exactly as
they were.

⚠ It is **view-only by design** (owner, 2026-08-05): deleting a strip changes nothing outside this
page — no score is built here, and nothing is written to disk. A reload starts empty.

## Check 22 — what the model actually said (the raw decode inspector, 2026-08-09)

Goal: read the model's own output for the page **you just read in the app**. Check 13 does this for
a page you re-slice in a separate tool; this is the same question asked of the real read, after the
stitcher and the editor have had their turn — and it is where a note that never reached the score
becomes visible.

1. `npm run dev:web`, upload a page (or use **Şeritleri oku** in **Gelişmiş** with a folder of
   `*_sNN_wNN.png` crops).
2. Open **Gelişmiş** → **Modelin ham çıktısı**. The line under the title says how many strips, how
   many tokens in total, and where it was read (`sunucuda` / `bu bilgisayarda`).
3. Click a strip chip (`s0w0`, `s1w1`, … — the file name is in the tooltip). You get the
   detokenized line the stitcher was handed, then **every token in order** with its log-probability
   underneath: `\sig −0.74`, `\komaFlat −0.35`, `si</w> −0.20`. Orange borders are less sure, red
   ones are doubtful — the number is the claim, the colour is only for the eye.
   ⚠ Pitches are shown as **note names**, not letters (`la'4`, `si</w>`), the same way
   `review_ui.py` shows the labelling queues — hover a token, or the line, for the raw vocabulary
   spelling (`a'4`, `b</w>`). Everything else is verbatim, `</w>` markers included.
4. A chip marked **⚠** hit the token cap: that strip is a truncated read, not a short one.
5. **2 birleştirme uyarısı** at the bottom opens the stitcher's own notes — `row 0: mid-row \sig
   ignored`, `row 6: \tie into a rest ignored`. This is the answer to "the model saw it, so why is
   it not on the page".
6. **Ham çıktıyı indir (JSON)** saves the whole thing — ids, token spellings, logprobs, per strip.
   The file keeps the **letters**, not the note names: it is data, and its alphabet is the one the
   model was trained on.

What to look for: a strip whose tokens are confident but wrong (a real model error), against one
whose tokens are all near −1 (the crop is bad — go to check 13), against a strip whose tokens are
right and whose music is missing from the score (a stitcher warning, step 5).

⚠ It shows the **last read only**, and loading a JSON score clears it — the tokens would otherwise
describe a different piece than the one on the screen.

> **Checks 15–21 (the editor)** moved to **[MANUAL_CHECKS.md](#manual-checks--the-score-editor)** on
> 2026-08-09, again at the 400-line cap: editing a note on the sheet, the armed palette, Çal from the
> bar you just fixed, inserting notes, rests and the numbered koma signs, triplets, and bars that do
> not add up.



## Check 23 — the repeat is a SIGN, the cursor goes back with it, and the teslim returns (2026-08-30)

The point of this one is to see the two halves agree: the page is short, the music is long.

1. Read a page (Check 12) or its crops (Check 10). Most pages carry repeat signs — about two thirds
   of them do.
2. Look at the sheet. Where the model read a repeat you should see **`‖:` and `:‖`**, the **1.** and
   **2.** brackets, and — where the page had them — **𝄋**, **⊕**, **"D.C."** and **"Son"**. The bars
   between the signs are drawn **once**. Before 2026-08-30 they were drawn twice and no sign appeared.
3. Count the bars on screen, then open the console and compare:
   ```js
   __omrStructure.playBars.length        // how many bars are PLAYED
   Math.max(...__omrDoc.events.map(e => e.bar))   // how many are WRITTEN
   ```
   The played number should be the bigger one. That difference is the fold.
4. Now click a bar **inside** the repeat to play from there, and watch the blue cursor. When it
   reaches the `:‖` it must **jump back to the `‖:`** and play the passage again — and the sound must
   agree with it. ⚠ This is the whole claim; a cursor that runs on past the `:‖` while the music
   repeats (or the other way round) is the bug to report.
5. **The 𝄋 → 𝄋 return** (2026-08-30). On a page with **two or more 𝄋** — a saz semâî prints one at
   the head of the teslim and one at the end of each later hâne — the section under the first 𝄋 must
   be played again at every later one, and the music must then carry on where it jumped from. Read it
   in the console: `__omrStructure.bars.filter(b => b.segno)` gives the marked bars (`segnoAt` says
   which edge each is drawn on), and the section's bar numbers should appear in `playBars` once per
   later 𝄋, in between the hâne's bars. ⚠ If the page carries no "Son" and no `:‖` after the first 𝄋,
   nothing happens on purpose — the app will not guess where the section ends.
6. Open **Gelişmiş** and tick **Tekrarları açık yaz**. The score is written out long again, with no
   signs — the old behaviour, kept for comparison. ⚠ **Düzenle closes when you tick it**, on purpose:
   in that view every repeated bar is a copy, and an edit aimed at a copy would land on the wrong
   note. Untick it (or press Düzenle) to fold back.
7. Headless and asserted, over a real page: `npm run smoke:app` — the last two lines say whether the
   sheet is shorter than the performance and whether the playhead went back. The claim that folding
   never changes the SOUND is `npm run check:fold` (1,720 pages, expect 0 changed).

## Check 14 — the makam changes what you HEAR (2026-08-07)

Goal: the only check in this file that needs your ears. A makam is not a label — picking one bends
the sounding pitches to how the makam is actually performed, while the staff stays exactly as
drawn. Table and sources: [app/README.md](app/README.md#makam-selection--the-performed-intonation).

1. `npm run dev:web`, then open `http://localhost:5173/?score=/gamzedeyim-deva.json` — the app
   ships no score, so a bundled file is loaded by URL ([THIRD-PARTY.md](THIRD-PARTY.md)). **Makam**
   should already read **Uşşak ♪** (the file carries its own makam; ♪ marks the makams that bend
   something), and **no popup appears** — a file that knows its makam has nothing to ask.
2. **Read the line beside the picker before you play anything** (2026-09-05). It says *farklı
   çalınan perdeler*, then one chip: **Si** with a koma-bemol, **1,5 koma pes**, **bu eserde 22
   nota**. Open **neden?** — the reason is the sourced sentence from the table. Now pick **Hüzzam**:
   two chips, and the second (**Mi**, bakiye-bemol) reads **bu eserde yok**, because this piece
   never writes that note. That is the line being honest, not a bug.
3. Set **Makam** to **none (as written)**, ▶ Play, and listen to the si (B) notes.
4. Switch back to **Uşşak ♪** — playback stops, as for any change that moves pitches — and Play
   again. **Every written si koma-bemol now sounds noticeably flatter**: 1.5 commas ≈ 34 cents, so
   dügâh→segah goes from 181 to ~147 cents — the gap between how AEU spells the note and where an
   uşşak player puts it.
5. Switch to **Hüseyni**, which is deliberately *not* marked ♪ — it is documented as **not** taking
   that lowering, so it plays as written, and the line says the sources report no deviation. Then
   try **Hicâz**, which is simply not in the table: a *different* sentence, because "measured and
   flat" and "never looked at" are not the same claim. That contrast is the point of the feature.
6. **The staff must not have moved through any of this.** Switch to **Sheet**: same accidentals,
   same noteheads. Confirm it properly in the browser console — `JSON.stringify(__omrDoc)` under
   `none` and again under `Uşşak` — the two may differ in the `makam` field and nowhere else, never
   a `koma53` or `noteName`.
7. **The popup**, which only a decode raises: follow Check 12 with any page image. When the read
   finishes, a dialog names the makam it guessed **and shows why** — the signature it matched, the
   note the piece ends on, and the same perde line as step 2, already unfolded. Accept or change it;
   the status line carries the same guess.

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
   in ~19 s. Then switch to **Sheet**, press **▶ Play**, and edit a measure (✎ Edit → click one).
5. The same thing, headless and asserted, including a strip-count check against Python:
   ```
   .venv-ml/bin/python ml/prep/slicer_ref.py --pages 8 --out ref.json
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

## The ear-and-eye checks moved out (2026-08-16)

**Checks 23 (usul strokes), 24 (instrument voices) and 25 (the fingerboard) now live in
[MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md).** This file hit its 400-line cap, and the
split is by genre rather than size: those three are judgements only a person can make, on the
feature track, while everything left here checks the pipeline and the model.

**Merged into this file on 2026-11-20:**

- [Manual checks — the score editor](#manual-checks--the-score-editor) — was `docs/MANUAL_CHECKS.md`
- [Manual checks — the synthetic corpus and the renderer](#manual-checks--the-synthetic-corpus-and-the-renderer) — was `docs/MANUAL_CHECKS.md`


## Manual checks — the score editor

*Was `docs/MANUAL_CHECKS.md` (last updated 2026-08-09).*

> Split out of [MANUAL_CHECKS.md](MANUAL_CHECKS.md) on 2026-08-09 at the 400-line cap — the second
> such split, after the corpus half went to [MANUAL_CHECKS.md](#manual-checks--the-synthetic-corpus-and-the-renderer) on
> 2026-08-07. This half is **checks 15–21: the editor**. Everything else — the in-browser gate, page
> upload, the slice inspector, the raw decode inspector, makam playback — stayed in
> [MANUAL_CHECKS.md](MANUAL_CHECKS.md).
>
> Prerequisite for all of them: `npm run dev:web` → <http://localhost:5173>. ⚠ The app bundles no
> score since 2026-08-08, so these open with `?score=…` against the dev server (docs/THIRD-PARTY.md).
> Scripted equivalent of most of this file: `npm run smoke:editor`.

### Check 15 — editing a note on the sheet (editor slice 1, 2026-08-07)

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

### Check 16 — the armed palette (editor step 4, 2026-08-08)

Goal: see Mus2's model working — arm a tool, click a note, the note changes. Scripted version:
`npm run smoke:editor`.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. A **palette appears to the left of the sheet**: a **SÜRE** row of six note glyphs and a
   **DEĞİŞTİRME** row of the AEU signs. Every glyph is whole — no stem or flag cut off by its
   button. The score itself must not move, resize or re-flow when it appears, and the page must not
   gain a sideways scrollbar.
   ⚠ **Do this on a window at least ~1250 px wide.** The sheet is engraved at a fixed 1020 px and
   the palette costs 164 px, so on a narrower window the last measures of each system scroll off the
   paper — expected, not a bug (see [app/editor.md](app/editor.md), trap 3).
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

### Check 17 — Çal plays from the bar you just fixed (editor step 5, 2026-08-08)

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
   Çal. Resume-in-place is written up as not built ([app/editor.md](app/editor.md)).

### Check 18 — put a note where there wasn't one (editor step 6, 2026-08-08)

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

### Check 21 — rests, and the numbered koma signs (2026-08-08)

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

### Check 19 — make a triplet, and take it apart (editor step 7, 2026-08-08)

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
7. With ÜÇLEME still armed, click **any one of the three notes**: nothing happens. Since 2026-08-30
   a triplet is picked up by its **3**, not by its notes — see check 19b. One **Geri al** still
   undoes the whole triplet in a single press.
8. ⚠ Try a dotted note or a note already inside a triplet: they stay pale. Three dotted 8ths would
   draw a bracket that never closes, which is the mark that means *the model misread something*.

### Check 19b — hold a triplet: slide it, and take the bracket off (editor step 7b, 2026-08-30)

Goal: see that the handle MOVES the triplet without ever making it four notes, and that the ✕ keeps
the notes. Scripted version: `npm run smoke:editor`.

1. Carry on from check 19, with a triplet made and **ÜÇLEME** still armed.
2. Click the **3** the engraver drew over the group — the sign itself, not the notes. Hovering it
   shows a dashed teal outline, so you can see it is a target. An orange **frame** appears round all
   three notes, with a small orange **handle** at each end and a **✕** above the middle.
   ⚠ Try clicking one of the three **notes** instead: nothing happens. That is deliberate.
2b. Press **Esc** (or the **↖ Seçim** button) so no tool is armed, and click the **3** again: it is
   still a target, and still gives you the frame, the handles and the ✕. Now click one of its
   **notes**: the note gets selected and the tuplet lets go — only ever one thing is selected, so
   there is never more than one ✕ on the page. ⚠ Arm a note length instead (say 1/4) and click the
   **3**: nothing happens. A note length applies to a note, and a sign is not one.
3. Look at the notes either side: the ones a handle can be dragged onto are outlined with a **dashed
   teal border**. Everything else stays pale. A dashed note is a *landing*, not a button — clicking
   it does nothing, because the handles do the moving.
4. **Drag the right-hand handle to the right**, onto the next dashed note. The bracket moves with it:
   the triplet's **first** note drops out and goes back to its printed value, and the note you
   reached joins the group. It is still three notes, and the **bar length has not changed** — the −
   badge from check 20 stays exactly as it was. Drag back to the left and it returns.
5. ⚠ Keep dragging past the end of the bar, or over a note of a different length: **nothing happens.**
   A tuplet cannot cross a bar line, and three notes of different lengths cannot make one.
6. Click the **3** again: the group is let go (the frame and the handles disappear). Click it once
   more to pick it up, then press **✕**. The bracket disappears, the three notes go back to their printed values, **and all
   three notes are still there** — ✕ removes the *grouping*, never the music. The bar's badge flips,
   because the bar is now longer again.
7. ⚠ On roughly one piece in ten the mark is a square **bracket** instead of a curved arc (the style
   is fixed per piece). It is clickable in exactly the same way — but no automated check covers that
   style, because every bundled sample draws the arc, so it is worth a look if you meet one.
8. ⚠ The handles cannot widen a REAL triplet to four or five notes, and that is on purpose: the printed
   digit is always a "3" and the label the model reads is always `\tup3`. A wider group would draw
   and label a rhythm nobody wrote. See [app/editor.md](app/editor.md#the-tuplet-rules).

### Check 19c — the BROKEN marks: a "3" over one or two notes (2026-08-30)

Goal: see the marks the model got wrong, and fix them. This one needs a **decoded page**, because a
clean SymbTr sample has none. Scripted version: `npm run smoke:editor`.

1. `npm run dev:web` → `http://localhost:5173/?score=/decoded.json`. **Nota**, **✎ Düzenle**, arm
   **ÜÇLEME**.
2. Look for the **red** outlines. There are **five** of them on this page, against two orange-on-hover
   real triplets. A red mark is a "3" the arithmetic could not close — it sits over one or two notes
   instead of three, which means the model misread something there. They are flagged the moment the
   tool is armed, not on hover, because finding them is the point.
3. Click a red one. It is held exactly like a real triplet, and the frame is **red and dashed** so you
   can still see which kind you have.
4. Look at the notes beside it. A **green** outline means *"drag a handle here and this becomes a real
   triplet"*; a dashed teal one is an ordinary landing (it would shrink the mark). Drag the handle onto
   the green note: the bracket now covers three notes and turns orange — it is a real triplet.
5. Press **✕** on another red one instead. Its notes go back to their printed values and the mark
   disappears. **No note is deleted** — count them if you like.
6. ⚠ **Two of the five have no green note and no landing at all.** Their neighbours are not the right
   kind of note to complete a triplet, so there is nothing honest to drag to. Use **✕** on those, or
   fix the neighbour's length first with the note buttons. The page refuses rather than offering a
   drag that would produce another wrong rhythm.

### Check 20 — bars that do not add up (editor step 8, 2026-08-08)

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
   believing. n = 1 page measured so far ([app/editor.md](app/editor.md)).


## Manual checks — the synthetic corpus and the renderer

*Was `docs/MANUAL_CHECKS.md` (last updated 2026-08-07).*

> Split out of [MANUAL_CHECKS.md](MANUAL_CHECKS.md) on 2026-08-07 at the 400-line cap. This half is
> **checks 1–8: the corpus we render**. The app checks (the in-browser gate, uploading a page, the
> slice inspector, makam playback) stayed in [MANUAL_CHECKS.md](MANUAL_CHECKS.md).
>
> Prerequisite for the browser-driven ones is the same: `npm run dev:web` → <http://localhost:5173>,
> and the render-automation URL parameters are documented in [MANUAL_CHECKS.md](MANUAL_CHECKS.md).
>
> ⚠ **The `?score=…` URLs below still work, but only against a dev server.** Since 2026-08-08 the
> app bundles no score and the deployed build has none — the files are on disk and gitignored
> ([THIRD-PARTY.md](THIRD-PARTY.md)). A fresh checkout regenerates them with
> `ml/prep/export_scores.py`. There is no Sample dropdown any more, so `?score=` is the only way in.

---

### Check 1 — multi-measure strips (token cap 46 → 56)

Open (a **sparse** piece — see the note below):

> http://localhost:5173/?score=/safalar-getirdiniz.json&mode=every&lyrics=0

Scroll to the **Strip panel** below the sheet.

- **Look for:** strip ids like `m12-13`, `m30-31` (spanning 2+ measures), and `|` inside those
  labels between the measures.
- **Click a multi-measure strip:** the orange highlight rectangle on the sheet must cover all of
  its measures, and the decoded line under the label must match the highlighted notes.
- **Wrong looks like:** every single id being `mN-N`, or a highlight that covers a different
  region than the label describes.

⚠️ **Known and expected:** dense pieces (`/sample.json` = aldanma, `/gamzedeyim-deva.json`) still
pack ONE measure per strip. Verified against the real tokenizer: a dense 9-note measure costs
~38 of the decoder's 60-token budget, so two of them can never fit — this is a model constraint,
not a bug. Multi-measure coverage therefore comes from selecting enough sparse pieces (the
selection script targets this; see Check 5).

### Check 2 — URL-driven transpose + keysig labels

Open side by side:

> http://localhost:5173/?score=/sample.json&mode=keysig&lyrics=0&transpose=0
> http://localhost:5173/?score=/sample.json&mode=keysig&lyrics=0&transpose=-4

- **Look for:** a *different key signature* drawn after the clef in the second tab (t=0 shows a
  single koma-flat on b; t=−4 shows bakiye-flats on d, g, a), and the Strip panel labels'
  `\sig … \sigend` prefix tracking exactly what is drawn.
- **Wrong looks like:** the drawn signature and the `\sig` block disagreeing, or the sheet not
  transposing at all.

### Check 3 — seeded repeat-sign injection

Open:

> http://localhost:5173/?score=/sample.json&mode=every&lyrics=0&repseed=42

- **Look for:** repeat barlines (`‖:` thick+dots begin, `:‖` end) and "1." / "2." volta brackets
  drawn on the sheet.
- **Faithful one-end-only rule:** click a strip that touches only the *left* edge of a repeated
  passage — its label must contain `\repstart` but **not** `\repend` (and vice versa for the
  right edge). A strip fully inside the repeat has neither.
- **Determinism:** reload the page — the signs must be at the *identical* measures every time.
- **Wrong looks like:** a label carrying a repeat token whose sign isn't visible inside that
  strip's highlight rectangle, or signs moving between reloads.

### Check 3b — seeded navigation-mark injection (segno / coda / D.C. / Son)

Open:

> http://localhost:5173/?score=/gamzedeyim-deva.json&mode=every&lyrics=0&navseed=42&repseed=99&respellseed=43

- **Look for:** navigation marks drawn like the real neyzen.com sheets — this seed draws a
  ⊕ **coda pair** (end of m31 → start of m40) and italic **"D.C."** at m12's and m52's right
  barlines. Other seeds draw segno 𝄋 (e.g. `navseed=1`, m28) and "Son"; each render gets 4–6
  marks, so no single seed shows every kind (text marks sit above OR below the staff — both
  placements are injected on purpose).
- **Faithful tokens:** click a strip showing a mark — its label must carry the matching token
  (`\segno` `\coda` `\dc` `\fine`) at the drawn edge (start-edge marks before the measure's
  notes, end-edge marks after). Strips without a visible mark must have no nav token.
- **No stacking:** nav marks never appear on measures carrying repeat signs or volta brackets
  (injection excludes them ±1 measure — they share the above-staff band).
- **Determinism:** reload — identical marks at identical measures every time.
- **Wrong looks like:** a clipped glyph at a crop edge, a token without its drawn mark (or vice
  versa), or marks moving between reloads.

### Check 3c — rhythm signs: triplets / ties / grace notes (strips_v2_2, NOT injected)

Open (a piece carrying all three — 12 triplet events, 1 tie, 14 graces):

> http://localhost:5173/?score=/beyati-delisin.json&mode=every&lyrics=0

- **Triplets (m8, m16):** three 16ths beamed TOGETHER under one "3" mark — a curved slur-like
  arc with an italic 3 (most pieces, incl. this one) or VexFlow's square bracket (~30% of
  pieces, by name hash; the token is identical). The mark sits on the NOTEHEAD side — above
  when stems point down, below when they point up. The strip's label wraps the group:
  `\tup3 \komaFlat b'16 c''16 d''16 \tupend`, written durations plain (no `16. 32` snapping).
- **Tie (m40):** a single SymbTr 5/8 event drawn as half + arc + 8th; the label reads
  `a'2 \tie a'8` — accidentals (if any) only on the FIRST written note. Long RESTS split into
  side-by-side rests with no arc and no token.
- **Graces (m1, m39, …):** a small slashed 8th attached before its host note, label
  `\grace e''8` (with its own accidental token when drawn, e.g. `\grace \komaFlat b'8`).
- **Real data, no seeds:** these come from the durations themselves (`packages/core/src/labels/rhythm.ts`),
  so they sit at the same measures in EVERY render/seed/transpose of the piece.
- **Playback unchanged:** the tie plays as ONE held note (the note model still holds the single
  5/8 event); graces are silent for now (zero duration).
- **Editor:** ✎ a grace measure — graces are hidden from the row list and re-attached to their
  following note on save (hint text appears); saving without touching anything must not change
  the drawing.
- **Wrong looks like:** a `16. 32`-style rhythm where a triplet should be, a bracket over notes
  whose label has no `\tup3`, a triplet's three notes beamed apart, a grace drawn full-size, or
  a tie's second note repeating the accidental.

### Check 4 — distractor text (pixels only, never labels)

Open:

> http://localhost:5173/?score=/sample.json&mode=every&lyrics=0&textseed=7

- **Look for:** fake title/composer/usul text near the TOP of the first staff row, and
  publisher/year/page strings in the empty lyric zone at the bottom of rows (lyric-free renders
  only). Fonts/sizes/positions vary with the seed.
- **The critical check — labels unchanged:** open the same URL *without* `&textseed=7` in a second
  tab and compare any strip's label in the Strip panel: they must be **character-identical**.
  The text is drawn into the SVG only; the label pipeline never sees it.
- **Wrong looks like:** any label difference between the two tabs, or noise text covering note
  heads/accidentals so badly they'd be unreadable (occasional light overlap with beams is fine —
  real photos have that too).

### Check 5 — piece selection & coverage projection *(after step 5 exists)*

```bash
.venv-ml/bin/python ml/prep/select_pieces.py --n 150
```

- **Look for:** the printed per-class projection table — each of the 8 AEU accidental classes
  comfortably non-zero (watch `\buyukSharp` / `\kucukSharp`, the rare ones), and the projected
  multi-measure share. Skim `data/pieces.json` for familiar makams.
- Spot-load 2–3 exported scores in the harness: `?score=/scores/<slug>.json`.

### Check 6 — smoke render + contact sheet *(after step 6 exists)*

```bash
npx tsx tools/render/render.ts --pieces data/pieces.json --out data/synthetic/strips_v2_1 --from 0 --to 3
open data/synthetic/strips_v2_1/index.html
```

- **The single most valuable check in the pipeline:** each card shows a strip PNG, its raw label,
  and the human-readable decoded line. Read ~10 cards: does the decoded text match the drawn
  notes, accidentals, barlines, repeat signs?
- **Resumability:** interrupt the render mid-run (Ctrl-C), re-run the same command — finished
  pieces must be skipped, the interrupted one re-rendered.
- **Before the FULL render:** find the widest 4-measure strips on the contact sheet and confirm
  the glyphs stay legible — the model squashes every strip to 583×409.

### Check 7 — split + audit *(after step 7 exists)*

```bash
# split-by-piece is already committed at data/split.json — only re-run make_split.py if the
# piece list itself changes
.venv-ml/bin/python ml/omr/audit_coverage.py --strips data/synthetic/strips_v2_1 \
    --split data/split.json --tokenizer data/checkpoints/overfit10
```

- **Look for:** exit code 0; per-class counts vs the Definition-of-done targets (each AEU class
  ≥200 train / ≥25 val — büyük classes ≥15 val, since their respell-injection rate is deliberately
  low); ≥40% of labels containing `|`; `\repstart`/`\repend` in ≥5% of strips;
  **no label above 59 real tokenizer ids**; no piece in both splits.

### Check 8 — augmentation preview grid (training kit)

```bash
.venv-ml/bin/python ml/omr/augment.py --n 6 --out data/synthetic/aug_preview.png
open data/synthetic/aug_preview.png
```

Each row is one strip; the columns are **original | screenshot | photo | photo** (two
independent photo draws, since that profile varies the most).

- **Look for:** the *screenshot* column staying geometrically clean — flat white, straight
  staff, only a little rescale softness / JPEG fuzz (some slices come through nearly
  untouched — that's intended, native screenshots often are clean). The *photo* columns may
  tilt/curve/shade, but **every beam, flag and accidental must stay legible to your eye** —
  if you can't tell an 8th from a 16th, the model can't either (the Step-1 tests showed
  exactly that failure), so the amplitudes are too hot.
- **Wrong looks like:** screenshot cells with rotation/paper/shadows (profile leak), photo
  cells where noteheads merge with staff lines or accidentals smear beyond recognition, or
  two runs with the same `--seed` producing different grids.
- This is the human gate on augmentation strength — **look at it before spending GPU time**,
  and re-check after any parameter tweak in `augment.py`.

---

### Check 9 — staccato distractors (pixels only, and the POSITION is the point)

Added 2026-08-15. The model reads a printed staccato as an augmentation dot and lengthens the note;
this check is the human gate on the mark that teaches otherwise. Numbers:
[METRICS-DIAGNOSTICS.md](METRICS-DIAGNOSTICS.md). Floors: [archive/rounds.md](archive/rounds.md#the-levers-round-3-has-not-pulled--ranked-with-what-to-measure-first) Lever 6.

Open, with a score that has dotted notes:

> http://localhost:5173/?score=/sample.json&mode=measure&lyrics=0&staccatoseed=9

- **Look for:** small filled dots **above or below** noteheads, always on the side **opposite the
  stem**, always centred in a staff SPACE and never sitting on a line. They should be the same size
  as an augmentation dot — the two marks must differ only in *where* they are, or the model can
  separate them by size and learns nothing.
- **The case that matters most:** a note that carries **both** — augmentation dot to the RIGHT, on
  the notehead's own line/space; staccato ABOVE or BELOW. Find one and satisfy yourself the two are
  unmistakably different positions and clearly detached.
- **The critical check — labels unchanged:** open the same URL *without* `&staccatoseed=9` and
  compare any strip's label: **character-identical**. Or, for a whole corpus, render both arms and
  `diff` the manifests — they are byte-identical by construction (`staccatoseed` is deliberately not
  a manifest field).
- **Wrong looks like:** a dot fused to a notehead or sitting on a staff line (both were real bugs in
  the first two drafts — `getNoteHeadBounds()` returns the notehead's *anchor*, not its ink edges);
  a dot on the stem side; a dot noticeably bigger or smaller than the augmentation dot; or any label
  difference between the two tabs.
- ⚠ **Density is a judgement call, not a measurement.** `STACCATO_RATE` in `SheetView.tsx` is
  `{dotted: 0.30, run: 0.18}`, chosen because nobody has counted staccato frequency in real Turkish
  editions. If it reads heavier or lighter than the printed music you know, that is the number to
  change — and counting a few real editions is how to replace the guess.
