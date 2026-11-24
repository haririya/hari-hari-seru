"""Cek semua aset mentah sekaligus — ringkas, satu baris per file.

    python tools/check_all.py

Menandai file yang bermasalah supaya tidak perlu buka satu per satu.
"""
import glob
import os
from collections import Counter

from PIL import Image

files = sorted(glob.glob("assets/_raw/*"))
if not files:
    print("tidak ada file di assets/_raw/")
    raise SystemExit(1)

print(f"{'file':14s} {'dimensi':11s} {'putih':>6s} {'tepi':>6s} {'sentuh':>6s} {'isi%':>5s}  catatan")
print("-" * 78)

bermasalah = []

for path in files:
    nama = os.path.basename(path)
    stem = os.path.splitext(nama)[0]
    im = Image.open(path)
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    catatan = []

    if w != h:
        catatan.append(f"BUKAN 1:1 ({w}x{h})")

    # warna sudut harus hampir putih
    for cx, cy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        r, g, b, _ = px[cx, cy]
        if not (r > 240 and g > 240 and b > 240):
            catatan.append("sudut tidak putih")
            break

    # kerataan tepi — JPEG selalu ada noise ±3, jadi hitung "hampir putih"
    edge = []
    step = max(1, w // 60)
    for x in range(0, w, step):
        edge.append(px[x, 1])
        edge.append(px[x, h - 2])
    for y in range(0, h, step):
        edge.append(px[1, y])
        edge.append(px[w - 2, y])
    hampir_putih = sum(1 for r, g, b, _ in edge if r > 245 and g > 245 and b > 245)
    tepi = 100.0 * hampir_putih / len(edge)
    if tepi < 90:
        catatan.append("tepi tidak rata")

    # luas area putih
    putih = total = 0
    for y in range(0, h, 8):
        for x in range(0, w, 8):
            r, g, b, _ = px[x, y]
            total += 1
            if r > 245 and g > 245 and b > 245:
                putih += 1
    putih_pct = 100.0 * putih / total

    # isi menyentuh tepi = kemungkinan terpotong
    sentuh = 0
    for x in range(0, w, 2):
        for y in (0, 1, h - 2, h - 1):
            r, g, b, _ = px[x, y]
            if not (r > 235 and g > 235 and b > 235):
                sentuh += 1
                break
    for y in range(0, h, 2):
        for x in (0, 1, w - 2, w - 1):
            r, g, b, _ = px[x, y]
            if not (r > 235 and g > 235 and b > 235):
                sentuh += 1
                break
    if sentuh > 0:
        catatan.append("isi menyentuh tepi")

    # ukuran objek
    mask = rgba.convert("L").point(lambda v: 0 if v > 240 else 255)
    bbox = mask.getbbox()
    isi_pct = 0.0
    if bbox:
        bw = bbox[2] - bbox[0]
        bh = bbox[3] - bbox[1]
        isi_pct = 100.0 * max(bw, bh) / w
        if max(bw, bh) < 0.45 * w:
            catatan.append("objek kecil")

    print(
        f"{stem:14s} {w}x{h:<6d} {putih_pct:5.1f}% {tepi:5.0f}% {sentuh:6d} {isi_pct:5.0f}  "
        + ("; ".join(catatan) if catatan else "ok")
    )

    if catatan:
        bermasalah.append((stem, catatan))

print("-" * 78)
if bermasalah:
    print(f"{len(bermasalah)} file perlu perhatian:")
    for stem, c in bermasalah:
        print(f"  - {stem}: {', '.join(c)}")
else:
    print("semua file bersih, siap dikonversi")
