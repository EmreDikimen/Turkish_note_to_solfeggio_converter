# Metrics — the exported runtime (ONNX export, int8 quantization, parity)

purpose: the numbers behind what the app actually runs — export validation, quantized sizes, and how far int8 drifts from the PyTorch checkpoint
audience: whoever is exporting a checkpoint, or wondering whether a shipped model matches the one that was measured
updated: 2026-09-01

Split out of [METRICS.md](METRICS.md) on 2026-09-01 when that file crossed the 400-line cap. Genre:
METRICS.md holds model quality; this holds the artifact that gets served.

⚠ **No accuracy number anywhere in this project is measured on int8.** Every exam, real-val and
taxonomy figure comes from the PyTorch checkpoint. The app serves int8. That gap is what this file
sizes.

## Export (`optimum-cli export onnx --task image-to-text-with-past`)

| checkpoint | date | optimum float validation |
|---|---|---|
| `r3-final-stage2-last` | 2026-09-01 | max diff 5e-5 – 3.3e-4 (encoder 3.3e-4, logits 6.9e-5) |

The tolerance warning at 1e-5 is expected and has fired on every export this project has done; parity
in **id space** is the check that matters, below.

## int8 quantization (`quantize_onnx.py`, `quantize_dynamic`, QInt8 weights)

| graph | fp32 | int8 |
|---|---|---|
| encoder | 311 MB | **91 MB** |
| decoder | 276 MB | **69 MB** |
| decoder-with-past | 242 MB | **61 MB** |
| **total shipped** | ~830 MB | **221 MB** |

## Parity: int8 vs PyTorch, in id space

Found while exporting Round 3, by noticing that `onnx_parity.py` pointed at a real pool selects
**zero** strips and prints `0/0 PASS` — it filters to `GATE_STRIPS.txt`, which is 14 SYNTHETIC
strips. That vacuous pass is worth knowing about on its own.

Same reference decoder (`onnx_parity.onnx_greedy_decode`), 60 `_realval_v2` strips spread across the
pool, int8 graphs vs the PyTorch checkpoint, identical token ids required:

| checkpoint | 14 gate strips (synthetic) | **60 real strips** |
|---|---|---|
| `round2-stage2-best` — the LIVE runtime | — | **54/60 = 90.0%** |
| `r3-final-stage2-last` | **14/14 = 100%** | **52/60 = 86.7%** |

⭐ **This is ambient int8 behaviour, not a Round-3 defect**: both models diverge, 6 vs 8 strips of 60
is within noise at that n, and the divergences land on **largely the same strips** in both
(`yegah_pesrev…p2_s01_w03`, `canan_okuyor…p1_s03_w01`, `beni_cun_kendine…s01_w01`,
`cok_surmedi…p2_s00`) — a property of hard, near-boundary strips rather than of either export.
⚠ **But it has never been visible**, because the documented gate is 14 synthetic strips where int8 is
exact. The shipped app has always decoded real pages with a model that can disagree with its own
fp32 weights on ~1 strip in 10, and some disagreements are large (24 and 20 ids on ~50-token strips).
⚠ **Consequence for any hand-test or hands-on impression**: the app runs int8, and no
accuracy number in this file was measured on int8 — they all come from the PyTorch checkpoints.


## The browser gate is STALE for any tie-free model (2026-09-01)

`npm run gate:browser` expects **27/28**. `r3-final-stage2-last` reads **24/28**, and the four failed
checks are three different things:

| # | strip | cause |
|---|---|---|
| 2 | `rast…icime_hep` | ⭐ **the gold still contains `\tie`**, retired 2026-08-22. The model emits `a'1 a'4`, which under the retirement rule IS the correct label. **The fixture is wrong, not the model** |
| 1 | `kurdilihicazkar…bunca_cevrinle` (reference) | **pre-existing** — `round2-stage2-best` produces byte-identical output here; this is the known 1/28 |
| 1 | the same strip (canvas) | ⚠ **genuinely new** — Round 3 drops `\tup3` where Round 2 kept it, by one token (56 vs 57) |

⛔ **So the 27/28 gate cannot pass any post-`\tie` model**, and would have blocked whoever shipped
next regardless of Round 3. Regenerating that one gold tie-free would read **Round 3 26/28** and
**Round 2 25/28** — the honest ordering, since Round 2 is now the stale model. ⚠ Not done: changing a
shipped check's expected value is an owner call.

⚠ A second apparent difference on that strip, `d''32` rendered as `d'' 32`, is **not** a difference:
the two forms tokenize to identical ids `[17, 1, 37, 95, 35]`. `d''16` vs `d'' 16` genuinely differs,
which is why `promote_labels.norm_label`'s rule is **32 only**.
