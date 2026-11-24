"""Cari kandidat rekaman suara hewan asli di Wikimedia Commons.

    python tools/find_animal_sounds.py

Tidak mengunduh apa pun — hanya mencari dan melaporkan:
  - judul file, lisensi, ukuran, durasi
  - tautan unduhan langsung

Commons dipakai karena API-nya terbuka (tanpa kunci) dan lisensinya jelas.
"""
import json
import subprocess
import sys
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "Mozilla/5.0 (game-edukasi-anak; kontak: lokal)"

# Kata kunci pencarian per hewan. Sengaja sempit supaya tidak dapat
# rekaman kandang/zoo yang penuh suara lain.
QUERIES = {
    "kucing": "cat meow sound",
    "anjing": "dog barking sound",
    "sapi": "cow moo sound",
    "ayam": "chicken clucking sound",
    "singa": "lion roar sound",
    "katak": "frog croaking sound",
    "gajah": "elephant trumpet sound",
    "bebek": "duck quacking sound",
}

AUDIO_EXT = (".ogg", ".oga", ".wav", ".mp3", ".flac", ".opus")


def api(params):
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def durasi(path):
    """Durasi dalam detik lewat ffprobe; 0 kalau gagal."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", path],
            capture_output=True, text=True, timeout=20,
        )
        return float(out.stdout.strip())
    except Exception:
        return 0.0


def cari(hewan, kata, limit=8):
    data = api({
        "action": "query",
        "generator": "search",
        "gsrsearch": f"filetype:audio {kata}",
        "gsrnamespace": "6",
        "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
    })
    hasil = []
    for p in data.get("query", {}).get("pages", []):
        info = (p.get("imageinfo") or [{}])[0]
        judul = p.get("title", "")
        if not judul.lower().endswith(AUDIO_EXT):
            continue
        meta = info.get("extmetadata", {})
        lisensi = meta.get("LicenseShortName", {}).get("value", "?")
        seniman = meta.get("Artist", {}).get("value", "?")
        # bersihkan tag HTML kecil
        seniman = seniman.replace("<", " <").split("<")[0].strip() or "?"
        hasil.append({
            "hewan": hewan,
            "judul": judul.replace("File:", ""),
            "url": info.get("url"),
            "bytes": info.get("size", 0),
            "mime": info.get("mime", "?"),
            "lisensi": lisensi,
            "seniman": seniman,
            "panjang_detik": info.get("duration"),
        })
    return hasil


def main():
    semua = []
    for hewan, kata in QUERIES.items():
        print(f"\n=== {hewan}  (cari: {kata})")
        try:
            hasil = cari(hewan, kata)
        except Exception as e:
            print("  gagal:", e)
            continue
        if not hasil:
            print("  tidak ada hasil")
        for h in hasil:
            d = h["panjang_detik"]
            d = f"{float(d):5.1f}s" if d else "  ?  "
            kb = h["bytes"] / 1024
            print(f"  {d}  {kb:7.0f} KB  {h['lisensi'][:18]:18s} {h['judul'][:62]}")
            semua.append(h)

    with open("docs/animal_sound_candidates.json", "w", encoding="utf-8") as f:
        json.dump(semua, f, indent=2, ensure_ascii=False)
    print(f"\n{len(semua)} kandidat -> docs/animal_sound_candidates.json")


if __name__ == "__main__":
    sys.exit(main())
