"""Ekstrak prompt dari PROMPT_ASET.md ke PROMPT_ASET.txt (siap copy-paste)."""
import re
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "docs", "PROMPT_ASET.md")
DST = os.path.join(BASE, "docs", "PROMPT_ASET.txt")

src = open(SRC, encoding="utf-8").read()
blocks = re.findall(r"### (\d+) — `([^`]+)`\n```\n(.*?)\n```", src, re.S)

lines = [
    "PROMPT ASET - Petualangan Unicorn",
    "Total 14 gambar. Generate di Google Flow, rasio 1:1, latar putih polos.",
    r"Simpan ke: E:\hariri.hsn\game\assets\_raw",
    "=" * 66,
    "",
]

for num, fname, prompt in blocks:
    lines.append("[%s] %s" % (num, fname))
    lines.append(prompt.strip())
    lines.append("")
    lines.append("-" * 66)
    lines.append("")

open(DST, "w", encoding="utf-8").write("\n".join(lines))
print("prompt diekstrak:", len(blocks))
print("output:", DST)
