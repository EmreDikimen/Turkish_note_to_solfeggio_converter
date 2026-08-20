# Round 3 — the model plan, in plain words

purpose: the plain-English version of the model track: what is being changed, when we train, and what
the exam decides
audience: the project owner

updated: 2026-08-20

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

⛔ **Closed on 19 August: no more drawing work on triplets, and none of Round 3's three trainings is
a triplet training.** Two small things survive and neither costs anything:

- **A better lead, found by accident.** When a piece has several triplets in a row, the model marks
  the **first** and forgets the later ones — about 96% right on the first, 81% after. If that is real,
  the problem was never the drawing; it is that the model loses the thread as it reads along. ⚠ We do
  not believe it yet: one single piece supplied a third of the examples. **We will check it for free
  during the final exam**, because that reading happens anyway.
- **The "3" you saw between the curve and the notes** — ✅ **answered on 19 August, by you.** You
  produced two real editions printed that way, so it is now drawn as a *third* way on about a quarter
  of pieces, for variety and **not** as a correction. It goes into the final model's pictures only.
  It also cost us a claim: our "all 16 marks break the curve" note is withdrawn (item 1d below).

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
   described further up. Shrinking does cost accuracy; we cannot buy the reverse. ⛔ **And the one
   cheap change it left behind — one bar per picture — was itself dropped on 19 August, on your
   objection.** The reasoning is in the run table further down. Nothing survives this item.
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
   <http://localhost:8377> and pick the **batch3** tab (cut 19 August — it replaces batch2, see
   below). Each row shows a real strip with the model's reading already filled in, so you correct
   rather than type from scratch.
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
   computer-set anyway. We cut a **new** batch of scans instead.

   ✅ **THAT BATCH IS CUT AND WAITING FOR YOU (19 August): 54 pages, 1,499 strips, the `batch3` tab.**
   Your 8 corrections from batch2 were copied into the master list first, so none of that work is
   stranded. **Two things about the cut are worth your knowing, because both cost something:**
   - **28 pages were thrown out before you see them**, over four rounds of cut-check-recut (dropping a
     page pulls the next one in, and that one has to be checked too).
     **11 were handwritten.** We looked at 56 page pictures, and 20 of them again at full size. The
     rule we settled on is deliberately **narrow**: throw out pages where the *notes themselves* are
     written by hand with a pen — but **keep** the ones a professional copyist wrote out neatly and a
     publisher then printed. Most of the Turkish sheet music we have is exactly that, and so is the
     exam. The wide rule would have emptied the batch and taught the model a kind of page the exam
     does not contain.
     **17 were out of date — 24% of the 71 pages we checked.** Their pictures were cut by an older
     version of the page-cutter, so your answers on them would be thrown away if we ever re-cut. You
     chose to exclude them rather than label into them, and that is the right call while rebuilding
     the training sets (item 3) is still an open question.
   - ⚠ **The cost, on the record**: the pages we dropped were the *most* damaged ones, so the batch is
     now a little less rich than it started — 43.0 units of visible damage a page instead of 46.3.
     You accepted that trade knowingly.
   ✅ **YOU DID THAT, AND IT IS PAYING BETTER THAN EXPECTED (20 August).** 95 of the 1,499 rows
   judged, **56 of them fixes** — well above the 3-in-10 the scanned pages set as the mark to beat,
   and far above the 1-in-8 of the clean batch you left. A row arrives with the model's reading
   already in it, so a row you mark "right" changes the training data by nothing — **the fix rate is
   the whole value of the batch.** Keep going; re-read it with
   `scripts/rung3/build_label_batch.py --stats --batch 3` whenever you want the current number.
   ⭐ **And your eyes found something no measurement of ours did.** You noticed the model reading a
   **dotted bar line** — the light dotted divider Turkish editions print inside a bar, to show the
   beat pattern — as a **repeat sign**. It is not a one-off: we counted it, and **117 of the 1,499
   rows (about 1 in 13)** claim a repeat sign, and of the ones judged so far **more than half had it
   deleted as wrong**. The cause is the same shape as the short-note-dots problem: we have **no way of
   writing a dotted bar line down at all**, so we have never drawn one — **none** of our 40,826
   practice pictures contains one — and the closest thing the model knows is a repeat sign, which is
   also a line with dots. ⚠ **This is owed work, not next work**: fixing it means a new symbol and a
   redraw, which is a Round 4 conversation, not something to squeeze in beside a run that is already
   packed. It is written down so it cannot be lost.
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
1d. ✅ **DONE 19 AUGUST, BY YOUR EYES — and you were right.** You asked where the "3" on a triplet is
   printed, having spotted it **between the curve and the notes**, which is neither of the two ways we
   draw it. You then produced **two real scanned editions** doing exactly that. Our own note said all
   16 marks we had measured break the curve instead — that note is now **withdrawn**. It was never
   wrong about the 16; it was wrong to speak for Turkish printing in general, and it could not have
   found your example because **not one checked page we own is printed that way**. We measured your
   two pages rather than copying them by eye, and drew it as a **third** way, used on about a quarter
   of pieces. The part that makes it worth having: in real print the "3" and the curve are **separate
   ink**, never touching — our old mark welded them into one shape, which is exactly why it looked
   like an ordinary phrase curve. ⚠ It goes into the **final** model's pictures only, never into one
   of the test runs, because it changes a slice of every piece and would muddy what that run measured.
   ⚠ And we claim **nothing** about accuracy from it: no page we can score is printed this way.
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
1f. ⛔ **RAN ON 19 AUGUST — AND IT CHANGED NOTHING. The scan look stays OFF.** Read the item below for
   what it was and why it was worth trying; this line is the result. Judged the fair way — the same
   pages read by both models, page by page — the scan-trained model was **very slightly worse**, and
   the range around that number comfortably includes "no difference". It also rules out any
   improvement bigger than about **5%**, so this is an answer, not an unresolved question. The check
   that it did no *harm* to computer-set pages passes. ✅ **Your decision, same day: leave it off in
   the final model.** That costs nothing to act on — off is what it already is — and the work is kept
   on the shelf, one switch away, if a later round wants it. ⚠ **That is now three ideas in a row that
   came back empty, all of them the same idea**: make our practice pictures look more like real pages.
   The triplet mark, the second printing program, and now the scan look. We had *assumed* this axis
   was running out; it is now **measured** to be. A fourth one does not follow. The short-note-dots
   run is a different idea — a symbol the model has **never seen once** — and it stands.
   **What it was: we have never made our practice pictures look like a SCAN.** We do rough up our clean pictures before the model sees them — but only in two ways:
   like a **screenshot** (slightly resized, a bit of compression) and like a **phone photo** (paper
   texture, shadows, uneven light, held at an angle). A scan of a 1970s printed booklet is neither. It
   has flat light and no angle, but it *does* have speckles, thin lines that break up, ink that spreads
   on the thick strokes, print showing through from the back of the page, and a slight tilt. We have
   never drawn any of that — and **93% of the exam is scans**.
   ✅ **Why this one goes first:** nothing has to be redrawn, no new answer keys are needed, and it is
   one file. Every other idea on this list costs either a full redraw or your hands.
   ✅ **BUILT, PACKED AND RUN THE SAME DAY** (about 3 hours on the rented computer, roughly 5–10
   credits) — the result is the line at the top of this item. What was built: the six new ways of
   roughing up a picture, the recipe written down and signed *before* the code was written (out of
   every 100 practice pictures: **55 screenshot-like, 20 photo-like, 25 scan-like**), the pages we
   will score it on, and the zip and the notebook ready to upload.
   **Why it is one run and not two:** the model we compare against already exists on disk — same
   practice pictures, same split, same recipe, same length. The *only* difference between the two is
   the mix above. Your laptop cannot do this one; it has no fan, and a smaller run on it would break
   exactly the sameness that makes the comparison worth anything.
   ⚠ **One honest trade, decided in advance.** The reason we lean toward screenshots is *you* — real
   uploads to the app are mostly screenshots. Aiming at scans makes the model better at the **exam**,
   which may not be what your friends upload. So the scan look is **added beside** the other two rather
   than replacing them, and we wrote down the recipe before running it, not after seeing the score.
   ⚠ **Two things we found while building it, and both change what we are allowed to claim.**
   - **We cannot make the same practice picture twice.** The library that roughs up the pictures picks
     its randomness from the computer itself, not from a number we choose — so "same settings, same
     pictures" is a sentence this project may not write. Every comparison we have ever run still
     stands (they compare *whole piles* of pictures, not single ones), but nobody should ever claim we
     re-ran one exactly.
   - **The pages we called "hard" are not the hard ones.** They were filled in by the model first and
     then confirmed by hand — so that model's descendants find them *easy*, and the numbers say so
     plainly. We caught this while building the scoring, and moved what this run is judged on
     **before signing it**: scanned pages against computer-set pages, which is the thing the scan look
     actually changes. If we had noticed after seeing the score, the result would have been worthless.
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

**The practice runs are finished. One job is yours and one decision is yours** — correcting answer
keys in the `batch3` tab, and telling us whether the short-note dots go into the final drawing (see
just below the table). **All the practice runs have now been read:**

| # | The run | Needs a redraw? | Where it stands |
|---|---|---|---|
| 1 | Practice pictures that look like scans | no | ✅ **run, and it changed nothing** (19 August). The scan look stays **off** |
| ~~2~~ | ~~One bar of music per picture~~ | — | ⛔ **dropped 19 August, on your objection** — see below |
| 2 | Short-note dots — the model read "play it short" as "make it longer" 72.7% of the time, because every dot it had ever seen meant longer | yes | ✅ **run 20 August, and it WORKED — 72.7% → 0%** |
| 3 | The final model — whatever won above, plus your corrected answer keys | — | ⏭ **next.** Everything it was waiting on was decided on 20 August |

⭐ **The short-note-dots run is the first thing we have tried in Round 3 that actually worked**, and
it is worth knowing why. The three that came back empty all asked the model to read something **it
already knew** from slightly more realistic-looking practice pictures. This one showed it a mark it
had **never seen even once** — we had never drawn a short-note dot, not in any of the 40,826 practice
pictures. A **gap in what it has been shown** is a different kind of problem from *pictures that look
a bit wrong*, and only the first kind responded.

How well it worked: on the test pictures that carry the mark, it now gets the length wrong **0 times
out of 110**, down from 80 out of 110. It also did not break anything to get there — the real dots
that genuinely *do* mean "longer" are still read just as well as before, and the note-name accuracy
did not drop. Best of all, it now reads a page **with** these marks exactly as well as the same page
**without** them: the marks stopped confusing it entirely rather than merely confusing it less.

⚠ **One honest limit, and it is not small.** We tested this on **our own drawn version** of the mark.
We do not own a single hand-checked real page that carries one, so we cannot yet prove the model
reads a *printed* short-note dot from a real edition. It is the same gap we have with the third
triplet shape, and the same fix: find real pages that use it.

✅ **DECIDED 20 August: the short-note dots GO IN.** The worry was that the final drawing already
carries the new third triplet shape, so turning on two new things at once would leave us unable to say
which one did what. Three things answered it. The run **measured no cost** — every accuracy number
came out level or slightly up, so nothing is being traded blind. Neither of the two is an *experiment*:
the triplet shape is there because we measured real printed pages, and the dots are there because the
run passed. And the dots keep **their own separate test**, so that particular result stays readable
whatever else changes. What we genuinely give up: if the final model moves overall, we cannot say which
switch moved it — and that was already true, because the exam cannot resolve a difference that small.

⭐ **AND A THIRD THING GOES IN, which you found yourself while labelling.** Turkish editions print a
**dotted bar line** to mark the beats of the usul inside a bar. We have never drawn one — not once in
40,826 practice pictures — and there is no name for it in the model's vocabulary, so the model reaches
for the closest thing it knows: a **repeat sign**, which is also a line with dots. It is the same kind
of problem as the short-note dots, and that now means something proven rather than argued.

How big it is: **117 of 1,499** pictures in your current batch produce a false repeat sign, and about
**one correction in five that you are typing right now is deleting one**. You are fixing by hand
something one drawing change removes at the source.

⚠ **We draw it, but we do NOT give it a name.** That sounds odd, so here is the reason. If we gave it
a name, every answer key we already own would become wrong — none of them mentions a dotted bar line,
because we never drew one. Drawing it *without* a name teaches the model "this mark means nothing",
which agrees with every answer key on disk, and therefore costs **no new labelling at all**. That is
exactly the trick that made the short-note dots work. Teaching the model to write the mark down is a
question for Round 4.

⛔ **Why the one-bar-per-picture run is gone, and you are the one who stopped it.** You objected that
the page-cutter *already* splits over-wide pictures at the gaps, and it does — about a quarter of real
pictures get split that way. What actually makes us throw a picture away is not its width but the
**answer being too long to write down**, and nearly one in eleven *single*-bar pictures blows that
limit on its own, which no amount of narrowing fixes. What was left was making our practice pictures
match real ones in shape — the same "make it look more real" idea that has now come back empty three
times in a row. So it does not get a run.

**Then the exam, once.** We read it **once**, on the final model — if you keep re-sitting a test you
eventually pass by luck and learn nothing. The pass mark was written down and signed before any of this
started and does not move: **at least 3 pages in 4 needing 5 fixes or fewer**, against 57 in 100 today.
Pass, and the app can go public. Miss, and we say so plainly and start Round 4; your two friends keep
the link either way.

⛔ **A correction to what this page used to say.** It said the exam is "45 pieces, 67 pages". The
pieces and the 67 pages are right — but we have only ever **marked 46 of those pages**. The other 21
were never labelled. They are page 2 of a piece whose page 1 was done, and they have been sitting on
the disk unused.

⭐ **So the exam grows, and the growth is free.** Those 21 pages belong to pieces the model is
**already** forbidden to train on, so labelling them takes nothing away from the model. **46 → 67
pages, about 150 strips, roughly 120–130 needing your eyes.** For comparison, `batch3` has about 1,385
rows still open — so this is about a tenth of the labelling you are already committed to, and it is
the tenth that decides whether the exam result means anything. ⏭ **If you only have one evening, spend
it here.**

⚠ **Why we stop at 67 and do not keep going.** A small test wobbles. At 46 pages the wobble is about
±12 points — a model truly at 72 can score 78, and one truly at 78 can score 72. At 67 pages it is
about ±10. But the number that actually decided it is a different one: **to prove you passed a 75 mark,
you would have to score about 86 at 46 pages, and still about 81 at 200 pages.** Precision improves
only with the *square root* of the effort, so no exam we can afford makes a close result clear. Buying
more pages is the wrong purchase; printing the wobble beside the score is the right one. We are doing
**both** honest things: growing to 67 **before** we read it, and printing the wobble with the result.

⚠ **One rule that comes with growing it, and it is not optional.** The 57-in-100 we are measuring
against was measured on the 46-page version. If the exam grows and that older number does not get
re-measured on the same 67 pages, we would be comparing two different tests. So the old model gets
re-marked on the new exam first. It is one cheap computer run, not another training.

⭐ **One more thing the counting turned up, and it is uncomfortable.** On the pages we *do* mark, we
only actually grade **326 strips out of 608** — the other 282 are thrown away, and they are the
**widest and busiest** ones. So the exam has been reading each page on its easier half. It does not
change the pass mark (it makes the exam a little too kind, which we had already written down as a
known bias), but it must be said out loud beside the result.

⭐ **And it points at the single best-value thing on the list.** The reason those busy strips get
thrown away is a limit of **59** on how long an answer may be. That limit is not a law of the
machine — it is a **setting** we inherited from the original model, a number in a file. Raising it
would pay three times over: it would return those thrown-away exam strips, it would let in the busy
triplet music (**sirto, longa, saz semaisi**) that today is excluded from both the training and the
exam, and it would recover about 2,100 discarded practice pictures. ⏭ **The next step is only to
measure it** — count how many of the thrown-away pieces would fit if the limit were 90, or 120. That
is a small script, no training, no redraw. Actually raising it is a Round-4 job, because it would
change every file we own and how fast the app runs, all at once.

⚠ **Your labelling is the slow part, not the training.** The first three runs do not wait for it; only
the final one uses your corrections.

⚠ **Correcting answers while a run is going is safe — *using* them is not, yet.** A verdict you
give lands in one list and nowhere else, so it cannot disturb anything. But folding those corrections
into the training sets would change the practice material underneath the run in progress, and then a
better score would no longer tell us what did it. The scan run has now been read, so that particular
wait is over; the same rule now applies to the short-note-dots run. Nothing about this slows your
hands down.

The longer backlog these were chosen from — and the three ideas we tested and closed on 28
July, which should not be re-proposed — are on [OVERVIEW-MODEL.md](OVERVIEW-MODEL.md).

---

