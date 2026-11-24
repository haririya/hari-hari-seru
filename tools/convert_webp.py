"""
Konversi aset mentah (Google Flow) -> WebP siap pakai di game.

Yang dilakukan:
  1. Hapus latar putih  -> transparan. Memakai flood-fill dari tepi, jadi
     bagian PUTIH DI DALAM karakter (badan putih susu) TIDAK ikut terhapus.
  2. Erosi 1px + feather halus -> menghilangkan sisa garis putih (halo) di tepi.
  3. Potong rapat ke isi (bbox alpha), lalu tempel ke kanvas persegi transparan.
  4. Resize ke ukuran target, simpan WebP dengan alpha.

Pemakaian:
    python tools/convert_webp.py                 # semua file di assets/_raw
    python tools/convert_webp.py sparkle         # satu file saja (tanpa ekstensi)
    python tools/convert_webp.py --report        # hanya cek, tidak menulis

Butuh: Pillow, numpy, scipy  (pakai `python` 3.11, bukan python-3.10 laragon)
"""

import os
import sys
import glob

import numpy as np
from PIL import Image
from scipy import ndimage

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "assets", "_raw")
OUT_IMG = os.path.join(BASE, "assets", "images")

# Ukuran akhir per grup. Unicorn dipakai paling besar (karakter utama),
# hewan lebih kecil (kartu jawaban), kastil sedang.
SIZES = {
    "sparkle": (1024, "unicorns"),
    "breeze": (1024, "unicorns"),
    "sunny": (1024, "unicorns"),
    "berry": (1024, "unicorns"),
    "coco": (1024, "unicorns"),
    "kucing": (512, "animals"),
    "anjing": (512, "animals"),
    "sapi": (512, "animals"),
    "ayam": (512, "animals"),
    "singa": (512, "animals"),
    "katak": (512, "animals"),
    "gajah": (512, "animals"),
    "bebek": (512, "animals"),
    "kastil": (768, "castle"),
}

# Ambang "putih": kanal paling gelap masih > WHITE_MIN dianggap latar.
# JPEG membuat putih tidak persis 255, jadi jangan pakai 250.
WHITE_MIN = 205
# Batas bawah: piksel yang SANGAT gelap tidak pernah dianggap latar.
ERODE_PX = 1
WEBP_QUALITY = 92


def bg_mask(rgb):
    """True untuk piksel yang termasuk latar putih yang tersambung ke tepi."""
    whiteish = (rgb.min(axis=2) > WHITE_MIN)

    # label komponen putih; hanya komponen yang menyentuh tepi = latar
    labels, n = ndimage.label(whiteish)
    if n == 0:
        return np.zeros_like(whiteish)

    border_labels = set()
    border_labels.update(labels[0, :].tolist())
    border_labels.update(labels[-1, :].tolist())
    border_labels.update(labels[:, 0].tolist())
    border_labels.update(labels[:, -1].tolist())
    border_labels.discard(0)

    if not border_labels:
        return np.zeros_like(whiteish)

    return np.isin(labels, list(border_labels))


def remove_bg(im):
    rgb = np.asarray(im.convert("RGB")).astype(np.uint8)
    bg = bg_mask(rgb)

    alpha = np.where(bg, 0, 255).astype(np.uint8)

    # erosi 1px untuk membuang sisa putih di tepi (halo JPEG)
    if ERODE_PX > 0:
        alpha = ndimage.grey_erosion(alpha, size=(ERODE_PX * 2 + 1, ERODE_PX * 2 + 1))

    # feather halus supaya tepi tidak bergerigi
    alpha = ndimage.gaussian_filter(alpha.astype(np.float32), sigma=0.6)
    alpha = np.clip(alpha, 0, 255).astype(np.uint8)

    out = np.dstack([rgb, alpha])
    return Image.fromarray(out), bg


def crop_and_square(im, target):
    """Potong ke isi, lalu tempel ke kanvas persegi transparan, resize ke target."""
    bbox = im.getchannel("A").getbbox()
    if bbox is None:
        return None, "objek tidak ditemukan (semua transparan)"
    im = im.crop(bbox)

    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    canvas = canvas.resize((target, target), Image.LANCZOS)
    return canvas, None


def coverage(im):
    """Persentase area yang terisi (untuk deteksi aset kosong/rusak)."""
    a = np.asarray(im.getchannel("A"))
    return 100.0 * float((a > 20).sum()) / a.size


def process(name, dry=False):
    hits = glob.glob(os.path.join(RAW, name + ".*"))
    hits = [h for h in hits if not h.endswith(".webp")]
    if not hits:
        print("  LEWAT  %-10s file mentah tidak ada" % name)
        return False

    src = hits[0]
    target, sub = SIZES[name]
    im = Image.open(src)
    w0, h0 = im.size

    rgba, bg = remove_bg(im)
    pct_bg = 100.0 * float(bg.sum()) / bg.size
    square, err = crop_and_square(rgba, target)

    if err:
        print("  GAGAL  %-10s %s" % (name, err))
        return False

    cov = coverage(square)
    dst_dir = os.path.join(OUT_IMG, sub)
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, name + ".webp")

    note = ""
    if cov < 25:
        note = "  <-- PERINGATAN: isi cuma %.1f%%, cek manual" % cov
    if pct_bg < 40:
        note += "  <-- PERINGATAN: latar terdeteksi cuma %.1f%%, mungkin ada bayangan/gradien" % pct_bg

    if dry:
        print("  CEK    %-10s %dx%d -> %dpx | latar %.1f%% | isi %.1f%%%s" % (name, w0, h0, target, pct_bg, cov, note))
    else:
        square.save(dst, "WEBP", quality=WEBP_QUALITY, method=6)
        size_kb = os.path.getsize(dst) / 1024.0
        print("  OK     %-10s %dx%d -> %dpx | latar %.1f%% | isi %.1f%% | %.1f KB%s" % (name, w0, h0, target, pct_bg, cov, size_kb, note))

    return True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--report" in sys.argv

    names = args if args else list(SIZES.keys())
    unknown = [n for n in names if n not in SIZES]
    if unknown:
        print("nama tidak dikenal:", ", ".join(unknown))
        print("yang valid:", ", ".join(SIZES.keys()))
        return 1

    print("Konversi aset%s" % (" (mode cek saja)" if dry else ""))
    print("sumber:", RAW)
    print("")

    ok = 0
    for n in names:
        if process(n, dry):
            ok += 1

    print("")
    print("selesai: %d/%d" % (ok, len(names)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
