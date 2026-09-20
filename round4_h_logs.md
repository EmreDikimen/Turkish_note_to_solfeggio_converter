# Round 4, H arm — stage 1 and stage 2 logs (raw)

purpose: the verbatim console output of Round 4's H arm (scheme H vocabulary) — stage 1 from base, then stage 2 from its stage-1 best — kept as that run's own record
audience: anyone re-reading how the vocabulary A/B's H arm actually trained
updated: 2026-09-17

> Stage 1 (6,000 steps, synthetic) then stage 2 (4,000 steps, `strips_h1:4`, from stage-1 `best`). Read beside
> [src/vision/MODEL_EVAL.md](src/vision/MODEL_EVAL.md). ⛔ Its losses are per H token and cannot be
> set beside an old-vocabulary run's.

## Stage 1

```text
/content/tnc
   selection decode budget: 81 ids
   every-share -> 0.150 of synthetic (was 0.244); pool: every=8799 carry=27233 real=0; expected per-epoch mix: every 15.0% of all draws
== data: 36032 train / 4763 synth-val / 0 real-val strips; augment=on (screenshot 0.65 / photo 0.35 / scan 0.00); device=cuda
== loading Flova/omr_transformer ...
Warning: You are sending unauthenticated requests to the HF Hub. Please set a HF_TOKEN to enable higher rate limits and faster downloads.
preprocessor_config.json: 100% 438/438 [00:00<00:00, 1.99MB/s]
config.json: 100% 4.87k/4.87k [00:00<00:00, 3.11MB/s]
tokenizer_config.json: 100% 4.07k/4.07k [00:00<00:00, 11.8MB/s]
tokenizer.json: 100% 5.46k/5.46k [00:00<00:00, 11.3MB/s]
added_tokens.json: 100% 86.0/86.0 [00:00<00:00, 451kB/s]
special_tokens_map.json: 100% 96.0/96.0 [00:00<00:00, 525kB/s]

pytorch_model.bin: downloading bytes:  33% 191M/574M [00:01<00:01, 275MB/s, 12.2MB/s  ]
pytorch_model.bin: downloading bytes:  61% 349M/574M [00:02<00:00, 351MB/s, 27.4MB/s  ]
pytorch_model.bin: downloading bytes:  81% 466M/574M [00:02<00:00, 428MB/s, 38.3MB/s  ]
pytorch_model.bin: downloading bytes:  93% 533M/574M [00:02<00:00, 391MB/s, 46.6MB/s  ]
pytorch_model.bin: downloading bytes: 100% 540M/540M [00:02<00:00, 196MB/s, 48.4MB/s  ]
pytorch_model.bin: reconstructing file: 100% 574M/574M [00:02<00:00, 208MB/s, 52.0MB/s  ]
Loading weights: 100% 484/484 [00:00<00:00, 16875.12it/s]

model.safetensors: downloading bytes:   0% 0.00/574M [00:00<?, ?B/s]

generation_config.json: 100% 213/213 [00:00<00:00, 867kB/s]
[transformers] The new embeddings will be initialized from a multivariate normal distribution that has old embeddings' mean and covariance. As described in this article: https://nlp.stanford.edu/~johnhew/vocab-expansion.html. To disable this, use `mean_resizing=False`
   vocab: h (+42 tokens -> 116 ids)
== training to step 6000 (batch 16 x accum 1, lr 3e-05)
model.safetensors: downloading bytes:  41% 237M/574M [00:01<00:00, 365MB/s, 15.7MB/s  ]
model.safetensors: downloading bytes:  53% 302M/574M [00:01<00:00, 432MB/s, 22.7MB/s  ]
model.safetensors: downloading bytes:  91% 521M/574M [00:02<00:00, 271MB/s, 46.8MB/s  ]
model.safetensors: downloading bytes: 100% 540M/540M [00:03<00:00, 179MB/s, 46.3MB/s  ]
model.safetensors: reconstructing file: 100% 574M/574M [00:03<00:00, 190MB/s, 51.7MB/s  ]
   step     1  loss 13.9701  lr 2.40e-07  (5.50s/step)
   step    25  loss 8.3424  lr 3.12e-06  (1.12s/step)
   step    50  loss 5.1344  lr 6.12e-06  (1.01s/step)
   step    75  loss 3.9312  lr 9.12e-06  (0.97s/step)
   step   100  loss 3.6824  lr 1.21e-05  (0.96s/step)
   step   125  loss 3.0889  lr 1.51e-05  (0.95s/step)
   step   150  loss 2.5487  lr 1.81e-05  (0.94s/step)
   step   175  loss 2.0083  lr 2.11e-05  (0.93s/step)
   step   200  loss 1.9503  lr 2.41e-05  (0.93s/step)
   step   225  loss 1.8441  lr 2.71e-05  (0.93s/step)
   step   250  loss 1.7179  lr 3.00e-05  (0.93s/step)
   step   250  VAL loss 1.7277  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.20s/it]
Writing model shards: 100% 1/1 [00:00<00:00,  1.01it/s]
   step   275  loss 1.6918  lr 3.00e-05  (1.55s/step)
   step   300  loss 1.3162  lr 3.00e-05  (1.50s/step)
   step   325  loss 1.1216  lr 3.00e-05  (1.45s/step)
   step   350  loss 0.8789  lr 3.00e-05  (1.41s/step)
   step   375  loss 0.7842  lr 3.00e-05  (1.38s/step)
   step   400  loss 0.6617  lr 2.99e-05  (1.35s/step)
   step   425  loss 0.5559  lr 2.99e-05  (1.32s/step)
   step   450  loss 0.3478  lr 2.99e-05  (1.30s/step)
   step   475  loss 0.3799  lr 2.99e-05  (1.28s/step)
   step   500  loss 0.3324  lr 2.99e-05  (1.26s/step)
   step   500  VAL loss 0.2715  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.76s/it]
   step   525  loss 0.3719  lr 2.98e-05  (1.60s/step)
   step   550  loss 0.2423  lr 2.98e-05  (1.56s/step)
   step   575  loss 0.3621  lr 2.98e-05  (1.54s/step)
   step   600  loss 0.1269  lr 2.97e-05  (1.52s/step)
   step   625  loss 0.2803  lr 2.97e-05  (1.49s/step)
   step   650  loss 0.1172  lr 2.96e-05  (1.47s/step)
   step   675  loss 0.2338  lr 2.96e-05  (1.45s/step)
   step   700  loss 0.1036  lr 2.95e-05  (1.43s/step)
   step   725  loss 0.1301  lr 2.95e-05  (1.41s/step)
   step   750  loss 0.1254  lr 2.94e-05  (1.39s/step)
   step   750  VAL loss 0.1084  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.23s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  3.00s/it]
   step   775  loss 0.1025  lr 2.94e-05  (1.63s/step)
   step   800  loss 0.0905  lr 2.93e-05  (1.61s/step)
   step   825  loss 0.1126  lr 2.93e-05  (1.61s/step)
   step   850  loss 0.1168  lr 2.92e-05  (1.59s/step)
   step   875  loss 0.0944  lr 2.91e-05  (1.57s/step)
   step   900  loss 0.1829  lr 2.91e-05  (1.55s/step)
   step   925  loss 0.0766  lr 2.90e-05  (1.54s/step)
   step   950  loss 0.0619  lr 2.89e-05  (1.53s/step)
   step   975  loss 0.0902  lr 2.88e-05  (1.52s/step)
   step  1000  loss 0.0895  lr 2.88e-05  (1.51s/step)
   step  1000  VAL loss 0.0676  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.18s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.24s/it]
   step  1025  loss 0.1319  lr 2.87e-05  (1.67s/step)
   step  1050  loss 0.0130  lr 2.86e-05  (1.65s/step)
   step  1075  loss 0.0653  lr 2.85e-05  (1.64s/step)
   step  1100  loss 0.0547  lr 2.84e-05  (1.63s/step)
   step  1125  loss 0.0449  lr 2.83e-05  (1.61s/step)
   step  1150  loss 0.0919  lr 2.82e-05  (1.60s/step)
   step  1175  loss 0.0535  lr 2.81e-05  (1.58s/step)
   step  1200  loss 0.0537  lr 2.80e-05  (1.58s/step)
   step  1225  loss 0.0379  lr 2.79e-05  (1.56s/step)
   step  1250  loss 0.0059  lr 2.78e-05  (1.56s/step)
   step  1250  VAL loss 0.0379  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.26s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.75s/it]
   step  1275  loss 0.0707  lr 2.77e-05  (1.69s/step)
   step  1300  loss 0.0306  lr 2.76e-05  (1.68s/step)
   step  1325  loss 0.0101  lr 2.75e-05  (1.68s/step)
   step  1350  loss 0.0254  lr 2.74e-05  (1.66s/step)
   step  1375  loss 0.0472  lr 2.73e-05  (1.65s/step)
   step  1400  loss 0.0098  lr 2.71e-05  (1.64s/step)
   step  1425  loss 0.0318  lr 2.70e-05  (1.62s/step)
   step  1450  loss 0.0153  lr 2.69e-05  (1.61s/step)
   step  1475  loss 0.0148  lr 2.68e-05  (1.61s/step)
   step  1500  loss 0.0177  lr 2.66e-05  (1.59s/step)
   step  1500  VAL loss 0.0309  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.69s/it]
   step  1525  loss 0.0626  lr 2.65e-05  (1.70s/step)
   step  1550  loss 0.0035  lr 2.64e-05  (1.69s/step)
   step  1575  loss 0.2126  lr 2.62e-05  (1.69s/step)
   step  1600  loss 0.0286  lr 2.61e-05  (1.68s/step)
   step  1625  loss 0.0314  lr 2.60e-05  (1.67s/step)
   step  1650  loss 0.0086  lr 2.58e-05  (1.65s/step)
   step  1675  loss 0.0108  lr 2.57e-05  (1.65s/step)
   step  1700  loss 0.0349  lr 2.55e-05  (1.64s/step)
   step  1725  loss 0.0277  lr 2.54e-05  (1.63s/step)
   step  1750  loss 0.0392  lr 2.52e-05  (1.62s/step)
   step  1750  VAL loss 0.0265  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.27s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.45s/it]
   step  1775  loss 0.0112  lr 2.51e-05  (1.71s/step)
   step  1800  loss 0.0572  lr 2.49e-05  (1.70s/step)
   step  1825  loss 0.0183  lr 2.48e-05  (1.70s/step)
   step  1850  loss 0.0133  lr 2.46e-05  (1.69s/step)
   step  1875  loss 0.0694  lr 2.45e-05  (1.68s/step)
   step  1900  loss 0.0087  lr 2.43e-05  (1.67s/step)
   step  1925  loss 0.0263  lr 2.41e-05  (1.67s/step)
   step  1950  loss 0.0019  lr 2.40e-05  (1.66s/step)
   step  1975  loss 0.0022  lr 2.38e-05  (1.65s/step)
   step  2000  loss 0.0352  lr 2.37e-05  (1.64s/step)
   step  2000  VAL loss 0.0248  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.20s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.58s/it]
   step  2025  loss 0.0068  lr 2.35e-05  (1.73s/step)
   step  2050  loss 0.0372  lr 2.33e-05  (1.72s/step)
   step  2075  loss 0.0074  lr 2.31e-05  (1.71s/step)
   step  2100  loss 0.0411  lr 2.30e-05  (1.70s/step)
   step  2125  loss 0.0074  lr 2.28e-05  (1.69s/step)
   step  2150  loss 0.0458  lr 2.26e-05  (1.68s/step)
   step  2175  loss 0.0118  lr 2.24e-05  (1.68s/step)
   step  2200  loss 0.0193  lr 2.23e-05  (1.67s/step)
   step  2225  loss 0.0325  lr 2.21e-05  (1.66s/step)
   step  2250  loss 0.0176  lr 2.19e-05  (1.65s/step)
   step  2250  VAL loss 0.0275
Writing model shards: 100% 1/1 [00:01<00:00,  1.31s/it]
   step  2275  loss 0.0190  lr 2.17e-05  (1.72s/step)
   step  2300  loss 0.0396  lr 2.15e-05  (1.71s/step)
   step  2325  loss 0.0532  lr 2.13e-05  (1.70s/step)
   step  2350  loss 0.0257  lr 2.12e-05  (1.70s/step)
   step  2375  loss 0.0046  lr 2.10e-05  (1.69s/step)
   step  2400  loss 0.0025  lr 2.08e-05  (1.68s/step)
   step  2425  loss 0.0211  lr 2.06e-05  (1.67s/step)
   step  2450  loss 0.0245  lr 2.04e-05  (1.67s/step)
   step  2475  loss 0.0028  lr 2.02e-05  (1.66s/step)
   step  2500  loss 0.0267  lr 2.00e-05  (1.65s/step)
   step  2500  VAL loss 0.0252
Writing model shards: 100% 1/1 [00:01<00:00,  1.48s/it]
   step  2525  loss 0.0157  lr 1.98e-05  (1.71s/step)
   step  2550  loss 0.0165  lr 1.96e-05  (1.70s/step)
   step  2575  loss 0.0012  lr 1.94e-05  (1.69s/step)
   step  2600  loss 0.0475  lr 1.92e-05  (1.69s/step)
   step  2625  loss 0.0240  lr 1.90e-05  (1.69s/step)
   step  2650  loss 0.0012  lr 1.88e-05  (1.68s/step)
   step  2675  loss 0.0224  lr 1.87e-05  (1.67s/step)
   step  2700  loss 0.0387  lr 1.85e-05  (1.66s/step)
   step  2725  loss 0.0048  lr 1.83e-05  (1.66s/step)
   step  2750  loss 0.0549  lr 1.81e-05  (1.65s/step)
   step  2750  VAL loss 0.0174  (new best)
Writing model shards: 100% 1/1 [00:01<00:00,  1.29s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.32s/it]
   step  2775  loss 0.0369  lr 1.79e-05  (1.71s/step)
   step  2800  loss 0.0033  lr 1.76e-05  (1.70s/step)
   step  2825  loss 0.0132  lr 1.74e-05  (1.70s/step)
   step  2850  loss 0.0022  lr 1.72e-05  (1.69s/step)
   step  2875  loss 0.0188  lr 1.70e-05  (1.69s/step)
   step  2900  loss 0.0175  lr 1.68e-05  (1.68s/step)
   step  2925  loss 0.0102  lr 1.66e-05  (1.68s/step)
   step  2950  loss 0.0006  lr 1.64e-05  (1.67s/step)
   step  2975  loss 0.0010  lr 1.62e-05  (1.67s/step)
   step  3000  loss 0.0086  lr 1.60e-05  (1.66s/step)
   step  3000  VAL loss 0.0205
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
   step  3025  loss 0.0065  lr 1.58e-05  (1.71s/step)
   step  3050  loss 0.0013  lr 1.56e-05  (1.70s/step)
   step  3075  loss 0.0016  lr 1.54e-05  (1.70s/step)
   step  3100  loss 0.0025  lr 1.52e-05  (1.69s/step)
   step  3125  loss 0.0047  lr 1.50e-05  (1.69s/step)
   step  3150  loss 0.0236  lr 1.48e-05  (1.68s/step)
   step  3175  loss 0.0214  lr 1.46e-05  (1.67s/step)
   step  3200  loss 0.0012  lr 1.44e-05  (1.67s/step)
   step  3225  loss 0.0023  lr 1.42e-05  (1.66s/step)
   step  3250  loss 0.0311  lr 1.40e-05  (1.66s/step)
   step  3250  VAL loss 0.0184
Writing model shards: 100% 1/1 [00:01<00:00,  1.21s/it]
   step  3275  loss 0.0023  lr 1.38e-05  (1.70s/step)
   step  3300  loss 0.0577  lr 1.36e-05  (1.69s/step)
   step  3325  loss 0.0128  lr 1.34e-05  (1.69s/step)
   step  3350  loss 0.0012  lr 1.32e-05  (1.68s/step)
   step  3375  loss 0.0159  lr 1.30e-05  (1.68s/step)
   step  3400  loss 0.0068  lr 1.28e-05  (1.67s/step)
   step  3425  loss 0.0186  lr 1.26e-05  (1.67s/step)
   step  3450  loss 0.0431  lr 1.24e-05  (1.66s/step)
   step  3475  loss 0.0012  lr 1.21e-05  (1.66s/step)
   step  3500  loss 0.0015  lr 1.19e-05  (1.65s/step)
   step  3500  VAL loss 0.0205
Writing model shards: 100% 1/1 [00:01<00:00,  1.29s/it]
   step  3525  loss 0.0025  lr 1.17e-05  (1.69s/step)
   step  3550  loss 0.0062  lr 1.15e-05  (1.69s/step)
   step  3575  loss 0.0114  lr 1.13e-05  (1.68s/step)
   step  3600  loss 0.0389  lr 1.12e-05  (1.68s/step)
   step  3625  loss 0.0012  lr 1.10e-05  (1.68s/step)
   step  3650  loss 0.0254  lr 1.08e-05  (1.67s/step)
   step  3675  loss 0.0027  lr 1.06e-05  (1.67s/step)
   step  3700  loss 0.0303  lr 1.04e-05  (1.66s/step)
   step  3725  loss 0.0012  lr 1.02e-05  (1.66s/step)
   step  3750  loss 0.0033  lr 9.98e-06  (1.65s/step)
   step  3750  VAL loss 0.0208
Writing model shards: 100% 1/1 [00:01<00:00,  1.23s/it]
   step  3775  loss 0.0004  lr 9.78e-06  (1.69s/step)
   step  3800  loss 0.0216  lr 9.59e-06  (1.68s/step)
   step  3825  loss 0.0101  lr 9.40e-06  (1.68s/step)
   step  3850  loss 0.0178  lr 9.21e-06  (1.68s/step)
   step  3875  loss 0.0247  lr 9.02e-06  (1.67s/step)
   step  3900  loss 0.0047  lr 8.84e-06  (1.67s/step)
   step  3925  loss 0.0142  lr 8.65e-06  (1.66s/step)
   step  3950  loss 0.0198  lr 8.47e-06  (1.66s/step)
   step  3975  loss 0.0010  lr 8.28e-06  (1.65s/step)
   step  4000  loss 0.0232  lr 8.10e-06  (1.65s/step)
   step  4000  VAL loss 0.0217
Writing model shards: 100% 1/1 [00:01<00:00,  1.27s/it]
   step  4025  loss 0.0119  lr 7.92e-06  (1.69s/step)
   step  4050  loss 0.0008  lr 7.74e-06  (1.68s/step)
   step  4075  loss 0.0015  lr 7.56e-06  (1.68s/step)
   step  4100  loss 0.0532  lr 7.38e-06  (1.68s/step)
   step  4125  loss 0.0208  lr 7.21e-06  (1.67s/step)
   step  4150  loss 0.0141  lr 7.03e-06  (1.67s/step)
   step  4175  loss 0.0007  lr 6.86e-06  (1.66s/step)
   step  4200  loss 0.0078  lr 6.69e-06  (1.66s/step)
   step  4225  loss 0.0007  lr 6.52e-06  (1.65s/step)
   step  4250  loss 0.0185  lr 6.35e-06  (1.65s/step)
   step  4250  VAL loss 0.0206
Writing model shards: 100% 1/1 [00:01<00:00,  1.26s/it]
   step  4275  loss 0.0058  lr 6.18e-06  (1.68s/step)
   step  4300  loss 0.0005  lr 6.02e-06  (1.68s/step)
   step  4325  loss 0.0016  lr 5.86e-06  (1.67s/step)
   step  4350  loss 0.0027  lr 5.69e-06  (1.67s/step)
   step  4375  loss 0.0018  lr 5.53e-06  (1.67s/step)
   step  4400  loss 0.0004  lr 5.38e-06  (1.66s/step)
   step  4425  loss 0.0015  lr 5.22e-06  (1.66s/step)
   step  4450  loss 0.0016  lr 5.06e-06  (1.66s/step)
   step  4475  loss 0.0042  lr 4.91e-06  (1.65s/step)
   step  4500  loss 0.0005  lr 4.76e-06  (1.65s/step)
   step  4500  VAL loss 0.0200
Writing model shards: 100% 1/1 [00:01<00:00,  1.30s/it]
   step  4525  loss 0.0088  lr 4.61e-06  (1.68s/step)
   step  4550  loss 0.0015  lr 4.47e-06  (1.68s/step)
   step  4575  loss 0.0012  lr 4.32e-06  (1.67s/step)
   step  4600  loss 0.0008  lr 4.18e-06  (1.67s/step)
   step  4625  loss 0.0068  lr 4.04e-06  (1.67s/step)
   step  4650  loss 0.0244  lr 3.90e-06  (1.66s/step)
   step  4675  loss 0.0018  lr 3.76e-06  (1.66s/step)
   step  4700  loss 0.0006  lr 3.63e-06  (1.65s/step)
   step  4725  loss 0.0002  lr 3.49e-06  (1.65s/step)
   step  4750  loss 0.0042  lr 3.36e-06  (1.65s/step)
   step  4750  VAL loss 0.0195
Writing model shards: 100% 1/1 [00:01<00:00,  1.19s/it]
   step  4775  loss 0.0089  lr 3.24e-06  (1.68s/step)
   step  4800  loss 0.0008  lr 3.11e-06  (1.67s/step)
   step  4825  loss 0.0095  lr 2.99e-06  (1.67s/step)
   step  4850  loss 0.0004  lr 2.86e-06  (1.67s/step)
   step  4875  loss 0.0006  lr 2.75e-06  (1.66s/step)
   step  4900  loss 0.0023  lr 2.63e-06  (1.66s/step)
   step  4925  loss 0.0074  lr 2.51e-06  (1.66s/step)
   step  4950  loss 0.0285  lr 2.40e-06  (1.65s/step)
   step  4975  loss 0.0750  lr 2.29e-06  (1.65s/step)
   step  5000  loss 0.0114  lr 2.18e-06  (1.65s/step)
   step  5000  VAL loss 0.0176
Writing model shards: 100% 1/1 [00:01<00:00,  1.23s/it]
   step  5025  loss 0.0032  lr 2.08e-06  (1.67s/step)
   step  5050  loss 0.0017  lr 1.98e-06  (1.67s/step)
   step  5075  loss 0.0323  lr 1.88e-06  (1.67s/step)
   step  5100  loss 0.0008  lr 1.78e-06  (1.67s/step)
   step  5125  loss 0.0225  lr 1.68e-06  (1.66s/step)
   step  5150  loss 0.0003  lr 1.59e-06  (1.66s/step)
   step  5175  loss 0.0030  lr 1.50e-06  (1.66s/step)
   step  5200  loss 0.0170  lr 1.41e-06  (1.65s/step)
   step  5225  loss 0.0072  lr 1.32e-06  (1.65s/step)
   step  5250  loss 0.0045  lr 1.24e-06  (1.65s/step)
   step  5250  VAL loss 0.0178
Writing model shards: 100% 1/1 [00:01<00:00,  1.27s/it]
   step  5275  loss 0.0004  lr 1.16e-06  (1.67s/step)
   step  5300  loss 0.0012  lr 1.08e-06  (1.67s/step)
   step  5325  loss 0.0005  lr 1.01e-06  (1.67s/step)
   step  5350  loss 0.0004  lr 9.36e-07  (1.67s/step)
   step  5375  loss 0.0164  lr 8.66e-07  (1.66s/step)
   step  5400  loss 0.0662  lr 7.99e-07  (1.66s/step)
   step  5425  loss 0.0043  lr 7.34e-07  (1.66s/step)
   step  5450  loss 0.0288  lr 6.72e-07  (1.65s/step)
   step  5475  loss 0.0030  lr 6.13e-07  (1.65s/step)
   step  5500  loss 0.0166  lr 5.56e-07  (1.64s/step)
   step  5500  VAL loss 0.0179
Writing model shards: 100% 1/1 [00:01<00:00,  1.25s/it]
   step  5525  loss 0.0006  lr 5.02e-07  (1.67s/step)
   step  5550  loss 0.0151  lr 4.51e-07  (1.67s/step)
   step  5575  loss 0.0005  lr 4.03e-07  (1.66s/step)
   step  5600  loss 0.0010  lr 3.57e-07  (1.66s/step)
   step  5625  loss 0.0052  lr 3.14e-07  (1.66s/step)
   step  5650  loss 0.0013  lr 2.73e-07  (1.66s/step)
   step  5675  loss 0.0007  lr 2.36e-07  (1.65s/step)
   step  5700  loss 0.0005  lr 2.01e-07  (1.65s/step)
   step  5725  loss 0.0032  lr 1.69e-07  (1.65s/step)
   step  5750  loss 0.0068  lr 1.40e-07  (1.64s/step)
   step  5750  VAL loss 0.0179
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
   step  5775  loss 0.0117  lr 1.13e-07  (1.67s/step)
   step  5800  loss 0.0052  lr 8.95e-08  (1.66s/step)
   step  5825  loss 0.0345  lr 6.85e-08  (1.66s/step)
   step  5850  loss 0.0011  lr 5.03e-08  (1.66s/step)
   step  5875  loss 0.0060  lr 3.50e-08  (1.66s/step)
   step  5900  loss 0.0011  lr 2.24e-08  (1.65s/step)
   step  5925  loss 0.0072  lr 1.26e-08  (1.65s/step)
   step  5950  loss 0.0107  lr 5.60e-09  (1.65s/step)
   step  5975  loss 0.0059  lr 1.40e-09  (1.65s/step)
   step  6000  loss 0.0008  lr 0.00e+00  (1.64s/step)
   step  6000  VAL loss 0.0179
Writing model shards: 100% 1/1 [00:01<00:00,  1.19s/it]

== done: 6000 steps, best val loss 0.0174, best REAL val inf
   checkpoints: /content/drive/MyDrive/tnc/r4-h-stage1/best (lowest blended val loss — ~92% synthetic), /content/drive/MyDrive/tnc/r4-h-stage1/best-real (lowest REAL val loss), /content/drive/MyDrive/tnc/r4-h-stage1/last (resume point)
   ⚠ Choose between them on _realval_v2 with paired_arm_score.py — never on these losses.
   next: .venv-ml/bin/python src/vision/eval_omr.py --checkpoint /content/drive/MyDrive/tnc/r4-h-stage1/best
```

## Stage 2

```text
/content/tnc
   selection decode budget: 100 ids
   real pool data/real/rung3/strips_h1: 4011 train x4 / 441 val strips
   exam-disjointness OK: 600 real pieces, 0 in the 33-piece exam
   every-share -> 0.150 of synthetic (was 0.244); pool: every=8799 carry=27233 real=16044; expected per-epoch mix: every 10.4% of all draws
   selection: left out 29 of 288 strips (5 pieces whose song is in the synthetic TRAIN split)
== data: 52076 train / 4763 synth-val / 441 real-val strips / 259 SELECTION (free-running edits); augment=on (screenshot 0.65 / photo 0.35 / scan 0.00); device=cuda
== loading /content/drive/MyDrive/tnc/r4-h-stage1/best ...
Loading weights: 100% 483/483 [00:00<00:00, 3049.82it/s]
   vocab: h (+0 tokens -> 116 ids)
== training to step 4000 (batch 16 x accum 1, lr 1e-05)
   step     1  loss 0.0317  lr 2.00e-07  (3.47s/step)
   step    25  loss 0.1189  lr 2.60e-06  (1.00s/step)
   step    50  loss 0.0412  lr 5.10e-06  (0.95s/step)
   step    75  loss 0.0822  lr 7.60e-06  (1.06s/step)
   step   100  loss 0.0109  lr 1.00e-05  (1.02s/step)
   step   125  loss 0.0298  lr 1.00e-05  (1.00s/step)
   step   150  loss 0.0153  lr 1.00e-05  (0.98s/step)
   step   175  loss 0.0334  lr 9.99e-06  (0.97s/step)
   step   200  loss 0.0104  lr 9.98e-06  (0.96s/step)
   step   225  loss 0.0283  lr 9.97e-06  (0.96s/step)
   step   250  loss 0.0253  lr 9.96e-06  (0.95s/step)
   step   250  VAL loss 0.0219  real 0.0541  mix 0.0246  EDITS 350/259 strips (exact 167)  (new best)  (new best-real)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.24s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.58s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.29s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.45s/it]
   step   275  loss 0.0141  lr 9.95e-06  (1.73s/step)
   step   300  loss 0.0280  lr 9.94e-06  (1.66s/step)
   step   325  loss 0.0403  lr 9.92e-06  (1.60s/step)
   step   350  loss 0.0030  lr 9.90e-06  (1.55s/step)
   step   375  loss 0.1426  lr 9.88e-06  (1.51s/step)
   step   400  loss 0.0024  lr 9.85e-06  (1.47s/step)
   step   425  loss 0.0007  lr 9.83e-06  (1.44s/step)
   step   450  loss 0.0023  lr 9.80e-06  (1.41s/step)
   step   475  loss 0.0024  lr 9.77e-06  (1.38s/step)
   step   500  loss 0.0405  lr 9.74e-06  (1.36s/step)
   step   500  VAL loss 0.0179  real 0.0443  mix 0.0201  EDITS 322/259 strips (exact 184)  (new best)  (new best-real)  (new best-edits)
Writing model shards: 100% 1/1 [00:00<00:00,  1.01it/s]
Writing model shards: 100% 1/1 [00:01<00:00,  1.01s/it]
Writing model shards: 100% 1/1 [00:15<00:00, 15.01s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.80s/it]
   step   525  loss 0.0151  lr 9.71e-06  (1.76s/step)
   step   550  loss 0.0264  lr 9.68e-06  (1.72s/step)
   step   575  loss 0.0080  lr 9.64e-06  (1.71s/step)
   step   600  loss 0.0303  lr 9.60e-06  (1.67s/step)
   step   625  loss 0.0167  lr 9.56e-06  (1.64s/step)
   step   650  loss 0.0017  lr 9.52e-06  (1.61s/step)
   step   675  loss 0.0076  lr 9.47e-06  (1.59s/step)
   step   700  loss 0.0301  lr 9.43e-06  (1.57s/step)
   step   725  loss 0.0100  lr 9.38e-06  (1.58s/step)
   step   750  loss 0.0041  lr 9.33e-06  (1.55s/step)
   step   750  VAL loss 0.0198  real 0.0423  mix 0.0217  EDITS 310/259 strips (exact 181)  (new best-real)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.02s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.92s/it]
Writing model shards: 100% 1/1 [00:14<00:00, 14.50s/it]
   step   775  loss 0.0094  lr 9.28e-06  (1.81s/step)
   step   800  loss 0.0181  lr 9.23e-06  (1.78s/step)
   step   825  loss 0.0049  lr 9.17e-06  (1.77s/step)
   step   850  loss 0.0115  lr 9.11e-06  (1.75s/step)
   step   875  loss 0.0046  lr 9.06e-06  (1.72s/step)
   step   900  loss 0.0125  lr 9.00e-06  (1.70s/step)
   step   925  loss 0.0467  lr 8.94e-06  (1.68s/step)
   step   950  loss 0.0038  lr 8.87e-06  (1.66s/step)
   step   975  loss 0.0416  lr 8.81e-06  (1.64s/step)
   step  1000  loss 0.0241  lr 8.74e-06  (1.62s/step)
   step  1000  VAL loss 0.0203  real 0.0327  mix 0.0214  EDITS 305/259 strips (exact 187)  (new best-real)  (new best-edits)
Writing model shards: 100% 1/1 [00:00<00:00,  1.02it/s]
Writing model shards: 100% 1/1 [00:04<00:00,  4.01s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.48s/it]
   step  1025  loss 0.0017  lr 8.68e-06  (1.82s/step)
   step  1050  loss 0.0050  lr 8.61e-06  (1.80s/step)
   step  1075  loss 0.0031  lr 8.54e-06  (1.78s/step)
   step  1100  loss 0.0007  lr 8.46e-06  (1.76s/step)
   step  1125  loss 0.0113  lr 8.39e-06  (1.75s/step)
   step  1150  loss 0.0017  lr 8.32e-06  (1.73s/step)
   step  1175  loss 0.0414  lr 8.24e-06  (1.71s/step)
   step  1200  loss 0.0182  lr 8.16e-06  (1.70s/step)
   step  1225  loss 0.0009  lr 8.08e-06  (1.68s/step)
   step  1250  loss 0.0200  lr 8.00e-06  (1.67s/step)
   step  1250  VAL loss 0.0178  real 0.0338  mix 0.0191  EDITS 296/259 strips (exact 189)  (new best)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.01s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.80s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.39s/it]
   step  1275  loss 0.0017  lr 7.92e-06  (1.83s/step)
   step  1300  loss 0.0026  lr 7.84e-06  (1.81s/step)
   step  1325  loss 0.0320  lr 7.76e-06  (1.81s/step)
   step  1350  loss 0.0077  lr 7.67e-06  (1.79s/step)
   step  1375  loss 0.0014  lr 7.59e-06  (1.78s/step)
   step  1400  loss 0.0280  lr 7.50e-06  (1.76s/step)
   step  1425  loss 0.0094  lr 7.41e-06  (1.75s/step)
   step  1450  loss 0.0586  lr 7.32e-06  (1.73s/step)
   step  1475  loss 0.0032  lr 7.23e-06  (1.73s/step)
   step  1500  loss 0.0251  lr 7.14e-06  (1.71s/step)
   step  1500  VAL loss 0.0178  real 0.0319  mix 0.0190  EDITS 288/259 strips (exact 191)  (new best)  (new best-real)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.15s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.80s/it]
Writing model shards: 100% 1/1 [00:01<00:00,  1.49s/it]
Writing model shards: 100% 1/1 [00:03<00:00,  3.12s/it]
   step  1525  loss 0.0039  lr 7.05e-06  (1.85s/step)
   step  1550  loss 0.0031  lr 6.96e-06  (1.83s/step)
   step  1575  loss 0.0429  lr 6.87e-06  (1.82s/step)
   step  1600  loss 0.0265  lr 6.77e-06  (1.81s/step)
   step  1625  loss 0.0094  lr 6.68e-06  (1.80s/step)
   step  1650  loss 0.0063  lr 6.58e-06  (1.78s/step)
   step  1675  loss 0.0031  lr 6.49e-06  (1.78s/step)
   step  1700  loss 0.0258  lr 6.39e-06  (1.76s/step)
   step  1725  loss 0.0214  lr 6.29e-06  (1.76s/step)
   step  1750  loss 0.0138  lr 6.20e-06  (1.74s/step)
   step  1750  VAL loss 0.0195  real 0.0302  mix 0.0204  EDITS 303/259 strips (exact 184)  (new best-real)
Writing model shards: 100% 1/1 [00:01<00:00,  1.33s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.81s/it]
   step  1775  loss 0.0017  lr 6.10e-06  (1.85s/step)
   step  1800  loss 0.0168  lr 6.00e-06  (1.84s/step)
   step  1825  loss 0.0356  lr 5.90e-06  (1.82s/step)
   step  1850  loss 0.0008  lr 5.80e-06  (1.81s/step)
   step  1875  loss 0.0099  lr 5.70e-06  (1.80s/step)
   step  1900  loss 0.0039  lr 5.60e-06  (1.80s/step)
   step  1925  loss 0.0012  lr 5.50e-06  (1.78s/step)
   step  1950  loss 0.0110  lr 5.40e-06  (1.77s/step)
   step  1975  loss 0.0017  lr 5.30e-06  (1.76s/step)
   step  2000  loss 0.0036  lr 5.20e-06  (1.75s/step)
   step  2000  VAL loss 0.0195  real 0.0293  mix 0.0203  EDITS 286/259 strips (exact 192)  (new best-real)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.04s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.73s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.69s/it]
   step  2025  loss 0.0721  lr 5.10e-06  (1.85s/step)
   step  2050  loss 0.0443  lr 5.00e-06  (1.84s/step)
   step  2075  loss 0.0069  lr 4.90e-06  (1.84s/step)
   step  2100  loss 0.0446  lr 4.80e-06  (1.83s/step)
   step  2125  loss 0.0012  lr 4.70e-06  (1.82s/step)
   step  2150  loss 0.0185  lr 4.60e-06  (1.81s/step)
   step  2175  loss 0.0027  lr 4.50e-06  (1.80s/step)
   step  2200  loss 0.0006  lr 4.40e-06  (1.79s/step)
   step  2225  loss 0.0035  lr 4.30e-06  (1.78s/step)
   step  2250  loss 0.0149  lr 4.20e-06  (1.77s/step)
   step  2250  VAL loss 0.0221  real 0.0311  mix 0.0229  EDITS 293/259 strips (exact 189)
Writing model shards: 100% 1/1 [00:01<00:00,  1.01s/it]
   step  2275  loss 0.0139  lr 4.10e-06  (1.85s/step)
   step  2300  loss 0.0015  lr 4.00e-06  (1.84s/step)
   step  2325  loss 0.0078  lr 3.90e-06  (1.83s/step)
   step  2350  loss 0.0010  lr 3.80e-06  (1.83s/step)
   step  2375  loss 0.0006  lr 3.71e-06  (1.82s/step)
   step  2400  loss 0.0385  lr 3.61e-06  (1.81s/step)
   step  2425  loss 0.0016  lr 3.51e-06  (1.80s/step)
   step  2450  loss 0.0010  lr 3.42e-06  (1.79s/step)
   step  2475  loss 0.0561  lr 3.32e-06  (1.78s/step)
   step  2500  loss 0.0323  lr 3.23e-06  (1.77s/step)
   step  2500  VAL loss 0.0210  real 0.0302  mix 0.0218  EDITS 288/259 strips (exact 192)
Writing model shards: 100% 1/1 [00:01<00:00,  1.90s/it]
   step  2525  loss 0.0138  lr 3.13e-06  (1.84s/step)
   step  2550  loss 0.0006  lr 3.04e-06  (1.83s/step)
   step  2575  loss 0.0022  lr 2.95e-06  (1.82s/step)
   step  2600  loss 0.0117  lr 2.86e-06  (1.82s/step)
   step  2625  loss 0.0009  lr 2.77e-06  (1.81s/step)
   step  2650  loss 0.0009  lr 2.68e-06  (1.80s/step)
   step  2675  loss 0.0013  lr 2.59e-06  (1.80s/step)
   step  2700  loss 0.0174  lr 2.50e-06  (1.79s/step)
   step  2725  loss 0.0019  lr 2.41e-06  (1.78s/step)
   step  2750  loss 0.0007  lr 2.33e-06  (1.77s/step)
   step  2750  VAL loss 0.0205  real 0.0296  mix 0.0213  EDITS 286/259 strips (exact 192)
Writing model shards: 100% 1/1 [00:01<00:00,  1.02s/it]
   step  2775  loss 0.0228  lr 2.24e-06  (1.83s/step)
   step  2800  loss 0.0321  lr 2.16e-06  (1.82s/step)
   step  2825  loss 0.0005  lr 2.08e-06  (1.81s/step)
   step  2850  loss 0.0008  lr 2.00e-06  (1.81s/step)
   step  2875  loss 0.0008  lr 1.92e-06  (1.80s/step)
   step  2900  loss 0.0208  lr 1.84e-06  (1.80s/step)
   step  2925  loss 0.0273  lr 1.76e-06  (1.79s/step)
   step  2950  loss 0.0005  lr 1.68e-06  (1.78s/step)
   step  2975  loss 0.0038  lr 1.61e-06  (1.77s/step)
   step  3000  loss 0.0020  lr 1.54e-06  (1.77s/step)
   step  3000  VAL loss 0.0191  real 0.0294  mix 0.0199  EDITS 285/259 strips (exact 188)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.06s/it]
Writing model shards: 100% 1/1 [00:00<00:00,  1.02it/s]
   step  3025  loss 0.0015  lr 1.46e-06  (1.83s/step)
   step  3050  loss 0.0008  lr 1.39e-06  (1.82s/step)
   step  3075  loss 0.0039  lr 1.32e-06  (1.82s/step)
   step  3100  loss 0.0014  lr 1.26e-06  (1.81s/step)
   step  3125  loss 0.0053  lr 1.19e-06  (1.80s/step)
   step  3150  loss 0.0030  lr 1.13e-06  (1.80s/step)
   step  3175  loss 0.0050  lr 1.06e-06  (1.79s/step)
   step  3200  loss 0.0094  lr 1.00e-06  (1.78s/step)
   step  3225  loss 0.0047  lr 9.43e-07  (1.78s/step)
   step  3250  loss 0.0015  lr 8.85e-07  (1.78s/step)
   step  3250  VAL loss 0.0197  real 0.0301  mix 0.0206  EDITS 280/259 strips (exact 190)  (new best-edits)
Writing model shards: 100% 1/1 [00:01<00:00,  1.05s/it]
Writing model shards: 100% 1/1 [00:02<00:00,  2.69s/it]
   step  3275  loss 0.0009  lr 8.29e-07  (1.83s/step)
   step  3300  loss 0.0016  lr 7.74e-07  (1.83s/step)
   step  3325  loss 0.0004  lr 7.21e-07  (1.83s/step)
   step  3350  loss 0.0007  lr 6.70e-07  (1.82s/step)
   step  3375  loss 0.0006  lr 6.20e-07  (1.81s/step)
   step  3400  loss 0.0044  lr 5.73e-07  (1.81s/step)
   step  3425  loss 0.0035  lr 5.27e-07  (1.80s/step)
   step  3450  loss 0.0025  lr 4.83e-07  (1.79s/step)
   step  3475  loss 0.0009  lr 4.41e-07  (1.79s/step)
   step  3500  loss 0.0011  lr 4.00e-07  (1.78s/step)
   step  3500  VAL loss 0.0197  real 0.0302  mix 0.0206  EDITS 283/259 strips (exact 188)
Writing model shards: 100% 1/1 [00:01<00:00,  1.00s/it]
   step  3525  loss 0.0156  lr 3.62e-07  (1.83s/step)
   step  3550  loss 0.0014  lr 3.25e-07  (1.82s/step)
   step  3575  loss 0.0139  lr 2.90e-07  (1.82s/step)
   step  3600  loss 0.0053  lr 2.57e-07  (1.82s/step)
   step  3625  loss 0.0006  lr 2.26e-07  (1.81s/step)
   step  3650  loss 0.0009  lr 1.97e-07  (1.81s/step)
   step  3675  loss 0.0008  lr 1.70e-07  (1.80s/step)
   step  3700  loss 0.0035  lr 1.45e-07  (1.79s/step)
   step  3725  loss 0.0012  lr 1.22e-07  (1.79s/step)
   step  3750  loss 0.0010  lr 1.01e-07  (1.78s/step)
   step  3750  VAL loss 0.0197  real 0.0300  mix 0.0205  EDITS 282/259 strips (exact 188)
Writing model shards: 100% 1/1 [00:00<00:00,  1.00it/s]
   step  3775  loss 0.0006  lr 8.19e-08  (1.83s/step)
   step  3800  loss 0.0023  lr 6.47e-08  (1.82s/step)
   step  3825  loss 0.0204  lr 4.96e-08  (1.82s/step)
   step  3850  loss 0.0018  lr 3.65e-08  (1.81s/step)
   step  3875  loss 0.0011  lr 2.53e-08  (1.80s/step)
   step  3900  loss 0.0005  lr 1.62e-08  (1.80s/step)
   step  3925  loss 0.0005  lr 9.12e-09  (1.79s/step)
   step  3950  loss 0.0012  lr 4.06e-09  (1.79s/step)
   step  3975  loss 0.0004  lr 1.01e-09  (1.78s/step)
   step  4000  loss 0.0181  lr 0.00e+00  (1.78s/step)
   step  4000  VAL loss 0.0196  real 0.0300  mix 0.0205  EDITS 282/259 strips (exact 188)
Writing model shards: 100% 1/1 [00:01<00:00,  1.00s/it]

== done: 4000 steps, best val loss 0.0190, best REAL val 0.0293, fewest EDITS 280
   checkpoints: /content/drive/MyDrive/tnc/r4-h-stage2/best (lowest blended val loss — ~92% synthetic), /content/drive/MyDrive/tnc/r4-h-stage2/best-real (lowest REAL val loss), /content/drive/MyDrive/tnc/r4-h-stage2/last (resume point)
   /content/drive/MyDrive/tnc/r4-h-stage2/best-edits — fewest free-running corrections on 259 fixed strips. ⭐ This is the Round-4 pick; the two loss tags above are kept only so the run stays comparable with earlier ones.
   ⚠ Choose between them on _realval_v2 with paired_arm_score.py — never on these losses.
   next: .venv-ml/bin/python src/vision/eval_omr.py --checkpoint /content/drive/MyDrive/tnc/r4-h-stage2/best
```
