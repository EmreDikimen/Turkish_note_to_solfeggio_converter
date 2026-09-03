# Round 4 in plain words — what Round 3 taught us, and what we change now

purpose: the plain-English version of the Round 4 plan — what we learned, what we change, what we do not change, and what you will be asked to do
audience: the project owner (basic English, same as OVERVIEW.md)
updated: 2026-09-03

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
| **We throw away the dense half of every real page before training.** A strip whose label is longer than 59 ids (an id is one piece the model writes) is dropped. | 2,330 strips kept, **4,012 dropped** |
| **The key signature is the biggest single mistake, and part of its answer key was written by the model itself.** | 17.5% of corrections; 24 of 45 exam pieces had the signature overwritten by a model vote |
| **The checkpoint picker looks at the wrong number.** | wrong 3 times out of 3 |
| **Every page we own comes from two websites.** | 1,055 + 1,000 pages, nothing else |

## What we change, and what we do not

**We do not draw new practice pictures.** You said so, and the data agrees. The labels never change
either; only the way the model cuts a label into ids changes.

**We change how a note is spelled to the model.** Today `c'''16` costs 6 ids: one for the letter,
one for each `'`, one for each digit. So a high note costs three times what a low note costs, and
long strips do not fit. We add 16 tokens: the octave marks `'` `''` `'''`, the durations `16` `32`,
and the 14 most common letter+octave pairs (like `d''`) as single tokens. Your question was "one
token per note per octave, or one per octave and combine?" The answer is **both**: a pair that appears
at least 1,000 times gets its own token; a rare one (`a'''` appears once in the whole corpus) stays
as letter + octave, so nothing is learned from one example. This does not make octave reading
better by itself. We counted: of 69 wrong notes, only **1** was an octave jump; most were one line
off. What it buys is that **3,508 of the 4,012 dropped strips come back**, about three times more
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

## What you will be asked to do

1. Say whether the 16-token spelling (scheme H) is what you want. It is my recommendation, not yet
   your decision.
2. Decide whether Run A goes live now. My recommendation is yes.
3. Pick 10–15 pages outside the exam as your fixed hand-test set, and count corrections per page
   for each model on the same pages. That becomes the page-level score we never had.
4. Read the signature rows the vote disagrees on, and later the audit sample of the re-emitted
   strips: roughly 450 fixes out of 3,500 new strips.

Everything else (the tokenizer check, the picker, the re-emit, the two trainings) needs no decision
from you and no labelling.
