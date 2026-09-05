/**
 * The makam's PERFORMED intonation (Node-only) for `packages/core/src/makam.ts`.
 *
 * One property carries this whole feature: **the note the table names is the note that bends, and
 * no other**. Everything else about a makam is a label; this is the part a listener hears.
 *
 * The reason there is a file at all is the bug it exists to keep out. `makamKomaDeltas` is keyed by
 * the WRITTEN document's event indices, `unfoldDoc` **renumbers every event**, and the app applies
 * the deltas to the unfolded performance. Nothing throws when those two disagree — every index
 * still exists — so the bend simply lands on a different note, and the page plays subtly out of
 * tune. It shipped that way and was caught by ear (owner, 2026-09-05: *"bazen la farklı çalıyor,
 * bazen re, bazen mi… ama bazen de doğru çalınıyor"*). On `gamzedeyim-deva` under uşşak, **19 of
 * the 22 bent notes were the wrong ones**.
 *
 * Two things renumber, and the test covers both: a `meta` event (the unfolder drops it, which
 * shifts every later index down — so an ordinary page with no repeat at all is already affected)
 * and a repeated bar (one written note, several sounding ones).
 *
 * Run: npx --yes tsx tools/core/makam-test.ts
 */

import {
  assignBars,
  makamIntonation,
  makamIntonationRecorded,
  makamKomaDeltas,
  makamRuleUsage,
  remapKomaDeltas,
  unfoldDoc,
  withKomaDeltas,
  type NoteEvent,
  type NoteModelDocument,
} from "@turkish-omr/core";

let failures = 0;

function check(name: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want);
  if (g === w) console.log(`  ok    ${name}  ${g}`);
  else { failures++; console.log(`  FAIL  ${name}\n    want: ${w}\n    got : ${g}`); }
}

/**
 * A three-bar score whose bar 2 carries the segah the uşşak rule matches.
 *
 * ⚠ The `meta` event in bar 1 is the load-bearing part of the fixture, not decoration: it is what
 * makes the written and performed numbering disagree on a page that repeats nothing at all.
 */
function score(): NoteModelDocument {
  const events: NoteEvent[] = [];
  const push = (kind: NoteEvent["kind"], noteName: string, koma53: number, bar: number, n: number) =>
    events.push({
      index: events.length + 1,
      kind,
      koma53,
      noteName,
      noteAE: noteName,
      durationMs: 500,
      durationBeats: { num: 1, den: 2 },
      freqHz: 440,
      lyric: "",
      offset: bar - 1 + n / 2,
    } as NoteEvent);

  push("note", "La4", 40, 1, 1);        // dügâh — must never move
  push("meta", "", 0, 1, 1);            // ⚠ dropped by the unfolder; this is what shifts the rest
  push("note", "Re5", 62, 1, 2);        // nevâ — must never move
  push("note", "Si4b1", 48, 2, 1);      // segah, as AEU spells it — the ONE note uşşak bends
  push("note", "Mi5", 71, 2, 2);        // hüseynî — must never move
  push("note", "Si4b2", 47, 3, 1);      // a segah spelled 2 komas flat: the rule does NOT claim it
  push("note", "La4", 40, 3, 2);

  return assignBars({
    schemaVersion: 1,
    name: "t",
    makam: "",
    form: "",
    usul: "",
    title: "t",
    composer: "",
    tuning: { system: "53tet", refFreqHz: 440, refKoma: 40, commasPerOctave: 53 },
    events,
  });
}

/** Which notes actually come out bent, named and by how much — read off the sounding document. */
function bent(played: NoteModelDocument, sounded: NoteModelDocument): string {
  const before = new Map(played.events.map((e) => [e.index, e.koma53]));
  return sounded.events
    .filter((e) => e.koma53 !== before.get(e.index))
    .map((e) => `${e.noteName}${(e.koma53 - before.get(e.index)!).toFixed(1)}`)
    .join(" ");
}

console.log("the table names one note, and one note bends");
{
  const doc = score();
  const deltas = makamKomaDeltas(doc, "ussak");
  check("uşşak reaches exactly the written koma-bemol si", deltas.size, 1);
  check("…by a comma and a half, downwards", [...deltas.values()].join(), "-1.5");
  check("a makam with no rules reaches nothing", makamKomaDeltas(doc, "huseyni").size, 0);
  check("…and neither does 'none'", makamKomaDeltas(doc, "").size, 0);
  // The alias must not be a second, quieter table.
  check("an alias bends what its target bends", makamKomaDeltas(doc, "bayati").size, 1);
}

console.log("\nthe deltas survive the unfold — the 2026-09-05 bug");
{
  const doc = score();
  const deltas = makamKomaDeltas(doc, "ussak");

  // (a) No repeat at all. The `meta` event alone is enough to move every later index.
  const flat = unfoldDoc(doc, null);
  check("the unfolder drops the meta event", flat.doc.events.length, doc.events.length - 1);
  const shifted = [...flat.srcOf].filter(([played, written]) => played !== written).length;
  check("…so the performance is renumbered even with no repeat", shifted > 0, true);
  check(
    "⛔ applying the WRITTEN keys to it bends the wrong note",
    bent(flat.doc, withKomaDeltas(flat.doc, deltas)),
    "Mi5-1.5",
  );
  check(
    "⭐ re-keyed, the bend lands on the segah and nowhere else",
    bent(flat.doc, withKomaDeltas(flat.doc, remapKomaDeltas(deltas, flat.srcOf))),
    "Si4b1-1.5",
  );

  // (b) A repeat. One written note, two sounding ones — and the second pass must sound like the
  //     first, or a listener hears the piece go out of tune halfway through.
  const folded = unfoldDoc(doc, [1, 2, 1, 2, 3]);
  check(
    "⭐ every copy of a repeated segah bends",
    bent(folded.doc, withKomaDeltas(folded.doc, remapKomaDeltas(deltas, folded.srcOf))),
    "Si4b1-1.5 Si4b1-1.5",
  );
  // 2 sounding events a bar (the meta is gone), five bars played: 1 2 1 2 3.
  check("nothing else moved across the repeat", folded.doc.events.length, 10);
}

console.log("\nwhat the picker reports");
{
  const doc = score();
  const usage = makamRuleUsage(doc, "ussak");
  check("one rule, reported", usage.length, 1);
  check("…counting THIS score's matching notes", usage[0]!.count, 1);
  check("…and it is the rule the table holds", usage[0]!.rule.letter + usage[0]!.rule.alterCommas, "B-1");

  // Hüzzam's hisar is absent from this fixture: the rule is still listed, with a count of zero.
  const huzzam = makamRuleUsage(doc, "huzzam");
  check("hüzzam lists both its rules", huzzam.length, 2);
  check("…and says plainly that one reaches nothing here", huzzam.find((u) => u.rule.letter === "E")!.count, 0);
  check("the counts add up to the notes that bend", huzzam.reduce((n, u) => n + u.count, 0), makamKomaDeltas(doc, "huzzam").size);

  // ⚠ Two different empty answers. Merging them would dress an unmeasured makam as a measured one.
  check("hüseyni is RECORDED as not deviating", makamIntonationRecorded("huseyni") && makamIntonation("huseyni").length === 0, true);
  check("…while hicaz is simply not in the table", makamIntonationRecorded("hicaz"), false);
  check("'none' is not a measured makam either", makamIntonationRecorded(""), false);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
