/**
 * Rung-2 distractor text for training strips: real photographed sheets always carry non-musical
 * text (title, composer, usul, publisher, page numbers), and the crops inevitably include
 * fragments of it — so the model must learn to IGNORE text. The harness's real engraved header is
 * an HTML element *outside* the SVG (it never appears in a crop), so this draws seeded fake text
 * INSIDE the SVG, in the vertical bands the strip crops actually capture:
 *
 *   - top band (row 0): title/makam/composer lines straddling the crop's top edge, like the
 *     clipped headers in real staff-isolation crops;
 *   - bottom band (last row + occasionally interior rows, lyric-free renders only — on lyric
 *     renders the zone holds real lyrics): publisher / year / page-number strings.
 *
 * Pixels only: the strip labels are built from the note model (`buildStrips`) and never see this
 * layer — the label of a strip is identical with and without text noise, by construction.
 * Deterministic per seed (same `textseed` → same text at the same places).
 */

import { mulberry32 } from "../../../tools/render/rng";

/** One noise string to draw. `row` is the staff-row index it belongs to; `fx` a 0..1 fraction of
 *  the content width; `dy` a vertical offset in px from that row's stave top (`box.y`). */
export interface TextNoiseItem {
  row: number;
  fx: number;
  dy: number;
  text: string;
  size: number;
  italic: boolean;
  serif: boolean;
  anchor: "start" | "middle" | "end";
}

// Plausible Turkish sheet-header vocabulary. Content only needs to LOOK right in a crop — it is
// never parsed, never labeled, and deliberately independent of the actual piece's metadata.
const MAKAM_FORM = [
  "Nihâvend Şarkı", "Hicaz Şarkı", "Uşşak Şarkı", "Rast Peşrev", "Hüzzam Şarkı",
  "Kürdîlihicazkâr Longa", "Acemaşiran Yürük Semai", "Segâh İlâhi", "Mahur Saz Semaisi",
  "Bûselik Şarkı", "Sûzinak Şarkı", "Hüseyni Türkü",
];
const TITLES = [
  "Gönlümün İçindedir", "Bir Bahar Akşamı", "Aziz İstanbul", "Dertliyim Ruhuma",
  "Kalbimin Sahibi", "Gel Güzelim", "Sazlar Çalınır", "Bu Akşam Gün Batarken",
  "Yine Bir Gülnihal", "Sabah Olsun", "Endülüs'te Raks", "Şu Göğsüm Yırtılsa",
];
const COMPOSERS = [
  "Beste: Hacı Ârif Bey", "Beste: Tatyos Efendi", "Beste: Şevki Bey", "Beste: Zekâi Dede",
  "Beste: Yesâri Âsım Arsoy", "Beste: Sadettin Kaynak", "Beste: Münir Nurettin Selçuk",
  "Güfte: Nigâr Hanım", "Beste: III. Selim", "Beste: Dede Efendi",
];
const USUL_TEMPO = [
  "Usûl: Aksak", "Usûl: Düyek", "Usûl: Sofyan", "Usûl: Curcuna", "Usûl: Semai",
  "♩ = 96", "♩ = 120", "♩ = 84", "Ağırca", "Yürük",
];
const FOOTER = [
  "İstanbul Konservatuvarı Neşriyatı", "Türk Musikisi Vakfı Arşivi", "Şamlı İskender Matbaası",
  "İstanbul 1932", "Ankara 1948", "— 3 —", "— 12 —", "— 27 —", "Sahife 5", "No. 214",
  "Her hakkı mahfuzdur", "Nota Deposu, Beyoğlu",
];

const pick = <T>(rand: () => number, pool: readonly T[]): T => pool[Math.floor(rand() * pool.length)]!;

/**
 * Build the seeded noise items for a render with `nRows` staff rows. `lyrics` suppresses the
 * bottom band (that zone holds real lyric syllables on lyric renders).
 */
export function buildTextNoise(seed: number, nRows: number, lyrics: boolean): TextNoiseItem[] {
  const rand = mulberry32(seed);
  const items: TextNoiseItem[] = [];
  const style = () => ({ size: 11 + Math.floor(rand() * 6), italic: rand() < 0.4, serif: rand() < 0.5 });

  // Top band, row 0 — a title-ish center line, plus composer right / usul-tempo left ~70% each.
  // dy −4..+10 relative to the stave top: baselines straddle the crop's top edge (crop starts at
  // stave top − 6), so fragments appear clipped exactly like real photographed headers.
  const topDy = () => -4 + rand() * 14;
  items.push({
    row: 0, fx: 0.35 + rand() * 0.3, dy: topDy(),
    text: rand() < 0.5 ? `${pick(rand, MAKAM_FORM)} — ${pick(rand, TITLES)}` : pick(rand, TITLES),
    anchor: "middle", ...style(),
  });
  if (rand() < 0.7) items.push({ row: 0, fx: 0.85 + rand() * 0.13, dy: topDy(), text: pick(rand, COMPOSERS), anchor: "end", ...style() });
  if (rand() < 0.7) items.push({ row: 0, fx: 0.02 + rand() * 0.1, dy: topDy(), text: pick(rand, USUL_TEMPO), anchor: "start", ...style() });

  if (!lyrics && nRows > 0) {
    // Bottom band — footer strings in the (empty) lyric zone: always on the last row, ~20% on
    // each interior row. dy 90..102 keeps the baseline inside the crop (crop ends at +106).
    const bottomDy = () => 90 + rand() * 12;
    for (let r = 0; r < nRows; r++) {
      const isLast = r === nRows - 1;
      if (!isLast && rand() >= 0.2) continue;
      items.push({
        row: r, fx: isLast ? 0.4 + rand() * 0.2 : 0.05 + rand() * 0.9, dy: bottomDy(),
        text: pick(rand, FOOTER), anchor: isLast ? "middle" : "start", ...style(),
      });
    }
  }
  return items;
}
