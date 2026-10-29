#!/usr/bin/env python3
"""
Turn the app's music font into plain path outlines, for saving a score as PNG or PDF.

Why this exists (2026-10-17, a tester's Samsung phone): VexFlow 5 draws every notehead, clef,
accidental and time signature as TEXT in the music font. To save a PNG the app drew that SVG into an
image, with the font embedded in it — and a browser is not obliged to use a web font inside an image.
Chrome does; Samsung Internet did not, and the tester's PNG had staves and stems but no noteheads.
The robust fix is to need no font at all: `apps/web/src/exportOutline.ts` replaces each glyph with
its outline from the files this script writes, and every browser draws a path the same way.

Python is correct here for the same reason as `prepare_strokes.py`: it is data preparation, run once,
and only its OUTPUT ships — `apps/web/public/fonts/glyph-outlines/<hh>.json`, one file per block of
256 code points (`e0.json` holds U+E000–E0FF), so an export fetches only the blocks its score uses.
Never hand-edit those files; re-run this.

⚠ Licence: the source font is SIL OFL 1.1 with the Reserved Font Name "Bravura". Outlines in another
format are font data derived from it, so they ship under the same licence (OFL.txt sits in the same
folder) and are deliberately NOT named after the font. docs/THIRD-PARTY.md.

Each file: {"upm": 1000, "g": {"<hex code point>": [advance, "<SVG path d, font units, y UP>"]}}.

Usage:
    .venv-ml/bin/python scripts/prepare_glyph_outlines.py
"""
import json
from collections import defaultdict
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT = ROOT / "apps/web/public/fonts/Bravura.woff2"
OUT = ROOT / "apps/web/public/fonts/glyph-outlines"


def main() -> None:
    font = TTFont(FONT)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"].metrics
    upm = font["head"].unitsPerEm

    blocks: dict[int, dict[str, list]] = defaultdict(dict)
    for cp, name in sorted(cmap.items()):
        # Integer font units: 1/1000 of an em is ~0.04 px at the largest size the app draws.
        pen = SVGPathPen(glyphs, ntos=lambda v: str(round(v)))
        glyphs[name].draw(pen)
        d = pen.getCommands()
        if not d:
            continue  # a space: nothing to draw, and the advance alone never moves a VexFlow glyph
        blocks[cp >> 8][format(cp, "x")] = [hmtx[name][0], d]

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    total = 0
    for block, g in sorted(blocks.items()):
        text = json.dumps({"upm": upm, "g": g}, separators=(",", ":"))
        (OUT / f"{block:02x}.json").write_text(text)
        total += len(text)
    n = sum(len(g) for g in blocks.values())
    print(f"wrote {n} glyphs in {len(blocks)} files, {total // 1024} KB, to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
