# Round 3, RUN B — the 5,000-step stage-2 log (raw)

purpose: the verbatim console output of run B's stage 2, kept as that run's own record
audience: anyone re-reading how the two-pool run actually trained
updated: 2026-09-02

Raw paste, unedited below this line. ⚠ Stage 1 is absent on purpose — run B reuses Round 3's
`r3-final-stage1/best`, the same one run A starts from. ⛔ **Its `real` column is NOT comparable with
run A's**: two real pools mean two held-out sets, so this run evaluates on 560 strips (170 of them
retired-crop) against run A's 390. The reading of these curves is in
[src/vision/MODEL_EVAL.md](src/vision/MODEL_EVAL.md); do not re-derive it here.

---

/content/tnc
   real pool data/real/rung3/strips_b8: 3539 train x4 / 390 val strips
   real pool data/real/rung3/strips_oldhuman: 1238 train x4 / 170 val strips
   exam-disjointness OK: 628 real pieces, 0 in the 33-piece exam
   every-share -> 0.150 of synthetic (was 0.244); pool: every=8799 carry=27233 real=19108; expected per-epoch mix: every 9.8% of all draws
== data: 55140 train / 4763 synth-val / 560 real-val strips; augment=on (screenshot 0.65 / photo 0.35 / scan 0.00); device=cuda
== loading /content/drive/MyDrive/tnc/r3-final-stage1/best ...
Loading weights: 100% 483/483 [00:06<00:00, 77.98it/s] 
   vocab: +0 tokens -> 100 ids
== training to step 5000 (batch 16 x accum 1, lr 1e-05)
   step     1  loss 0.0570  lr 2.00e-07  (3.32s/step)
   step    25  loss 0.0506  lr 2.60e-06  (0.99s/step)
   step    50  loss 0.0228  lr 5.10e-06  (0.95s/step)
   step    75  loss 0.0526  lr 7.60e-06  (0.94s/step)
   step   100  loss 0.0017  lr 1.00e-05  (0.93s/step)
   step   125  loss 0.0029  lr 1.00e-05  (0.93s/step)
   step   150  loss 0.0004  lr 1.00e-05  (0.92s/step)
   step   175  loss 0.0223  lr 9.99e-06  (0.92s/step)
   step   200  loss 0.0196  lr 9.99e-06  (0.92s/step)
   step   225  loss 0.0025  lr 9.98e-06  (0.92s/step)
   step   250  loss 0.0021  lr 9.98e-06  (0.92s/step)
   step   250  VAL loss 0.0093  real 0.0458  mix 0.0131  (new best)  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.29s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.21s/it]
Writing model shards: 100% 1/1 [00:00<00:00,  1.02it/s]
   step   275  loss 0.0101  lr 9.97e-06  (1.62s/step)
   step   300  loss 0.0011  lr 9.96e-06  (1.56s/step)
   step   325  loss 0.0049  lr 9.95e-06  (1.51s/step)
   step   350  loss 0.0318  lr 9.94e-06  (1.47s/step)
   step   375  loss 0.0022  lr 9.92e-06  (1.43s/step)
   step   400  loss 0.0019  lr 9.91e-06  (1.40s/step)
   step   425  loss 0.0180  lr 9.89e-06  (1.37s/step)
   step   450  loss 0.0041  lr 9.87e-06  (1.34s/step)
   step   475  loss 0.0050  lr 9.86e-06  (1.32s/step)
   step   500  loss 0.0027  lr 9.84e-06  (1.30s/step)
   step   500  VAL loss 0.0084  real 0.0403  mix 0.0118  (new best)  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.16s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.59s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.70s/it]
   step   525  loss 0.0220  lr 9.82e-06  (1.68s/step)
   step   550  loss 0.0381  lr 9.79e-06  (1.65s/step)
   step   575  loss 0.0115  lr 9.77e-06  (1.62s/step)
   step   600  loss 0.0024  lr 9.75e-06  (1.59s/step)
   step   625  loss 0.0081  lr 9.72e-06  (1.56s/step)
   step   650  loss 0.0082  lr 9.69e-06  (1.54s/step)
   step   675  loss 0.0167  lr 9.66e-06  (1.55s/step)
   step   700  loss 0.0049  lr 9.63e-06  (1.53s/step)
   step   725  loss 0.0011  lr 9.60e-06  (1.52s/step)
   step   750  loss 0.0036  lr 9.57e-06  (1.50s/step)
   step   750  VAL loss 0.0071  real 0.0383  mix 0.0104  (new best)  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.35s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.88s/it]
   step   775  loss 0.0047  lr 9.54e-06  (1.75s/step)
   step   800  loss 0.0011  lr 9.50e-06  (1.72s/step)
   step   825  loss 0.0238  lr 9.47e-06  (1.70s/step)
   step   850  loss 0.0135  lr 9.43e-06  (1.68s/step)
   step   875  loss 0.0072  lr 9.40e-06  (1.66s/step)
   step   900  loss 0.0225  lr 9.36e-06  (1.63s/step)
   step   925  loss 0.0092  lr 9.32e-06  (1.62s/step)
   step   950  loss 0.0013  lr 9.28e-06  (1.60s/step)
   step   975  loss 0.0035  lr 9.23e-06  (1.59s/step)
   step  1000  loss 0.0131  lr 9.19e-06  (1.58s/step)
   step  1000  VAL loss 0.0079  real 0.0370  mix 0.0109  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.21s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.95s/it]
   step  1025  loss 0.0046  lr 9.15e-06  (1.74s/step)
   step  1050  loss 0.0190  lr 9.10e-06  (1.72s/step)
   step  1075  loss 0.0016  lr 9.05e-06  (1.71s/step)
   step  1100  loss 0.0077  lr 9.01e-06  (1.69s/step)
   step  1125  loss 0.0008  lr 8.96e-06  (1.67s/step)
   step  1150  loss 0.0378  lr 8.91e-06  (1.65s/step)
   step  1175  loss 0.0413  lr 8.86e-06  (1.64s/step)
   step  1200  loss 0.0122  lr 8.81e-06  (1.64s/step)
   step  1225  loss 0.0109  lr 8.75e-06  (1.63s/step)
   step  1250  loss 0.0067  lr 8.70e-06  (1.61s/step)
   step  1250  VAL loss 0.0075  real 0.0343  mix 0.0103  (new best)  (new best-real)
Writing model shards: 100% 1/1 [00:02<00:00,  2.15s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.74s/it]
Writing model shards: 100% 1/1 [00:12<00:00, 12.29s/it]
   step  1275  loss 0.0036  lr 8.65e-06  (1.76s/step)
   step  1300  loss 0.0058  lr 8.59e-06  (1.74s/step)
   step  1325  loss 0.0004  lr 8.54e-06  (1.73s/step)
   step  1350  loss 0.0184  lr 8.48e-06  (1.71s/step)
   step  1375  loss 0.0109  lr 8.42e-06  (1.70s/step)
   step  1400  loss 0.0070  lr 8.36e-06  (1.68s/step)
   step  1425  loss 0.0012  lr 8.30e-06  (1.67s/step)
   step  1450  loss 0.0008  lr 8.24e-06  (1.66s/step)
   step  1475  loss 0.0097  lr 8.18e-06  (1.64s/step)
   step  1500  loss 0.0039  lr 8.12e-06  (1.64s/step)
   step  1500  VAL loss 0.0077  real 0.0369  mix 0.0107
Writing model shards: 100% 1/1 [00:01<00:00,  1.21s/it]
   step  1525  loss 0.0319  lr 8.05e-06  (1.74s/step)
   step  1550  loss 0.0057  lr 7.99e-06  (1.73s/step)
   step  1575  loss 0.0146  lr 7.93e-06  (1.72s/step)
   step  1600  loss 0.0008  lr 7.86e-06  (1.71s/step)
   step  1625  loss 0.0015  lr 7.79e-06  (1.70s/step)
   step  1650  loss 0.0039  lr 7.73e-06  (1.68s/step)
   step  1675  loss 0.0037  lr 7.66e-06  (1.67s/step)
   step  1700  loss 0.0143  lr 7.59e-06  (1.66s/step)
   step  1725  loss 0.0029  lr 7.52e-06  (1.65s/step)
   step  1750  loss 0.0283  lr 7.45e-06  (1.64s/step)
   step  1750  VAL loss 0.0081  real 0.0379  mix 0.0112
Writing model shards: 100% 1/1 [00:01<00:00,  1.22s/it]
   step  1775  loss 0.0023  lr 7.38e-06  (1.73s/step)
   step  1800  loss 0.0008  lr 7.31e-06  (1.72s/step)
   step  1825  loss 0.0058  lr 7.24e-06  (1.71s/step)
   step  1850  loss 0.0006  lr 7.17e-06  (1.70s/step)
   step  1875  loss 0.0039  lr 7.10e-06  (1.69s/step)
   step  1900  loss 0.0031  lr 7.02e-06  (1.68s/step)
   step  1925  loss 0.0195  lr 6.95e-06  (1.67s/step)
   step  1950  loss 0.0101  lr 6.88e-06  (1.66s/step)
   step  1975  loss 0.0122  lr 6.80e-06  (1.65s/step)
   step  2000  loss 0.0119  lr 6.73e-06  (1.64s/step)
   step  2000  VAL loss 0.0060  real 0.0376  mix 0.0093  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.18s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.64s/it]
   step  2025  loss 0.0005  lr 6.65e-06  (1.73s/step)
   step  2050  loss 0.0035  lr 6.58e-06  (1.72s/step)
   step  2075  loss 0.0015  lr 6.50e-06  (1.71s/step)
   step  2100  loss 0.0060  lr 6.42e-06  (1.70s/step)
   step  2125  loss 0.0011  lr 6.35e-06  (1.70s/step)
   step  2150  loss 0.0019  lr 6.27e-06  (1.69s/step)
   step  2175  loss 0.0041  lr 6.19e-06  (1.68s/step)
   step  2200  loss 0.0091  lr 6.11e-06  (1.67s/step)
   step  2225  loss 0.0032  lr 6.03e-06  (1.66s/step)
   step  2250  loss 0.0005  lr 5.96e-06  (1.65s/step)
   step  2250  VAL loss 0.0058  real 0.0385  mix 0.0092  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.22s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.47s/it]
   step  2275  loss 0.0014  lr 5.88e-06  (1.73s/step)
   step  2300  loss 0.0283  lr 5.80e-06  (1.72s/step)
   step  2325  loss 0.0029  lr 5.72e-06  (1.72s/step)
   step  2350  loss 0.0006  lr 5.64e-06  (1.71s/step)
   step  2375  loss 0.0007  lr 5.56e-06  (1.70s/step)
   step  2400  loss 0.0264  lr 5.48e-06  (1.69s/step)
   step  2425  loss 0.0043  lr 5.40e-06  (1.68s/step)
   step  2450  loss 0.0049  lr 5.32e-06  (1.68s/step)
   step  2475  loss 0.0006  lr 5.24e-06  (1.67s/step)
   step  2500  loss 0.0063  lr 5.16e-06  (1.66s/step)
   step  2500  VAL loss 0.0060  real 0.0366  mix 0.0092
Writing model shards: 100% 1/1 [00:01<00:00,  1.23s/it]
   step  2525  loss 0.0006  lr 5.08e-06  (1.72s/step)
   step  2550  loss 0.0004  lr 5.00e-06  (1.72s/step)
   step  2575  loss 0.0006  lr 4.92e-06  (1.71s/step)
   step  2600  loss 0.0144  lr 4.84e-06  (1.70s/step)
   step  2625  loss 0.0099  lr 4.76e-06  (1.70s/step)
   step  2650  loss 0.0056  lr 4.68e-06  (1.69s/step)
   step  2675  loss 0.0046  lr 4.60e-06  (1.68s/step)
   step  2700  loss 0.0003  lr 4.52e-06  (1.67s/step)
   step  2725  loss 0.0004  lr 4.44e-06  (1.67s/step)
   step  2750  loss 0.0010  lr 4.36e-06  (1.66s/step)
   step  2750  VAL loss 0.0061  real 0.0361  mix 0.0093
Writing model shards: 100% 1/1 [00:01<00:00,  1.17s/it]
   step  2775  loss 0.0086  lr 4.28e-06  (1.72s/step)
   step  2800  loss 0.0005  lr 4.20e-06  (1.71s/step)
   step  2825  loss 0.0119  lr 4.12e-06  (1.70s/step)
   step  2850  loss 0.0005  lr 4.04e-06  (1.70s/step)
   step  2875  loss 0.0009  lr 3.97e-06  (1.69s/step)
   step  2900  loss 0.0006  lr 3.89e-06  (1.68s/step)
   step  2925  loss 0.0014  lr 3.81e-06  (1.68s/step)
   step  2950  loss 0.0110  lr 3.73e-06  (1.67s/step)
   step  2975  loss 0.0014  lr 3.65e-06  (1.67s/step)
   step  3000  loss 0.0004  lr 3.58e-06  (1.66s/step)
   step  3000  VAL loss 0.0059  real 0.0348  mix 0.0089  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.19s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.31s/it]
   step  3025  loss 0.0120  lr 3.50e-06  (1.72s/step)
   step  3050  loss 0.0018  lr 3.42e-06  (1.71s/step)
   step  3075  loss 0.0087  lr 3.35e-06  (1.71s/step)
   step  3100  loss 0.0003  lr 3.27e-06  (1.70s/step)
   step  3125  loss 0.0249  lr 3.20e-06  (1.69s/step)
   step  3150  loss 0.0061  lr 3.12e-06  (1.69s/step)
   step  3175  loss 0.0019  lr 3.05e-06  (1.69s/step)
   step  3200  loss 0.0071  lr 2.98e-06  (1.68s/step)
   step  3225  loss 0.0008  lr 2.90e-06  (1.68s/step)
   step  3250  loss 0.0038  lr 2.83e-06  (1.67s/step)
   step  3250  VAL loss 0.0055  real 0.0363  mix 0.0087  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.22s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.67s/it]
   step  3275  loss 0.0024  lr 2.76e-06  (1.73s/step)
   step  3300  loss 0.0016  lr 2.69e-06  (1.72s/step)
   step  3325  loss 0.0003  lr 2.62e-06  (1.72s/step)
   step  3350  loss 0.0017  lr 2.55e-06  (1.71s/step)
   step  3375  loss 0.0003  lr 2.48e-06  (1.70s/step)
   step  3400  loss 0.0004  lr 2.41e-06  (1.70s/step)
   step  3425  loss 0.0002  lr 2.34e-06  (1.69s/step)
   step  3450  loss 0.0294  lr 2.27e-06  (1.69s/step)
   step  3475  loss 0.0038  lr 2.21e-06  (1.68s/step)
   step  3500  loss 0.0079  lr 2.14e-06  (1.68s/step)
   step  3500  VAL loss 0.0061  real 0.0366  mix 0.0093
Writing model shards: 100% 1/1 [00:01<00:00,  1.20s/it]
   step  3525  loss 0.0004  lr 2.07e-06  (1.72s/step)
   step  3550  loss 0.0003  lr 2.01e-06  (1.72s/step)
   step  3575  loss 0.0011  lr 1.95e-06  (1.71s/step)
   step  3600  loss 0.0006  lr 1.88e-06  (1.71s/step)
   step  3625  loss 0.0030  lr 1.82e-06  (1.70s/step)
   step  3650  loss 0.0047  lr 1.76e-06  (1.69s/step)
   step  3675  loss 0.0031  lr 1.70e-06  (1.69s/step)
   step  3700  loss 0.0015  lr 1.64e-06  (1.68s/step)
   step  3725  loss 0.0064  lr 1.58e-06  (1.68s/step)
   step  3750  loss 0.0005  lr 1.52e-06  (1.67s/step)
   step  3750  VAL loss 0.0058  real 0.0366  mix 0.0090
Writing model shards: 100% 1/1 [00:01<00:00,  1.26s/it]
   step  3775  loss 0.0016  lr 1.46e-06  (1.72s/step)
   step  3800  loss 0.0087  lr 1.41e-06  (1.71s/step)
   step  3825  loss 0.0024  lr 1.35e-06  (1.71s/step)
   step  3850  loss 0.0005  lr 1.30e-06  (1.70s/step)
   step  3875  loss 0.0112  lr 1.25e-06  (1.70s/step)
   step  3900  loss 0.0169  lr 1.19e-06  (1.69s/step)
   step  3925  loss 0.0114  lr 1.14e-06  (1.69s/step)
   step  3950  loss 0.0038  lr 1.09e-06  (1.68s/step)
   step  3975  loss 0.0111  lr 1.04e-06  (1.68s/step)
   step  4000  loss 0.0052  lr 9.93e-07  (1.67s/step)
   step  4000  VAL loss 0.0059  real 0.0374  mix 0.0092
Writing model shards: 100% 1/1 [00:01<00:00,  1.19s/it]
   step  4025  loss 0.0008  lr 9.46e-07  (1.71s/step)
   step  4050  loss 0.0010  lr 8.99e-07  (1.71s/step)
   step  4075  loss 0.0004  lr 8.54e-07  (1.70s/step)
   step  4100  loss 0.0281  lr 8.10e-07  (1.70s/step)
   step  4125  loss 0.0020  lr 7.66e-07  (1.69s/step)
   step  4150  loss 0.0005  lr 7.24e-07  (1.69s/step)
   step  4175  loss 0.0034  lr 6.83e-07  (1.68s/step)
   step  4200  loss 0.0009  lr 6.43e-07  (1.68s/step)
   step  4225  loss 0.0079  lr 6.05e-07  (1.67s/step)
   step  4250  loss 0.0013  lr 5.67e-07  (1.67s/step)
   step  4250  VAL loss 0.0057  real 0.0371  mix 0.0090
Writing model shards: 100% 1/1 [00:01<00:00,  1.19s/it]
   step  4275  loss 0.0037  lr 5.31e-07  (1.71s/step)
   step  4300  loss 0.0104  lr 4.95e-07  (1.70s/step)
   step  4325  loss 0.0150  lr 4.61e-07  (1.70s/step)
   step  4350  loss 0.0014  lr 4.28e-07  (1.69s/step)
   step  4375  loss 0.0010  lr 3.96e-07  (1.69s/step)
   step  4400  loss 0.0001  lr 3.65e-07  (1.69s/step)
   step  4425  loss 0.0002  lr 3.36e-07  (1.68s/step)
   step  4450  loss 0.0007  lr 3.08e-07  (1.68s/step)
   step  4475  loss 0.0021  lr 2.81e-07  (1.67s/step)
   step  4500  loss 0.0007  lr 2.55e-07  (1.67s/step)
   step  4500  VAL loss 0.0058  real 0.0372  mix 0.0091
Writing model shards: 100% 1/1 [00:01<00:00,  1.28s/it]
   step  4525  loss 0.0015  lr 2.30e-07  (1.70s/step)
   step  4550  loss 0.0161  lr 2.07e-07  (1.70s/step)
   step  4575  loss 0.0011  lr 1.84e-07  (1.69s/step)
   step  4600  loss 0.0030  lr 1.64e-07  (1.69s/step)
   step  4625  loss 0.0008  lr 1.44e-07  (1.69s/step)
   step  4650  loss 0.0009  lr 1.25e-07  (1.68s/step)
   step  4675  loss 0.0037  lr 1.08e-07  (1.68s/step)
   step  4700  loss 0.0129  lr 9.22e-08  (1.68s/step)
   step  4725  loss 0.0018  lr 7.75e-08  (1.67s/step)
   step  4750  loss 0.0005  lr 6.41e-08  (1.67s/step)
   step  4750  VAL loss 0.0059  real 0.0371  mix 0.0091
Writing model shards: 100% 1/1 [00:01<00:00,  1.22s/it]
   step  4775  loss 0.0085  lr 5.19e-08  (1.70s/step)
   step  4800  loss 0.0231  lr 4.10e-08  (1.70s/step)
   step  4825  loss 0.0007  lr 3.14e-08  (1.69s/step)
   step  4850  loss 0.0002  lr 2.31e-08  (1.69s/step)
   step  4875  loss 0.0003  lr 1.60e-08  (1.69s/step)
   step  4900  loss 0.0105  lr 1.03e-08  (1.68s/step)
   step  4925  loss 0.0003  lr 5.78e-09  (1.68s/step)
   step  4950  loss 0.0011  lr 2.57e-09  (1.67s/step)
   step  4975  loss 0.0002  lr 6.42e-10  (1.67s/step)
   step  5000  loss 0.0058  lr 0.00e+00  (1.67s/step)
   step  5000  VAL loss 0.0059  real 0.0371  mix 0.0092
Writing model shards: 100% 1/1 [00:02<00:00,  2.28s/it]

== done: 5000 steps, best val loss 0.0087, best REAL val 0.0343
   checkpoints: /content/drive/MyDrive/tnc/r3-r3b-stage2/best (lowest blended val loss — ~92% synthetic), /content/drive/MyDrive/tnc/r3-r3b-stage2/best-real (lowest REAL val loss), /content/drive/MyDrive/tnc/r3-r3b-stage2/last (resume point)
   ⚠ Choose between them on _realval_v2 with paired_arm_score.py — never on these losses.
   next: .venv-ml/bin/python src/vision/eval_omr.py --checkpoint /content/drive/MyDrive/tnc/r3-r3b-stage2/best