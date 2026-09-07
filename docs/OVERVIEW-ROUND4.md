# Round 4 in plain words — what Round 3 taught us, and what we change now

purpose: the plain-English version of the Round 4 plan — what we learned, what we change, what we do not change, and what you will be asked to do
audience: the project owner (basic English, same as OVERVIEW.md)
updated: 2026-09-06

> The full plan with its evidence is [rung3/round4.md](rung3/round4.md). This page restates numbers
> on purpose so it reads on its own; if it ever disagrees with [METRICS.md](METRICS.md), METRICS.md
> is right.

## What Round 3 taught us

- We spent Round 3 making the practice pictures look more real. The exam said that was not the
  problem: every kind of mistake those pictures aimed at stayed the same or got slightly worse. Most
  of the score jump (+17 points, about 15 of them) came from no longer writing a tie mark we had
  retired.
- **Your own test of the app says Run A is clearly better** than the Round 3 model and Round 2. Our
  measuring tools said "no difference". Both can be right. The tools look at 262 short pieces of
  pages, and the exam throws away 41% of its material, the wide and dense parts. You look at whole
  pages in the app, dense parts included. So for "which model do we ship", your eyes decide.
- The tools still caught two things eyes cannot: the tie illusion, and the fact that our automatic
  "pick the best checkpoint" step (a checkpoint is a saved copy of the model mid-training) picked
  the wrong copy three times out of three.

## Where the mistakes actually come from

| the cause | the number |
|---|---|
| **We throw away the dense half of every real page before training.** A strip whose label is longer than the budget (an id is one piece the model writes) is dropped. | 2,330 strips kept, **4,012 dropped** — see the budget section below, which is where this one is fixed |
| **The key signature is the biggest single mistake, and part of its answer key was written by the model itself.** | 17.5% of corrections; 24 of 45 exam pieces had the signature overwritten by a model vote |
| **The checkpoint picker looks at the wrong number.** | wrong 3 times out of 3 |
| **Every page we own comes from two websites.** | 1,055 + 1,000 pages, nothing else |

## What we change, and what we do not

**We do not draw new practice pictures.** You said so, and the data agrees. The labels never change
either; only the way the model cuts a label into ids changes.

**We change how a note is spelled to the model.** Today `c'''16` costs 6 ids: one for the letter,
one for each `'`, one for each digit. So a high note costs three times what a low note costs, and
long strips do not fit. We add 16 tokens: the octave mark `'`, the durations `16` and `32`, and the
14 most common letter+octave pairs (like `d''`) as single tokens. Your question was "one
token per note per octave, or one per octave and combine?" The answer is **both**: a pair that appears
at least 1,000 times gets its own token; a rare one (`a'''` appears once in the whole corpus) stays
as letter + octave, so nothing is learned from one example. This does not make octave reading
better by itself. We counted: of 69 wrong notes, only **1** was an octave jump; most were one line
off. What it buys is that **almost all of the 4,012 dropped strips come back**, about three times more
real training data.

**We keep `\tupend`** (the triplet closing mark). You judged the triplets read well enough.

**We keep stage 2 at 4,000 steps**, the recipe that produced Run A.

**We fix the picker** so it chooses by "how many corrections on real pages", not by a loss number
that is 92% synthetic.

**We stop the signature vote from silently overwriting the answer key.** Where the model's vote
disagrees with the makam table, the rows go to you for a look instead.

**We test two new websites first, small.** 20–40 pages, about 200 strips labelled by hand, the
current model scored on them. If it falls apart there, new sites become the priority. If it holds,
they are only more of the same.

**Beam search** (letting the model keep several candidate readings open instead of committing to
one at each step) is tested only on our side first. It would make a page about half again slower
for the user, not three times; it reaches the app only if it clearly helps.


## What the first check found (6 September 2026)

Before adding any token we ran a small test — about two minutes, no training, nothing re-read. Three
results.

**We were about to add two tokens that nothing would ever use.** The plan listed `''` and `'''` as
new tokens. We counted every note in the whole collection — 450,456 of them — and those two are used
**zero** times. The reason is simple: once `d''` is its own token, nothing is left that needs `''`
on its own, and `d'''` gets written as `d''` plus one `'`. So the list is 16 tokens, not 18. This
matters because token numbers can never be removed later. Two minutes of checking saved a permanent
mistake.

**The worry about rare notes was unfounded, and the change fixes a small problem we already had.**
We were afraid a rare high note might be cut up differently each time, so the model would have to
learn it twice. It does not happen: every rare note is cut the same way every time. And today's
spelling *does* have that problem in a small way — **1.277%** of all notes are written in a second,
different form. After the change that drops to **0.003%**.

**The gain is confirmed: 3,508 of the 4,012 thrown-away strips come back** on the spelling change
alone, and the budget decision below brings back most of the rest. The real training set goes from
3,929 strips to **7,437+** — nearly double.

### The budget: it was 59, and it is now 80 (your call, 7 September)

A "budget" here is how long a label is allowed to be before we drop the strip. It was 59 ids. You
pointed at three strips on a page you had corrected by hand and said the model reads strips of 85–90
ids correctly, so 59 looked too tight. **You were right, and for a stronger reason than expected.**

- **59 was never a limit of the model.** It was a rule we wrote for ourselves, to keep bad labels out
  of training. The model's real limit is **100**, and it is in two places: the reader in the browser
  stops after 100 pieces, and the training code cuts a longer label off at 99. Cutting a label off is
  the worst thing that can happen here — it teaches the model to stop early, which is exactly the
  mistake we are trying to remove.
- **Your 85–90 was in the OLD spelling.** The new spelling writes the same music ~40% shorter. So
  what you saw was the model walking 85–90 steps correctly, and the new spelling gives those steps
  more music each. Your observation supports the change more strongly than it first looked.
- **Your three strips**, measured: 92 → **57** ids, 99 → **61**, 131 → **67**. And over the 579
  labels you have typed by hand, the longest one under the new spelling is **67**. Nothing you have
  ever corrected comes near 85.

**So the budget is 80.** Out of every 100 strips, 99 now fit. The re-cutting tool only has to touch
**148** windows instead of 504, and **356 dense strips are trained whole** instead of being sawn in
two. 20 ids of room are left under the hard limit of 100.

⚠ **Two costs, said out loud.** Our practice pictures stop at 44 ids, so raising the real budget to
80 makes the gap between practice and real pages about twice as wide as it was. And the planned
side-by-side test of old spelling against new cannot use exactly the same strips any more: 769 of
them are too long for the old spelling to hold at all. Neither is a blocker; both are decisions to
take before those steps run.

### One real risk, and why we are not fixing it by re-drawing

The new spelling makes labels shorter. Our practice pictures then stop at 44 ids, while real pages
reach 59 — and 80 after the budget decision above. So **887 real strips (12 out of every 100)**, and
now more, are longer than anything the model practises on. We asked whether to re-draw the practice pictures to make them longer, and you said yes — then
we measured how, and it does not work.

To carry 56 ids, a practice picture would have to be about **2,580 pixels** wide. Real page cuts are
never wider than **1,450 pixels** — the slicer refuses. And we already measured that wide pictures
cost accuracy: the model looks at a fixed small window, so a wide picture arrives shrunk and the
notes get harder to see. So re-drawing would fix the label length by making the pictures *less* like
real pages. We stopped.

What we do instead: **watch it**. When the new model is read, long strips get their own score
column. If the model does stop too early on them, we will see it as a number instead of guessing.
The honest fix, if it is ever needed, is to draw the notes closer together — not wider pictures.
That is written down and not costed.

## What you will be asked to do

1. ✅ **Done 6 September** — you confirmed the 16-token spelling (scheme H), and you confirmed we do
   not re-draw the practice pictures.
2. ✅ **Already done** — Run A is what visitors read today.
3. ⏭ **This is the one thing waiting on you.** Pick 10–15 pages outside the exam as your fixed
   hand-test set. They must not be exam pieces, and once chosen they stay the same, so every model is
   read on the same pages and the counts can be compared. Send me the page names or files and I will
   set up the counting.
4. Read the signature rows the vote disagrees on, and later the audit sample of the re-emitted
   strips: roughly 450 fixes out of 3,500 new strips.

Everything else (the tokenizer check, the picker, the re-emit, the two trainings) needs no decision
from you and no labelling.
