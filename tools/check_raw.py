"""Cek kualitas aset mentah sebelum masuk pipeline konversi."""
import sys
import os
from collections import Counter

from PIL import Image

path = sys.argv[1] if len(sys.argv) > 1 else None
if not path:
    print("pakai: python check_raw.py <file>")
    sys.exit(1)

im = Image.open(path)
print("file      :", os.path.basename(path))
print("format    :", im.format, "| mode:", im.mode)
print("dimensi   :", im.size[0], "x", im.size[1])
print("rasio     :", round(im.size[0] / im.size[1], 3))

rgba = im.convert("RGBA")
w, h = rgba.size
px = rgba.load()

# 1. warna sudut — harus putih
corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
print("\nwarna 4 sudut:")
for i, c in enumerate(corners):
    print("  sudut%d: rgb(%d,%d,%d) a=%d" % (i + 1, c[0], c[1], c[2], c[3]))

# 2. seberapa rata latarnya — sampel 4 garis tepi
edge = []
for x in range(0, w, max(1, w // 60)):
    edge.append(px[x, 1])
    edge.append(px[x, h - 2])
for y in range(0, h, max(1, h // 60)):
    edge.append(px[1, y])
    edge.append(px[w - 2, y])
c = Counter(edge)
top, topn = c.most_common(1)[0]
print("\ntepi gambar: %d sampel, warna dominan rgb(%d,%d,%d) = %.1f%%" % (len(edge), top[0], top[1], top[2], 100.0 * topn / len(edge)))
print("variasi warna tepi unik:", len(c))

# 3. berapa persen area yang benar-benar putih
whiteish = 0
total = 0
for y in range(0, h, 4):
    for x in range(0, w, 4):
        r, g, b, a = px[x, y]
        total += 1
        if r > 245 and g > 245 and b > 245:
            whiteish += 1
print("\narea hampir putih (>245): %.1f%%" % (100.0 * whiteish / total))

# 4. apakah ada isi yang menyentuh tepi (tanda terpotong)
touch = 0
for x in range(w):
    for y in (0, 1, h - 2, h - 1):
        r, g, b, a = px[x, y]
        if not (r > 235 and g > 235 and b > 235):
            touch += 1
            break
for y in range(h):
    for x in (0, 1, w - 2, w - 1):
        r, g, b, a = px[x, y]
        if not (r > 235 and g > 235 and b > 235):
            touch += 1
            break
print("baris/kolom tepi yang tersentuh objek:", touch, "(0 = aman, >0 = mungkin terpotong)")

# 5. bounding box objek (piksel non-putih)
mask = rgba.convert("L").point(lambda v: 0 if v > 240 else 255)
bbox = mask.getbbox()
print("\nbbox objek :", bbox)
if bbox:
    bw = bbox[2] - bbox[0]
    bh = bbox[3] - bbox[1]
    print("ukuran isi : %d x %d (%.1f%% lebar, %.1f%% tinggi kanvas)" % (bw, bh, 100.0 * bw / w, 100.0 * bh / h))
    print("margin     : kiri %d, atas %d, kanan %d, bawah %d" % (bbox[0], bbox[1], w - bbox[2], h - bbox[3]))
