# Manual checks — the score editor

purpose: see-it-yourself checks for the EDITOR (select, drag, the armed palette, insert, rests, tuplets, off-meter bars)
audience: anyone verifying an editor feature by hand rather than by test
updated: 2026-08-09

> Split out of [MANUAL_CHECKS.md](MANUAL_CHECKS.md) on 2026-08-09 at the 400-line cap — the second
> such split, after the corpus half went to [MANUAL_CHECKS-CORPUS.md](MANUAL_CHECKS-CORPUS.md) on
> 2026-08-07. This half is **checks 15–21: the editor**. Everything else — the in-browser gate, page
> upload, the slice inspector, the raw decode inspector, makam playback — stayed in
> [MANUAL_CHECKS.md](MANUAL_CHECKS.md).
>
> Prerequisite for all of them: `npm run dev:web` → <http://localhost:5173>. ⚠ The app bundles no
> score since 2026-08-08, so these open with `?score=…` against the dev server (docs/THIRD-PARTY.md).
> Scripted equivalent of most of this file: `npm run smoke:editor`.

## Check 15 — editing a note on the sheet (editor slice 1, 2026-08-07)

Goal: see the direct editor do what the modal did, without the modal. Scripted version:
`npm run smoke:editor` — this is the version you do with your eyes.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; stay on **Nota**.
2. Press **✎ Düzenle**. **Geri al** / **Yinele** appear beside it, both greyed out.
3. **Move the pointer across the sheet.** Notes outline in teal as you pass them; **bars do not
   highlight at all** — editing is whole-score, so there is no measure hover.
4. **Click a note.** An amber ring appears around it and an **✕** above its right shoulder.
   ⚠ **Changed 2026-08-08:** clicking empty space used to open that bar's window. The modal is
   deleted — with nothing armed an empty click now just clears the selection, and with a note value
   armed it inserts a note (check 18).
5. **Drag the note up or down.** The notehead follows your pointer, one line/space at a time, and
   **the page itself must not scroll or select text**. Pick a note with an accidental: the
   accidental moves *with* it — a Si♭ dragged up becomes a Do♭, not a plain Do. Let go anywhere;
   the drag keeps working even though the note has slid out from under the pointer.
6. **Press the ✕.** The note disappears; its bar is now one note short and **the bar lines do not
   move**. That is the intended behaviour — an edit absorbs into its bar.
7. **Geri al** (or Ctrl/⌘+Z) puts it back; pressing it again undoes the pitch change. **One whole
   drag is one undo**, not one per staff step. **Yinele** replays them.
8. ⚠ **Grace notes (çarpma) are not selectable** — they are drawn attached to the note after them
   and have no click target of their own. Deleting their host takes them with it.

## Check 16 — the armed palette (editor step 4, 2026-08-08)

Goal: see Mus2's model working — arm a tool, click a note, the note changes. Scripted version:
`npm run smoke:editor`.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. A **palette appears to the left of the sheet**: a **SÜRE** row of six note glyphs and a
   **DEĞİŞTİRME** row of the AEU signs. Every glyph is whole — no stem or flag cut off by its
   button. The score itself must not move, resize or re-flow when it appears, and the page must not
   gain a sideways scrollbar.
   ⚠ **Do this on a window at least ~1250 px wide.** The sheet is engraved at a fixed 1020 px and
   the palette costs 164 px, so on a narrower window the last measures of each system scroll off the
   paper — expected, not a bug (see [mvp/editor.md](mvp/editor.md), trap 3).
3. **Click the ♪ (1/8).** It takes the accent, the hint under the palette changes, and the pointer
   over a note becomes a *copy* cursor rather than a grab hand.
4. **Click a note that is longer than an eighth.** It re-engraves as an eighth **in place** — its
   bar is now short and **the bar lines do not move**. Nothing else in the bar changes.
   ⚠ With a tool armed a click must **not** drag the pitch: the notehead stays on its line.
5. **Geri al** once puts the whole thing back — one click is one undo entry.
6. **Press Esc.** The armed tool clears (`↖ Seçim` lights up instead) and dragging a note moves its
   pitch again, exactly as in check 15.
7. **Arm a koma bemol and click a note with no accidental.** The sign appears before the notehead,
   the note stays on its line, and the pitch you hear on **Çal** drops by one koma. Clicking it a
   second time with the same sign armed does nothing at all — including nothing to the undo stack.
8. ⚠ Leaving edit mode disarms the palette; re-entering starts on **Seçim**.

## Check 17 — Çal plays from the bar you just fixed (editor step 5, 2026-08-08)

Goal: hear the correction loop. Scripted version: `npm run smoke:editor` (which measures the
playhead, but cannot listen). This one is about the **ears**, so do it with sound on.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. The palette's top group is **DİNLE**, with **▶ Çal** and a greyed **■ Dur**.
3. **Press Çal before editing anything.** It plays from the **top** of the piece — the playhead
   starts on the first system. **Dur** silences it.
4. **Scroll to a bar halfway down**, arm a note value, and click a note there.
5. **Press Çal.** It must start **at that bar**, not at the top — the playhead appears down the page
   where you just worked, and what you hear is that bar. This is the whole feature.
6. **Press Çal again while it is still playing.** It restarts from the same bar. (Pause and resume
   are unchanged and still live in the transport bar above.)
7. **Press Geri al.** The edit reverses, but Çal still starts from that same bar — deliberate: the
   bar you were working in is still the bar you want to hear.
8. ⚠ **An edit stops playback**, as it always has. That is expected in this step: stop, fix, press
   Çal. Resume-in-place is written up as not built ([mvp/editor.md](mvp/editor.md)).

## Check 18 — put a note where there wasn't one (editor step 6, 2026-08-08)

Goal: see the ghost land on the pitch it promised, and see the bar absorb it. Scripted version:
`npm run smoke:editor`, which checks the geometry but not how it *feels* to aim.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. Arm a note value (say the quarter note). Move the pointer over blank staff between two notes: a
   **teal oval** follows it, jumping a step at a time — it is snapped to staff positions, not to the
   pixel, which is what makes aiming possible at all.
3. Move up and down slowly. The oval sits **on lines and in spaces**, never between, and it keeps
   going a few steps past the staff each way before it stops.
4. **Click.** A real note appears exactly where the oval was, with the value you armed, and it is
   **selected** (its ✕ is showing) so you can immediately delete it or give it an accidental.
5. **The bar line to its right has not moved** — the bar simply holds one note more. That is the
   absorb rule; the warning for a bar that no longer adds up is step 8.
6. Under a key signature, insert on a letter the signature alters: the note is born with that
   alteration and the engraver prints **no accidental** on it. It looks like where you clicked.
7. Now arm an **accidental** instead and click blank staff: **nothing happens** (it has nothing to
   attach to), and no window opens. Press **Esc** and click blank staff again: the selection clears
   and **nothing else happens**. ⚠ Until 2026-08-08 that opened the per-measure window; it is
   deleted, and with it the only way to add a **rest**.
8. **Geri al** removes the inserted note in one press.

## Check 21 — rests, and the numbered koma signs (2026-08-08)

Goal: the two things the deleted measure modal used to own, now in the palette.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. The palette now has an **ES** row under **SÜRE**: the same six values, drawn as rests. Arm the
   quarter rest and move over blank staff — the ghost sits **in the middle of the staff and stays
   there** as you move up and down. A rest has no pitch, and the preview must not pretend otherwise.
3. **Click.** A rest appears. The bar absorbs it (a **+** badge appears at the bar's corner) and the
   bar line does not move.
4. **Geri al.** Now, with the rest tool still armed, click an existing **note**: it becomes a rest.
   Its syllable disappears with it — nothing sings on a rest.
5. Arm a **note value** and click that rest at some height on the staff: it becomes a note **at the
   height you clicked**. That is the fix for a rest the model read where a note belongs.
6. The **DEĞİŞTİRME** row now has thirteen signs, not seven: the four AEU flats and sharps, natural,
   and the numbered **2-comma** and **3-comma** ones. Hover them — each tooltip names the comma
   count.
7. Apply **2 koma diyezi** to a plain note. ⚠ Look carefully: the printed sign is the nearest
   standard AEU sign, because that is what a Turkish edition prints — but the **sound** moves by
   exactly two commas. Press **Çal** and listen; then **Geri al** and listen again.

## Check 19 — make a triplet, and take it apart (editor step 7, 2026-08-08)

Goal: see the tool refuse what it cannot do, before you click. Scripted version:
`npm run smoke:editor`.

1. `npm run dev:web` → `http://localhost:5173`. Any sample; **Nota**, then **✎ Düzenle**.
2. Arm **ÜÇLEME** (the italic 3). Immediately, before you click anything: **most notes go pale**.
   The ones still crisp are the ones a triplet can *start* at — three equal, plain notes in a row.
   Try clicking a pale one: nothing happens, and no window opens. That is the refusal, and it is
   deliberately silent (dim, never an error box).
3. Click a crisp note. It turns teal, and now **exactly one** other note in the whole score is
   clickable: the one two positions along. Everything else, including the note between them, is
   pale — a tuplet cannot skip notes.
4. Click that end note. A **bracket with a 3** appears over the three, and the notes are drawn as
   the next value up (three 1/16s become three 1/24s printed as 1/16s under the bracket).
5. **The bar line has not moved**, and a small **−** badge appears at the bar's top-right: the bar
   is now shorter than the usul asks for. That is check 20.
6. Press the palette's **Çal**: playback starts at that bar and the triplet sounds faster than it
   looked. This is the whole loop — fix, listen.
7. With ÜÇLEME still armed, click **any one of the three notes**: nothing happens. Since 2026-08-30
   a triplet is picked up by its **3**, not by its notes — see check 19b. One **Geri al** still
   undoes the whole triplet in a single press.
8. ⚠ Try a dotted note or a note already inside a triplet: they stay pale. Three dotted 8ths would
   draw a bracket that never closes, which is the mark that means *the model misread something*.

## Check 19b — hold a triplet: slide it, and take the bracket off (editor step 7b, 2026-08-30)

Goal: see that the handle MOVES the triplet without ever making it four notes, and that the ✕ keeps
the notes. Scripted version: `npm run smoke:editor`.

1. Carry on from check 19, with a triplet made and **ÜÇLEME** still armed.
2. Click the **3** the engraver drew over the group — the sign itself, not the notes. Hovering it
   shows a dashed teal outline, so you can see it is a target. An orange **frame** appears round all
   three notes, with a small orange **handle** at each end and a **✕** above the middle.
   ⚠ Try clicking one of the three **notes** instead: nothing happens. That is deliberate.
3. Look at the notes either side: the ones a handle can be dragged onto are outlined with a **dashed
   teal border**. Everything else stays pale. A dashed note is a *landing*, not a button — clicking
   it does nothing, because the handles do the moving.
4. **Drag the right-hand handle to the right**, onto the next dashed note. The bracket moves with it:
   the triplet's **first** note drops out and goes back to its printed value, and the note you
   reached joins the group. It is still three notes, and the **bar length has not changed** — the −
   badge from check 20 stays exactly as it was. Drag back to the left and it returns.
5. ⚠ Keep dragging past the end of the bar, or over a note of a different length: **nothing happens.**
   A tuplet cannot cross a bar line, and three notes of different lengths cannot make one.
6. Click the **3** again: the group is let go (the frame and the handles disappear). Click it once
   more to pick it up, then press **✕**. The bracket disappears, the three notes go back to their printed values, **and all
   three notes are still there** — ✕ removes the *grouping*, never the music. The bar's badge flips,
   because the bar is now longer again.
7. ⚠ On roughly one piece in ten the mark is a square **bracket** instead of a curved arc (the style
   is fixed per piece). It is clickable in exactly the same way — but no automated check covers that
   style, because every bundled sample draws the arc, so it is worth a look if you meet one.
8. ⚠ The handles cannot widen a REAL triplet to four or five notes, and that is on purpose: the printed
   digit is always a "3" and the label the model reads is always `\tup3`. A wider group would draw
   and label a rhythm nobody wrote. See [mvp/editor.md](mvp/editor.md#the-tuplet-rules).

## Check 19c — the BROKEN marks: a "3" over one or two notes (2026-08-30)

Goal: see the marks the model got wrong, and fix them. This one needs a **decoded page**, because a
clean SymbTr sample has none. Scripted version: `npm run smoke:editor`.

1. `npm run dev:web` → `http://localhost:5173/?score=/decoded.json`. **Nota**, **✎ Düzenle**, arm
   **ÜÇLEME**.
2. Look for the **red** outlines. There are **five** of them on this page, against two orange-on-hover
   real triplets. A red mark is a "3" the arithmetic could not close — it sits over one or two notes
   instead of three, which means the model misread something there. They are flagged the moment the
   tool is armed, not on hover, because finding them is the point.
3. Click a red one. It is held exactly like a real triplet, and the frame is **red and dashed** so you
   can still see which kind you have.
4. Look at the notes beside it. A **green** outline means *"drag a handle here and this becomes a real
   triplet"*; a dashed teal one is an ordinary landing (it would shrink the mark). Drag the handle onto
   the green note: the bracket now covers three notes and turns orange — it is a real triplet.
5. Press **✕** on another red one instead. Its notes go back to their printed values and the mark
   disappears. **No note is deleted** — count them if you like.
6. ⚠ **Two of the five have no green note and no landing at all.** Their neighbours are not the right
   kind of note to complete a triplet, so there is nothing honest to drag to. Use **✕** on those, or
   fix the neighbour's length first with the note buttons. The page refuses rather than offering a
   drag that would produce another wrong rhythm.

## Check 20 — bars that do not add up (editor step 8, 2026-08-08)

Goal: see the editor point at a bar that is the wrong length — and, on a decoded page, notice that
it is also pointing at the model's mistakes.

1. In **✎ Düzenle** on a clean sample: **no badges anywhere.** Leave edit mode: still none (the
   marks are edit-mode only — a friend should not meet eight warnings on their first look).
2. Delete a note from a middle bar (click it, press **✕**). A **−** appears at that bar's top-right.
   Hover it: it tells you the bar's own total and the meter it is being compared against.
3. Insert a note into the same bar instead: the badge becomes **+**.
4. **Geri al** clears it.
5. ⚠ The first and last bar are only marked when they are too LONG. A pickup bar and a closing bar
   are legitimately short, so a triplet made in bar 1 shows nothing — that is correct, not broken.
6. Now load a **decoded page** (upload a photo, or a saved decode). Several interior bars light up.
   Those are candidates for where the model misread a duration — worth checking by ear before
   believing. n = 1 page measured so far ([mvp/editor.md](mvp/editor.md)).
