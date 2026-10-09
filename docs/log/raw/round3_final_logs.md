# Round 3 — THE FINAL MODEL's Colab training log (raw)

purpose: the verbatim console output of the Round-3 final model's two training stages, kept as the run's own record
audience: anyone re-reading how the graded model actually trained
updated: 2026-09-01

Raw paste, unedited below this line. The reading of these curves — including the selector defect they
exposed — is in [src/vision/MODEL_EVAL.md](src/vision/MODEL_EVAL.md); do not re-derive it here.

---

/content/tnc
   every-share -> 0.150 of synthetic (was 0.244); pool: every=8799 carry=27233 real=0; expected per-epoch mix: every 15.0% of all draws
== data: 36032 train / 4763 synth-val / 0 real-val strips; augment=on (screenshot 0.65 / photo 0.35 / scan 0.00); device=cuda
== loading Flova/omr_transformer ...
Warning: You are sending unauthenticated requests to the HF Hub. Please set a HF_TOKEN to enable higher rate limits and faster downloads.
Loading weights: 100% 484/484 [00:00<00:00, 15905.44it/s]
[transformers] The new embeddings will be initialized from a multivariate normal distribution that has old embeddings' mean and covariance. As described in this article: https://nlp.stanford.edu/~johnhew/vocab-expansion.html. To disable this, use `mean_resizing=False`
   vocab: +25 tokens -> 100 ids
== training to step 6000 (batch 16 x accum 1, lr 3e-05)
   step     1  loss 3.0616  lr 2.40e-07  (3.71s/step)
   step    25  loss 1.9059  lr 3.12e-06  (1.01s/step)
   step    50  loss 1.6209  lr 6.12e-06  (0.96s/step)
   step    75  loss 0.8108  lr 9.12e-06  (0.94s/step)
   step   100  loss 0.7967  lr 1.21e-05  (0.93s/step)
   step   125  loss 0.6689  lr 1.51e-05  (0.93s/step)
   step   150  loss 0.5968  lr 1.81e-05  (0.93s/step)
   step   175  loss 0.4521  lr 2.11e-05  (0.92s/step)
   step   200  loss 0.4087  lr 2.41e-05  (0.92s/step)
   step   225  loss 0.3304  lr 2.71e-05  (0.92s/step)
   step   250  loss 0.1917  lr 3.00e-05  (0.92s/step)
   step   250  VAL loss 0.2797  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.17s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.06s/it]
   step   275  loss 0.2321  lr 3.00e-05  (1.54s/step)
   step   300  loss 0.2051  lr 3.00e-05  (1.49s/step)
   step   325  loss 0.2323  lr 3.00e-05  (1.45s/step)
   step   350  loss 0.2205  lr 3.00e-05  (1.41s/step)
   step   375  loss 0.1462  lr 3.00e-05  (1.38s/step)
   step   400  loss 0.1042  lr 2.99e-05  (1.35s/step)
   step   425  loss 0.1121  lr 2.99e-05  (1.32s/step)
   step   450  loss 0.1069  lr 2.99e-05  (1.30s/step)
   step   475  loss 0.0819  lr 2.99e-05  (1.28s/step)
   step   500  loss 0.0758  lr 2.99e-05  (1.26s/step)
   step   500  VAL loss 0.0914  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.17s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.25s/it]
   step   525  loss 0.0534  lr 2.98e-05  (1.57s/step)
   step   550  loss 0.0384  lr 2.98e-05  (1.54s/step)
   step   575  loss 0.0514  lr 2.98e-05  (1.51s/step)
   step   600  loss 0.0610  lr 2.97e-05  (1.49s/step)
   step   625  loss 0.0663  lr 2.97e-05  (1.46s/step)
   step   650  loss 0.0559  lr 2.96e-05  (1.44s/step)
   step   675  loss 0.0602  lr 2.96e-05  (1.43s/step)
   step   700  loss 0.0648  lr 2.95e-05  (1.41s/step)
   step   725  loss 0.0245  lr 2.95e-05  (1.40s/step)
   step   750  loss 0.0164  lr 2.94e-05  (1.39s/step)
   step   750  VAL loss 0.0510  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.49s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.23s/it]
   step   775  loss 0.0727  lr 2.94e-05  (1.62s/step)
   step   800  loss 0.0508  lr 2.93e-05  (1.59s/step)
   step   825  loss 0.0431  lr 2.93e-05  (1.59s/step)
   step   850  loss 0.0352  lr 2.92e-05  (1.57s/step)
   step   875  loss 0.0286  lr 2.91e-05  (1.55s/step)
   step   900  loss 0.0413  lr 2.91e-05  (1.53s/step)
   step   925  loss 0.0447  lr 2.90e-05  (1.52s/step)
   step   950  loss 0.0391  lr 2.89e-05  (1.51s/step)
   step   975  loss 0.0330  lr 2.88e-05  (1.49s/step)
   step  1000  loss 0.0897  lr 2.88e-05  (1.48s/step)
   step  1000  VAL loss 0.0269  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.20s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.88s/it]
   step  1025  loss 0.0166  lr 2.87e-05  (1.65s/step)
   step  1050  loss 0.0174  lr 2.86e-05  (1.63s/step)
   step  1075  loss 0.0259  lr 2.85e-05  (1.62s/step)
   step  1100  loss 0.0160  lr 2.84e-05  (1.61s/step)
   step  1125  loss 0.0226  lr 2.83e-05  (1.59s/step)
   step  1150  loss 0.0359  lr 2.82e-05  (1.58s/step)
   step  1175  loss 0.0230  lr 2.81e-05  (1.56s/step)
   step  1200  loss 0.0067  lr 2.80e-05  (1.56s/step)
   step  1225  loss 0.0111  lr 2.79e-05  (1.54s/step)
   step  1250  loss 0.0051  lr 2.78e-05  (1.53s/step)
   step  1250  VAL loss 0.0237  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.17s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.80s/it]
   step  1275  loss 0.0314  lr 2.77e-05  (1.66s/step)
   step  1300  loss 0.0326  lr 2.76e-05  (1.64s/step)
   step  1325  loss 0.0178  lr 2.75e-05  (1.63s/step)
   step  1350  loss 0.0504  lr 2.74e-05  (1.62s/step)
   step  1375  loss 0.0133  lr 2.73e-05  (1.60s/step)
   step  1400  loss 0.0218  lr 2.71e-05  (1.59s/step)
   step  1425  loss 0.0093  lr 2.70e-05  (1.58s/step)
   step  1450  loss 0.0180  lr 2.69e-05  (1.57s/step)
   step  1475  loss 0.0031  lr 2.68e-05  (1.56s/step)
   step  1500  loss 0.0271  lr 2.66e-05  (1.55s/step)
   step  1500  VAL loss 0.0173  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.28s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.07s/it]
   step  1525  loss 0.0136  lr 2.65e-05  (1.65s/step)
   step  1550  loss 0.0073  lr 2.64e-05  (1.64s/step)
   step  1575  loss 0.0024  lr 2.62e-05  (1.63s/step)
   step  1600  loss 0.0064  lr 2.61e-05  (1.62s/step)
   step  1625  loss 0.0068  lr 2.60e-05  (1.61s/step)
   step  1650  loss 0.0286  lr 2.58e-05  (1.60s/step)
   step  1675  loss 0.0065  lr 2.57e-05  (1.59s/step)
   step  1700  loss 0.0054  lr 2.55e-05  (1.58s/step)
   step  1725  loss 0.0451  lr 2.54e-05  (1.57s/step)
   step  1750  loss 0.0044  lr 2.52e-05  (1.56s/step)
   step  1750  VAL loss 0.0175
Writing model shards: 100% 1/1 [00:01<00:00,  1.26s/it]
   step  1775  loss 0.0099  lr 2.51e-05  (1.65s/step)
   step  1800  loss 0.0225  lr 2.49e-05  (1.64s/step)
   step  1825  loss 0.0223  lr 2.48e-05  (1.63s/step)
   step  1850  loss 0.0122  lr 2.46e-05  (1.63s/step)
   step  1875  loss 0.0151  lr 2.45e-05  (1.62s/step)
   step  1900  loss 0.0060  lr 2.43e-05  (1.61s/step)
   step  1925  loss 0.0031  lr 2.41e-05  (1.60s/step)
   step  1950  loss 0.0176  lr 2.40e-05  (1.59s/step)
   step  1975  loss 0.0153  lr 2.38e-05  (1.58s/step)
   step  2000  loss 0.0053  lr 2.37e-05  (1.57s/step)
   step  2000  VAL loss 0.0180
Writing model shards: 100% 1/1 [00:01<00:00,  1.21s/it]
   step  2025  loss 0.0020  lr 2.35e-05  (1.64s/step)
   step  2050  loss 0.0025  lr 2.33e-05  (1.64s/step)
   step  2075  loss 0.0263  lr 2.31e-05  (1.63s/step)
   step  2100  loss 0.0242  lr 2.30e-05  (1.62s/step)
   step  2125  loss 0.0058  lr 2.28e-05  (1.61s/step)
   step  2150  loss 0.0233  lr 2.26e-05  (1.61s/step)
   step  2175  loss 0.0019  lr 2.24e-05  (1.60s/step)
   step  2200  loss 0.0042  lr 2.23e-05  (1.59s/step)
   step  2225  loss 0.0220  lr 2.21e-05  (1.58s/step)
   step  2250  loss 0.0022  lr 2.19e-05  (1.58s/step)
   step  2250  VAL loss 0.0139  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.19s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.61s/it]
   step  2275  loss 0.0329  lr 2.17e-05  (1.65s/step)
   step  2300  loss 0.0111  lr 2.15e-05  (1.64s/step)
   step  2325  loss 0.0054  lr 2.13e-05  (1.64s/step)
   step  2350  loss 0.0025  lr 2.12e-05  (1.63s/step)
   step  2375  loss 0.0010  lr 2.10e-05  (1.62s/step)
   step  2400  loss 0.0220  lr 2.08e-05  (1.62s/step)
   step  2425  loss 0.0045  lr 2.06e-05  (1.61s/step)
   step  2450  loss 0.0264  lr 2.04e-05  (1.60s/step)
   step  2475  loss 0.0124  lr 2.02e-05  (1.60s/step)
   step  2500  loss 0.0018  lr 2.00e-05  (1.59s/step)
   step  2500  VAL loss 0.0122  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.23s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.07s/it]
   step  2525  loss 0.0168  lr 1.98e-05  (1.65s/step)
   step  2550  loss 0.0078  lr 1.96e-05  (1.64s/step)
   step  2575  loss 0.0018  lr 1.94e-05  (1.64s/step)
   step  2600  loss 0.0022  lr 1.92e-05  (1.63s/step)
   step  2625  loss 0.0070  lr 1.90e-05  (1.62s/step)
   step  2650  loss 0.0099  lr 1.88e-05  (1.62s/step)
   step  2675  loss 0.0324  lr 1.87e-05  (1.61s/step)
   step  2700  loss 0.0076  lr 1.85e-05  (1.61s/step)
   step  2725  loss 0.0015  lr 1.83e-05  (1.60s/step)
   step  2750  loss 0.0034  lr 1.81e-05  (1.59s/step)
   step  2750  VAL loss 0.0133
Writing model shards: 100% 1/1 [00:02<00:00,  2.44s/it]
   step  2775  loss 0.0006  lr 1.79e-05  (1.65s/step)
   step  2800  loss 0.0034  lr 1.76e-05  (1.64s/step)
   step  2825  loss 0.0044  lr 1.74e-05  (1.64s/step)
   step  2850  loss 0.0061  lr 1.72e-05  (1.63s/step)
   step  2875  loss 0.0014  lr 1.70e-05  (1.63s/step)
   step  2900  loss 0.0007  lr 1.68e-05  (1.62s/step)
   step  2925  loss 0.0295  lr 1.66e-05  (1.61s/step)
   step  2950  loss 0.0015  lr 1.64e-05  (1.61s/step)
   step  2975  loss 0.0119  lr 1.62e-05  (1.60s/step)
   step  3000  loss 0.0170  lr 1.60e-05  (1.60s/step)
   step  3000  VAL loss 0.0109  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.28s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.23s/it]
   step  3025  loss 0.0067  lr 1.58e-05  (1.65s/step)
   step  3050  loss 0.0019  lr 1.56e-05  (1.65s/step)
   step  3075  loss 0.0244  lr 1.54e-05  (1.64s/step)
   step  3100  loss 0.0063  lr 1.52e-05  (1.64s/step)
   step  3125  loss 0.0164  lr 1.50e-05  (1.63s/step)
   step  3150  loss 0.0150  lr 1.48e-05  (1.63s/step)
   step  3175  loss 0.0207  lr 1.46e-05  (1.62s/step)
   step  3200  loss 0.0043  lr 1.44e-05  (1.62s/step)
   step  3225  loss 0.0015  lr 1.42e-05  (1.61s/step)
   step  3250  loss 0.0072  lr 1.40e-05  (1.61s/step)
   step  3250  VAL loss 0.0122
Writing model shards: 100% 1/1 [00:01<00:00,  1.20s/it]
   step  3275  loss 0.0039  lr 1.38e-05  (1.65s/step)
   step  3300  loss 0.0006  lr 1.36e-05  (1.65s/step)
   step  3325  loss 0.0131  lr 1.34e-05  (1.64s/step)
   step  3350  loss 0.0008  lr 1.32e-05  (1.64s/step)
   step  3375  loss 0.0022  lr 1.30e-05  (1.63s/step)
   step  3400  loss 0.0173  lr 1.28e-05  (1.63s/step)
   step  3425  loss 0.0150  lr 1.26e-05  (1.62s/step)
   step  3450  loss 0.0053  lr 1.24e-05  (1.62s/step)
   step  3475  loss 0.0016  lr 1.21e-05  (1.61s/step)
   step  3500  loss 0.0023  lr 1.19e-05  (1.61s/step)
   step  3500  VAL loss 0.0107  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.22s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.64s/it]
   step  3525  loss 0.0017  lr 1.17e-05  (1.65s/step)
   step  3550  loss 0.0014  lr 1.15e-05  (1.65s/step)
   step  3575  loss 0.0120  lr 1.13e-05  (1.65s/step)
   step  3600  loss 0.0241  lr 1.12e-05  (1.64s/step)
   step  3625  loss 0.0251  lr 1.10e-05  (1.64s/step)
   step  3650  loss 0.0105  lr 1.08e-05  (1.63s/step)
   step  3675  loss 0.0049  lr 1.06e-05  (1.63s/step)
   step  3700  loss 0.0135  lr 1.04e-05  (1.62s/step)
   step  3725  loss 0.0013  lr 1.02e-05  (1.62s/step)
   step  3750  loss 0.0167  lr 9.98e-06  (1.61s/step)
   step  3750  VAL loss 0.0105  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.23s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.64s/it]
   step  3775  loss 0.0198  lr 9.78e-06  (1.66s/step)
   step  3800  loss 0.0006  lr 9.59e-06  (1.65s/step)
   step  3825  loss 0.0568  lr 9.40e-06  (1.65s/step)
   step  3850  loss 0.0032  lr 9.21e-06  (1.65s/step)
   step  3875  loss 0.0058  lr 9.02e-06  (1.64s/step)
   step  3900  loss 0.0433  lr 8.84e-06  (1.64s/step)
   step  3925  loss 0.0021  lr 8.65e-06  (1.64s/step)
   step  3950  loss 0.0097  lr 8.47e-06  (1.63s/step)
   step  3975  loss 0.0086  lr 8.28e-06  (1.63s/step)
   step  4000  loss 0.0039  lr 8.10e-06  (1.62s/step)
   step  4000  VAL loss 0.0097  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.19s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.97s/it]
   step  4025  loss 0.0017  lr 7.92e-06  (1.67s/step)
   step  4050  loss 0.0004  lr 7.74e-06  (1.66s/step)
   step  4075  loss 0.0046  lr 7.56e-06  (1.66s/step)
   step  4100  loss 0.0007  lr 7.38e-06  (1.65s/step)
   step  4125  loss 0.0004  lr 7.21e-06  (1.65s/step)
   step  4150  loss 0.0018  lr 7.03e-06  (1.65s/step)
   step  4175  loss 0.0008  lr 6.86e-06  (1.64s/step)
   step  4200  loss 0.0087  lr 6.69e-06  (1.64s/step)
   step  4225  loss 0.0031  lr 6.52e-06  (1.63s/step)
   step  4250  loss 0.0003  lr 6.35e-06  (1.63s/step)
   step  4250  VAL loss 0.0094  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.54s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.15s/it]
   step  4275  loss 0.0102  lr 6.18e-06  (1.67s/step)
   step  4300  loss 0.0036  lr 6.02e-06  (1.66s/step)
   step  4325  loss 0.0024  lr 5.86e-06  (1.66s/step)
   step  4350  loss 0.0003  lr 5.69e-06  (1.66s/step)
   step  4375  loss 0.0004  lr 5.53e-06  (1.65s/step)
   step  4400  loss 0.0017  lr 5.38e-06  (1.65s/step)
   step  4425  loss 0.0051  lr 5.22e-06  (1.64s/step)
   step  4450  loss 0.0011  lr 5.06e-06  (1.64s/step)
   step  4475  loss 0.0008  lr 4.91e-06  (1.64s/step)
   step  4500  loss 0.0018  lr 4.76e-06  (1.63s/step)
   step  4500  VAL loss 0.0091  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.31s/it]
   step  4525  loss 0.0006  lr 4.61e-06  (1.67s/step)
   step  4550  loss 0.0010  lr 4.47e-06  (1.66s/step)
   step  4575  loss 0.0040  lr 4.32e-06  (1.66s/step)
   step  4600  loss 0.0006  lr 4.18e-06  (1.66s/step)
   step  4625  loss 0.0124  lr 4.04e-06  (1.66s/step)
   step  4650  loss 0.0131  lr 3.90e-06  (1.65s/step)
   step  4675  loss 0.0004  lr 3.76e-06  (1.65s/step)
   step  4700  loss 0.0210  lr 3.63e-06  (1.65s/step)
   step  4725  loss 0.0019  lr 3.49e-06  (1.64s/step)
   step  4750  loss 0.0039  lr 3.36e-06  (1.64s/step)
   step  4750  VAL loss 0.0094
Writing model shards: 100% 1/1 [00:02<00:00,  2.46s/it]
   step  4775  loss 0.0004  lr 3.24e-06  (1.67s/step)
   step  4800  loss 0.0040  lr 3.11e-06  (1.67s/step)
   step  4825  loss 0.0365  lr 2.99e-06  (1.66s/step)
   step  4850  loss 0.0004  lr 2.86e-06  (1.66s/step)
   step  4875  loss 0.0282  lr 2.75e-06  (1.66s/step)
   step  4900  loss 0.0006  lr 2.63e-06  (1.65s/step)
   step  4925  loss 0.0007  lr 2.51e-06  (1.65s/step)
   step  4950  loss 0.0002  lr 2.40e-06  (1.64s/step)
   step  4975  loss 0.0050  lr 2.29e-06  (1.64s/step)
   step  5000  loss 0.0040  lr 2.18e-06  (1.64s/step)
   step  5000  VAL loss 0.0091
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
   step  5025  loss 0.0237  lr 2.08e-06  (1.67s/step)
   step  5050  loss 0.0003  lr 1.98e-06  (1.66s/step)
   step  5075  loss 0.0056  lr 1.88e-06  (1.66s/step)
   step  5100  loss 0.0006  lr 1.78e-06  (1.66s/step)
   step  5125  loss 0.0005  lr 1.68e-06  (1.65s/step)
   step  5150  loss 0.0006  lr 1.59e-06  (1.65s/step)
   step  5175  loss 0.0002  lr 1.50e-06  (1.65s/step)
   step  5200  loss 0.0002  lr 1.41e-06  (1.64s/step)
   step  5225  loss 0.0128  lr 1.32e-06  (1.64s/step)
   step  5250  loss 0.0005  lr 1.24e-06  (1.63s/step)
   step  5250  VAL loss 0.0094
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
   step  5275  loss 0.0002  lr 1.16e-06  (1.66s/step)
   step  5300  loss 0.0057  lr 1.08e-06  (1.66s/step)
   step  5325  loss 0.0046  lr 1.01e-06  (1.66s/step)
   step  5350  loss 0.0007  lr 9.36e-07  (1.65s/step)
   step  5375  loss 0.0149  lr 8.66e-07  (1.65s/step)
   step  5400  loss 0.0029  lr 7.99e-07  (1.65s/step)
   step  5425  loss 0.0064  lr 7.34e-07  (1.64s/step)
   step  5450  loss 0.0004  lr 6.72e-07  (1.64s/step)
   step  5475  loss 0.0002  lr 6.13e-07  (1.64s/step)
   step  5500  loss 0.0068  lr 5.56e-07  (1.63s/step)
   step  5500  VAL loss 0.0092
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
   step  5525  loss 0.0090  lr 5.02e-07  (1.66s/step)
   step  5550  loss 0.0004  lr 4.51e-07  (1.66s/step)
   step  5575  loss 0.0009  lr 4.03e-07  (1.65s/step)
   step  5600  loss 0.0004  lr 3.57e-07  (1.65s/step)
   step  5625  loss 0.0003  lr 3.14e-07  (1.65s/step)
   step  5650  loss 0.0005  lr 2.73e-07  (1.64s/step)
   step  5675  loss 0.0001  lr 2.36e-07  (1.64s/step)
   step  5700  loss 0.0005  lr 2.01e-07  (1.64s/step)
   step  5725  loss 0.0029  lr 1.69e-07  (1.63s/step)
   step  5750  loss 0.0086  lr 1.40e-07  (1.63s/step)
   step  5750  VAL loss 0.0093
Writing model shards: 100% 1/1 [00:02<00:00,  2.00s/it]
   step  5775  loss 0.0152  lr 1.13e-07  (1.66s/step)
   step  5800  loss 0.0088  lr 8.95e-08  (1.65s/step)
   step  5825  loss 0.0029  lr 6.85e-08  (1.65s/step)
   step  5850  loss 0.0051  lr 5.03e-08  (1.65s/step)
   step  5875  loss 0.0016  lr 3.50e-08  (1.65s/step)
   step  5900  loss 0.0022  lr 2.24e-08  (1.64s/step)
   step  5925  loss 0.0002  lr 1.26e-08  (1.64s/step)
   step  5950  loss 0.0014  lr 5.60e-09  (1.64s/step)
   step  5975  loss 0.0011  lr 1.40e-09  (1.63s/step)
   step  6000  loss 0.0069  lr 0.00e+00  (1.63s/step)
   step  6000  VAL loss 0.0093
Writing model shards: 100% 1/1 [00:01<00:00,  1.27s/it]

== done: 6000 steps, best val loss 0.0091
   checkpoints: /content/drive/MyDrive/tnc/r3-final-stage1/best (lowest val loss), /content/drive/MyDrive/tnc/r3-final-stage1/last (resume point)
   next: .venv-ml/bin/python src/vision/eval_omr.py --checkpoint /content/drive/MyDrive/tnc/r3-final-stage1/best



/content/tnc
   real pool data/real/rung3/strips_b8: 3539 train x5 / 390 val strips
   exam-disjointness OK: 568 real pieces, 0 in the 33-piece exam
   every-share -> 0.150 of synthetic (was 0.244); pool: every=8799 carry=27233 real=17695; expected per-epoch mix: every 10.1% of all draws
== data: 53727 train / 4763 synth-val / 390 real-val strips; augment=on (screenshot 0.65 / photo 0.35 / scan 0.00); device=cuda
== loading /content/drive/MyDrive/tnc/r3-final-stage1/best ...
Loading weights: 100% 483/483 [00:00<00:00, 2693.62it/s]
   vocab: +0 tokens -> 100 ids
== training to step 2000 (batch 16 x accum 1, lr 1e-05)
   step     1  loss 0.0189  lr 2.00e-07  (3.52s/step)
   step    25  loss 0.0168  lr 2.60e-06  (1.00s/step)
   step    50  loss 0.0052  lr 5.10e-06  (0.96s/step)
   step    75  loss 0.0162  lr 7.60e-06  (1.03s/step)
   step   100  loss 0.0038  lr 1.00e-05  (1.00s/step)
   step   125  loss 0.0052  lr 1.00e-05  (0.98s/step)
   step   150  loss 0.0197  lr 9.98e-06  (0.97s/step)
   step   175  loss 0.0252  lr 9.96e-06  (0.96s/step)
   step   200  loss 0.0019  lr 9.93e-06  (0.95s/step)
   step   225  loss 0.0025  lr 9.89e-06  (0.95s/step)
   step   250  loss 0.0017  lr 9.85e-06  (0.95s/step)
   step   250  VAL loss 0.0107  real 0.0301  mix 0.0121  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.21s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.08s/it]
   step   275  loss 0.0092  lr 9.79e-06  (1.61s/step)
   step   300  loss 0.0059  lr 9.73e-06  (1.55s/step)
   step   325  loss 0.0106  lr 9.66e-06  (1.50s/step)
   step   350  loss 0.0015  lr 9.58e-06  (1.46s/step)
   step   375  loss 0.0167  lr 9.49e-06  (1.42s/step)
   step   400  loss 0.0249  lr 9.40e-06  (1.39s/step)
   step   425  loss 0.0065  lr 9.30e-06  (1.36s/step)
   step   450  loss 0.0052  lr 9.19e-06  (1.34s/step)
   step   475  loss 0.0040  lr 9.07e-06  (1.32s/step)
   step   500  loss 0.0210  lr 8.95e-06  (1.30s/step)
   step   500  VAL loss 0.0106  real 0.0234  mix 0.0115  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.18s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.68s/it]
   step   525  loss 0.0092  lr 8.82e-06  (1.62s/step)
   step   550  loss 0.0081  lr 8.68e-06  (1.60s/step)
   step   575  loss 0.0011  lr 8.54e-06  (1.57s/step)
   step   600  loss 0.0006  lr 8.39e-06  (1.54s/step)
   step   625  loss 0.0018  lr 8.23e-06  (1.52s/step)
   step   650  loss 0.0136  lr 8.07e-06  (1.49s/step)
   step   675  loss 0.0241  lr 7.91e-06  (1.47s/step)
   step   700  loss 0.0218  lr 7.73e-06  (1.45s/step)
   step   725  loss 0.0037  lr 7.56e-06  (1.44s/step)
   step   750  loss 0.0011  lr 7.38e-06  (1.42s/step)
   step   750  VAL loss 0.0109  real 0.0198  mix 0.0116
Writing model shards: 100% 1/1 [00:01<00:00,  1.20s/it]
   step   775  loss 0.0189  lr 7.20e-06  (1.64s/step)
   step   800  loss 0.0007  lr 7.01e-06  (1.61s/step)
   step   825  loss 0.0026  lr 6.82e-06  (1.62s/step)
   step   850  loss 0.0414  lr 6.62e-06  (1.60s/step)
   step   875  loss 0.0057  lr 6.43e-06  (1.58s/step)
   step   900  loss 0.0075  lr 6.23e-06  (1.56s/step)
   step   925  loss 0.0025  lr 6.03e-06  (1.54s/step)
   step   950  loss 0.0160  lr 5.82e-06  (1.53s/step)
   step   975  loss 0.0084  lr 5.62e-06  (1.51s/step)
   step  1000  loss 0.0006  lr 5.41e-06  (1.50s/step)
   step  1000  VAL loss 0.0110  real 0.0221  mix 0.0119
Writing model shards: 100% 1/1 [00:01<00:00,  1.31s/it]
   step  1025  loss 0.0025  lr 5.21e-06  (1.66s/step)
   step  1050  loss 0.0027  lr 5.00e-06  (1.64s/step)
   step  1075  loss 0.0346  lr 4.79e-06  (1.62s/step)
   step  1100  loss 0.0248  lr 4.59e-06  (1.61s/step)
   step  1125  loss 0.0019  lr 4.38e-06  (1.59s/step)
   step  1150  loss 0.0011  lr 4.18e-06  (1.58s/step)
   step  1175  loss 0.0134  lr 3.97e-06  (1.56s/step)
   step  1200  loss 0.0036  lr 3.77e-06  (1.55s/step)
   step  1225  loss 0.0041  lr 3.57e-06  (1.54s/step)
   step  1250  loss 0.0027  lr 3.38e-06  (1.53s/step)
   step  1250  VAL loss 0.0118  real 0.0206  mix 0.0124
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
   step  1275  loss 0.0036  lr 3.18e-06  (1.66s/step)
   step  1300  loss 0.0086  lr 2.99e-06  (1.64s/step)
   step  1325  loss 0.0159  lr 2.80e-06  (1.63s/step)
   step  1350  loss 0.0012  lr 2.62e-06  (1.62s/step)
   step  1375  loss 0.0167  lr 2.44e-06  (1.60s/step)
   step  1400  loss 0.0199  lr 2.27e-06  (1.59s/step)
   step  1425  loss 0.0047  lr 2.09e-06  (1.58s/step)
   step  1450  loss 0.0161  lr 1.93e-06  (1.57s/step)
   step  1475  loss 0.0107  lr 1.77e-06  (1.56s/step)
   step  1500  loss 0.0019  lr 1.61e-06  (1.55s/step)
   step  1500  VAL loss 0.0116  real 0.0196  mix 0.0122
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
   step  1525  loss 0.0004  lr 1.46e-06  (1.65s/step)
   step  1550  loss 0.0022  lr 1.32e-06  (1.64s/step)
   step  1575  loss 0.0224  lr 1.18e-06  (1.63s/step)
   step  1600  loss 0.0014  lr 1.05e-06  (1.62s/step)
   step  1625  loss 0.0172  lr 9.31e-07  (1.61s/step)
   step  1650  loss 0.0016  lr 8.14e-07  (1.60s/step)
   step  1675  loss 0.0081  lr 7.05e-07  (1.59s/step)
   step  1700  loss 0.0032  lr 6.03e-07  (1.58s/step)
   step  1725  loss 0.0028  lr 5.08e-07  (1.57s/step)
   step  1750  loss 0.0005  lr 4.21e-07  (1.56s/step)
   step  1750  VAL loss 0.0117  real 0.0182  mix 0.0122
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
   step  1775  loss 0.0039  lr 3.42e-07  (1.65s/step)
   step  1800  loss 0.0014  lr 2.71e-07  (1.65s/step)
   step  1825  loss 0.0033  lr 2.08e-07  (1.64s/step)
   step  1850  loss 0.0034  lr 1.53e-07  (1.63s/step)
   step  1875  loss 0.0014  lr 1.06e-07  (1.62s/step)
   step  1900  loss 0.0002  lr 6.82e-08  (1.61s/step)
   step  1925  loss 0.0021  lr 3.84e-08  (1.60s/step)
   step  1950  loss 0.0033  lr 1.71e-08  (1.59s/step)
   step  1975  loss 0.0117  lr 4.27e-09  (1.58s/step)
   step  2000  loss 0.0022  lr 0.00e+00  (1.57s/step)
   step  2000  VAL loss 0.0117  real 0.0183  mix 0.0122
Writing model shards: 100% 1/1 [00:01<00:00,  1.23s/it]

== done: 2000 steps, best val loss 0.0115
   checkpoints: /content/drive/MyDrive/tnc/r3-final-stage2/best (lowest val loss), /content/drive/MyDrive/tnc/r3-final-stage2/last (resume point)
   next: .venv-ml/bin/python src/vision/eval_omr.py --checkpoint /content/drive/MyDrive/tnc/r3-final-stage2/best