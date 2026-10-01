"""Fetch and prepare the page's Istanbul backdrop — one painting for day, one for night.

    .venv-ml/bin/python scripts/prepare_backdrop.py

Both are Ivan Aivazovsky (1817–1900), public domain, from Wikimedia Commons; credits are in
apps/web/public/THIRD-PARTY.txt and docs/THIRD-PARTY.md. They were picked as a PAIR (owner,
2026-10-01) for their light — morning sun, and a blue moonlit night with the Maiden's Tower.

For each painting this writes two WebP files into apps/web/public/backdrop/:
  <name>.webp       the painting, calmed: saturation down, pulled toward the theme's ground
  <name>-soft.webp  the same, small and blurred — the layer behind the content column
The FADE itself (how faint, how blurred where) is CSS (`.kv-backdrop` in app.css), so it can be
tuned without re-running this. ⚠ Never hand-edit an output; change a number here and re-run.

curl, not urllib: this machine's Python has no CA bundle (SSL verify fails).
"""

from __future__ import annotations

import io
import json
import subprocess
import urllib.parse
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "apps/web/public/backdrop"
UA = "KomaVision/0.1 (https://github.com/EmreDikimen/Turkish_note_to_solfeggio_converter)"

# name, Commons file, saturation kept, tint colour, tint share
PAINTINGS = [
    ("day", "Aivazovsky - View of Constantinople and the Bosphorus.jpg", 0.55, (247, 244, 236), 0.18),
    # Swapped 2026-10-01 (owner): the Golden Horn's yellow moonlight "felt like a day picture".
    ("night", "Ivan Konstantinovich Aivazovsky - A View of the Bosporus with the Hagia Sophia and the Maiden's Tower in the Moonlight.jpg", 0.6, (12, 20, 38), 0.3),
]
WIDTH = 2000  # the sharp layer; a 1440px window at 1.4x still has a pixel per pixel
SOFT_WIDTH = 640
SOFT_BLUR = 2  # px at SOFT_WIDTH — about 6px once stretched over a desktop window. Owner,
               # 2026-10-01: tried 960px (~4px) and 800px (~5px), and kept this one.


def curl(url: str) -> bytes:
    return subprocess.run(["curl", "-sfL", "-A", UA, url], check=True, capture_output=True).stdout


def fetch(title: str) -> Image.Image:
    q = urllib.parse.urlencode(
        {"action": "query", "titles": f"File:{title}", "prop": "imageinfo",
         "iiprop": "url", "iiurlwidth": str(WIDTH), "format": "json"}
    )
    page = next(iter(json.loads(curl(f"https://commons.wikimedia.org/w/api.php?{q}"))["query"]["pages"].values()))
    info = page["imageinfo"][0]
    # A thumb is only made when the original is wider than asked; otherwise take the original.
    return Image.open(io.BytesIO(curl(info.get("thumburl") or info["url"]))).convert("RGB")


def calm(im: Image.Image, saturation: float, tint: tuple[int, int, int], share: float) -> Image.Image:
    im = ImageEnhance.Color(im).enhance(saturation)
    return Image.blend(im, Image.new("RGB", im.size, tint), share)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, title, sat, tint, share in PAINTINGS:
        im = calm(fetch(title), sat, tint, share)
        if im.width > WIDTH:
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        im.save(OUT / f"{name}.webp", quality=60, method=6)
        soft = im.resize((SOFT_WIDTH, round(im.height * SOFT_WIDTH / im.width)), Image.LANCZOS)
        soft.filter(ImageFilter.GaussianBlur(SOFT_BLUR)).save(OUT / f"{name}-soft.webp", quality=60, method=6)
        for f in (f"{name}.webp", f"{name}-soft.webp"):
            print(f"{f:18} {(OUT / f).stat().st_size / 1024:6.0f} KB  {Image.open(OUT / f).size}")


if __name__ == "__main__":
    main()
