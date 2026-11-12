# Kanun — mandals counted on a real instrument (2026-11-12)

purpose: the per-course mandal counts the owner made by eye on a real kanun, beside the agent's reading of the same instrument's photo
audience: agents and the owner, before changing `MANDAL_LAYOUTS` in `packages/core/src/kanun.ts`
updated: 2026-11-12

> ✅ **Applied 2026-11-12** — `MANDAL_LAYOUTS` in `packages/core/src/kanun.ts` now carries these
> counts (the "What the app draws" table below). The view's own doc is [kanun-view.md](kanun-view.md).

## Where the numbers come from

- **Owner** — counted on the instrument itself, 2026-11-12 (*"kendi gözümle saydım"*). Totals per
  course. This is the better source wherever the two differ.
- **Photo** — the agent's count on `IMG_20261112_200233.jpg` (12000×9000, the owner's Downloads
  folder, not in the repo). Lowered levers were counted by the white knob on each handle; raised
  levers by the handle lugs. Both bottom corners of the frame are soft, so the ends are ranges.

## The counts, lowest course first

The owner confirmed **26 courses** (2026-11-12), which is what the app draws, so the rows carry the
app's own names. "Total" is every lever on the course; it does not depend on the day's setting.

| Course | Note | Owner: total | Photo: total |
|---|---|---|---|
| 1 | Re3 | ⚠ see below | 2–3 (soft corner) |
| 2 | Mi3 | ⚠ see below | 3–5 |
| 3 | Fa3 | ⚠ see below | 5–7 |
| 4 | Sol3 | **9** | 9 |
| 5 | La3 | **8** | 8 |
| 6 | Si3 | **8** | 8 |
| 7 | Do4 | **12** | 12 |
| 8 | Re4 | **9** | 9 |
| 9 | Mi4 | **8** | 8 |
| 10 | Fa4 | **12** | 12 |
| 11 | Sol4 | **9** | 9 |
| 12 | La4 | **8** | 8 |
| 13 | Si4 | **8** | 8 |
| 14 | Do5 | **12** | 12 |
| 15 | Re5 | **9** | 9 |
| 16 | Mi5 | **8** | 8 |
| 17 | Fa5 | **12** | 12 |
| 18 | Sol5 | *"and so on"* | 9 |
| 19 | La5 | *"and so on"* | 8 |
| 20 | Si5 | *"and so on"* | 8 (lowered may be 1) |
| 21 | Do6 | not given | 9 (5 up + 4 down) |
| 22 | Re6 | not given | 6–7 |
| 23 | Mi6 | not given | 5–6 |
| 24 | Fa6 | **6** | 7–8 |
| 25 | Sol6 | **4** | 4–5 |
| 26 | La6 | **2** | 2–3 |

The owner's run of fourteen (9, 8, 8, 12, 9, 8, 12, 9, 8, 8, 12, 9, 8, 12) is placed on courses
4–17 because that is where the photo shows exactly the same run, counted down from the top course.
The repeating middle is **Do 12 · Re 9 · Mi 8 · Fa 12 · Sol 9 · La 8 · Si 8**.

✅ **The owner checked: the first 12-lever course is the 7th from the bottom**, so the run sits on
courses 4–17 as drawn here and the photo count was right. ⚠ That leaves **three** courses below it
and only two values from the owner — *3* for the lowest and *odd, keep what the app draws* for the
second. The third (Fa3) has no count from anyone but the photo's 5–7.

## What the owner also said

- On every course with more than six levers, **six were up**. On the 8- and 9-lever courses there
  is **a small distance** between them and the lowered ones; on the 12-lever courses there is
  **none** (the owner corrected the first wording the same day; the photo shows the same).

## What differed from the app before this count

| Thing | App (paper, 2026-11-11) | This instrument |
|---|---|---|
| Sol | 10 (6 up + 4 down) | **9** (6 + 3) |
| La | 9 (6 + 3) | **8** (6 + 2) |
| The top six courses | same as the lower octaves | fewer, falling to 2 at the top |
| The lowest three courses | 9, 8 and 12 | few levers; the owner gave 3 and "odd" for two of them |

Do, Re, Mi, Fa and Si match.

## What the app draws since 2026-11-12

"Counted" is the owner's total. Where only a total exists, the split is the agent's guess from the
photo, and a lone lowered lever is assumed to be the top step (the full semitone).

| Course | Up at natural + down | Total | Basis |
|---|---|---|---|
| Re3 | 2 + 1 | 3 | total counted; split guessed |
| Mi3 | 6 + 2 | 8 | ⚠ unknown — the owner said keep what was drawn |
| Fa3 | 6 + 6 | 12 | ⚠ unknown — no count; the photo suggests 5–7 |
| Sol3 … Si5 | Do/Fa 6 + 6 · Re/Sol 6 + 3 · Mi/La/Si 6 + 2 | 12 / 9 / 8 | counted, and the photo agrees |
| Do6 | 5 + 4 | 9 | photo only |
| Re6 | 4 + 2 | 6 | photo only (range 6–7) |
| Mi6 | 4 + 1 | 5 | photo only (range 5–6) |
| Fa6 | 3 + 3 | 6 | total counted; split guessed |
| Sol6 | 3 + 1 | 4 | total counted; split guessed |
| La6 | 1 + 1 | 2 | total counted; split guessed |

212 levers in all. The four scores on disk plan exactly as before (0 unreachable of 1,875 notes).

## ⚠ Still open

- **Mi3 and Fa3** are drawn regular for want of a count.
- **Every split on an end course** (how many up, how many down, which step) is a guess.
- **The note names rest on one assumption**: that the 12-lever courses are Do and Fa, as in the
  paper. Nothing on the instrument was tuned or sounded to check it.
- **Do6, Re6, Mi6** were not counted by the owner; the photo ranges are all there is.
- One instrument. The paper measured nine makers and they disagree by one lever on Re, Mi, La, Si.
