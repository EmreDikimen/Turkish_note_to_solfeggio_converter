# What we found in late July 2026 — in plain words

purpose: the plain-English write-up of the late-July findings (the 27 July correction count and the 28 July test day), split out of OVERVIEW.md at the 400-line cap
audience: the project owner (basic English, same as OVERVIEW)
updated: 2026-08-06

> Split out of [OVERVIEW.md](OVERVIEW.md) on 2026-08-05. This page is **history** — it records what
> we found on one day, not what to do now. Current state in plain words is
> [OVERVIEW.md](OVERVIEW.md); the short do-not-re-propose list lives there too.

---

## What we learned last (27 July 2026) — we were fixing the wrong 13%

We counted every correction a user would have to make on the exam, and sorted them by *what* needs
fixing:

| what you would have to fix | share |
|---|---|
| **the note itself (which line/space it sits on)** | **40%** |
| **how long the note is** | **28%** |
| tie / triplet / grace marks | 13% |
| **the microtonal marks (koma, küçük, bakiye…)** | **13%** |
| bar-lines, repeats | 5% |

Two whole rounds of work went into that 13%. Not because it was the biggest problem — but because
our old score *only measured that*. It could not see the other 87%.

Two more things came out of the same count:

- **A few bad strips do most of the damage.** Strips with three notes or fewer are only about 1 in
  18, but they cause a fifth of all corrections. ⚠ **We first thought the model "invents a whole bar"
  on these — that was checked on 28 July and it is wrong** (only 1 of the 8 such strips in existence
  did anything of the sort). It simply cannot read them. See the 28 July section below.
- **You were right about the octave labels.** Every octave disagreement we found is a case where our
  *answer key* is wrong and the model is right. But there are only a handful, and the training data
  is clean — so it is worth fixing, and it is not what is holding the model back.

**So the next round targets the notes and their lengths, not the microtonal marks.**

### What we already know about those two (the plan: [rung3/round3.md](rung3/round3.md))

- **Note heights are slightly off, not wrong.** When the model misses, it is usually off by only
  one or two positions up or down — 74% of the time. It is not confused about which note it sees; it
  is misjudging the height, like reading a thermometer one mark off.
  We suspected this came from our training pictures being too uniform — and they are: the staff lines
  sit at **exactly** the same size in every single one, while real strips vary. ⚠ **But testing on
  28 July says that is not what is costing us corrections today**, so the "shake the pictures more"
  setting is kept as cheap insurance rather than a fix. See the 28 July section below.
- **Note lengths are nearly always "twice too long".** A short note carries a little flag or beam on
  its stem, and the model is missing it. It also adds or drops the small dot that lengthens a note,
  about equally often. We assumed the **same story as the sharp marks**: our music font draws thicker
  strokes than real printing. ⚠ **Checked on 28 July — it is the opposite.** Our beams are exactly the
  textbook thickness and real printed music is *heavier*, so this idea is closed.

Both were checks to run *before* making new pictures. Both were run — see the 28 July section.

---

## The four ideas we tested

Round 3 was going to cost a lot: redraw all **40,826** training pictures and pay for a training run,
all to chase four ideas about what the model gets wrong. Every one of those ideas could be tested
against the model we already have, for the price of running it — no drawing, no training. So we
tested them first.

**That was worth doing. Three of the four ideas turned out to be wrong**, and the change that
actually helps was not on the list at all.

**Something that works, which we still cannot explain.**

If we shrink each real strip by about **2%** before the model reads it, the number of corrections a
user has to make **drops by 12–15%**. Free — no training, no redrawing. We tested four different
shrink amounts and they all help by roughly the same amount, while a much bigger shrink (4%) helps
far less. So the effect is real and there is a sweet spot around 2%.

**But we do not know why, and our best explanation turned out to be wrong.** The obvious answer was
size: our training pictures have the staff lines exactly 30.0 pixels apart, every single time, while
real strips come out of our page-cutter at about 30.4. So we thought the model simply wanted the
familiar size back. We tested that directly — measuring each strip and resizing it to exactly 30.0 —
and it helped only **6%**, less than half as much as the crude 2% shrink. If the model just wanted
the familiar size, that test should have won. It did not.

We also checked one specific suspect inside the page-cutter and it came out clean.

So: **a real, free, sizeable improvement that we are not shipping yet, because we do not understand
it.** Shipping a change we cannot explain is how you get a surprise later. The next job is to find
out what the shrink is actually doing — our current guesses are about ink weight (real print is
darker and thicker than our drawings) rather than size.

**What we found while building the practice test (28 July 2026).**

The practice test is being rebuilt so it contains hard pages (see "what we do next"). Building it
turned up two things worth knowing.

**First: the model is doing well. The old page-cutter was the problem.** Going through the hard
strips by hand, most of what looked like model mistakes are actually bad *crops* — the cutter took a
sliver of a line, or cut in the wrong place, and the model then read that sliver correctly. We
already replaced the cutter, and its new crops look right.

**Second, and awkwardly: everything we test on was cut by the OLD cutter.** The strips were made on
15–17 July; the cutter was replaced on 25 July and nothing was re-cut. We checked 30 of them: **not
one** is the same under the new cutter, two no longer exist at all, and crops that used to be 207
pixels wide are now full 1435-pixel lines. The exam has exactly the same problem.

That does not make our past results wrong — the exam and the practice test were both cut the old
way, so comparing them to each other is still fair. But it does mean both are measuring a version of
the app we no longer ship. **Open decision:** re-cut everything before finishing the practice test
(the recommendation), or finish with the old crops and accept it.

**A small thing, so nobody wastes time on it:** the model writes 32nd notes with a space, like
`f'' 32` instead of `f''32`. That is not a mistake — the two are literally the same to the scoring
code. It happens only for 32nd notes.

**What we found when we re-cut the pages (29 July 2026).**

We re-cut 158 pages with the new cutter. Then we tried to generate answer keys for them, and on the
first page **25 of 30 strips were thrown away** — mostly for being "too long to label".

Here is what is going on, and it is a good problem to have. The old cutter was **chopping the left
edge off** staff lines — up to 490 pixels, enough to lose the clef or a whole bar. The new cutter
fixed that, so each line of music now comes through complete. But the rule for how many bars go into
one strip was chosen back when lines were being chopped short. Now that they are complete, three
bars is often **more music than our answer-key format can hold**, so the strip gets discarded.

Measured: strips that are too long went from **21% to 32%**. If we put fewer bars in each strip we
get more usable ones — 1 bar per strip gives 107 usable where 3 bars gives 79.

That is not a decision yet. Smaller strips mean less context for the model, more pieces to glue back
together, and a mismatch with our training pictures (which use 2–4 bars). So the next job is to pick
that number properly, **before** we generate answer keys — otherwise we would label a batch and then
throw it away.

**The three ideas that turned out to be wrong:**

- **"When a strip has no notes in it, the model panics and invents a whole bar."** It does not. Of
  the 8 such strips that exist in everything we have labelled, only **1** invented anything. The
  truth is duller and harder: the model simply *cannot read* those strips — it gets nearly every
  symbol wrong. And those strips are made that way by our own page-cutter on purpose (it would
  rather keep a thin sliver than lose part of the page), and the newer cutter already makes half as
  many. So teaching our *drawing* program to imitate them would have been backwards.
- **"Our strips are too wide, so cut them narrower."** This looked like the biggest win available —
  wide strips are 14% of the exam but 29% of all the corrections. We tried it: cutting them in half
  made things **worse, by 32%**. And 19 of the 45 wide strips have no bar-line inside them, so there
  is nowhere sensible to cut anyway. Idea closed for good.
- **"Our beams are too heavy."** (Beams are the thick bars joining fast notes.) We once found our
  sharp signs were 22% too thick and fixing it helped, so we assumed beams had the same problem.
  The opposite is true: ours are exactly the textbook thickness, and **real printed music is
  heavier**. Making them thinner would have moved us further from reality — and we would have
  baked that mistake into all 40,826 pictures.

**Three wrong guesses about one file, and what we changed because of them.** Three times we thought
we knew what the page-cutter was doing wrong; all three were measured and all three were wrong. Twice
we had already written the fix — the first fix did literally nothing (we proved it
by re-cutting 67 pages and getting identical results), and the second was based on a guess the
cutter's own records disproved. Both were undone. Separately, two of our measuring tools quietly
gave wrong answers and we only caught them by **looking at the pictures with our own eyes**. The
rule we wrote down: *measure the thing before changing the file that produces it.*

**One more thing we learned.** Our training pictures are **identical in size, every single one**
(30.000 pixels, no variation at all). Real ones vary. We had written that we "shake" the training
pictures about five times less than reality moves; the truth is we do not shake them at all before
the shaking step. That makes the shaking change we had already written more sensible than we
thought — but our tests say it is **not** what is costing us corrections today, so it stays as
cheap insurance, not a fix.
