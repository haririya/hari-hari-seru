"""Buat potongan pendek suara hewan asli untuk game.

    python tools/build_animal_sfx.py

Untuk setiap hewan:
  - ambil bagian paling berisi suara (dari hasil analyze_audio.py)
  - potong ~2 detik
  - ulang kalau sumbernya terlalu pendek (kucing cuma 1 detik)
  - normalkan kenyaringan ke -16 LUFS, bukan sekadar puncak
    -> supaya ayam tidak jauh lebih keras daripada katak
  - fade in/out kecil supaya tidak "klik" di speaker
  - encode MP3 mono 44.1 kHz

Keluaran:
  assets/audio/sfx/{hewan}.mp3          <- dipakai game
  assets/audio/sfx/_uji/{hewan}-{n}.mp3 <- semua kandidat untuk audisi

Suara hewan tidak bergantung bahasa, jadi satu berkas dipakai ID dan EN.
"""
import json
import os
import subprocess
import sys

OUT = "assets/audio/sfx"
UJI = os.path.join(OUT, "_uji")

PANJANG = 2.0      # detik — target akhir
FADE = 0.04        # detik
LUFS = -16.0       # kenyaringan persepsi target
TRUE_PEAK = -1.5   # batas puncak

# (hewan, berkas, mulai, panjang, keterangan)
PILIHAN = [
    # ── utama: dipakai game ───────────────────────────────────────
    ("kucing", "kucing-1.wav", 0.15, 1.00, "utama — CC0, diulang 2x"),
    ("anjing", "anjing-1.ogg", 0.10, 2.00, "utama — gonggongan tunggal"),
    ("sapi",   "sapi-2.ogg",   0.60, 2.00, "utama — moo panjang"),
    ("ayam",   "ayam-3.ogg",   2.90, 2.00, "utama — kokok, paling padat"),
    ("singa",  "singa-1.wav", 16.50, 2.20, "utama — auman asli"),
    ("katak",  "katak-1.oga",  0.00, 2.00, "utama — croak tunggal"),
    ("gajah",  "gajah-1.ogg",  0.00, 1.40, "utama — CC0, diulang 2x"),
    ("bebek",  "bebek-1.ogg",  1.10, 2.00, "utama — mallard"),

    # ── kandidat lain: untuk audisi ───────────────────────────────
    ("kucing", "kucing-3.ogg", 0.10, 1.05, "alt — 44.1k stereo"),
    ("kucing", "kucing-2.oga", 9.40, 2.00, "alt — 8 kHz, kualitas rendah"),
    ("anjing", "anjing-2.ogg", 1.50, 2.00, "alt — gonggongan berulang"),
    ("anjing", "anjing-3.ogg", 2.20, 2.00, "alt — stereo"),
    ("sapi",   "sapi-1.ogg",   0.20, 1.00, "alt — CC0 pendek"),
    ("sapi",   "sapi-3.ogg",   0.10, 2.00, "alt — moo tunggal"),
    ("ayam",   "ayam-1.ogg",   3.80, 2.00, "alt — ayam minta makan"),
    ("ayam",   "ayam-2.ogg",   8.10, 2.00, "alt — keluar kandang"),
    ("singa",  "singa-2.ogg",  0.30, 2.20, "alt — public domain"),
    ("katak",  "katak-2.ogg",  24.90, 2.00, "alt — chorus malam"),
]


def ukur_lufs(path, mulai, panjang):
    """Lolos pertama loudnorm: ukur kenyaringan sebenarnya."""
    r = subprocess.run(
        ["ffmpeg", "-v", "info", "-ss", str(mulai), "-t", str(panjang),
         "-i", path,
         "-af", f"loudnorm=I={LUFS}:TP={TRUE_PEAK}:LRA=11:print_format=json",
         "-f", "null", "-"],
        capture_output=True, text=True, timeout=180,
    )
    txt = r.stderr
    awal = txt.rfind("{")
    akhir = txt.rfind("}")
    if awal == -1 or akhir == -1:
        return None
    try:
        return json.loads(txt[awal:akhir + 1])
    except json.JSONDecodeError:
        return None


def bangun(path, mulai, panjang, keluar):
    """Potong, ulang bila pendek, normalkan LUFS, fade, encode MP3."""
    # kalau sumber lebih pendek dari target, ulang supaya cukup panjang
    ulang = max(1, int(-(-PANJANG // panjang)))   # ceil
    ulangi = ulang > 1

    m = ukur_lufs(path, mulai, panjang)

    if m:
        af = (
            f"loudnorm=I={LUFS}:TP={TRUE_PEAK}:LRA=11"
            f":measured_I={m['input_i']}:measured_TP={m['input_tp']}"
            f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
            f":offset={m['target_offset']}:linear=true,"
            f"afade=t=in:st=0:d={FADE},"
            f"afade=t=out:st={max(0.0, ulang * panjang - FADE):.3f}:d={FADE}"
        )
    else:
        # cadangan: normalkan puncak saja
        af = (
            f"volume=-1.5dB,"
            f"afade=t=in:st=0:d={FADE},"
            f"afade=t=out:st={max(0.0, ulang * panjang - FADE):.3f}:d={FADE}"
        )

    cmd = ["ffmpeg", "-y", "-v", "error"]
    if ulangi:
        cmd += ["-stream_loop", str(ulang - 1)]
    # -ss di sisi input (cari cepat), -t di sisi output (batasi hasil)
    # Kalau -t ditaruh sebelum -i, pengulangan tidak menambah panjang.
    cmd += ["-ss", str(mulai), "-i", path,
            "-t", f"{ulang * panjang:.3f}",
            "-af", af, "-ac", "1", "-ar", "44100",
            "-codec:a", "libmp3lame", "-b:a", "96k", keluar]

    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    return r.returncode == 0, ulang, r.stderr.strip()


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(UJI, exist_ok=True)

    if not os.path.isdir("assets/_raw_audio"):
        print("assets/_raw_audio tidak ada — jalankan fetch_animal_sounds.py dulu")
        return 1

    laporan = []
    nomor = {}
    gagal = 0

    for hewan, berkas, mulai, panjang, ket in PILIHAN:
        sumber = os.path.join("assets/_raw_audio", berkas)
        if not os.path.exists(sumber):
            print(f"  ✗ sumber tidak ada: {berkas}")
            gagal += 1
            continue

        utama = ket.startswith("utama")
        if utama:
            keluar = os.path.join(OUT, f"{hewan}.mp3")
        else:
            nomor[hewan] = nomor.get(hewan, 1) + 1
            keluar = os.path.join(UJI, f"{hewan}-{nomor[hewan]}.mp3")

        ok, ulang, err = bangun(sumber, mulai, panjang, keluar)
        if ok:
            kb = os.path.getsize(keluar) / 1024
            tag = f"{ulang}x" if ulang > 1 else "  "
            print(f"  ✓ {os.path.basename(keluar):18s} {kb:6.0f} KB  {tag}  ({ket})")
            laporan.append({
                "hewan": hewan, "berkas": os.path.basename(keluar),
                "sumber": berkas, "mulai": mulai, "panjang": panjang,
                "diulang": ulang, "keterangan": ket,
            })
        else:
            print(f"  ✗ {keluar}: {err[:80]}")
            gagal += 1

    with open("docs/animal_sfx_build.json", "w", encoding="utf-8") as f:
        json.dump(laporan, f, indent=2, ensure_ascii=False)

    print(f"\n{len(laporan)} potongan dibuat, {gagal} gagal")
    return 0 if gagal == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
