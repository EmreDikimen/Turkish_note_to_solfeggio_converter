/**
 * What the chosen makam plays somewhere other than where the page writes it.
 *
 * The dropdown marks a deviating makam with a ♪ and stops there, which says that something moves
 * without saying WHAT — and the thing that moves is the whole point of choosing a makam. This is
 * that answer, in one line beside the picker: the written perde, how far from it the note is
 * really played, and how many notes of THIS score that reaches.
 *
 * ⚠ **The count is the honest half.** A rule is a claim about a perde, not about the piece in
 * front of you: hüzzam bends its hisar, and a hüzzam page that never writes one sounds exactly as
 * printed. `count: 0` is therefore shown, not hidden — otherwise the hint promises a change
 * nobody will hear. It comes from `makamRuleUsage`, which walks the same matcher `makamKomaDeltas`
 * walks, so the number and the pitches playback actually bends cannot drift apart.
 *
 * ⚠ **A makam that bends nothing gets ONE sentence** (owner, 2026-09-05, cutting a first version
 * that wrote two). Hüseyni's empty rule list is a finding — the sources say it does NOT take the
 * uşşak lowering — and an unlisted makam's is silence. That distinction is real and it stays where
 * it belongs, in `MAKAM_INTONATION` and docs/mvp/makam.md; a reader picking a makam is asking one
 * question, whether the piece will sound as it looks, and two sentences answered a question they
 * had not asked.
 *
 * ⚠ The written staff never moves; this describes the SOUND only. Same component in the transport
 * bar and in the post-decode prompt, so the two can never explain the same makam differently —
 * the prompt just opens the reasoning (`open`) where it has the room.
 *
 * `[data-omr="makam-intonation"]` carries `data-makam` / `data-rules` / `data-notes` and each chip
 * `[data-omr="makam-rule"]` carries `data-letter` / `data-alter` / `data-delta` / `data-notes`, so
 * a check reads WHICH perde is bent and by how much without matching a Turkish sentence.
 */

import {
  accidentalLabel,
  makamIntonation,
  solfegeLetter,
  type IntonationRule,
  type MakamRuleUse,
} from "@turkish-omr/core";
import { accidentalChar } from "./accidentals";
import { TR } from "./strings";

/** Turkish writes 1,5 — and these deltas are fractional on purpose. */
const komaText = (commas: number): string => String(Math.abs(commas)).replace(".", ",");

/** "1,5 koma pes" / "1 koma tiz" — the shift, in the direction a player hears it. */
function shiftLabel(rule: IntonationRule): string {
  const koma = komaText(rule.deltaCommas);
  return rule.deltaCommas < 0 ? TR.makamHint.down(koma) : TR.makamHint.up(koma);
}

/** The written perde a rule matches: "Si" plus the accidental the page prints, as its own glyph. */
function PerdeName({ rule }: { rule: IntonationRule }) {
  return (
    <span className="kv-makam__perde" title={TR.makamHint.perdeTitle(accidentalLabel(rule.alterCommas))}>
      {solfegeLetter(rule.letter)}
      {rule.alterCommas !== 0 && (
        <span className="kv-glyph" aria-hidden="true">
          {accidentalChar(rule.alterCommas)}
        </span>
      )}
    </span>
  );
}

export function MakamIntonation({
  slug,
  usage,
  open = false,
}: {
  /** The makam currently chosen. "" renders nothing — the picker already says "as written". */
  slug: string;
  /** Per-rule hit counts against the score. Empty = no score to count against; the counts are
   *  then left off rather than shown as zero, which would be a claim about a document. */
  usage: readonly MakamRuleUse[];
  /** Show the reasoning unfolded. The prompt does; the transport bar's one line does not. */
  open?: boolean;
}) {
  if (!slug) return null;

  const rules = makamIntonation(slug);
  const countOf = (r: IntonationRule): number | null =>
    usage.find((u) => u.rule.letter === r.letter && u.rule.alterCommas === r.alterCommas)?.count ??
    null;
  const total = usage.reduce((n, u) => n + u.count, 0);

  if (rules.length === 0) {
    return (
      <p
        className="kv-makam kv-makam--flat"
        data-omr="makam-intonation"
        data-makam={slug}
        data-rules={0}
        data-notes={0}
      >
        {TR.makamHint.asWritten}
      </p>
    );
  }

  return (
    <div
      className="kv-makam"
      data-omr="makam-intonation"
      data-makam={slug}
      data-rules={rules.length}
      data-notes={total}
    >
      <span className="kv-makam__lead">{TR.makamHint.lead}</span>
      {rules.map((rule) => {
        const count = countOf(rule);
        return (
          <span
            key={`${rule.letter}${rule.alterCommas}`}
            className="kv-makam__rule"
            data-omr="makam-rule"
            data-letter={rule.letter}
            data-alter={rule.alterCommas}
            data-delta={rule.deltaCommas}
            data-notes={count ?? ""}
          >
            <PerdeName rule={rule} />
            <span className="kv-makam__shift">{shiftLabel(rule)}</span>
            {count !== null && (
              <span className="kv-makam__count">
                {count > 0 ? TR.makamHint.count(count) : TR.makamHint.countNone}
              </span>
            )}
          </span>
        );
      })}

      {/* The sources' reasoning, folded away. It is the same `why` the table carries, so a reader
          who wonders why a note moved gets the answer where the choice is made. */}
      <details className="kv-makam__why" open={open}>
        <summary>{TR.makamHint.why}</summary>
        <ul>
          {rules.map((rule) => (
            <li key={`${rule.letter}${rule.alterCommas}`}>
              <strong className="kv-makam__whead">
                <PerdeName rule={rule} />
                {shiftLabel(rule)}
              </strong>{" "}
              — {rule.why}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
