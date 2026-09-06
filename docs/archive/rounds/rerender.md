# Synthetic re-render — `strips_v3` and the accidental-distribution findings (Step 4.1)

purpose: why the Round-1 corpus was rebuilt carry-dominant, and what measuring it revealed
audience: agents and the owner working the real-page track
updated: 2026-07-21

> Part of the real-page track — index: [README.md](README.md). Current state and next action are NOT here: see [../STATUS.md](../STATUS.md).
Numbers: [../METRICS.md](../METRICS.md). Decisions: [../DECISIONS.md](../DECISIONS.md).

### Step 4.1 — Round-1 synthetic re-render (carry-dominant) ✅ BUILT 2026-07-21 + the accidental-distribution findings

#### Ordering CHANGED (2026-07-21): Round 1 FIRST, the re-slice moves to Round 2

Step 4 item 6 said "re-slice STARTS FIRST" (open the human adjudication queue early, it's the
slowest resource). **Superseded** — the re-slice now runs AFTER Round 1 and feeds Round 2. Why:

- Re-slice adjudication cost is driven by DECODER quality, not volume. SymbTr is the label, so an
  aligned window auto-accepts for free; the *review queue* — the only human cost — is populated by
  decode-vs-SymbTr disagreements (`nd_review`, `acc_disagreement`, `row_unaligned`). A weak decoder
  **manufactures false disputes** (correct label, disagreeing decode → thrown to a human anyway).
- The current labeler (`rung3-labeler`) was fine-tuned on `strips_r1` = **362 neyzen strips only**,
  but the re-slice target is **nota-dominant** (nota holds essentially all the `over_budget` drops).
  Decoding nota with a neyzen-only labeler is the *worst* time to do it. A Round-1 model that has
  trained on nota real strips is a materially better labeler → smaller, cleaner queue.
- Round 1 doesn't need the recoveries: its levers are the synthetic re-render (tup3 precision) and
  the already-promoted ~2,351 real strips. Round 1 is also an A/B *experiment* — it picks the recipe,
  it is not the maximal final model.
- This dissolves rather than contradicts the "bottleneck" argument: per-strip human cost is a
  function of labeler quality, so opening the queue early with a weak labeler costs MORE total effort.

Round-1 data scope is therefore **FROZEN**: fresh synthetic re-render + the promoted real pools.

#### Re-render design — mode/transpose policy (LOCKED with the user)

- **Carry mode** (the web app's `"measure"` = signature at row start + measure-scoped accidental
  carry; the real printed-page convention) **replaces keysig entirely** and is the DOMINANT share.
  It is signature-bearing, so it wears the makam's conventional PRINTED signature.
- Carry renders at **transpose 0 ONLY** (written pitch = the conventional signature matches the
  notation; a transposed makam signature matches no real edition). Bulked to dominance via
  `CARRY_PASSES=4` seeded augmentation passes (blur/text/repeat/nav + signature-variant variety).
- **Every mode** (no signature; every accidental inline) is the MINORITY and carries the
  **transpose augmentation** (t≠0) — pure pitch augmentation, always faithful, no signature conflict.
- `stripExport.ts` gained its first `measure`/carry branch: **all chunks kept** (not keysig's
  row-start-only), carry+sigTolerant serialization, `\sig` prefix on the row-start chunk only —
  matching how the emitter labels REAL carry strips, so synthetic and real carry agree.

#### Per-makam conventional PRINTED signatures (`data/makam_signatures.json`)

Real editions print the makam's conventional signature (donanım), which routinely differs from
SymbTr's content-derived one (`deriveKeySignature`). Built by `scripts/build_makam_signatures.py`
from the **adjudication-confirmed `\sig…\sigend` blocks in the promoted real labels** (source of
truth), with AEU theory only as fallback for the ~12 makams with no real sig strips.
**Variant count is UNCAPPED** — several makams genuinely print 3–4 spellings (hicaz 4, şehnaz 4,
nisaburek 3, sultaniyegah 3); the renderer samples one per pass weighted by real frequency.
Covers all 49 corpus makams (65 entries incl. aliases nihavent→nihavend, hicaz-uzzal→uzzal).
Wiring: `parseSignatureBody` (`lilypond.ts`, inverse of `serializeSignature`) →
`render.ts` seeded weighted pick → `?sig=` → `App.tsx` → BOTH `SheetView` (drawn glyphs) and
`stripExport` (label), so pixels == labels.

#### Slur distractors (the tup3-precision fix)

Previously the ONLY arc the renderer drew was the triplet mark, so the model learned "any over-note
arc ⇒ `\tup3`" (baseline tup3 precision **15%**, arc-triggered false-tup3 rate **77.6%**).
`drawSlurArc` (`SheetView.tsx`) now draws label-free phrase arcs — ≥3 notes, **no "3"**, within a
measure so a barline crop never bisects one — over a seeded ~35% of non-tuplet runs, threaded as
`slurseed`/`slurNoise`. **Pixels only**: verified 15 slurs drawn with a seed / 0 without, and
88/88 labels byte-identical to the pre-slur render.

Already in place, no change needed: realistic triplets (`drawTupletArc` + the rung2.2b stem-fix),
blur/fade (`src/vision/augment.py`, train-time), the empty-`\sig` fix (serializer).

#### The corpus: `data/synthetic/strips_v3` (2026-07-21)

**38,091 strips** over 190 pieces / 49 makams; **73.3% carry** (27,933) / 26.7% every (10,158);
27,933 carry strips carry a signature, **33 distinct signature variants** sampled.
Budget gate PASS (longest label 57 ids, cap 59; no token drift).

#### Accidental distribution — finding + ✅ DECIDED plan (2026-07-21): train-time `--every-share` sweep

Measured the synthetic label distribution against the REAL pools (what the model must generalize to):

| | inline accidentals per strip |
|---|---|
| carry (measure) | **0.36** |
| **REAL pools** | **0.32** ✅ |
| every | **4.22** (13× real) |

**Carry mode structurally matches real — the signature work is validated.** But `every` mode is
**26.7% of strips yet produces 81% of all inline accidentals**, pushing the *effective* rate to
1.40/strip = **4.4× real**. Hypothesis (unproven, testable): this inflates the model's
"emit an accidental" prior, and on ambiguous/blurry real ink (nota = 79% of the real pool) an
inflated prior surfaces as **hallucination** — consistent with baseline komaSharp precision **21%**
and komaFlat **54%**, which Step-4.0 gates at ≥70%.

Effective mix as a function of the every-mode sampling share `s`:

| s | inline rate | mean abs dev. from real | kucukFlat | kucukSharp | komaSharp |
|---|---|---|---|---|---|
| 26.7% (as rendered) | 4.4× | 3.75pp | 4.9% | 1.9% | 5.7% |
| 15% | 2.9× | **3.32pp** | 7.1% | **2.7%** | 6.1% |
| 10% | 2.3× | 3.36pp | 8.3% | 3.2% | 6.3% |
| 5% | 1.7× | 3.69pp | 9.8% | 3.8% | 6.6% |
| 0% | 1.1× | 4.11pp | 11.7% | 4.6% | 7.0% |
| **REAL** | — | — | **19.3%** | **2.5%** | **2.1%** |

Note the criteria **disagree at the margin**: overall deviation is minimised near s≈10–15%, the
inline-rate argument pushes lower, and komaSharp gets *worse* as s falls (carry-only komaSharp is
7.0%, higher than every-mode's). Deleting every mode entirely (s=0) is measurably WORSE overall.

**On the earlier "komaSharp/kucukSharp boost" plan item — overturned by data:** komaSharp is
already OVER-represented in synth (5.7% vs 2.1% real) and is *precision*-bound, so boosting it would
backfire; kucukSharp already matches real. The genuine gap is **kucukFlat**, and its residual after
the signature fix is a **makam-mix** artifact (the real pool over-weights kucukFlat-signature makams
— nihavent/kurdilihicazkar/acemasiran) rather than a spelling bug. Down-weighting `every` lifts
kucukFlat for free (4.9% → 7–8%), so the `bakiyeSharp→kucukFlat` enharmonic respell
(`respell.ts`, the proven büyük-style mechanism) is **held**, not applied.

**✅ DECIDED (2026-07-21) — the plan, pre-registered before any Round-1 training runs:**

1. **Mechanism = train-time, not re-render.** Add `--every-share` to `train.py` (stochastic
   per-epoch sampling — `Strip` already carries `mode`, `data.py:60`; PyTorch's
   `WeightedRandomSampler` is the idiomatic tool; with-replacement, so every strip stays reachable
   across epochs). strips_v3 is a superset of every mix we'd want: sampling down is free, instant
   and reversible, while a re-render bakes in ONE guess at ~75 min and can't be retuned. **Default
   `s = 0.15`** — the mean-deviation minimum in the table above, and it keeps meaningful transpose
   exposure alive (see the confound below).
2. **Pre-registered arms: `s ∈ {26.7%, 15%, 5%}` — three, not two, because the arms are
   diagnostic.** The two candidate mechanisms make OPPOSITE predictions at 5%: the *inline-rate*
   story (hallucination prior scales with total accidental bulk) predicts monotone improvement as
   `s` falls → 5% beats 15%; the *class-mix* story (what matters is the accidental-type
   distribution matching real) predicts an optimum at ~15% with 5% nearly as bad as as-rendered
   (3.69pp vs 3.75pp) → 15% beats both ends. A {26.7, 15} pair would confirm "downweighting
   helps" but not WHICH mechanism — and the mechanism decides the Round-2 re-render design
   (rate ⇒ accidental-thinned every strips; mix ⇒ makam-mix rebalance for kucukFlat).
3. **Run budget: SEQUENTIAL, never crossed with the init experiment** (crossing = 2 inits × 3
   shares = 6 runs). First the init A/B (Step 4 item 1: two-stage vs single-stage) with `s` FIXED
   at 0.15 (2 runs), then the every-share sweep {26.7%, 5%} on the winning init recipe (2 runs —
   the 0.15 cell is already filled). **4 runs total.** Selection at every step stays the ONE
   locked number: free-running real-val mean AEU F1, tie-break = arc-triggered false-`\tup3`
   rate; the exam is taken ONCE, on the overall winner.
4. **Pre-registered confound (non-claim):** `s` scales TWO things at once — the accidental rate
   AND transpose exposure, because every mode is the sole carrier of t≠0 (carry is t0-only by
   design). At s=5% the model sees almost no transposed strips, so pitch-height↔makam
   correlations go nearly unbroken. If the 5% arm loses, we canNOT attribute the loss between
   mix-deviation and transpose starvation — accepted for Round 1 (the arms still order correctly
   for selection); deconfounding (e.g. transposed-signature carry or accidental-thinned every) is
   Round-2 re-render material.
5. **Diagnostic logging (NOT selection):** per-class real-val precision across the arms,
   komaSharp especially. Lowering `s` cuts the overall "emit an accidental" prior (should help
   precision) but RAISES komaSharp's share of synthetic accidentals (5.7% → 7.0% carry-only, vs
   2.1% real) — the class-specific prior moves the wrong way, and komaSharp is the scariest
   Step-4.0 floor (21% → ≥70%). If komaSharp precision does not move with `s`, the hallucination
   is not distributional and Round 2 needs a different lever (decode-side or hard-negative
   rendering), not more mix-tuning.

Standing risk note: mixture ratios are tuned on validation — keep the sweep to these 3 values
and let the **one-shot exam** stay the clean number.

**⚠ AMENDED 2026-07-22, before any sweep run** (full text: "Every-share sweep protocol" in
[round1.md](round1.md) Step 4.2): sweep selection = mean AEU F1 over the four **≥30-gold** real-val classes only (the
init A/B measured a single komaSharp token swinging the 6-class mean 6.9 pp); stage 1 shortened
to ~3–4k steps but **re-run per arm** (`s` must apply to stage 1); the komaSharp diagnostic in
item 5 is unmeasurable on real-val (n=1) → replaced by **komaFlat precision (62 gold) as the
measurable proxy**.

**⛔ CANCELLED later the same day, still before any sweep run** (decision block, full reasoning in [../log/superseded.md](../log/superseded.md)):
the init A/B measured the selection
metric's power (largest available intervention → 0.5 pp) and showed the target pathology
already fixed on real-val (komaFlat F1 93.7 in both arms) — the sweep could neither select nor
diagnose. `s` ships at the pre-registered default **0.15**; deconfounding the renderer replaces
`s`-tuning in Round 2.
