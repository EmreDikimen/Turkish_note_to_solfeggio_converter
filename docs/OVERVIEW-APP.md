# The app, in plain words — every piece of it, and what is left

purpose: the plain-English list of everything built on the APP side, in the order it was built, with what each piece cost and what it taught
audience: the project owner (deliberately basic English)
updated: 2026-09-27

Split out of [OVERVIEW.md](OVERVIEW.md) on 27 September 2026 at its size limit, the same way
[OVERVIEW-SERVER.md](OVERVIEW-SERVER.md) was on 11 August. **Nothing here changed in the move.**
Current state and the plan → [OVERVIEW.md](OVERVIEW.md); the next action → [STATUS.md](STATUS.md).

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
   You do **not** have to pick the üçleme button first: with plain **↖ Seçim** on, clicking a **3**
   picks it up just the same, and the ✕ deletes it from there.
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
   ✅ **Your tuning question is answered, and since 27 September you can change the answer.** The
   strings open on the standard **Sol–Re–La–Mi**; **Tel akordunu değiştir** sets each one to any
   ordinary note name — the twelve a tuning app shows, not the 53 komas, because tuning by koma is
   an expert's job and this app is for learners. ⭐ It also unblocked a question from 16 August: we
   would not invent a named Turkish tuning for you, since which one violinists use is a repertoire
   question we had no right to answer — but letting *you* turn a peg needs no such claim. A note
   **below** the lowest string still draws no dot, said plainly rather than moved somewhere wrong;
   now you can tune that string down and see whether it rescues the note.
   ⏭ **What is left is your eyes, and it is the next thing on this list** (see the note below). It
   went onto the website **before** anyone looked at it, on your instruction. Every automatic check we
   have reads the *same numbers the drawing uses*, so not one of them can tell you whether the dot is
   where a violinist would really put the finger.
   ⚠ **Do not report the high positions as a fault.** Near the nut one koma is about 7 screen pixels,
   and less further up — that is the resolution of the photo we shipped, not a mistake in the
   arithmetic. A sharper picture of a violin neck fixes it with no change to the program.
   ⚠ **If your look does find something, the fix now needs its own upload to the website.** That is the cost of having put it out before looking; it is small.
13b. ⏭ **NEXT ON THE APP SIDE, AND IT IS TEN MINUTES OF YOUR TIME: look at the violin neck.** Open
   the site (or run it on your own machine with `npm run dev:cloud`), load a piece, choose **Keman**
   and press play. Two questions only a person can answer:
   **(1) Does the dot sit where your finger would go?** The open strings are the free check — on an
   open string the dot must sit **at the very top of the neck**, against the nut. If it does, the
   arithmetic underneath is right.
   **(2) Do the little ticks help, or are they clutter?** Say so either way; it is a drawing choice,
   not a measurement, and yours is the only opinion that settles it.
15. ~~Stop a page refresh from throwing away a read.~~ ✅ **Done 5 September, the day you asked.** Reading a page takes 35–55 seconds, and until now closing the tab or refreshing the page lost all of it — plus every correction you had made in the editor. The app now keeps the **notes** of every page it has read **inside your own browser**, and offers them back by name in a list under the upload box. It keeps the **last 30**; the 31st pushes out the one you have not opened for longest. You can **rename** any of them — the one you are looking at, from the ✎ next to its title, and the older ones from the ✎ on their row — because a page arrives named after your photograph's file name (`IMG_20260905_142233`), which tells you nothing. The **makam** is shown next to the name, and it is not part of the name: it is re-read from the score every time, so it stays right after you rename a page and follows you if you change the makam later. You can delete one with ✕, or all of them at once. ⚠ **Two things to know, because they surprise people.** It is a **memory, not a save**: the browser is allowed to clear it on its own (Safari does this after about a week of not visiting), so it is a convenience and not a place to keep something important. And it lives in **one browser on one device** — a page you read on your phone is not there on your computer, because there is no server and no account, which is exactly what makes it cost nothing. ⚠ **The photograph itself is not kept**, only the notes: a phone photo is 2–5 MB against about 60–125 KB for the score, fifty times the space for a picture you already have.
14. ~~Open it to everyone — but only when a round's exam result is good.~~ ✅ **Done 5 September — you put the link on LinkedIn.** This item said to wait for a good exam result; Round 3's was not good (51% against 75%) and you opened it anyway, which was yours to decide. What it changes is in [STATUS.md](STATUS.md): strangers now read pages on a server with no fallback, and the model they meet is Round 3 Run A.
