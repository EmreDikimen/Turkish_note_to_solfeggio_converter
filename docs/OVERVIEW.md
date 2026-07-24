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

- We just finished **Round 1** — the first time the model trained on **real** printed pages (before,
  it only trained on clean computer-made ones).
- Our honest score comes from the **exam**: real pages the model never trains on. Round 1 scored
  **about 66%** on the hard note-marks. Our target was **85%**, so Round 1 **did not pass the bar**.
- But it is clearly **better than the version that was live before**, so we **shipped it anyway** and
  wrote down honestly that it improved things but did not hit the target yet. It is now the live
  model. The next round continues.

---

## The problem we are fixing now

When the model reads a strip from the **middle** of a line, that strip does not show the
**signature** — the note at the *start* of the line that says which notes are quietly lowered. (It
got cut off when we sliced the page.)

So the model sees a plain note with no mark. The right thing to do is simple: **write it down plain**
(the signature gets applied later, at reassembly). But the model sometimes **adds a mark that is not
actually printed**, out of habit — *"this note is usually lowered, so I'll add the mark."* That
invents a mistake. It happens most on the note **'si'**.

**This is a fixable habit, not an impossible task** — the right answer is always "copy what you see."
We have found the cause and know what to try.

---

## What we do next (in order)

1. **Photo test — happening now (your part).** So far we tested on clean PDF pages, but real users
   take **phone photos** (shadows, angles, blur). Print our exam pages, photograph them, and see how
   the model does. **Why first:** if photos score much worse, the real problem is *photo messiness*,
   not the mark-habit — and that changes what we fix next. Cheap, and it decides the direction.

2. **Fix the "invented mark" habit** (if the photo test says this is still the priority). A training
   change: teach the model to only write marks it actually sees.

3. **Rebuild our everyday score.** Our day-to-day progress number was too optimistic (it used easy
   pages only — it said 95% while the real exam said 66%). We are rebuilding it to include hard pages,
   so future decisions rest on an honest number.

---

## Small glossary (only the words used above)

| Word | Plain meaning |
|---|---|
| **strip** | One small horizontal slice of a page (2–3 measures) that the model reads. |
| **signature** | The note at the **start of a line** saying which notes are lowered for that whole line. |
| **mark (accidental)** | A small symbol on one note that raises or lowers it. ~8 kinds; telling them apart is the hard part. |
| **bare note** | A note with no mark drawn. It may still be "lowered" by the line's signature — but the model should still write it bare and let reassembly apply the signature. |
| **exam** | Real pages the model never trains on — our honest score (now ~66%). |
| **Round 1** | The first cycle of training the model on real pages. Just finished, now live. |
