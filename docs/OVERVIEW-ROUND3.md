# Round 3 — the model plan, in plain words

purpose: the plain-English version of the model track: what is being changed, when we train, and what
the exam decides
audience: the project owner

updated: 2026-08-19

> Split out of [OVERVIEW.md](OVERVIEW.md) on 2026-08-19, when that page passed its size limit. Genre
> split: that page is the app and where we stand today; this one is the model plan. Neither is the
> authority on current state — that is [STATUS.md](STATUS.md). The model's *history* (Rounds 1 and 2,
> and the ideas we tested and closed) is [OVERVIEW-MODEL.md](OVERVIEW-MODEL.md).

## The triplets — the whole story, and it is finished (closed 19 August 2026)

A triplet is three notes played in the time of two. Printed music marks it with a small "3" and
usually a curved line over the notes. Miss the mark and the rhythm comes out wrong.

**The short version.** You reported two triplets read wrongly. We found the model was **missing**
about one in six, and we thought we knew why: real Turkish sheet music **breaks the curve** and puts
the "3" in the gap, while we drew an unbroken curve with a "3" floating above. So we redrew it, you
checked it against a real edition, and we ran two identical trainings to see whether it helped. New
mark: **48 of 54** triplets. Old mark: **46**. Two triplets is too small to trust — the honest answer
is **we could not tell**. We kept the new mark anyway, because it is what real sheet music looks like,
and we claim nothing about accuracy. The full account, including the flattering number we nearly
quoted: [OVERVIEW-MODEL.md](OVERVIEW-MODEL.md).

⛔ **Closed on 19 August: no more drawing work on triplets, and none of Round 3's four trainings is
a triplet training.** Two small things survive and neither costs anything:

- **A better lead, found by accident.** When a piece has several triplets in a row, the model marks
  the **first** and forgets the later ones — about 96% right on the first, 81% after. If that is real,
  the problem was never the drawing; it is that the model loses the thread as it reads along. ⚠ We do
  not believe it yet: one single piece supplied a third of the examples. **We will check it for free
  during the final exam**, because that reading happens anyway.
- **The "3" you saw between the curve and the notes** — a position we have never drawn. That needs
  your eyes on real examples, one at a time (item 1d below). If it is common it goes in as *another*
  way of drawing it, for variety, not as a correction.

Details: [rung3/tuplets.md](rung3/tuplets.md).

## List B — the model (Round 3, running in parallel)

1. ✅ **DONE — Round 3's target is written down and you signed it (15 August).** On the honest
   measure: **3 pages in 4 need 5 fixes or fewer**, against 57% today. It does double duty as the gate
   for opening the app to everyone. It was fixed *before* training, and it does not move afterwards —
   if the round lands under it, the app stays with the two friends and we do a Round 4.
   Why three-in-four and not nine-in-ten: nine-in-ten is where we are going, but no round so far has
   moved this number that far in one go, and a target nobody can reach stops telling us anything.
1b. ✅ **DONE — the triplet mark is redrawn, tested, and kept** — the item just above.
1c. ✅ **DONE 15 August, and then STOPPED 17 August** — the blank-paper test and the follow-up, both
   described further up. Shrinking does cost accuracy; we cannot buy the reverse. What is left of it is
   one cheap change: **print the practice pictures one bar per strip** so the model stops practising on
   blurrier music than it is tested on. 13% more pictures, nothing else moves.
1b2. ⛔ **17 August — DROPPED, AND YOU ARE THE ONE WHO DROPPED IT.** You reported that the app does
   badly "especially in classical parts", we measured it and it looked real, then you **tried it
   again** and found it was not: classical pages come out no better and no worse than songs. So there
   is no "classical problem" and the plan to collect classical sheet music is cancelled. ⚠ One
   explanation we gave you along the way was **wrong and is withdrawn** — we said those pages were
   simply worse photocopies, which came from a number that does not measure scan quality at all. The
   full account, and the 94.8% figure that still needs its correction, are on
   [OVERVIEW-MODEL.md](OVERVIEW-MODEL.md). ⚠ What is left is the plain version: **the model is not good
   enough yet, on everything.** That is what Round 3 is for.
1c2. ⏭ **THIS WEEK — you are hand-correcting real answer keys, and that is the better bet.** Why:
   of the real answers we have checked so far, **531 needed fixing against 167 that were fine — three
   in four wrong.** And the note itself is 40% of what a user fixes. If the answers we train on have
   wrong notes in them, the model learns wrong notes, and no amount of redrawing our practice music
   repairs that. Against seven synthetic ideas that mostly came back "no", this is measured, large,
   and on the right axis.
   **The tool:** `.venv-ml/bin/python scripts/rung3/review_ui.py`, then open
   <http://localhost:8377> and pick the **batch2** tab (new, 18 August). Each row shows a real strip
   with the model's reading already filled in, so you correct rather than type from scratch.
   **What changed and why:** the old **reslice-all** tab has 33,804 rows in an order we then measured
   and found **worse than random** — working down it was close to picking strips by chance. So we cut
   a batch out of it instead: **52 pages, about 1,500 strips**, chosen as the pages showing the most
   visible damage, with **every strip of a page kept together and in reading order**, so you read a
   page once instead of meeting its pieces twenty times. Your verdicts are copied back into the big
   list afterwards, so nothing lives only in the batch.
   ⛔ **CHANGED ON 19 AUGUST — you are moving off the clean pages and onto the SCANS, and you were
   right to want to.** On 18 August the batch was cut from the clean computer-typeset pages ("teach the
   clean modern sheets first"). Then you looked at them and said they were mostly read correctly
   already — and two measurements said the same thing:
   - **The exam is 93% scans.** Of its 67 pages only 5 are computer-set. So the clean batch was
     teaching the model about **7%** of what it will be graded on.
   - **Your own verdicts on it: 59 right, 8 needing a fix, 1 unusable.** About **one fix in eight**.
     In the scanned pages the same check finds **one in three**. Since each row arrives with the
     model's reading already filled in, a row you mark "right" changes the training data by *nothing* —
     so seven or eight looks in every ten were buying nothing at all.

   ⚠ **We are not simply switching to the parked first batch.** That one is the most damaged pages of
   the *whole* collection, which is why it filled up with handwriting — and 10 of its 52 pages are
   computer-set anyway. We cut a **new** batch of scans instead, look at the 52 page images first and
   drop the handwritten ones, and check 100 rows before committing to 1,500.
   ⚠ **The clean-pages question is not dead**, it is just not what your hands are for right now: it
   still has to be measured before anyone talks about publishing for clean input only.
   ⚠ **Look at the note and its length, not just the tiny marks.** Every check we have ever done went
   looking for the tiny marks, because that is what the old score measured. Notes and lengths are
   two-thirds of the problem and nobody has ever checked them.
   ⚠ **Old handwritten sheets: mark them `bad` and move on** (your call, 17 August). There are real
   handwritten pages mixed into the scans — the project had assumed everything was printed. Handwriting
   is a genuinely different and harder problem (not one of our 40,826 practice sheets looks anything
   like it), so it gets its own effort later rather than being smuggled into this one.
   ⚠ **Honest expectation on yield:** on this queue, two clicks in three just confirm the model was
   already right. That is the price of the queue being safe. Filtering for bars whose note lengths do
   not add up (your choice, 17 August) is how we raise it.
   ⚠ **You were right to ask whether the pictures were out of date, and it nearly cost you the week.**
   Some of the tabs show pictures cut by the *old* version of the page-cutter: we measured it, and
   **18 of 20 pages there would throw your work away** — the same way you lost 130 answers in July.
   The **reslice-all** tab is the safe one — **20 of 20 pages keep their answers** — and the new
   **batch2** tab is cut from the same pictures, so it inherits that. If you ever want to check first,
   run `scripts/rung3/check_crop_staleness.py`; it can now check **exactly the pages of your batch**
   (`--pages-from …_pages.json`) instead of twenty random ones, which is the honest version of the
   question, because a batch is on purpose made of the roughest pages.
1d. ⏭ **THEN, and it needs your eyes rather than a computer: where is the "3" on a triplet printed?**
   You spotted it sitting **between the curve and the notes** on a real page, which is neither of the
   two ways we have drawn it. Our notes say all 16 marks we measured do it differently — but 16 marks
   is a small sample, and one clear counter-example is enough to reopen it. The tool shows you real
   examples one at a time and you say yes or no; we change no drawing until you have.
1e. ✅ **THE BIG UNTRIED ONE — VARIETY — WAS TRIED ON 18 AUGUST, AND IT DID NOT PAY (yet).** All
   40,826 practice pictures come from **one** music-printing program, one font, one spacing, while real
   sheet music comes from many publishers that each look a little different. You moved this ahead of
   the note-mix work on 17 August after asking about fonts. Here is what happened.
   ✅ **A second printing program now works**, it is free, and — the part that could have killed the
   idea in a morning — it already knows all eight Turkish quarter-tone symbols and draws each one for
   the same pitch we do. It prints from **our existing answer keys**, so a second look costs no new
   answer-writing, and all 40,826 pictures would take about an hour and a quarter. The safety check
   passes on all **312** test pictures.
   ⛔ **But the pictures did not come out any closer to real sheet music** — same as before or slightly
   worse, on every measurement we have. **Reported as it came out.**
   ⏭ **This does not license printing all 40,826 that way.** 312 pictures answers "does it work", not
   "does it teach the model better", and only a training run answers that. The two honest limits on
   that null result, and the four things that would have to be added first, are on
   [OVERVIEW-MODEL.md](OVERVIEW-MODEL.md).
1f. ⭐ **NEW ON 19 AUGUST, AND IT IS THE NEXT TRAINING: we have never made our practice pictures look
   like a SCAN.** We do rough up our clean pictures before the model sees them — but only in two ways:
   like a **screenshot** (slightly resized, a bit of compression) and like a **phone photo** (paper
   texture, shadows, uneven light, held at an angle). A scan of a 1970s printed booklet is neither. It
   has flat light and no angle, but it *does* have speckles, thin lines that break up, ink that spreads
   on the thick strokes, print showing through from the back of the page, and a slight tilt. We have
   never drawn any of that — and **93% of the exam is scans**.
   ✅ **Why this one goes first:** nothing has to be redrawn, no new answer keys are needed, and it is
   one file. Every other idea on this list costs either a full redraw or your hands.
   ⚠ **One honest trade, decided in advance.** The reason we lean toward screenshots is *you* — real
   uploads to the app are mostly screenshots. Aiming at scans makes the model better at the **exam**,
   which may not be what your friends upload. So the scan look is **added beside** the other two rather
   than replacing them, and we write down the recipe before running it, not after seeing the score.
2. **Draw more eighth notes and longer bars** (the item explained below) — the original Round 3.
   **Still on, and now last of the drawing changes.** Check on 300 sample pictures before redrawing all
   40,826.
3. **Decide whether to rebuild the training sets from the newly-cut strips.** Not automatic — it
   would rewrite the lists that our hand-checked answers hang off.
4. **Collect real pages from more websites than the two we use** (your decision, 17 August). ⚠ Worth
   knowing what it does and does not buy: we already have about **2,500 real page pictures nobody has
   checked by hand**, so the thing slowing us down is the checking, not the collecting. More pages will
   not speed that up — but you decided to widen the net anyway, and that is recorded.

## When we train the model again, and what happens after

"Training" means showing the model hundreds of thousands of practice pictures, each with the correct
answer beside it, and letting it adjust itself until it reads them well. One run takes **1 to 4 hours**
on a rented Google computer and costs a few dollars of credit. The computer time is cheap. The
expensive part is deciding **what to change before each run**, because we can only learn one thing per
run — change three things at once and a better score tells you nothing about which one did it. That
has already happened to us twice.

**Right now: no training.** Two things happen first, at the same time — you correct answer keys on
scanned pages, and we build the scan look. Then four runs, in this order, one change each:

| # | The run | Needs a redraw? |
|---|---|---|
| 1 | Practice pictures that look like scans | no |
| 2 | One bar of music per picture (ours are wider than real ones, so the model has been practising on more squashed music than it is tested on) | yes |
| 3 | Short-note dots — the model reads "play it short" as "make it longer" 72.7% of the time, because every dot it has ever seen meant longer | yes |
| 4 | The final model — whatever won above, plus your corrected answer keys | — |

**Then the exam, once.** 45 pieces, 67 pages the model has never seen and never trained on. We read it
**once**, on the final model — if you keep re-sitting a test you eventually pass by luck and learn
nothing. The pass mark was written down and signed before any of this started and does not move:
**at least 3 pages in 4 needing 5 fixes or fewer**, against 57 in 100 today. Pass, and the app can go
public. Miss, and we say so plainly and start Round 4; your two friends keep the link either way.

⚠ **One warning worth having now rather than on the day.** 67 pages is a small test, so the score
wobbles by about ±12 points either way: a model truly at 72 can score 78, and one truly at 78 can
score 72. There are exactly two honest ways to handle that and **both have to be chosen before we
read it** — grow the exam first, or read it as signed and print the wobble beside the number.
Choosing after seeing the score is the one thing we cannot do.

⚠ **Your labelling is the slow part, not the training.** The first three runs do not wait for it; only
the final one uses your corrections.

The longer backlog these were chosen from — and the three ideas we tested and closed on 28
July, which should not be re-proposed — are on [OVERVIEW-MODEL.md](OVERVIEW-MODEL.md).

---

