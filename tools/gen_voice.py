"""
Generate semua narasi game dengan gTTS.

Sumber teks : docs/voice_lines.json  (dihasilkan tools/dump_voice_manifest.mjs)
Output      : assets/audio/voice/{id,en}/{kunci}.mp3

Sifat:
  - RESUMABLE: file yang sudah ada dan tidak kosong dilewati.
  - Retry otomatis 3x per baris kalau jaringan gagal.
  - Kalau satu baris gagal terus, dicatat dan proses lanjut; jalankan ulang
    nanti untuk menambal yang bolong.

Pakai Python 3.10 laragon (di situ gTTS terpasang):
  C:/laragon/bin/python/python-3.10/python.exe tools/gen_voice.py
  ... tools/gen_voice.py --locale id      # satu bahasa saja
  ... tools/gen_voice.py --force          # timpa semua
  ... tools/gen_voice.py --dry            # hanya hitung, tidak menulis
"""

import json
import os
import sys
import time

from gtts import gTTS

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINES = os.path.join(BASE, "docs", "voice_lines.json")
OUT = os.path.join(BASE, "assets", "audio", "voice")

# tld=co.uk memberi aksen Inggris yang lebih netral untuk versi EN
TLD = {"id": "com", "en": "co.uk"}
SLOW = False       # gTTS tidak mendukung rate; kalau butuh lebih lambat, pakai SSML engine lain
RETRIES = 3
PAUSE = 0.35       # jeda antar request supaya tidak dianggap spam


def target(locale, key):
    return os.path.join(OUT, locale, key + ".mp3")


def ok_file(path):
    return os.path.exists(path) and os.path.getsize(path) > 1200


def generate(locale, key, text, force=False, dry=False):
    path = target(locale, key)
    if not force and ok_file(path):
        return "skip"
    if dry:
        return "would"

    last = None
    for attempt in range(1, RETRIES + 1):
        try:
            tts = gTTS(text=text, lang=locale, tld=TLD.get(locale, "com"), slow=SLOW)
            tts.save(path)
            if ok_file(path):
                return "ok"
            last = "file terlalu kecil"
        except Exception as e:  # noqa: BLE001
            last = str(e)[:120]
        time.sleep(1.2 * attempt)
    return "FAIL: " + str(last)


def main():
    argv = sys.argv[1:]
    force = "--force" in argv
    dry = "--dry" in argv

    locales = ["id", "en"]
    if "--locale" in argv:
        i = argv.index("--locale")
        if i + 1 < len(argv):
            locales = [argv[i + 1]]

    if not os.path.exists(LINES):
        print("voice_lines.json belum ada. Jalankan dulu:")
        print("  node tools/dump_voice_manifest.mjs")
        return 1

    with open(LINES, encoding="utf-8") as f:
        lines = json.load(f)

    print("sumber :", LINES)
    print("kunci  :", len(lines))
    print("bahasa :", ", ".join(locales))
    print("mode   :", "cek saja" if dry else ("timpa semua" if force else "tambal yang kurang"))
    print("")

    tally = {"ok": 0, "skip": 0, "would": 0, "fail": 0}
    failures = []

    for locale in locales:
        os.makedirs(os.path.join(OUT, locale), exist_ok=True)
        print("── %s ──" % locale)

        for key, line in lines.items():
            text = line.get(locale) or line.get("id")
            if not text:
                continue
            res = generate(locale, key, text, force=force, dry=dry)
            if res == "ok":
                tally["ok"] += 1
                print("  ok    %s" % key)
            elif res == "skip":
                tally["skip"] += 1
            elif res == "would":
                tally["would"] += 1
            else:
                tally["fail"] += 1
                failures.append((locale, key, res))
                print("  GAGAL %s -> %s" % (key, res))
            time.sleep(PAUSE)

    print("")
    print("hasil: %d dibuat, %d dilewati, %d gagal%s"
          % (tally["ok"], tally["skip"], tally["fail"],
             (", %d akan dibuat" % tally["would"]) if dry else ""))

    if failures:
        print("")
        print("yang gagal (jalankan ulang script ini untuk menambal):")
        for locale, key, why in failures:
            print("  %s/%s  %s" % (locale, key, why))
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
