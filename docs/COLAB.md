# Rung 2 on Google Colab — first-timer's guide

> How to run the scaled fine-tune (`src/vision/train.py`) on Colab, written for someone who has
> never used Colab. The ready-made notebook is **`notebooks/rung2_colab.ipynb`**; this doc is the
> context around it: what Colab is, which plan to buy, how not to lose a run, and what "done"
> looks like.

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
   `strips_v2_1` (manifest + PNGs). Nothing else is needed on the Colab side — no git.
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
  1e-5–5e-5, more steps, `--photo-share` sanity checks) → that is the planned trigger to evaluate
  the CRNN+CTC fallback (`ROADMAP.md` §1).
- Typical knobs, in the order to try them: more steps (`--max-steps 10000 --resume`), LR 1e-5 or
  5e-5 (fresh run), `--batch-size 16` with A100. Change ONE thing per run; `metrics.jsonl` +
  `eval.jsonl` are the comparison record.
