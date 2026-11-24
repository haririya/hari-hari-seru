"""Analisis rekaman mentah: cari bagian paling berisi suara.

    python tools/analyze_audio.py

Untuk setiap berkas:
  - hitung RMS per 100 ms
  - laporkan bagian paling keras (kandidat potongan)
  - laporkan bagian hening di awal/akhir (yang harus dibuang)

Tujuannya bukan memotong otomatis, tapi memberi angka supaya potongan
tidak asal dari detik 0 — beberapa rekaman punya 10 detik hening di depan.
"""
import glob
import json
import os
import subprocess
import sys

SR = 8000          # cukup untuk analisis amplitudo, hemat waktu
WIN = 0.10         # jendela 100 ms


def rms_envelope(path):
    """Kembalikan list RMS per 100ms."""
    cmd = [
        "ffmpeg", "-v", "error", "-i", path,
        "-ac", "1", "-ar", str(SR), "-f", "s16le", "-",
    ]
    raw = subprocess.run(cmd, capture_output=True, timeout=180).stdout
    if not raw:
        return []

    import array
    a = array.array("h")
    a.frombytes(raw[: len(raw) - (len(raw) % 2)])

    step = int(SR * WIN)
    out = []
    for i in range(0, len(a) - step + 1, step):
        chunk = a[i:i + step]
        # RMS tanpa numpy: akar dari rata-rata kuadrat
        s = 0
        for v in chunk:
            s += v * v
        out.append((s / step) ** 0.5)
    return out


def analisis(path):
    env = rms_envelope(path)
    if not env:
        return None

    puncak = max(env)
    if puncak <= 0:
        return None

    # ambang: 12% dari puncak — cukup rendah untuk menangkap ekor suara
    ambang = puncak * 0.12

    # cari jendela 2 detik (20 sampel) dengan energi tertinggi
    n = 20
    terbaik, posisi = -1, 0
    for i in range(len(env) - n + 1):
        e = sum(env[i:i + n])
        if e > terbaik:
            terbaik, posisi = e, i

    # awal & akhir bagian bersuara
    mulai = next((i for i, v in enumerate(env) if v > ambang), 0)
    akhir = len(env) - next(
        (i for i, v in enumerate(reversed(env)) if v > ambang), 0
    )

    return {
        "file": os.path.basename(path),
        "durasi": round(len(env) * WIN, 2),
        "puncak_rms": round(puncak),
        "mulai_bersuara": round(mulai * WIN, 2),
        "akhir_bersuara": round(akhir * WIN, 2),
        "potong_dari": round(posisi * WIN, 2),
        "energi_potongan": round(terbaik),
        # rasio energi potongan vs rata-rata: makin tinggi makin padat suaranya
        "kepadatan": round(terbaik / (sum(env) / len(env) + 1e-9), 1),
    }


def main():
    hasil = []
    for path in sorted(glob.glob("assets/_raw_audio/*")):
        try:
            r = analisis(path)
        except Exception as e:
            print(f"  ✗ {os.path.basename(path)}: {e}")
            continue
        if r:
            hasil.append(r)

    print(f"{'berkas':16s} {'dur':>6s} {'suara':>13s} {'potong':>7s} {'padat':>6s}")
    for r in hasil:
        print(
            f"{r['file']:16s} {r['durasi']:6.2f} "
            f"{r['mulai_bersuara']:5.2f}-{r['akhir_bersuara']:5.2f} "
            f"{r['potong_dari']:7.2f} {r['kepadatan']:6.1f}"
        )

    with open("docs/animal_sound_analysis.json", "w", encoding="utf-8") as f:
        json.dump(hasil, f, indent=2, ensure_ascii=False)
    print(f"\n{len(hasil)} berkas dianalisis -> docs/animal_sound_analysis.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
