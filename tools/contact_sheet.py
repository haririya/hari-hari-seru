"""Buat lembar kontak semua aset di atas papan catur.

Tujuan: melihat sekaligus apakah ada
  - lubang transparan di badan karakter (badan putih ikut terhapus)
  - halo / garis putih di tepi
  - aset yang terpotong

    python tools/contact_sheet.py
"""

import os
import glob

from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(BASE, "assets", "images")
OUT = os.path.join(BASE, "_test", "kontak-aset.png")

GRUP = [
    ("unicorns", 220),
    ("animals", 190),
    ("castle", 260),
]

CELL = 240
PAD = 10
LABEL_H = 24
COLS = 5


def papan_catur(size, kotak=16):
    im = Image.new("RGB", (size, size), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, size, kotak):
        for x in range(0, size, kotak):
            if (x // kotak + y // kotak) % 2:
                d.rectangle([x, y, x + kotak - 1, y + kotak - 1], fill=(205, 205, 205))
    return im


def main():
    items = []
    for sub, _ in GRUP:
        for f in sorted(glob.glob(os.path.join(IMG, sub, "*.webp"))):
            items.append((sub, os.path.basename(f), f))

    if not items:
        print("tidak ada aset webp")
        return 1

    rows = (len(items) + COLS - 1) // COLS
    W = COLS * (CELL + PAD) + PAD
    H = rows * (CELL + LABEL_H + PAD) + PAD

    sheet = Image.new("RGB", (W, H), (245, 245, 250))
    d = ImageDraw.Draw(sheet)

    for i, (sub, nama, path) in enumerate(items):
        r, c = divmod(i, COLS)
        x = PAD + c * (CELL + PAD)
        y = PAD + r * (CELL + LABEL_H + PAD)

        cell = papan_catur(CELL)
        im = Image.open(path).convert("RGBA")
        im.thumbnail((CELL - 16, CELL - 16), Image.LANCZOS)
        ox = (CELL - im.width) // 2
        oy = (CELL - im.height) // 2
        cell.paste(im, (ox, oy), im)

        sheet.paste(cell, (x, y))
        d.rectangle([x, y, x + CELL - 1, y + CELL - 1], outline=(180, 180, 190))
        d.text((x + 4, y + CELL + 6), f"{nama}  ({sub})", fill=(40, 40, 50))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT, "PNG")
    print(f"{len(items)} aset -> {OUT}")
    print(f"ukuran {W}x{H}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
