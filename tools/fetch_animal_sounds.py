"""Unduh rekaman suara hewan asli dari Wikimedia Commons.

    python tools/fetch_animal_sounds.py

Menyimpan ke assets/_raw_audio/ dan menulis kredit lisensi ke
docs/animal_sound_credits.json — CC BY-SA wajib disebut di deskripsi video.

Catatan penting: file berawalan En-us-, De-, Fr-, Ru- adalah rekaman
PENGUCAPAN KATA oleh manusia (proyek Wiktionary), bukan suara hewan.
Semua sudah disaring keluar dari daftar di bawah.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "GameEdukasiAnak/1.0 (proyek lokal; kontak hasanhariri79@gmail.com)"
OUT = "assets/_raw_audio"

# Rekaman asli saja. Urutan = prioritas (CC0/PD didahulukan).
KANDIDAT = {
    "kucing": [
        "Meow of a Siamese cat - freemaster2.wav",   # CC0
        "Meow of a pleading cat.oga",
        "Meow domestic cat.ogg",
    ],
    "anjing": [
        "Barking of a dog.ogg",
        "Barking of a dog 2.ogg",
        "Perro ladrando.ogg",
    ],
    "sapi": [
        "Cow in Vezo.ogg",            # CC0
        "Single Cow Moo.ogg",
        "Mudchute cow 1.ogg",
    ],
    "ayam": [
        "Hen announcing shes lain an egg.ogg",   # Public domain
        "Chickens demanding food.ogg",           # Public domain
        "Medium rooster crowing.ogg",            # Public domain
    ],
    "singa": [
        "Lionroar.wav",
        "Lion raring-sound1TamilNadu178.ogg",
    ],
    "katak": [
        "Single Frog Croak.oga",
        "Victorian smooth froglet call.ogg",
    ],
    "gajah": [
        "Elephant voice - trumpeting.ogg",
    ],
    "bebek": [
        "Anas platyrhynchos - Mallard - XC62258.ogg",
    ],
}


def api(params):
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)


def info_berkas(judul):
    d = api({
        "action": "query",
        "titles": f"File:{judul}",
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
    })
    pages = d.get("query", {}).get("pages", [])
    if not pages or "missing" in pages[0]:
        return None
    i = (pages[0].get("imageinfo") or [{}])[0]
    meta = i.get("extmetadata", {})

    def m(k):
        v = meta.get(k, {}).get("value", "")
        return v.replace("<", " <").split("<")[0].strip()

    return {
        "judul": judul,
        "url": i.get("url"),
        "mime": i.get("mime"),
        "bytes": i.get("size", 0),
        "lisensi": m("LicenseShortName") or "?",
        "seniman": m("Artist") or "?",
        "halaman": f"https://commons.wikimedia.org/wiki/File:{judul.replace(' ', '_')}",
    }


def unduh(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())


def main():
    os.makedirs(OUT, exist_ok=True)
    kredit = []
    gagal = []

    for hewan, daftar in KANDIDAT.items():
        print(f"\n=== {hewan}")
        for n, judul in enumerate(daftar, 1):
            ext = os.path.splitext(judul)[1]
            path = os.path.join(OUT, f"{hewan}-{n}{ext}")

            if os.path.exists(path) and os.path.getsize(path) > 1000:
                print(f"  = sudah ada  {os.path.basename(path)}")
                continue

            try:
                info = info_berkas(judul)
                if not info or not info["url"]:
                    print(f"  ✗ tidak ditemukan: {judul}")
                    gagal.append(judul)
                    continue

                unduh(info["url"], path)
                kb = os.path.getsize(path) / 1024
                info["file"] = path
                info["hewan"] = hewan
                kredit.append(info)
                print(f"  ✓ {os.path.basename(path):28s} {kb:7.0f} KB  {info['lisensi']}")
                time.sleep(3)   # hormati batas Commons

            except Exception as e:
                print(f"  ✗ {judul}: {e}")
                gagal.append(judul)
                time.sleep(5)

    with open("docs/animal_sound_credits.json", "w", encoding="utf-8") as f:
        json.dump(kredit, f, indent=2, ensure_ascii=False)

    print(f"\n{len(kredit)} berkas diunduh -> {OUT}")
    if gagal:
        print("gagal:", gagal)
    print("kredit -> docs/animal_sound_credits.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
