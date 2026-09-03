# Note-spelling tokens — how a label is spelled, and what re-spelling it would buy

purpose: the measured case for giving octaves and durations their own tokens, the design the owner
chose, the traps in implementing it, and what has to be measured before it is worth a retrain
audience: agents and the owner picking up the Round-4 density work

updated: 2026-09-03

> Current state and next action are NOT here — see [../STATUS.md](../STATUS.md). ⏭ **PICKED UP FOR
> ROUND 4 (2026-09-03)** — the plan, the order and the owner's decisions are in [round4.md](round4.md).
> Scheme **H** is the recommendation (owner to confirm); **no re-render this round** (owner), so
> `noteToLily`'s packing estimate is left as is and the synthetic strips stay as cut; **`\tupend`
> stays** (owner). Acting on it re-cuts nothing but does invalidate every checkpoint's vocabulary.

## The finding first

The model's vocabulary is **100 tokens** and it spells a note almost character by character, so
`c'''16` costs **6 ids** — one per apostrophe, one per duration digit. Giving the octave marks and
the two-digit durations their own tokens takes the same note to **3 ids** and every real label to
**79% of its current length**, for **4 new ids**. The prize is not comprehension; it is the
**4,012 real strips currently dropped as `over_budget`** ([../METRICS-CORPUS.md](../METRICS-CORPUS.md)).

## How a note is spelled today

Measured by encoding labels with the live tokenizer, `data/checkpoints/round2-stage2-best/tokenizer.json`:

| part of a note | ids | note |
|---|---|---|
| pitch letter | 1 | |
| each octave mark `'` | 1 **each** | `'''` = 3 ids |
| each duration character | 1 **each** | `4` = 1, `16` = 2, `32` = 2 |
| dot | 1 | |
| accidental, `\|`, `\grace`, `\tup3` | 1 | our added tokens are whole words |

So `c'4` = 3, `c'16` = 4, `c''16` = 5, `c'''16` = 6. The renderer's packing estimate in
`tools/render/lilypond.ts` (`noteToLily`) already uses exactly this rule and matches the tokenizer
exactly — the estimate is not an approximation.

### The vocabulary is mostly empty

**45 of the 100 ids never appear** in any label (424,867 labels, all 70 manifests). Four of those are
`<unk>` / `</s>` / `<pad>` / `<s>`, which are in use. The other **41 are genuinely dead**, and 18 of
them are the base model's own LilyPond header tokens — `\key `, `\major `, `\minor `, `\repeat `,
`volta `, `\tempo `, four tempo marks and eight dynamics (`\pp` … `\fff`).

⚠ **Do not reuse a dead id for a new token.** It carries a pretrained embedding for a different
meaning, which is a worse starting point than a fresh row and is invisible when debugging. Appending
is free: `d_model` is 1024, so 23 new tokens are ~24 k parameters against ~143 M — **0.02%**. Ids stay
append-only either way.

⚠ The dead base tokens are **not** an opportunity to label dynamics or tempo. Their embeddings are
pretrained on Western engraving; nothing here has measured whether that transfers, and adding a new
label class is a separate decision with its own corpus cost.

## What re-spelling saves

Every label re-costed under three schemes. `n` = 40,826 synthetic (`strips_v4`) and 3,955 real
(`strips_b8`).

| scheme | new ids | mean (synth) | mean (real) | `c'''16` | length vs today | **rescued of 4,012** |
|---|---|---|---|---|---|---|
| today | — | 40.7 | 36.1 | 6 | 100% | — |
| **A** durations only | 2 | 37.8 | 33.6 | 5 | 93% | not measured |
| **B** durations + octaves | **4** | 32.2 | 28.6 | **3** | **78%** | **2,410 (60.1%)** |
| **C** B + every letter+octave fused | 23 | 23.6 | 20.9 | **2** | **57%** | **3,510 (87.5%)** |
| ⭐ **H** B + the 14 pitches with ≥1,000 notes fused | **16** | — | — | **2** | **57%** | **3,508 (87.4%)** |

⭐ **H is the measured best.** It matches C's rescue to within 2 strips on 7 fewer tokens, and it
leaves the seven rare pitches compositional so none of them becomes a one-example token — which was
the only argument against C. The fused set is `a'` `a''` `b'` `b''` `c''` `c'''` `d'` `d''` `e'`
`e''` `f'` `f''` `g'` `g''`; `a` `b` `g` `c'` `a'''` `d'''` `e'''` stay letter+octave.

Durations alone are nearly worthless (7%) because `4` and `8` are already one character. **The
apostrophes are where the money is** — they are **37.3%** of every id in `strips_v4`
(604,451 of 1,619,274), corroborating the 37.6% already recorded in
[../BACKLOG-LATER.md](../BACKLOG-LATER.md).

### Only four ids are actually new

`'`, `1`, `2`, `4`, `8` are already single ids. The complete set of missing pieces is **`''`,
`'''`, `16`, `32`**. Every octave and duration the corpus contains is then one token:

- octaves seen, all pools: `'` 105,348 · `''` 268,635 · `'''` 4,733 · bare 74. **Three octaves**,
  as the owner said.
- durations seen: `8` · `16` · `4` · `2` · `8.` · `4.` · `2.` · `32` · `16.` · `1` · `2..` · `1.` ·
  `4..` — **13 spellings over 6 base values**.

## The design (owner, 2026-08-27)

**Base durations get tokens; the dot does not fold into them.** `16.` stays `16` + `.`, so the
duration vocabulary is 6 values rather than 13 tokens. Cost of that choice, measured: scheme B goes
77.6% → **79.1%** and scheme C 56.6% → **58.1%** — **~1.5pp of label length for 7 fewer tokens**.
Cheap, and it keeps the dot as one idea in one place.

### ⚠ The implementation trap: add `'` as a token too, or the letters split

Verified, not reasoned. Adding only the four missing pieces makes the pitch letter take **two
different ids depending on what follows it** — `c'''16` tokenizes as `c</w> ''' 16` while `c'8`
tokenizes as `c ' 8</w>`. Both id forms then appear in the real pool (`c` 13 times, `c</w>` 4,850),
so the model would learn each letter twice from split evidence.

Promoting `'` to an added token as well fixes it — every letter takes one id form, mean length is
unchanged at 28.6, and **the vocabulary stays at 104** because `'` is already in it. That is the
version to build.

### The fused-pitch variant (C) is stronger on paper and riskier in fact

C nearly halves labels, but it destroys the compositional structure: today `c'` and `c''` share the
letter's evidence and `a'''` and `c'''` share the octave's. Fused, each of the 21 combinations is
learned alone — and the corpus is very uneven (391,771 notes):

| | |
|---|---|
| commonest | `d''` 15.6% · `e''` 12.8% · `c''` 12.2% |
| **under 1,000 occurrences** | `c'` 364 · `d'''` 933 · `e'''` 23 · `a'''` **1** · bare `a`/`b`/`g` 74 total |

**`a'''` would be a token with one training example.** Under B it is simply the `a` the model has
seen 65,000 times next to the `'''` it has seen 4,733 times.

⭐ **Scheme H removes this objection at no cost**: fuse only the 14 pitches with ≥1,000 notes and
leave the other seven compositional. The seven are **0.36% of 391,771 notes**, and H's rescue is
within 2 strips of C's. ⚠ Freeze the fused set once — ids are append-only, and a pitch that is rare
today staying compositional forever is the correct behaviour, not a limitation.

## What the change actually buys

⭐ **`over_budget` is the case for doing it.** The emitter drops any strip whose label exceeds 59 ids
([`emit_strip_labels.py`](../../scripts/rung3/emit_strip_labels.py)). In the `b8` emit that is
**4,012 strips discarded against 2,330 accepted** — more real page data thrown away than kept. Their
sizes: median 76 ids, p90 127, max 344.

**The rescue is measured, not estimated** (corrected 2026-08-27, same day). `emit_drops.csv` keeps
only the id count, but `emit_responses.json` keeps **the label of every strip the emitter built,
including the dropped ones** — 15,758 rows, of which exactly the 4,012 over-budget ones re-cost
directly. See the rescue column in the scheme table above. Under **H the whole pool's over-budget
count falls 4,012 → 502**; under B, 4,012 → 1,602.

For scale: `b8` **accepted 2,330** strips. B more than doubles that pool; H roughly triples it.

For comparison, the same pile at a **90-id budget** returns 2,811 of 4,012
([../DECISIONS.md](../DECISIONS.md), 2026-08-22) — but raising the budget costs decode time on every
strip forever, and re-spelling does not.

## What is NOT claimed

⛔ **"Dense 16th-note strips are hard for the model" is untested.** The owner's hypothesis was
checked against the 3,955 `b8` rows and the signal is flat and non-monotonic — exact reads by
16th/32nd share: 0% → 67.9%, 25–50% → 61.1%, 50–75% → 60.0%, 75–100% → 68.6%. ⚠ **That pool cannot
answer the question**: these are rows that *passed* the emit gate, so the failures were already
removed. Survivorship, not evidence of absence.

What *is* measured is that fast-note rows sit against the ceiling — mean ids used, of 59: **30.4**
for rows with no 16ths, **44.3** at 50–75%, **45.3** at 75–100%.

⛔ **Shorter labels are not known to decode more accurately.** Fewer autoregressive steps means fewer
chances to slip, which is a real but unquantified effect. It adds no pixels: a crowded crop stays
crowded, and that is [levers.md](levers.md) Lever 1's territory, which is closed.

### Fused or compositional? Both — the ≥1,000-examples rule (2026-09-03)

The owner asked whether to add one token per pitch per octave, or one token per octave value and
combine it with the letter. **Both**, by the rule H already encodes: a letter+octave pair with
≥1,000 notes is fused (the notehead's height *is* letter+octave together, one decode step fewer,
and the best-performing kern encoding in the literature keeps pitch as one unit with duration
separate); a rare pair stays letter + octave so nothing is learned from one example. Vocabulary
size is not the balance to strike — 16 tokens are 0.01% of the model — examples per token is.
⚠ Verify with the real tokenizer how the seven rare pitches segment (`a'''8` must always be `a`
`'''` `8`, never sometimes `a''` `'` `8`); this file verified the split-evidence trap for B only.
⚠ The 2026-09-03 octave count says a fused token fixes no height misread — 1 octave jump in 69
wrong pitched notes ([../METRICS-DIAGNOSTICS.md](../METRICS-DIAGNOSTICS.md)); the case is yield.

## Retiring `\tupend` — proposed 2026-08-27 (owner), ⛔ DECLINED for Round 4 (owner, 2026-09-03)

> *"tupend i şimdilik tutabiliriz fena okumuyor aslında model şuanda tupletleri."* The analysis below
> stands as written and is not acted on this round; the stitcher's bracketing of an unclosed run is
> what makes the 51% unbalanced pairs cost the user nothing.

The owner's argument: a triplet's length is fixed, so `\tup3` at the front is enough and the closing
token is redundant. **The data agrees, and the reason is stronger than "always three".**

| | |
|---|---|
| `\tup3` groups across all 70 manifests | **33,807** |
| exactly 3 events between open and close | **33,788 (99.94%)** |
| genuinely different, and closed | **1** — `\segno a''8 \tup3 \bakiyeSharp g''8 a''8 \tupend` (`strips_tup`) |
| unclosed at a strip edge | 27, and 14 of the 15 two-event cases are one strip replicated across pool variants |
| malformed gold (`\tup3 \tup3`, a missing close) | 4 |

⚠ **"Always three" is NOT guaranteed by the generator.** `tupletGroupsIn`
([`tools/render/rhythm.ts`](../../tools/render/rhythm.ts)) closes a run *when its duration sum lands
on a plain value* — a quarter-triplet plus an eighth-triplet sums to 1/4 and closes at **two**
events. That is why the corpus contains one. ⭐ **But that same rule is the right replacement**: the
member durations already say where the group ends, so the stitcher can re-derive the boundary with
the identical arithmetic the renderer draws with, rather than counting to three. `\tupend` is
redundant against the durations, not against a fixed count.

### The case is reliability, not budget

⛔ **The token saving is nearly nothing** — `\tupend` is **0.20% of all ids** (3,625 of 1,802,983
over 44,781 labels) and appears in only 4.9% of labels. On its own it rescues **15** of the 4,012
over-budget strips; on top of scheme H, **22**. Do not sell this as a budget change.

⭐ **The case is that the model cannot keep the pair balanced. Across 5,626 audited decodes, 300
mention a tuplet token and 154 of them — 51% — have a `\tup3`/`\tupend` mismatch**: 98 missing a
close, 56 with a stray close and no open. Gold is balanced in all 279 rows that carry the pair, so
every one of those 154 is a model error on the closing token specifically. `stitch.ts` already warns
`stray \tupend ignored`, and the 2026-08-05 rule already brackets an unclosed run — so the failure
is being **worked around** today rather than avoided.

### What it would touch

The `\tie` retirement is the precedent and the procedure ([labeling.md](labeling.md)): the id stays
in `ADDED_TOKENS` (append-only), nothing emits it, and `eval_omr.py` drops it from **both** gold and
decode so old and new checkpoints stay comparable. Beyond that: the close branch in
[`tools/render/stitch.ts`](../../tools/render/stitch.ts) becomes duration arithmetic, and
`audit_coverage.py`'s `\tupend`-equals-`\tup3` expectation goes.

⚠ **The trade is real and unmeasured**: today a wrong `\tupend` moves the bracket; afterwards a
wrong *duration* moves it. Which is worse has not been measured, and pitch/duration is already
**68% of what a user corrects**. ⏭ It rides on the same retrain as the vocabulary change — it is not
worth its own round.

## If it is picked up — the order

1. ⭐ **NO LABEL CONVERSION IS NEEDED — this is a vocabulary change, not a spelling change**
   (corrected 2026-08-27; confirmed by the owner 2026-09-03: *"label lar asla değişmeyecek, sadece
   modelin onları okuma şekli değişecek"*). ⚠ **And no re-render either (owner, 2026-09-03)** — with
   one measurable risk: a synthetic strip packed to 57 old ids is ~33 new ids, a re-emitted real
   strip fills 59 new ids, so long labels would exist only in the real pool. Measure both id-length
   distributions under the new tokenizer before training; that check alone may reopen the render. `c''16` stays the string `c''16`; only how the tokenizer *segments* it
   changes. Verified by adding the tokens and re-encoding. So `NOTE_RE` in
   [`tools/render/stitch.ts`](../../tools/render/stitch.ts), `noteToLily` in
   [`tools/render/lilypond.ts`](../../tools/render/lilypond.ts) and every label on disk are all
   **untouched**. The change is `ADDED_TOKENS` alone — ⚠ duplicated by hand in `src/vision/data.py`
   and `tools/render/lilypond.ts`, so both, or `check_token_drift` fails. ⚠ `noteToLily`'s packing
   estimate does need updating, or the renderer will keep packing to the old cost.
2. **Re-emit, do not convert in place.** A converter over existing manifests proves the spelling
   round-trips, but the point is the strips that were never emitted, and only a re-run of
   `emit_strip_labels.py` produces those.
3. **Warm-start the new embeddings** rather than randomising: initialise `''` from `'` and `16`
   from the mean of `1` and `6`. Untested here, and cheap enough to be worth trying before a full
   retrain from base.
4. **Then price it.** The measurement that decides this is corpus yield — how many `over_budget`
   drops actually return — not a val loss. Accuracy is a second question and needs a paired arm
   against [round3-criteria.md](round3-criteria.md)-style floors.

⚠ **Every existing checkpoint keeps working and none of them understands the new spelling.** Ids are
append-only so nothing breaks, but a model trained on `c ' ' ' 1 6` cannot read `c ''' 16`. This is a
retrain, and it should ride along with the Round-4 rail work
([../BACKLOG-LATER.md](../BACKLOG-LATER.md) item 0) rather than be its own round — both re-emit the
pools, and doing them separately pays that cost twice.
