# Rung-2 dataset & training upgrades — manual checking guide

purpose: see-it-yourself checks: run each feature and look at the result
audience: anyone verifying a feature by hand rather than by test
updated: 2026-08-30

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
| `slurseed` | integer → seeded label-free phrase slurs (an arc alone is not a triplet) | `slurseed=3` |
| `staccatoseed` | integer → seeded label-free staccato dots (a dot means "longer" only BESIDE the notehead) | `staccatoseed=9` |
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
   PNG side by side and fix a wrong note. ⚠ **`⬇ Save JSON` was removed on 2026-08-30**: to read the
   corrected document, open the console and type `__omrDoc`. The labelling loop's real path is
   `scripts/rung3/review_ui.py` (`docs/PIPELINE.md` §3.2).
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

> **Checks 15–21 (the editor)** moved to **[MANUAL_CHECKS-EDITOR.md](MANUAL_CHECKS-EDITOR.md)** on
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
drawn. Table and sources: [mvp/makam.md](mvp/makam.md).

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

## The ear-and-eye checks moved out (2026-08-16)

**Checks 23 (usul strokes), 24 (instrument voices) and 25 (the fingerboard) now live in
[MANUAL_CHECKS-FEATURES.md](MANUAL_CHECKS-FEATURES.md).** This file hit its 400-line cap, and the
split is by genre rather than size: those three are judgements only a person can make, on the
feature track, while everything left here checks the pipeline and the model.
