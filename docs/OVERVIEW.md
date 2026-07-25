# Where we are and what we do next — in plain words

> A short, plain-language page about the **current state and the plan going forward**. No music
> knowledge needed. It does not cover the full history — for that, see the detailed logs
> (`RUNG3.md`, `MODEL_EVAL.md`). Update this page when the plan changes.

---

## What we are building (one paragraph)

An app that **takes a picture of Turkish sheet music and turns it into a digital score you can
edit** — like OCR (photo of text → editable text), but for music notes. The hard part: Turkish
music uses about **eight tiny note-marks** (that raise or lower a note by small amounts) which look
very similar, and the sheet music writes them in a **shorthand** that hides information (see "the
problem" below).

How it works, in three steps: **(1) Slice** the page into small pieces called **strips** (2–3
measures each); **(2) Read** — an AI model writes down the notes it sees in each strip; **(3)
Reassemble** the strips back into a full score.

---

## Where we are right now

- We finished **Round 1** — the first time the model trained on **real** printed pages (before, it
  only trained on clean computer-made ones). It scored **about 66%** on the exam (real pages it never
  trains on), below our **85%** target, but clearly better than the old model, so we **shipped it**.
- **We ran the phone-photo test.** At first the model looked terrible on photos — but the real problem
  was the **slicer** (step 1): on a slightly tilted photo it could not even find the staff lines, so
  it produced *nothing* to read on 7 out of 10 photos. We added a small "clean-up" step (straighten
  the photo, crop to the page, flatten the angle). After that the slicer works on **almost every
  photo**. To get an *honest* photo score, we then wrote the correct answer by hand for **284 photo
  strips** (we stopped there — that is enough to measure, and many photos are too blurry to read even
  for a person). The direct result: **about 74%** on the hard marks — only **~3–4 points behind clean
  pages**. **So photos are basically a solved problem now** — the model reads them almost as well as
  clean scans, and the slicer clean-up was the fix.
- **What the honest photo score revealed:** the model's real weakness is **two specific marks — the
  koma and küçük sharp** (it mixes them up with each other and with the bakiye sharp). This is *not* a
  photo problem — it happens on clean pages too. And two things we *thought* were problems — the
  bar-lines (`|`) and the "tie" marks — are actually read **well** (about 90%+). So the one thing worth
  fixing in the model is telling those three sharps apart.
- **We re-checked the exam's answer key and found it had a few wrong answers.** After fixing 13 of
  them, the exam score went from 66% to **about 78%**. But be careful: **most of that jump is a
  scoring quirk**, not the model getting better. The score is an *average across mark-types*, and one
  tiny mark-type (only **3 examples**, all scored 0) was dragging the average down; fixing those 3
  removed it from the average. The model's actual reading barely changed. **Takeaway:** the model was
  a little better than 66% suggested, but it still has a **real weakness on two of the hardest marks**
  (koma/küçük sharp), and our exam's headline number is **too easily swung by tiny categories** — we
  will fix how it is averaged.

---

## An old problem we decided NOT to fix (kept for the record)

When the model reads a strip from the **middle** of a line, that strip does not show the
**signature** — the note at the *start* of the line that says which notes are quietly lowered. (It
got cut off when we sliced the page.)

So the model sees a plain note with no mark. The right thing to do is simple: **write it down plain**
(the signature gets applied later, at reassembly). But the model sometimes **adds a mark that is not
actually printed**, out of habit — *"this note is usually lowered, so I'll add the mark."* That
invents a mistake. It happens most on the note **'si'**.

**This is a fixable habit, not an impossible task** — the right answer is always "copy what you see."
But we **dropped it on 2026-07-25**: the marks it affects (the flat family) now score 89–92%, so this
is no longer where the model loses points. The sharps are.

**Your 284 photo labels: they stay as a test only.** They are photos of the *exam* pieces, so training
on them would let the model see the exam in advance — the same mistake that spoiled Round 1. They are
now frozen as the photo part of the next exam. If we want camera photos to *train* on, we print and
shoot **different** pieces (there are thousands available).

---

## What we do next (in order)

1. **Photo test — DONE** (slicer fixed, honest photo score ~74%, photos basically solved — see above).

2. **Find out WHY the sharps fail — before building anything** (koma vs küçük vs bakiye). This is the
   **main model weakness** left. The clue: when the model says "küçük sharp" it is right 100% of the
   time, but it only spots 48% of them. So it is not careless — it is **not seeing** the size
   difference. Two possible causes, needing opposite fixes:
   - **Teaching problem** — the difference is visible in the strip, but under-taught → make training
     examples showing the four sharp sizes side by side.
   - **Seeing problem** — the four sharps differ by only a few pixels at the size we hand the model →
     then no amount of training data helps, and we must give the model a bigger picture.

   **Cheap test that decides it:** draw the same note with each of the four sharps, cut them at the
   exact size the model receives, and measure how many pixels differ. Do this first.

3. ⛔ **"Invented mark" habit — DROPPED (2026-07-25).** It was next on the list, but the honest scores
   show the flat-family marks are now healthy (küçük flat 92%, bakiye flat 89%, natural 89%). The
   problem moved entirely to the sharps. Kept only as a note, not as work.

4. **Rebuild our everyday score.** Our day-to-day progress number was too optimistic (it used easy
   pages only — it said 95% while the real exam said 66%). We are rebuilding it to include hard pages,
   so future decisions rest on an honest number.

5. **Fix how the exam is scored.** The headline is an average across mark-types, so a mark-type with
   only 3 examples can swing it a lot (that just happened: +11 points from one tiny category). The new
   exam will require a minimum number of examples per mark-type, or weight by how common each is.

---

## Small glossary (only the words used above)

| Word | Plain meaning |
|---|---|
| **strip** | One small horizontal slice of a page (2–3 measures) that the model reads. |
| **signature** | The note at the **start of a line** saying which notes are lowered for that whole line. |
| **mark (accidental)** | A small symbol on one note that raises or lowers it. ~8 kinds; telling them apart is the hard part. |
| **bare note** | A note with no mark drawn. It may still be "lowered" by the line's signature — but the model should still write it bare and let reassembly apply the signature. |
| **slicer** | Step 1: the tool that cuts a page into strips. It first finds the staff lines; on tilted photos it failed, which we fixed with a "clean-up" step. |
| **exam** | Real pages the model never trains on — our honest score (~66%, ~78% after fixing a few wrong answer-key entries, but see the scoring quirk above). |
| **Round 1** | The first cycle of training the model on real pages. Just finished, now live. |
