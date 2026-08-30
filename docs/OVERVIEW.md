# Where we are and what we do next — in plain words

purpose: plain-English summary of the current state and the plan — no jargon, no music theory needed
audience: the project owner (this page is deliberately written in basic English)
updated: 2026-08-30

> A short, plain-language page about the **current state and the plan going forward**. No music
> knowledge needed. It does not cover the full history — for that see [rung3/](rung3/README.md)
> and [log/status-log.md](log/status-log.md). Update this page when the plan changes.
>
> This page **restates numbers on purpose**, so it can be read on its own; if it ever disagrees
> with [METRICS.md](METRICS.md), METRICS.md is right.

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

## What we are aiming for (changed 27 July 2026)

**Goal: 9 out of 10 pages should need 5 corrections or fewer — and the app should show you where
they are.**

We used to aim at a model-accuracy number (85%). We changed it because that number does not tell
you whether the app is worth using. What you actually care about is: *how much work is left after
the app has done its part?*

Right now a typical page needs about **5 fixes**, and **57%** of pages are already at 5 or fewer.
So the work is the harder pages, not the typical one.

The second half matters more than it sounds. Today the app gives you a page that is ~95% correct —
but it does not tell you *which* 5 marks are wrong, so you have to check all of them yourself. That
wipes out most of the time you saved.

⛔ **This half is still NOT built, and the obvious way to build it was tried and failed.** This page
used to end the paragraph above with "if the app highlighted the places it was unsure you would check
five spots instead of two hundred and fifty — we already compute that signal, we simply never showed
it to you." **That was too optimistic, and it stayed here for months after we knew better.** The
model's own "how sure am I" number was tested on 5 August against a target set in advance — highlight
the 10% of the page it is least sure about, and catch at least 60% of the real mistakes. It caught
**26.3%**. The idea was dropped rather than the target lowered. ⚠ Re-measured a different way on 18
August, it came out **worse than picking at random**. So finding the mistakes for you is still an
open, unsolved problem — not a feature waiting to be switched on.

## What we learned before that (27 July 2026) — we were fixing the wrong 13%

We counted every correction a user would have to make on the exam and sorted them by *what* needs
fixing. The answer changed the plan: **the note itself is 40% of the work and its length 28%, while
the microtonal marks — which two whole rounds went into — are only 13%.** The old score could only
see that 13%, which is why it looked like the whole problem. The full count, and what we already
know about note heights and note lengths, moved to **[OVERVIEW-JULY.md](OVERVIEW-JULY.md)**.

## What happened on 28 July 2026 — we tested four ideas and three were wrong

That test day is written up on its own page, in the same plain words:
**[OVERVIEW-JULY.md](OVERVIEW-JULY.md)**. Short version: before spending money on training we
checked four hunches about *why* the model makes mistakes. Three did not survive the check. It is
kept because the reasoning stops us re-proposing them — the short do-not-repeat list is near the
bottom of this page.

## The "can the model even see the page?" idea → [OVERVIEW-MODEL.md](OVERVIEW-MODEL.md)

Tested 15 August, **closed 17 August**. Short version: making a strip artificially wider (so the model
shrinks it more) genuinely does cost accuracy — but we then found we cannot buy the reverse, because
real pages are *already* at the good size, and cutting them smaller than one bar creates a worse
problem than it solves. It was stopped by a rule written down before the test ran. Two numbers we had
been believing turned out to be three times too pessimistic. Full account on that page.

## Where we are right now

### The app now reads the page's road signs (30 August 2026)

Sheet music does not write everything out. It uses **road signs** that say "go back and play that
part again". The app used to ignore two of them.

1. **The repeat sign** (`‖: … :‖`) means "play these bars twice". The app used to print those bars
   **twice on the paper**. Now the paper looks like a normal printed score — the bars appear once,
   with the sign — and the repeat is taken **when the music plays**.
2. **The 𝄋 sign** (called *segno*) is the one you asked about. In a **saz semâîsi** the **teslim**
   is written only once, and it is played after **every hâne**. The page says that with one glyph: a
   𝄋 at the start of the teslim, and a 𝄋 at the end of each later hâne. The rule is: the **first**
   𝄋 is only a bookmark; **every later** 𝄋 means "go back to the bookmark, play that section again,
   then come back here and carry on". The last one has nothing left to come back to, so the piece
   ends there — which is where the page prints "Son".

Before this, the second 𝄋 did nothing at all unless the page also said "D.C.", and almost none of
them do: of the **258** real pages that carry two or more 𝄋, **249** have no "D.C.". So the teslim
was simply never played after the later hâne.

⚠ **One thing the app cannot guess: where the section ENDS.** It looks for a "Son", and if there is
none, for the first `:‖` after the 𝄋. If the page has neither, the app **does nothing** and writes a
note saying why — on **58** of those 258 pages. Replaying a random stretch of music would be wrong;
playing the page straight through is only incomplete.


### The cutting tool got three fixes, and then you froze it (26 August 2026)

The **slicer** cuts a photo of a page into small strips. Before the model can read anything, the
slicer has to find the staff — the five lines the notes sit on. It was getting that wrong in three
different ways, and you found two of them **by looking at pages yourself**.

1. **Whole rows of music were disappearing.** Not cut badly — **not found at all**. On a faint
   photocopy the tool looks for a line that stays perfectly straight for a long way; a hand-ruled or
   slightly tilted line wanders, so the tool erased it. One page had 9 rows of music and the tool
   found 4. ⭐ **This is why no accuracy number ever showed it**: a row that is never found makes no
   strip, so there is nothing to be wrong about. The fix finds **320 extra rows across 227 pages**.
   It is **switched off** for now, and **on in the slice inspector** so you can see the lost rows.
2. **The app and the training data cut one page differently.** The browser and Python read the same
   picture and disagreed about where one staff ended — because a browser cannot convert an image to
   grey in exactly the same way, and the difference was **one unit of brightness**. That was enough
   to flip a decision that sat less than a pixel from its edge. Fixed, and now they agree.
3. **A crop that swallowed the row above it.** The tool measured one staff's line spacing 54% too
   large, so it magnified that row too little and the fixed-size picture reached up into the
   neighbouring music. Fixed.

⭐ **The most useful lesson is about the SHAPE of a fix.** Four times we tried to fix something by
making a rule *looser* everywhere. **All four made things worse** when measured on all 6,440 rows,
even though each looked right on a handful of pages. The three fixes that worked all do the same
thing instead: **only act where the normal rule already produced something broken, never touch a page
that is fine.** That is now written at the top of the slicer notes so nobody spends a day
rediscovering it.

**Then you froze the slicer**, and that was the right call: the last two fixes were worth **−2 and +2
rows out of 6,440** — essentially nothing. The tool is not perfect, but it is no longer the thing
worth working on.

### The exam stays as it is, and you are labelling it

We looked at re-cutting the exam with the improved tool and **decided not to**. The reason is
simple: when the exam is re-cut, your old answers come back only as **suggestions to confirm**, not
as finished work — deliberately, because an answer you gave about one picture should not be trusted
about a different picture. So re-cutting would turn **208 rows left** into **about 663 to look at
again**. Not worth it.

The exam is fine for grading: all 67 pages were cut by the **same** tool, and that is what makes the
test fair. ⚠ One thing to say out loud when you quote the score: it describes the model on crops
**slightly older** than what the app cuts today. The difference is small — 62 and 13 rows out of
6,440 — but it is not zero.


### The features that shipped in early August → [OVERVIEW-AUGUST.md](OVERVIEW-AUGUST.md)

Moved there on 15 August 2026, when this page grew past its size limit — the same move July's account
got. **Nothing was dropped.** In one line each: the **violin, clarinet and kanun** play real
recordings and are live (13 August, and you signed them off after four rounds of listening); your
**two friends** liked the app and asked for exactly those instrument sounds (11 August); the **usul
plays on a real darbuka and bendir** and all ten patterns passed your ear (11 August); the **example
songs were removed** so the app gives away nobody's music (8–9 August, two copyright jobs still
yours to decide); and the app learned to **read a whole page** at about 25 seconds (5 August).

### The plan as of 5 August 2026: two things at once

Earlier (2 August) the plan was "stop the model work, finish the app, then train again." **On 5
August you changed it: now both happen at the same time.** Here is the whole plan in one table.

| | |
|---|---|
| **Who sees it first** | **Two friends.** Not a public launch |
| **What you ask them** | **"What should I add?"** — you want feedback on the **app**, not on how well it reads music |
| **The model** | **Round 3 starts now**, in parallel. It does not wait for the friends, because what they say about features will not change how we train it |
| **Which model the friends get** | **Whatever is best at the time.** Because the model now runs on a server, swapping it is something you do on your side — the friends download nothing and notice nothing |
| **How you collect feedback** | **You talk to them.** With two people, a conversation tells you more than any button inside the app, and costs nothing to build |
| **Phones** | **Later.** Web first, finish it, then think about phones |
| **Opening it to everyone** | **Only after Round 3's exam result is good.** If it is not good, do Round 4, then look again |

⚠ **One honest cost of swapping the model whenever it improves:** if a friend says "it read this
page badly", we will not know for certain which model did it. That is acceptable *because* you are
asking them about features — but it means those remarks are stories, not measurements. The exam is
still the only thing that tells us whether a model got better.

### Why there is a server, where it lives, what it costs → [OVERVIEW-SERVER.md](OVERVIEW-SERVER.md)

Moved there on 11 August 2026, when this page grew past its size limit. It explains — in the same
plain words — why the reading now happens on a rented computer instead of your laptop, the three
places the app lives and why it is not just one, what it all costs, and one thing we decided **not**
to build. None of it has changed; it is background rather than news.

### Before that — the model work

**Rounds 1 and 2, the phone-photo test and the sharps, in the same plain words, moved to
[OVERVIEW-MODEL.md](OVERVIEW-MODEL.md)** on 9 August (this page hit its length limit). Nothing was
dropped. The one-line version: Round 2 is the model in the app, it is a small improvement once the
score is counted fairly, and the weakness that remains is telling the koma and küçük sharps apart
**inside the key signature**.

---

*(The one old problem we decided **not** to fix — the cut-off signature, and why your 284 photo
labels stay a test only — moved to [OVERVIEW-JULY.md](OVERVIEW-JULY.md) on 7 August.)*

## What we do next

**Two lists now, and they run at the same time.** Nothing on one waits for the other.

### List A — the app (this is what reaches your friends)

1–6. ~~Build the reading server, check it matches the browser, switch the app over with a fallback,
   put both online, set the $5 alert, lock the door.~~ ✅ **All done 6 August** —
   <https://komavision.netlify.app>, the model on Hugging Face, the wake-up delay about 11 seconds.
7. ~~Make the app play the right makam.~~ ✅ **Done 7 August.** The app used to play every note
   exactly where it is written — but Turkish music does not work like that. In **uşşak** the note
   written "si with one small flat" is actually **played lower**, and no sign exists for where it
   really goes; only the makam tells you. The app now **guesses the makam from the page**, shows the
   guess and why, lets you change it, and plays the piece the way that makam is really played. It
   **only changes the sound — the notes on screen never move.** Right on 204 of 213 test pieces.
8. ~~Make the app look good.~~ ✅ **Done 7 August.** It is called **KomaVision**, it is in Turkish,
   and it looks like a music page rather than a testing tool: warm paper, the sheet music as the
   main thing on screen, one big box at the top to drop (or paste) the photo into. Only the buttons
   a musician uses stay in the open — play, stop, tempo, metronome, usul, makam; the dozen
   developer switches fold into a **Gelişmiş** drawer that stays shut. The bar also carries the
   three that change what you see and hear: **Transpozisyon** (how far up or down to move the
   whole piece, in komas — and named by interval where one fits, like "4 ses (22 koma)"),
   whether the written staff moves with it, and how **arıza işaretleri** are printed.
9. ~~Put the new version on the website.~~ ✅ **Done 9 August.** One rebuild, one upload — it carried
   items 7 and 8 **and** the copyright removal. Checked afterwards: the app reads a page both ways,
   and the five songs that used to be downloadable are gone.
   Three things fell out of it. **We now know how long the rented computer really takes to wake up
   after a proper sleep: about 11 seconds** — measured on a server nobody had touched for three
   hours, rather than minutes after an upload as before. ⚠ But **we still have not proved the app
   handles that wait on the real website.** It briefly looked like we had; in fact an automatic
   visitor — some robot that visits every site right after it changes — had woken the server 33
   seconds before our check ran, so our check found it already awake. Worth knowing for next time:
   **checking straight after an upload can never test the sleeping case**, because uploading is what
   summons the robot. And an alarm from 6 August turned out to be nothing — the rented computer
   looked like it had got **2.5× slower to wake**, but that only happens on the first wake after new
   code is uploaded; four later wakes are back to normal.
   **Somebody you have not told about it has already used it.** Three pages were read on 8 August:
   one was **your own phone**, and the other two were not. Those two might be one person or two — we
   cannot tell, because a phone that moves from home internet to your network looks exactly like a
   second phone. So: **at least one stranger, at most two.** We can see any of this only because the
   app quietly says hello to the server when someone opens it; most of the *other* visits are robots,
   not people — see the note under item 11.
   ⚠ **Worth thinking about before you send the link:** the plan says "web first, phones later", but
   everyone who has actually used it was on a phone, and one of them switched to "desktop site" a
   minute after opening — then uploaded. That is far too few people to redraw the plan on. It is a
   **question to ask your two friends**, not an answer.
10. ~~Make fixing a wrong note quick.~~ ✅ **Done — finished 15 August.** It used to be: click a bar,
   a window opens on top of the music, edit a table of rows, and it refuses to save until the bar
   adds up again. Now you **click a note right on the page**, **drag it up or down** to change its
   pitch, or press the **✕** to delete it — and **undo** anything (Ctrl/⌘+Z). There is a **palette**
   beside the music for note lengths and accidentals, you add a note by clicking empty space, and the
   old window is gone. It works like Mus2, which is the point.
   The last item on the list was to remove the **Save JSON** button. You left it in August because
   our automatic test used that button to look at what an edit actually did — **on 30 August it went**,
   once the test was given a way to read the score directly instead, so removing it would have cost us the test and bought nothing.
   **30 August: you can now grab a triplet.** A "triplet" is three notes played in the time of two —
   the page draws a little **3** over them. Now you **click that 3** and it picks the group up: an
   orange box appears round the three notes, with a small handle at each end and an **✕**. You click
   the *sign*, not the notes — the notes themselves do nothing, which is what you asked for. Drag a handle sideways and the group **moves**
   along the bar — the note it leaves behind goes back to its normal length, and the note it reaches
   joins in. The whole drag is **one undo**. The **✕** takes the *3* away and keeps the notes.
   **And the broken ones.** On a page read from a photo, the program sometimes draws that **3** over
   only one or two notes. That is a mistake — a real triplet is three. Those marks are now drawn in
   **red** so you can find them, and you can fix them: drag a handle onto the note marked **green**
   and the group becomes a proper triplet, or press **✕** and the mark goes away with the notes left
   alone. On one test page there are five of these against two correct ones, so on real pages this is
   the common case, not the rare one. ⚠ Some of them cannot be fixed by dragging, because the notes
   next to them are the wrong length; for those, use **✕**, or change the neighbour's length first.
   ⚠ **A CORRECT group always stays three notes**, and you asked about this before it was built. Making it
   four or five is not a small change: the printed **3** is written into the program as the letter
   "3", and the word the reading model learns is literally `\tup3`. There is no word for a group of
   five, so a wider group would print and *label* a rhythm nobody wrote. Adding those words changes
   what the model can be taught, so it is your call to make later, not a button to add now.
   ⚠ One thing to stay honest about: this is **not** a labelling tool. An earlier plan said every
   page you corrected would become training data. That was never built, and the reason to have the
   editor is simpler — *a friend whose page has a wrong note should be able to fix it.*
11. **Send the link to two friends and ask what to add.** Tell them the first upload of the day is
   slow (the rented computer has to wake up), and that a page takes about a minute. Ask about the
   **buttons and the screen**, not about mistakes in the notes — the notes are the exam's job.
   ⚠ **How to tell a real visitor from a robot, when you look at who used it.** The server knows two
   different things: someone **opened** the page, and someone **uploaded** a page. Only the second
   means a person used it. Robots do the first constantly — one of them pretended to be an iPhone
   from four different places in two days — so count uploads, not visits.
12. ~~Give the app real instrument sounds.~~ ✅ **Done 14 August, and your friends liked it.** They
   asked for more instrument sounds, and now the app plays **klarnet**, **keman** and **kanun** —
   real recordings of real instruments, not made-up tones. Every note is stretched slightly to land
   on its exact koma, so the microtones are right. It took **four rounds of you listening**, and
   every single one found something wrong that no automatic test had caught: breath noise on fast
   notes, a trim that cut too deep, the kanun tuned a whole **koma** too high, and a note that
   started before the string was even plucked. Worth remembering for the ney: **the tests check the
   shape, only the ear checks the sound.** Budget one listening pass per instrument.
13. ~~Show where to put your finger — the violin, and only the violin.~~ ✅ **Built 16 August, and it
   has been on the website since 18 August.** Open <https://komavision.netlify.app>, pick **Keman**,
   and there is now a second tab beside the notes: an instrument you pick, with a mark that moves
   with the music as it plays, and a small tick at **every position the piece you loaded actually
   uses** on each string. So the uneven spacing you see is the music's own, not a diagram's.
   This is the feature no ordinary music app can copy: a normal app knows twelve frets, so it
   **cannot** show you where a koma is. Ours works it out with one line of arithmetic, so all 53 land
   exactly — you can see that a koma sharp and a küçük sharp are millimetres apart.
   ✅ **Your tuning question is answered**: the four open strings are the standard **Sol–Re–La–Mi**,
   placed on this project's 53-step grid. If a written note falls **below** the open Sol string, the
   app says so plainly instead of quietly moving it to the nearest playable spot — a wrong dot would
   teach you the wrong place.
   ⏭ **What is left is your eyes, and it is the next thing on this list** (see the note below). It
   went onto the website **before** anyone looked at it, on your instruction. Every automatic check we
   have reads the *same numbers the drawing uses*, so not one of them can tell you whether the dot is
   where a violinist would really put the finger.
   ⚠ **Do not report the high positions as a fault.** Near the nut one koma is about 7 screen pixels,
   and less further up — that is the resolution of the photo we shipped, not a mistake in the
   arithmetic. A sharper picture of a violin neck fixes it with no change to the program.
   ⚠ **If your look does find something, the fix now needs its own upload to the website.** That is
   the cost of having put it out before looking; it is small.
13b. ⏭ **NEXT ON THE APP SIDE, AND IT IS TEN MINUTES OF YOUR TIME: look at the violin neck.** Open
   the site (or run it on your own machine with `npm run dev:cloud`), load a piece, choose **Keman**
   and press play. Two questions only a person can answer:
   **(1) Does the dot sit where your finger would go?** The open strings are the free check — on an
   open string the dot must sit **at the very top of the neck**, against the nut. If it does, the
   arithmetic underneath is right.
   **(2) Do the little ticks help, or are they clutter?** Say so either way; it is a drawing choice,
   not a measurement, and yours is the only opinion that settles it.
14. **Open it to everyone — but only if Round 3's exam result is good.**

### The model work → [OVERVIEW-ROUND3.md](OVERVIEW-ROUND3.md)

The whole model plan in plain words — what the triplet work settled, the scanned-pages decision, the
**three trainings** and what each one changes, when we train, and what the one-shot exam decides.
Moved out of this page on 19 August when it passed its size limit.

## Small glossary (only the words used above)

| Word | Plain meaning |
|---|---|
| **strip** | One small horizontal slice of a page (2–3 measures) that the model reads. |
| **mark (accidental)** | A small symbol on one note that raises or lowers it. ~8 kinds; telling them apart is the hard part. |
| **bare note** | A note with no mark drawn. It may still be "lowered" by the line's signature — but the model should still write it bare and let reassembly apply the signature. |
| **slicer** | Step 1: the tool that cuts a page into strips. It first finds the staff lines; on tilted photos it failed, which we fixed with a "clean-up" step. |
| **exam** | Real pages the model never trains on — our honest score. It read 66% first; after we fixed 13 wrong answers in the answer key it reads ~78%, but most of that jump is the scoring quirk explained above, not the model improving. |
| **Round 1** | The first cycle of training the model on real pages. Shipped 2026-07-23; replaced by Round 2. |
| **Round 2** | The second cycle. Fixed two problems in how we make training pictures. The old score read 78% → 74%, but that turned out to be a scoring quirk; on the fair scores it is better, so it **shipped** on 2026-07-27 and is the model in the app. |
| **key signature** | The group of marks printed once at the start of a line, which apply to every matching note on it. This is where almost all the hard marks are — and where the model still gets confused. |
| **makam** | The "mode" a Turkish piece is in (uşşak, hicaz, hüzzam…). It decides not just which notes are used but **exactly where some of them are played**, which the written page cannot tell you. The app guesses it and lets you change it. |
