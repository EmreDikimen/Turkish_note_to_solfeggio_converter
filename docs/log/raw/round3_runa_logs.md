# Round 3, RUN A — the 4,000-step stage-2 log (raw)

purpose: the verbatim console output of run A's stage 2, kept as that run's own record
audience: anyone re-reading how the longer stage 2 actually trained
updated: 2026-09-01

Raw paste, unedited below this line. ⚠ Stage 1 is absent on purpose — run A reuses Round 3's
`r3-final-stage1/best`, which is what keeps stage-2 length the only variable. The reading of these
curves is in [src/vision/MODEL_EVAL.md](src/vision/MODEL_EVAL.md); do not re-derive it here.

---

/content/tnc
   real pool data/real/rung3/strips_b8: 3539 train x5 / 390 val strips
   exam-disjointness OK: 568 real pieces, 0 in the 33-piece exam
   every-share -> 0.150 of synthetic (was 0.244); pool: every=8799 carry=27233 real=17695; expected per-epoch mix: every 10.1% of all draws
== data: 53727 train / 4763 synth-val / 390 real-val strips; augment=on (screenshot 0.65 / photo 0.35 / scan 0.00); device=cuda
== loading /content/drive/MyDrive/tnc/r3-final-stage1/best ...
Loading weights: 100% 483/483 [00:18<00:00, 26.19it/s]
   vocab: +0 tokens -> 100 ids
== training to step 4000 (batch 16 x accum 1, lr 1e-05)
   step     1  loss 0.0307  lr 2.00e-07  (3.08s/step)
   step    25  loss 0.0175  lr 2.60e-06  (0.97s/step)
   step    50  loss 0.0056  lr 5.10e-06  (0.94s/step)
   step    75  loss 0.0164  lr 7.60e-06  (0.93s/step)
   step   100  loss 0.0028  lr 1.00e-05  (0.92s/step)
   step   125  loss 0.0163  lr 1.00e-05  (0.92s/step)
   step   150  loss 0.0115  lr 1.00e-05  (0.92s/step)
   step   175  loss 0.0263  lr 9.99e-06  (0.92s/step)
   step   200  loss 0.0021  lr 9.98e-06  (0.92s/step)
   step   225  loss 0.0071  lr 9.97e-06  (0.92s/step)
   step   250  loss 0.0283  lr 9.96e-06  (0.92s/step)
   step   250  VAL loss 0.0100  real 0.0297  mix 0.0115  (new best)  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.20s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
   step   275  loss 0.0047  lr 9.95e-06  (1.57s/step)
   step   300  loss 0.0104  lr 9.94e-06  (1.51s/step)
   step   325  loss 0.0115  lr 9.92e-06  (1.46s/step)
   step   350  loss 0.0018  lr 9.90e-06  (1.42s/step)
   step   375  loss 0.0110  lr 9.88e-06  (1.39s/step)
   step   400  loss 0.0204  lr 9.85e-06  (1.36s/step)
   step   425  loss 0.0061  lr 9.83e-06  (1.33s/step)
   step   450  loss 0.0117  lr 9.80e-06  (1.31s/step)
   step   475  loss 0.0225  lr 9.77e-06  (1.29s/step)
   step   500  loss 0.0022  lr 9.74e-06  (1.27s/step)
   step   500  VAL loss 0.0105  real 0.0254  mix 0.0117  (new best-real)
Writing model shards: 100% 1/1 [00:02<00:00,  2.73s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.15s/it]
   step   525  loss 0.0090  lr 9.71e-06  (1.63s/step)
   step   550  loss 0.0054  lr 9.68e-06  (1.60s/step)
   step   575  loss 0.0006  lr 9.64e-06  (1.61s/step)
   step   600  loss 0.0038  lr 9.60e-06  (1.58s/step)
   step   625  loss 0.0139  lr 9.56e-06  (1.55s/step)
   step   650  loss 0.0107  lr 9.52e-06  (1.53s/step)
   step   675  loss 0.0008  lr 9.47e-06  (1.50s/step)
   step   700  loss 0.0017  lr 9.43e-06  (1.48s/step)
   step   725  loss 0.0010  lr 9.38e-06  (1.46s/step)
   step   750  loss 0.0013  lr 9.33e-06  (1.44s/step)
   step   750  VAL loss 0.0144  real 0.0199  mix 0.0148  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.20s/it]
   step   775  loss 0.0327  lr 9.28e-06  (1.65s/step)
   step   800  loss 0.0008  lr 9.23e-06  (1.63s/step)
   step   825  loss 0.0006  lr 9.17e-06  (1.62s/step)
   step   850  loss 0.0355  lr 9.11e-06  (1.60s/step)
   step   875  loss 0.0002  lr 9.06e-06  (1.58s/step)
   step   900  loss 0.0049  lr 9.00e-06  (1.56s/step)
   step   925  loss 0.0031  lr 8.94e-06  (1.55s/step)
   step   950  loss 0.0160  lr 8.87e-06  (1.53s/step)
   step   975  loss 0.0088  lr 8.81e-06  (1.51s/step)
   step  1000  loss 0.0002  lr 8.74e-06  (1.50s/step)
   step  1000  VAL loss 0.0112  real 0.0207  mix 0.0119
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
   step  1025  loss 0.0017  lr 8.68e-06  (1.66s/step)
   step  1050  loss 0.0083  lr 8.61e-06  (1.64s/step)
   step  1075  loss 0.0341  lr 8.54e-06  (1.63s/step)
   step  1100  loss 0.0121  lr 8.46e-06  (1.62s/step)
   step  1125  loss 0.0015  lr 8.39e-06  (1.60s/step)
   step  1150  loss 0.0004  lr 8.32e-06  (1.59s/step)
   step  1175  loss 0.0104  lr 8.24e-06  (1.57s/step)
   step  1200  loss 0.0006  lr 8.16e-06  (1.56s/step)
   step  1225  loss 0.0065  lr 8.08e-06  (1.55s/step)
   step  1250  loss 0.0009  lr 8.00e-06  (1.53s/step)
   step  1250  VAL loss 0.0124  real 0.0215  mix 0.0131
   step  1275  loss 0.0216  lr 7.92e-06  (1.65s/step)
   step  1300  loss 0.0079  lr 7.84e-06  (1.64s/step)
   step  1325  loss 0.0026  lr 7.76e-06  (1.62s/step)
   step  1350  loss 0.0007  lr 7.67e-06  (1.61s/step)
   step  1375  loss 0.0130  lr 7.59e-06  (1.60s/step)
   step  1400  loss 0.0008  lr 7.50e-06  (1.59s/step)
   step  1425  loss 0.0010  lr 7.41e-06  (1.57s/step)
   step  1450  loss 0.0011  lr 7.32e-06  (1.56s/step)
   step  1475  loss 0.0045  lr 7.23e-06  (1.55s/step)
   step  1500  loss 0.0102  lr 7.14e-06  (1.54s/step)
   step  1500  VAL loss 0.0114  real 0.0186  mix 0.0119  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.16s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.63s/it]
   step  1525  loss 0.0042  lr 7.05e-06  (1.66s/step)
   step  1550  loss 0.0005  lr 6.96e-06  (1.66s/step)
   step  1575  loss 0.0003  lr 6.87e-06  (1.65s/step)
   step  1600  loss 0.0111  lr 6.77e-06  (1.64s/step)
   step  1625  loss 0.0176  lr 6.68e-06  (1.63s/step)
   step  1650  loss 0.0009  lr 6.58e-06  (1.62s/step)
   step  1675  loss 0.0014  lr 6.49e-06  (1.61s/step)
   step  1700  loss 0.0050  lr 6.39e-06  (1.60s/step)
   step  1725  loss 0.0011  lr 6.29e-06  (1.59s/step)
   step  1750  loss 0.0119  lr 6.20e-06  (1.58s/step)
   step  1750  VAL loss 0.0121  real 0.0194  mix 0.0127
   step  1775  loss 0.0047  lr 6.10e-06  (1.67s/step)
   step  1800  loss 0.0098  lr 6.00e-06  (1.66s/step)
   step  1825  loss 0.0005  lr 5.90e-06  (1.65s/step)
   step  1850  loss 0.0004  lr 5.80e-06  (1.64s/step)
   step  1875  loss 0.0012  lr 5.70e-06  (1.63s/step)
   step  1900  loss 0.0004  lr 5.60e-06  (1.62s/step)
   step  1925  loss 0.0018  lr 5.50e-06  (1.61s/step)
   step  1950  loss 0.0002  lr 5.40e-06  (1.60s/step)
   step  1975  loss 0.0016  lr 5.30e-06  (1.59s/step)
   step  2000  loss 0.0231  lr 5.20e-06  (1.58s/step)
   step  2000  VAL loss 0.0116  real 0.0183  mix 0.0121  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.21s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
   step  2025  loss 0.0128  lr 5.10e-06  (1.67s/step)
   step  2050  loss 0.0003  lr 5.00e-06  (1.67s/step)
   step  2075  loss 0.0020  lr 4.90e-06  (1.66s/step)
   step  2100  loss 0.0006  lr 4.80e-06  (1.66s/step)
   step  2125  loss 0.0003  lr 4.70e-06  (1.66s/step)
   step  2150  loss 0.0027  lr 4.60e-06  (1.65s/step)
   step  2175  loss 0.0178  lr 4.50e-06  (1.64s/step)
   step  2200  loss 0.0014  lr 4.40e-06  (1.63s/step)
   step  2225  loss 0.0120  lr 4.30e-06  (1.62s/step)
   step  2250  loss 0.0004  lr 4.20e-06  (1.62s/step)
   step  2250  VAL loss 0.0126  real 0.0181  mix 0.0131  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
   step  2275  loss 0.0006  lr 4.10e-06  (1.68s/step)
   step  2300  loss 0.0025  lr 4.00e-06  (1.68s/step)
   step  2325  loss 0.0004  lr 3.90e-06  (1.67s/step)
   step  2350  loss 0.0012  lr 3.80e-06  (1.66s/step)
   step  2375  loss 0.0006  lr 3.71e-06  (1.65s/step)
   step  2400  loss 0.0006  lr 3.61e-06  (1.65s/step)
   step  2425  loss 0.0096  lr 3.51e-06  (1.64s/step)
   step  2450  loss 0.0098  lr 3.42e-06  (1.63s/step)
   step  2475  loss 0.0029  lr 3.32e-06  (1.62s/step)
   step  2500  loss 0.0018  lr 3.23e-06  (1.62s/step)
   step  2500  VAL loss 0.0125  real 0.0171  mix 0.0128  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.15s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.97s/it]
   step  2525  loss 0.0029  lr 3.13e-06  (1.69s/step)
   step  2550  loss 0.0005  lr 3.04e-06  (1.69s/step)
   step  2575  loss 0.0113  lr 2.95e-06  (1.68s/step)
   step  2600  loss 0.0189  lr 2.86e-06  (1.67s/step)
   step  2625  loss 0.0005  lr 2.77e-06  (1.66s/step)
   step  2650  loss 0.0062  lr 2.68e-06  (1.66s/step)
   step  2675  loss 0.0002  lr 2.59e-06  (1.65s/step)
   step  2700  loss 0.0001  lr 2.50e-06  (1.65s/step)
   step  2725  loss 0.0089  lr 2.41e-06  (1.64s/step)
   step  2750  loss 0.0003  lr 2.33e-06  (1.63s/step)
   step  2750  VAL loss 0.0115  real 0.0175  mix 0.0120
   step  2775  loss 0.0006  lr 2.24e-06  (1.69s/step)
   step  2800  loss 0.0006  lr 2.16e-06  (1.68s/step)
   step  2825  loss 0.0032  lr 2.08e-06  (1.67s/step)
   step  2850  loss 0.0038  lr 2.00e-06  (1.67s/step)
   step  2875  loss 0.0007  lr 1.92e-06  (1.66s/step)
   step  2900  loss 0.0042  lr 1.84e-06  (1.65s/step)
   step  2925  loss 0.0006  lr 1.76e-06  (1.65s/step)
   step  2950  loss 0.0004  lr 1.68e-06  (1.64s/step)
   step  2975  loss 0.0002  lr 1.61e-06  (1.64s/step)
   step  3000  loss 0.0141  lr 1.54e-06  (1.63s/step)
   step  3000  VAL loss 0.0114  real 0.0180  mix 0.0119
Writing model shards: 100% 1/1 [00:01<00:00,  1.20s/it]
   step  3025  loss 0.0008  lr 1.46e-06  (1.68s/step)
   step  3050  loss 0.0024  lr 1.39e-06  (1.67s/step)
   step  3075  loss 0.0022  lr 1.32e-06  (1.67s/step)
   step  3100  loss 0.0007  lr 1.26e-06  (1.67s/step)
   step  3125  loss 0.0005  lr 1.19e-06  (1.66s/step)
   step  3150  loss 0.0005  lr 1.13e-06  (1.65s/step)
   step  3175  loss 0.0008  lr 1.06e-06  (1.65s/step)
   step  3200  loss 0.0006  lr 1.00e-06  (1.64s/step)
   step  3225  loss 0.0023  lr 9.43e-07  (1.64s/step)
   step  3250  loss 0.0009  lr 8.85e-07  (1.63s/step)
   step  3250  VAL loss 0.0115  real 0.0179  mix 0.0120
   step  3275  loss 0.0042  lr 8.29e-07  (1.68s/step)
   step  3300  loss 0.0005  lr 7.74e-07  (1.67s/step)
   step  3325  loss 0.0067  lr 7.21e-07  (1.67s/step)
   step  3350  loss 0.0050  lr 6.70e-07  (1.66s/step)
   step  3375  loss 0.0004  lr 6.20e-07  (1.65s/step)
   step  3400  loss 0.0002  lr 5.73e-07  (1.65s/step)
   step  3425  loss 0.0007  lr 5.27e-07  (1.64s/step)
   step  3450  loss 0.0013  lr 4.83e-07  (1.64s/step)
   step  3475  loss 0.0030  lr 4.41e-07  (1.63s/step)
   step  3500  loss 0.0124  lr 4.00e-07  (1.63s/step)
   step  3500  VAL loss 0.0114  real 0.0178  mix 0.0119
Writing model shards: 100% 1/1 [00:01<00:00,  1.18s/it]
   step  3525  loss 0.0050  lr 3.62e-07  (1.67s/step)
   step  3550  loss 0.0012  lr 3.25e-07  (1.67s/step)
   step  3575  loss 0.0002  lr 2.90e-07  (1.67s/step)
   step  3600  loss 0.0026  lr 2.57e-07  (1.66s/step)
   step  3625  loss 0.0006  lr 2.26e-07  (1.66s/step)
   step  3650  loss 0.0002  lr 1.97e-07  (1.65s/step)
   step  3675  loss 0.0004  lr 1.70e-07  (1.65s/step)
   step  3700  loss 0.0008  lr 1.45e-07  (1.64s/step)
   step  3725  loss 0.0007  lr 1.22e-07  (1.64s/step)
   step  3750  loss 0.0029  lr 1.01e-07  (1.63s/step)
   step  3750  VAL loss 0.0114  real 0.0177  mix 0.0118
   step  3775  loss 0.0105  lr 8.19e-08  (1.67s/step)
   step  3800  loss 0.0123  lr 6.47e-08  (1.67s/step)
   step  3825  loss 0.0004  lr 4.96e-08  (1.66s/step)
   step  3850  loss 0.0003  lr 3.65e-08  (1.66s/step)
   step  3875  loss 0.0007  lr 2.53e-08  (1.65s/step)
   step  3900  loss 0.0040  lr 1.62e-08  (1.65s/step)
   step  3925  loss 0.0009  lr 9.12e-09  (1.64s/step)
   step  3950  loss 0.0037  lr 4.06e-09  (1.64s/step)
   step  3975  loss 0.0156  lr 1.01e-09  (1.63s/step)
   step  4000  loss 0.0106  lr 0.00e+00  (1.63s/step)
   step  4000  VAL loss 0.0114  real 0.0177  mix 0.0118
Writing model shards: 100% 1/1 [00:01<00:00,  1.19s/it]

== done: 4000 steps, best val loss 0.0115, best REAL val 0.0171
   checkpoints: /content/drive/MyDrive/tnc/r3-r3a-stage2/best (lowest blended val loss — ~92% synthetic), /content/drive/MyDrive/tnc/r3-r3a-stage2/best-real (lowest REAL val loss), /content/drive/MyDrive/tnc/r3-r3a-stage2/last (resume point)
   ⚠ Choose between them on _realval_v2 with paired_arm_score.py — never on these losses.
   next: .venv-ml/bin/python src/vision/eval_omr.py --checkpoint /content/drive/MyDrive/tnc/r3-r3a-stage2/best