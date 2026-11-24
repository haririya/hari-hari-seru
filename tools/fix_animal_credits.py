"""Lengkapi atribusi rekaman hewan yang benar-benar dipakai game.

    python tools/fix_animal_credits.py

Masalah: fetch_animal_sounds.py menyimpan `seniman` sebagai "?" untuk
sebagian besar berkas karena field Artist di Commons kosong pada
metadata pertama yang dibaca.

Skrip ini:
  - hanya memeriksa berkas yang dipakai game (yang "utama")
  - mengambil extmetadata lengkap: Artist, Credit, LicenseShortName,
    LicenseUrl, AttributionRequired
  - menulis docs/ATRIBUSI_SUARA.md supaya atribusi CC BY-SA terpenuhi
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "GameEdukasiAnak/1.0 (proyek lokal; hasanhariri79@gmail.com)"

# berkas mentah yang jadi suara utama di game
UTAMA = {
    "kucing-1.wav": "kucing",
    "anjing-1.ogg": "anjing",
    "sapi-2.ogg": "sapi",
    "ayam-3.ogg": "ayam",
    "singa-1.wav": "singa",
    "katak-1.oga": "katak",
    "gajah-1.ogg": "gajah",
    "bebek-1.ogg": "bebek",
}


def bersih(html):
    """Buang tag HTML dari nilai extmetadata."""
    import re
    return re.sub(r"<[^>]+>", "", str(html or "")).strip()


def ambil_banyak(judul_list, percobaan=4):
    """Ambil extmetadata BANYAK berkas dalam SATU permintaan.

    Commons membalas 429 kalau dipanggil berulang cepat. Satu permintaan
    untuk semua judul (dipisah "|") menghindari masalah itu sekaligus —
    dan kalau gagal, atribusi CC BY-SA tidak boleh diam-diam jadi "?".

    Judul WAJIB berawalan "File:". Tanpa itu API membalas "invalid" tanpa
    error, dan atribusi jatuh ke "?" secara diam-diam.
    """
    judul_list = [
        j if j.lower().startswith("file:") else f"File:{j}"
        for j in judul_list if j
    ]
    params = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "prop": "imageinfo",
        "iiprop": "extmetadata|url|size|user",
        "titles": "|".join(judul_list),
    }
    url = API + "?" + urllib.parse.urlencode(params)

    data = None
    for n in range(percobaan):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = json.load(r)
            if data.get("query", {}).get("pages"):
                break
        except Exception as e:
            print(f"    percobaan {n + 1} gagal: {e}")
            data = None
        time.sleep(3.0 * (n + 1))

    if not data:
        return {}

    hasil = {}
    for pg in data.get("query", {}).get("pages", []):
        judul = pg.get("title", "")
        info = pg.get("imageinfo")
        if not info:
            continue
        ii = info[0]
        md = ii.get("extmetadata", {})

        def f(kunci, _md=md):
            return bersih(_md.get(kunci, {}).get("value"))

        hasil[judul] = {
            "judul": judul,
            "unggah": ii.get("user", ""),
            "halaman": "https://commons.wikimedia.org/wiki/"
                       + urllib.parse.quote(judul.replace(" ", "_")),
            "lisensi": f("LicenseShortName"),
            "lisensi_url": f("LicenseUrl"),
            "pencipta": (f("Artist") or f("Credit")
                         or ii.get("user", "") or "(tidak tercantum)"),
            "kredit": f("Credit"),
            "wajib_atribusi": f("AttributionRequired"),
            "deskripsi": f("ImageDescription")[:160],
        }
    return hasil


def main():
    kredit = json.load(open("docs/animal_sound_credits.json", encoding="utf-8"))

    # peta: nama berkas mentah -> entri kredit
    peta = {}
    for c in kredit:
        nama = os.path.basename(str(c.get("file", "")).replace("\\", "/"))
        peta[nama] = c

    # kumpulkan judul dulu, lalu ambil semuanya dalam SATU permintaan
    pasangan = []
    for mentah, hewan in UTAMA.items():
        c = peta.get(mentah)
        if not c:
            print(f"  ✗ tidak ada di kredit: {mentah}")
            continue
        judul = c.get("judul", "")
        pasangan.append((mentah, hewan, judul))
        print(f"  {hewan:8s} {mentah:14s} {judul[:52]}")

    md_semua = ambil_banyak([j for _, _, j in pasangan])
    # kunci dari API selalu berawalan "File:", sedangkan yang tersimpan
    # di berkas kredit tidak — samakan dulu sebelum mencari.
    md_peta = {k.lower().replace("_", " "): v for k, v in md_semua.items()}

    hasil = []
    kurang = []
    for mentah, hewan, judul in pasangan:
        kunci = (judul if judul.lower().startswith("file:") else f"File:{judul}")
        md = md_peta.get(kunci.lower().replace("_", " "))
        c = peta[mentah]

        entri = {
            "hewan": hewan,
            "berkas_game": f"assets/audio/sfx/{hewan}.mp3",
            "berkas_sumber": mentah,
            "judul_commons": judul,
        }
        if md:
            entri.update({
                "pencipta": md["pencipta"],
                "lisensi": md["lisensi"],
                "lisensi_url": md["lisensi_url"],
                "halaman": md["halaman"],
                "wajib_atribusi": md["wajib_atribusi"],
            })
        else:
            # jangan diam-diam mengarang atribusi
            kurang.append(hewan)
            entri.update({
                "pencipta": c.get("seniman") or "(tidak tercantum)",
                "lisensi": c.get("lisensi", ""),
                "lisensi_url": "",
                "halaman": c.get("halaman", ""),
                "wajib_atribusi": "",
            })
        hasil.append(entri)

    if kurang:
        print(f"\n⚠ metadata tidak terambil untuk: {', '.join(kurang)}")
        print("  jalankan ulang skrip ini — atribusi CC wajib lengkap.")

    with open("docs/animal_sfx_credits.json", "w", encoding="utf-8") as f:
        json.dump(hasil, f, indent=2, ensure_ascii=False)

    # ── tulis berkas atribusi yang bisa dibaca manusia ────────────
    baris = [
        "# Atribusi Suara Hewan",
        "",
        "Rekaman asli dari Wikimedia Commons. Sebagian berlisensi CC BY / CC BY-SA",
        "yang **mewajibkan pencantuman pencipta** — daftar ini memenuhi kewajiban itu.",
        "",
        "| Hewan | Berkas game | Pencipta | Lisensi | Sumber |",
        "|---|---|---|---|---|",
    ]
    for e in hasil:
        lis = e["lisensi"] or "?"
        if e.get("lisensi_url"):
            lis = f"[{lis}]({e['lisensi_url']})"
        baris.append(
            f"| {e['hewan']} | `{e['berkas_game']}` | {e['pencipta']} | {lis} | "
            f"[Commons]({e['halaman']}) |"
        )

    baris += [
        "",
        "## Catatan",
        "",
        "- Rekaman dipotong ~2 detik dan dinormalkan ke -16 LUFS oleh",
        "  `tools/build_animal_sfx.py`. Pemotongan & normalisasi adalah perubahan",
        "  (adaptasi) yang diizinkan lisensi CC.",
        "- Lisensi CC BY-SA mewajibkan karya turunan tetap berbagi dengan lisensi",
        "  yang sama **jika didistribusikan**. Selama game dipakai sendiri /",
        "  diunggah sebagai video (bukan distribusi berkas audio), cukup",
        "  mencantumkan atribusi di deskripsi video.",
        "- Berkas mentah lengkap ada di `assets/_raw_audio/`.",
        "",
    ]

    with open("docs/ATRIBUSI_SUARA.md", "w", encoding="utf-8") as f:
        f.write("\n".join(baris))

    print(f"\n{len(hasil)} entri -> docs/animal_sfx_credits.json")
    print("ringkasan  -> docs/ATRIBUSI_SUARA.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
