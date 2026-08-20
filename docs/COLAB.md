# Training on Google Colab — first-timer's guide

purpose: how to run training on Colab (the fanless-Mac offload path)
audience: whoever is launching a training run
updated: 2026-08-19

> How to run the scaled fine-tune (`src/vision/train.py`) on Colab, written for someone who has
> never used Colab. This doc is the context around the notebooks: what Colab is, which plan to buy,
> how not to lose a run, and what "done" looks like.
>
> **One notebook per round — never re-point an old one.** Each carries its round's corpus paths,
> recipe and caveats in its own cells, so a stale path can't silently train on the wrong data:
>
> | Round | Notebook | Zip | Corpus |
> |---|---|---|---|
> | Rung 2 | `notebooks/rung2_colab.ipynb` | `tnc_rung2_colab.zip` | `strips_v2_2` |
> | Round 1 | `notebooks/round1_colab.ipynb` | `tnc_round1_colab.zip` | `strips_v3` + real pools |
> | **Round 2** | **`notebooks/round2_colab.ipynb`** | `tnc_round2_colab.zip` (`scripts/make_round2_colab_zip.sh`) | `strips_v4` + real pools |
> | **Round 3 — the tuplet A/B** | **`notebooks/round3_tuplet_ab_colab.ipynb`** | `tnc_round3_<arm>_colab.zip` (`scripts/make_round3_colab_zip.sh tupnew\|tupctl`) | `strips_v5_tupnew` / `strips_v5_tupctl` + real pools |
> | **Round 3 — arm 1, the scan profile** | **`notebooks/round3_scan_profile_colab.ipynb`** | `tnc_round3_scan_colab.zip` (`scripts/make_round3_colab_zip.sh scan`, 688 MB) | `strips_v5_tupnew` + real pools — **the same corpus as its control** |
> | **Round 3 — the staccato arm** | **`notebooks/round3_staccato_colab.ipynb`** | `tnc_round3_stac_colab.zip` (`scripts/make_round3_colab_zip.sh stac`, 704 MB) | `strips_v6_stac` + real pools — tupnew re-rendered with `--staccato-noise`, **manifest matched to the control's row set** |
>
> ⚠ **The scan arm ships no corpus of its own, and that is the design.** Its only variable is the
> augmentation mix (`--photo-share 0.20 --scan-share 0.25`), chosen at training time, so its control
> is `data/checkpoints/r3-tupnew-stage2-best` — already trained, same corpus, split, recipe, steps
> and seed. **One run, not two.** Nothing downstream records the mix, so `train.py` prints it in its
> startup line and the notebook asserts it before any long run; that log line is the only evidence of
> which arm a checkpoint is. Protocol: [rung3/scan-profile.md](rung3/scan-profile.md).
>
> The Round-3 tuplet notebook is **run twice**, once per arm, off a single `ARM` cell — it is one
> experiment, and the arms must not drift apart in recipe. ⚠ The two corpora have **byte-identical
> manifests** (the tuplet mark is pixels only), so nothing downstream can tell them apart: the zip
> script and the notebook both assert `render_config.json`, which is the only file that can.
> Protocol: [rung3/round3-criteria.md](rung3/round3-criteria.md).
>
> Round 2 differs from Round 1 in three places that matter: `--strips-dir data/synthetic/strips_v4`,
> `--split data/split_v4.json`, and the real-pool oversample **`:9` not `:8`** (synthetic grew, so
> `:8` would drop real from ~34% to 31.9% of batches). It runs ONE recipe, not an A/B.
>
> **Outcome: Rung 2 PASSED on the first full run (2026-07-07, batch 16, lr 3e-5, 6000 steps ≈
> 110 min)** — full result in `src/vision/MODEL_EVAL.md`; checkpoint copied local to
> `data/checkpoints/rung2-best/`. This guide stays as the recipe for future Colab runs
> (e.g. the Rung-3 fine-tune on real photos).
>
> ### GPU decode offload — a different genre, same rules
>
> These notebooks train nothing; they run the emitter's expensive half (slice + decode every page)
> and bring back the `<page>_decode.json` caches so the laptop only does the cheap alignment.
>
> | Job | Notebook | Zip | Model | Window | Out |
> |---|---|---|---|---|---|
> | tuplet pass (2026-07-18) | `rung3_decode_colab.ipynb` | `tnc_rung3_decode_colab.zip` | `rung3-labeler` | `--measures-per-strip 1` | `data/real/strips` |
> | **2026-07-29 re-slice** | **`rung3_reslice_colab.ipynb`** | `tnc_reslice_colab.zip` + `tnc_round2_ckpt.zip` | `round2-stage2-best` | default (3) | `data/real/strips_v2` |
>
> Build the package with `scripts/rung3/make_decode_zip.sh <pages-list> <zip-name>`; both
> arguments are optional and the pages list keeps its own filename inside the zip.
>
> ⚠ **Two flags decide whether the trip was worth anything.** `--cache-checkpoint` is the string
> recorded in every JSON, and the laptop emitter refuses a cache whose recorded checkpoint differs
> from its own `--checkpoint` — get it wrong and the whole batch is discarded on arrival. `--out`
> must not be an existing strip root, because live manifests point into those. The re-slice
> notebook asserts both on 5 smoke pages before the full run.
>
> **The offload is not always the cheap option.** Measured 2026-07-30 on this M4 at `nice -19`:
> **5.2 pages/min on CPU**, so the 1,578-page re-slice is ~5 h locally against a 1.2 GB upload,
> 1.5–3 h of T4, and a ~1 GB download. Overnight on the laptop is a real alternative when the job
> is inference rather than training; the fanless rule is about sustained heat, and this workload is
> resumable and page-cached, so it can be stopped at any point.

## 1. Colab in three sentences

Google Colab is a Jupyter notebook running on a rented Google VM with a GPU attached — you open a
notebook in the browser, pick a GPU, and run cells. The VM is **ephemeral**: its disk is wiped
when the session ends, and sessions DO end (idle timeout, usage limits, random disconnects).
Everything that must survive therefore lives in your **Google Drive**, which the notebook mounts
like a folder — our checkpoints stream there, so a killed session costs minutes (`--resume`), not
the run.

## 2. Which plan? — **Colab Pro. Not Pro+.**

The run is small by GPU standards (143M params, 18.6k strips, ~6k steps):

| GPU | availability | full-run time (defaults) | ≈ compute units |
|---|---|---|---|
| T4 16 GB | free tier + paid | ~2.5–4 h | ~3–7 |
| L4 24 GB | Pro | ~1.5–2 h | ~4–5 |
| A100 40 GB | Pro (when available) | ~45–75 min | ~6–10 |

- **Free tier**: enough for the shakeout (and technically even a full run across interrupted
  sessions, thanks to `--resume`) — but sessions are short, T4-only, and can be preempted.
- **Colab Pro (~$10/month)**: 100 compute units + L4/A100 access + longer sessions. One full run
  burns ~5–10 units, so Pro covers **~10+ full runs** — the whole Rung-2 campaign including LR
  retries, and later the Rung-3 fine-tune on real photos. **This is the plan to buy.**
- **Colab Pro+ (~$50/month)**: 500 units + background execution (runs survive a closed browser).
  Our checkpoint/resume design makes background execution redundant, and 500 units is ~10× more
  compute than Phase 3 needs. Not worth it here.

Suggested path: do the free-tier shakeout first (§4), buy Pro the same day the full run starts.

## 3. One-time setup

1. **Build the upload package** (on the Mac):
   ```bash
   sh scripts/make_colab_zip.sh        # → data/colab/tnc_rung2_colab.zip (~320 MB)
   ```
   One zip, mirroring the repo layout: the `src/vision` training kit + `data/split.json` +
   `strips_v2_2` (manifest + PNGs). Nothing else is needed on the Colab side — no git.
2. **Upload it to Drive**: go to [drive.google.com](https://drive.google.com), create a folder
   **`tnc`** in My Drive, drag `tnc_rung2_colab.zip` into it. (~5–15 min on a home connection;
   one-time — later sessions reuse it.)
3. **Open the notebook**: go to [colab.research.google.com](https://colab.research.google.com) →
   `Upload` → pick `notebooks/rung2_colab.ipynb` from this repo.
4. **Pick a GPU**: menu `Runtime → Change runtime type → Hardware accelerator`. Free tier: T4.
   Pro: L4 (best value) or A100 (fastest).

## 4. Running it (the notebook does all of this)

Run the cells top to bottom:

1. `nvidia-smi` — confirms which GPU you got.
2. Mount Drive (approve the permission popup).
3. Copy the zip **Drive → VM disk** and unzip there. This matters: training reads 18k PNGs
   per epoch, and the Drive mount is far too slow for a dataloader — data goes on the VM's local
   disk, only the ~200 MB checkpoints go the other way, to Drive.
4. `pip install` the three missing packages (torch is preinstalled).
5. **Shakeout** (~3 min, do this on the FREE tier before paying): 100 steps on 512 strips. It
   proves the whole chain — manifest, tokenizer extension (`+21 ids` in the log), augmentation
   workers, AMP, checkpoint write to Drive. The loss must fall; then check
   `MyDrive/tnc/rung2-shakeout/` exists in Drive.
6. **Full run**: defaults (`batch 8, lr 3e-5, 6000 steps` ≈ 2.9 epochs). On L4/A100 add
   `--batch-size 16`. Progress prints every 25 steps; val loss + checkpoints every 500
   (`best` = lowest val loss, `last` = resume point, both on Drive).
7. **Eval** the best checkpoint — the headline per-class AEU accidental accuracy.

**If the session disconnects** (it will, eventually): `Runtime → Reconnect`, rerun cells 1–4,
then the **resume** cell (`--resume` reloads model + optimizer + scheduler from
`MyDrive/tnc/rung2/last`). Keep the browser tab open and the machine awake during long runs on
free tier / Pro; only Pro+ runs survive a closed tab, and we don't need that.

## 5. What "done" looks like (and what to do with it)

- **Judge on `eval_omr.py`, not val loss**: the per-class accuracy over the 8 AEU accidentals is
  the Rung-2 headline (`docs/PHASE2.md` §5; SER + exact-match are secondary). It appends to
  `rung2/best/eval.jsonl` so runs are comparable.
- **Keep** (all already on Drive): `rung2/best/` (the weights — input to the ONNX export, which
  reuses the proven Rung-1.5 pipeline), `rung2/metrics.jsonl`, `eval.jsonl`.
- **Good result** → Rung 2 passes → Rung 3: real-photo collection + model-assisted labeling
  (`docs/PIPELINE.md` §3). **Poor accidental accuracy** after honest retries (LR within
  1e-5–5e-5, more steps, `--photo-share` sanity checks) → that was the planned trigger to evaluate
  the CRNN+CTC fallback (`ROADMAP.md` §1). *(Moot: Rung 2 passed first try; the fallback is retired.)*
- Typical knobs, in the order to try them: more steps (`--max-steps 10000 --resume`), LR 1e-5 or
  5e-5 (fresh run), `--batch-size 16` with A100. Change ONE thing per run; `metrics.jsonl` +
  `eval.jsonl` are the comparison record.
