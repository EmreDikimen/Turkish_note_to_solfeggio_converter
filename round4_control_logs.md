# Round 4, CONTROL arm — the stage-2 log (raw)

purpose: the verbatim console output of Round 4's control arm (old vocabulary, strips_h1:4, 4,000 steps), kept as that run's own record
audience: anyone re-reading how the vocabulary A/B's control actually trained
updated: 2026-09-16

> Stage 1 is Round 3's `r3-final-stage1/best`, reused. Read beside
> [src/vision/MODEL_EVAL.md](src/vision/MODEL_EVAL.md). ⛔ Its `EDITS` column is in OLD ids: never
> set it beside the H arm's.

```text
/content/tnc
   selection decode budget: 100 ids
   real pool data/real/rung3/strips_h1: 4011 train x4 / 441 val strips
   exam-disjointness OK: 600 real pieces, 0 in the 33-piece exam
   every-share -> 0.150 of synthetic (was 0.244); pool: every=8799 carry=27233 real=16044; expected per-epoch mix: every 10.4% of all draws
   selection: left out 29 of 288 strips (5 pieces whose song is in the synthetic TRAIN split)
== data: 52076 train / 4763 synth-val / 441 real-val strips / 259 SELECTION (free-running edits); augment=on (screenshot 0.65 / photo 0.35 / scan 0.00); device=cuda
== loading /content/drive/MyDrive/tnc/r3-final-stage1/best ...
Loading weights: 100% 483/483 [00:08<00:00, 58.77it/s]
   vocab: old (+0 tokens -> 100 ids)
== training to step 4000 (batch 16 x accum 1, lr 1e-05)
   step     1  loss 0.0092  lr 2.00e-07  (3.13s/step)
   step    25  loss 0.0783  lr 2.60e-06  (0.98s/step)
   step    50  loss 0.0119  lr 5.10e-06  (0.94s/step)
   step    75  loss 0.0189  lr 7.60e-06  (0.93s/step)
   step   100  loss 0.0152  lr 1.00e-05  (0.93s/step)
   step   125  loss 0.0050  lr 1.00e-05  (0.93s/step)
   step   150  loss 0.0020  lr 1.00e-05  (0.92s/step)
   step   175  loss 0.0205  lr 9.99e-06  (0.92s/step)
   step   200  loss 0.0062  lr 9.98e-06  (0.92s/step)
   step   225  loss 0.0182  lr 9.97e-06  (0.92s/step)
   step   250  loss 0.0143  lr 9.96e-06  (0.92s/step)
   step   250  VAL loss 0.0114  real 0.0307  mix 0.0131  EDITS 532/259 strips (exact 165)  (new best)  (new best-real)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.21s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.30s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.15s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.31s/it]
   step   275  loss 0.0211  lr 9.95e-06  (1.72s/step)
   step   300  loss 0.0267  lr 9.94e-06  (1.65s/step)
   step   325  loss 0.0138  lr 9.92e-06  (1.60s/step)
   step   350  loss 0.0016  lr 9.90e-06  (1.55s/step)
   step   375  loss 0.0140  lr 9.88e-06  (1.51s/step)
   step   400  loss 0.0013  lr 9.85e-06  (1.47s/step)
   step   425  loss 0.0003  lr 9.83e-06  (1.44s/step)
   step   450  loss 0.0015  lr 9.80e-06  (1.41s/step)
   step   475  loss 0.0101  lr 9.77e-06  (1.38s/step)
   step   500  loss 0.0054  lr 9.74e-06  (1.36s/step)
   step   500  VAL loss 0.0102  real 0.0255  mix 0.0115  EDITS 461/259 strips (exact 183)  (new best)  (new best-real)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.29s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.86s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.28s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.75s/it]
   step   525  loss 0.0027  lr 9.71e-06  (1.75s/step)
   step   550  loss 0.0074  lr 9.68e-06  (1.71s/step)
   step   575  loss 0.0093  lr 9.64e-06  (1.67s/step)
   step   600  loss 0.0199  lr 9.60e-06  (1.66s/step)
   step   625  loss 0.0091  lr 9.56e-06  (1.63s/step)
   step   650  loss 0.0006  lr 9.52e-06  (1.60s/step)
   step   675  loss 0.0007  lr 9.47e-06  (1.57s/step)
   step   700  loss 0.0053  lr 9.43e-06  (1.55s/step)
   step   725  loss 0.0078  lr 9.38e-06  (1.53s/step)
   step   750  loss 0.0067  lr 9.33e-06  (1.51s/step)
   step   750  VAL loss 0.0106  real 0.0230  mix 0.0116  EDITS 447/259 strips (exact 181)  (new best-real)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.08s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.86s/it]
   step   775  loss 0.0168  lr 9.28e-06  (1.77s/step)
   step   800  loss 0.0104  lr 9.23e-06  (1.74s/step)
   step   825  loss 0.0092  lr 9.17e-06  (1.72s/step)
   step   850  loss 0.0124  lr 9.11e-06  (1.70s/step)
   step   875  loss 0.0024  lr 9.06e-06  (1.68s/step)
   step   900  loss 0.0154  lr 9.00e-06  (1.66s/step)
   step   925  loss 0.0283  lr 8.94e-06  (1.64s/step)
   step   950  loss 0.0022  lr 8.87e-06  (1.63s/step)
   step   975  loss 0.0169  lr 8.81e-06  (1.61s/step)
   step  1000  loss 0.0080  lr 8.74e-06  (1.60s/step)
   step  1000  VAL loss 0.0120  real 0.0192  mix 0.0126  EDITS 466/259 strips (exact 183)  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
Writing model shards: 100% 1/1 [00:04<00:00,  4.30s/it]
   step  1025  loss 0.0016  lr 8.68e-06  (1.79s/step)
   step  1050  loss 0.0003  lr 8.61e-06  (1.77s/step)
   step  1075  loss 0.0031  lr 8.54e-06  (1.77s/step)
   step  1100  loss 0.0030  lr 8.46e-06  (1.75s/step)
   step  1125  loss 0.0085  lr 8.39e-06  (1.73s/step)
   step  1150  loss 0.0037  lr 8.32e-06  (1.72s/step)
   step  1175  loss 0.0194  lr 8.24e-06  (1.70s/step)
   step  1200  loss 0.0076  lr 8.16e-06  (1.69s/step)
   step  1225  loss 0.0007  lr 8.08e-06  (1.68s/step)
   step  1250  loss 0.0193  lr 8.00e-06  (1.66s/step)
   step  1250  VAL loss 0.0108  real 0.0207  mix 0.0117  EDITS 442/259 strips (exact 190)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.26s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.28s/it]
   step  1275  loss 0.0034  lr 7.92e-06  (1.82s/step)
   step  1300  loss 0.0005  lr 7.84e-06  (1.80s/step)
   step  1325  loss 0.0215  lr 7.76e-06  (1.79s/step)
   step  1350  loss 0.0013  lr 7.67e-06  (1.78s/step)
   step  1375  loss 0.0144  lr 7.59e-06  (1.76s/step)
   step  1400  loss 0.0092  lr 7.50e-06  (1.75s/step)
   step  1425  loss 0.0039  lr 7.41e-06  (1.73s/step)
   step  1450  loss 0.0094  lr 7.32e-06  (1.73s/step)
   step  1475  loss 0.0030  lr 7.23e-06  (1.72s/step)
   step  1500  loss 0.0013  lr 7.14e-06  (1.70s/step)
   step  1500  VAL loss 0.0103  real 0.0202  mix 0.0111  EDITS 434/259 strips (exact 190)  (new best)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.26s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.27s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.29s/it]
   step  1525  loss 0.0125  lr 7.05e-06  (1.84s/step)
   step  1550  loss 0.0006  lr 6.96e-06  (1.83s/step)
   step  1575  loss 0.0003  lr 6.87e-06  (1.81s/step)
   step  1600  loss 0.0010  lr 6.77e-06  (1.80s/step)
   step  1625  loss 0.0082  lr 6.68e-06  (1.79s/step)
   step  1650  loss 0.0018  lr 6.58e-06  (1.78s/step)
   step  1675  loss 0.0021  lr 6.49e-06  (1.77s/step)
   step  1700  loss 0.0004  lr 6.39e-06  (1.76s/step)
   step  1725  loss 0.0095  lr 6.29e-06  (1.75s/step)
   step  1750  loss 0.0018  lr 6.20e-06  (1.73s/step)
   step  1750  VAL loss 0.0111  real 0.0189  mix 0.0117  EDITS 434/259 strips (exact 190)  (new best-real)
Writing model shards: 100% 1/1 [00:02<00:00,  2.61s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.90s/it]
   step  1775  loss 0.0030  lr 6.10e-06  (1.84s/step)
   step  1800  loss 0.0098  lr 6.00e-06  (1.82s/step)
   step  1825  loss 0.0015  lr 5.90e-06  (1.81s/step)
   step  1850  loss 0.0002  lr 5.80e-06  (1.80s/step)
   step  1875  loss 0.0003  lr 5.70e-06  (1.79s/step)
   step  1900  loss 0.0008  lr 5.60e-06  (1.78s/step)
   step  1925  loss 0.0003  lr 5.50e-06  (1.77s/step)
   step  1950  loss 0.0034  lr 5.40e-06  (1.76s/step)
   step  1975  loss 0.0008  lr 5.30e-06  (1.75s/step)
   step  2000  loss 0.0083  lr 5.20e-06  (1.74s/step)
   step  2000  VAL loss 0.0107  real 0.0192  mix 0.0115  EDITS 415/259 strips (exact 191)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.59s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.03s/it]
   step  2025  loss 0.0111  lr 5.10e-06  (1.83s/step)
   step  2050  loss 0.0304  lr 5.00e-06  (1.82s/step)
   step  2075  loss 0.0005  lr 4.90e-06  (1.81s/step)
   step  2100  loss 0.0495  lr 4.80e-06  (1.80s/step)
   step  2125  loss 0.0020  lr 4.70e-06  (1.79s/step)
   step  2150  loss 0.0038  lr 4.60e-06  (1.78s/step)
   step  2175  loss 0.0004  lr 4.50e-06  (1.77s/step)
   step  2200  loss 0.0004  lr 4.40e-06  (1.77s/step)
   step  2225  loss 0.0067  lr 4.30e-06  (1.76s/step)
   step  2250  loss 0.0128  lr 4.20e-06  (1.75s/step)
   step  2250  VAL loss 0.0109  real 0.0187  mix 0.0116  EDITS 421/259 strips (exact 188)  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.08s/it]
   step  2275  loss 0.0032  lr 4.10e-06  (1.83s/step)
   step  2300  loss 0.0101  lr 4.00e-06  (1.82s/step)
   step  2325  loss 0.0067  lr 3.90e-06  (1.81s/step)
   step  2350  loss 0.0013  lr 3.80e-06  (1.80s/step)
   step  2375  loss 0.0170  lr 3.71e-06  (1.79s/step)
   step  2400  loss 0.0036  lr 3.61e-06  (1.78s/step)
   step  2425  loss 0.0102  lr 3.51e-06  (1.78s/step)
   step  2450  loss 0.0087  lr 3.42e-06  (1.77s/step)
   step  2475  loss 0.0003  lr 3.32e-06  (1.76s/step)
   step  2500  loss 0.0073  lr 3.23e-06  (1.75s/step)
   step  2500  VAL loss 0.0119  real 0.0196  mix 0.0126  EDITS 425/259 strips (exact 187)
Writing model shards: 100% 1/1 [00:01<00:00,  1.22s/it]
   step  2525  loss 0.0145  lr 3.13e-06  (1.82s/step)
   step  2550  loss 0.0003  lr 3.04e-06  (1.82s/step)
   step  2575  loss 0.0005  lr 2.95e-06  (1.81s/step)
   step  2600  loss 0.0013  lr 2.86e-06  (1.80s/step)
   step  2625  loss 0.0011  lr 2.77e-06  (1.79s/step)
   step  2650  loss 0.0017  lr 2.68e-06  (1.78s/step)
   step  2675  loss 0.0003  lr 2.59e-06  (1.77s/step)
   step  2700  loss 0.0002  lr 2.50e-06  (1.77s/step)
   step  2725  loss 0.0003  lr 2.41e-06  (1.76s/step)
   step  2750  loss 0.0001  lr 2.33e-06  (1.75s/step)
   step  2750  VAL loss 0.0116  real 0.0191  mix 0.0122  EDITS 396/259 strips (exact 193)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.28s/it]
   step  2775  loss 0.0013  lr 2.24e-06  (1.82s/step)
   step  2800  loss 0.0195  lr 2.16e-06  (1.81s/step)
   step  2825  loss 0.0001  lr 2.08e-06  (1.81s/step)
   step  2850  loss 0.0068  lr 2.00e-06  (1.80s/step)
   step  2875  loss 0.0004  lr 1.92e-06  (1.79s/step)
   step  2900  loss 0.0038  lr 1.84e-06  (1.79s/step)
   step  2925  loss 0.0103  lr 1.76e-06  (1.78s/step)
   step  2950  loss 0.0003  lr 1.68e-06  (1.78s/step)
   step  2975  loss 0.0007  lr 1.61e-06  (1.77s/step)
   step  3000  loss 0.0015  lr 1.54e-06  (1.76s/step)
   step  3000  VAL loss 0.0113  real 0.0187  mix 0.0119  EDITS 407/259 strips (exact 190)
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
   step  3025  loss 0.0002  lr 1.46e-06  (1.82s/step)
   step  3050  loss 0.0004  lr 1.39e-06  (1.81s/step)
   step  3075  loss 0.0012  lr 1.32e-06  (1.81s/step)
   step  3100  loss 0.0006  lr 1.26e-06  (1.80s/step)
   step  3125  loss 0.0003  lr 1.19e-06  (1.79s/step)
   step  3150  loss 0.0045  lr 1.13e-06  (1.79s/step)
   step  3175  loss 0.0028  lr 1.06e-06  (1.78s/step)
   step  3200  loss 0.0050  lr 1.00e-06  (1.77s/step)
   step  3225  loss 0.0070  lr 9.43e-07  (1.77s/step)
   step  3250  loss 0.0007  lr 8.85e-07  (1.76s/step)
   step  3250  VAL loss 0.0114  real 0.0187  mix 0.0120  EDITS 410/259 strips (exact 194)
Writing model shards: 100% 1/1 [00:01<00:00,  1.31s/it]
   step  3275  loss 0.0012  lr 8.29e-07  (1.81s/step)
   step  3300  loss 0.0010  lr 7.74e-07  (1.81s/step)
   step  3325  loss 0.0001  lr 7.21e-07  (1.80s/step)
   step  3350  loss 0.0006  lr 6.70e-07  (1.80s/step)
   step  3375  loss 0.0114  lr 6.20e-07  (1.79s/step)
   step  3400  loss 0.0002  lr 5.73e-07  (1.78s/step)
   step  3425  loss 0.0013  lr 5.27e-07  (1.78s/step)
   step  3450  loss 0.0005  lr 4.83e-07  (1.77s/step)
   step  3475  loss 0.0004  lr 4.41e-07  (1.76s/step)
   step  3500  loss 0.0112  lr 4.00e-07  (1.76s/step)
   step  3500  VAL loss 0.0113  real 0.0189  mix 0.0120  EDITS 405/259 strips (exact 196)
Writing model shards: 100% 1/1 [00:01<00:00,  1.27s/it]
   step  3525  loss 0.0013  lr 3.62e-07  (1.81s/step)
   step  3550  loss 0.0017  lr 3.25e-07  (1.80s/step)
   step  3575  loss 0.0084  lr 2.90e-07  (1.80s/step)
   step  3600  loss 0.0127  lr 2.57e-07  (1.79s/step)
   step  3625  loss 0.0002  lr 2.26e-07  (1.79s/step)
   step  3650  loss 0.0002  lr 1.97e-07  (1.78s/step)
   step  3675  loss 0.0086  lr 1.70e-07  (1.77s/step)
   step  3700  loss 0.0016  lr 1.45e-07  (1.77s/step)
   step  3725  loss 0.0004  lr 1.22e-07  (1.76s/step)
   step  3750  loss 0.0014  lr 1.01e-07  (1.76s/step)
   step  3750  VAL loss 0.0113  real 0.0188  mix 0.0120  EDITS 410/259 strips (exact 195)
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
   step  3775  loss 0.0018  lr 8.19e-08  (1.80s/step)
   step  3800  loss 0.0085  lr 6.47e-08  (1.80s/step)
   step  3825  loss 0.0006  lr 4.96e-08  (1.79s/step)
   step  3850  loss 0.0013  lr 3.65e-08  (1.79s/step)
   step  3875  loss 0.0020  lr 2.53e-08  (1.78s/step)
   step  3900  loss 0.0002  lr 1.62e-08  (1.78s/step)
   step  3925  loss 0.0079  lr 9.12e-09  (1.77s/step)
   step  3950  loss 0.0002  lr 4.06e-09  (1.77s/step)
   step  3975  loss 0.0005  lr 1.01e-09  (1.76s/step)
   step  4000  loss 0.0070  lr 0.00e+00  (1.76s/step)
   step  4000  VAL loss 0.0113  real 0.0189  mix 0.0120  EDITS 410/259 strips (exact 195)
Writing model shards: 100% 1/1 [00:01<00:00,  1.34s/it]

== done: 4000 steps, best val loss 0.0111, best REAL val 0.0187, fewest EDITS 396
   checkpoints: /content/drive/MyDrive/tnc/r4-ctl-stage2/best (lowest blended val loss — ~92% synthetic), /content/drive/MyDrive/tnc/r4-ctl-stage2/best-real (lowest REAL val loss), /content/drive/MyDrive/tnc/r4-ctl-stage2/last (resume point)
   /content/drive/MyDrive/tnc/r4-ctl-stage2/best-edits — fewest free-running corrections on 259 fixed strips. ⭐ This is the Round-4 pick; the two loss tags above are kept only so the run stays comparable with earlier ones.
   ⚠ Choose between them on _realval_v2 with paired_arm_score.py — never on these losses.
   next: .venv-ml/bin/python src/vision/eval_omr.py --checkpoint /content/drive/MyDrive/tnc/r4-ctl-stage2/best
```
