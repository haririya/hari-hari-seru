// BANK KONTEN TERPUSAT
// Satu item bisa dipakai banyak game dan banyak arketipe.
// Menambah topik = tambah baris di sini. TIDAK menyentuh kode mesin.
//
// Struktur tiap item:
//   id      : unik, dipakai sebagai kunci jawaban
//   kind    : jenis konten -> menentukan resep mana yang bisa memakainya
//   level   : 1 = TK (4 thn), 2 = TK lanjut, 3 = SD awal
//   label   : { id, en }
//   voice   : kunci suara nama item (opsional)
//   ... properti visual sesuai kind

export const ITEMS = [
  // ── WARNA (level 1) ────────────────────────────────────────────
  { id: "merah", kind: "color", level: 1, hex: "#ef4444", label: { id: "Merah", en: "Red" }, voice: { id: "warna_merah", en: "color_red" } },
  { id: "biru", kind: "color", level: 1, hex: "#3b82f6", label: { id: "Biru", en: "Blue" }, voice: { id: "warna_biru", en: "color_blue" } },
  { id: "hijau", kind: "color", level: 1, hex: "#22c55e", label: { id: "Hijau", en: "Green" }, voice: { id: "warna_hijau", en: "color_green" } },
  { id: "kuning", kind: "color", level: 1, hex: "#eab308", label: { id: "Kuning", en: "Yellow" }, voice: { id: "warna_kuning", en: "color_yellow" } },
  { id: "ungu", kind: "color", level: 2, hex: "#a855f7", label: { id: "Ungu", en: "Purple" }, voice: { id: "warna_ungu", en: "color_purple" } },
  { id: "oranye", kind: "color", level: 2, hex: "#f97316", label: { id: "Oranye", en: "Orange" }, voice: { id: "warna_oranye", en: "color_orange" } },

  // ── BENTUK (level 1) ───────────────────────────────────────────
  { id: "lingkaran", kind: "shape", level: 1, shape: "circle", hex: "#38bdf8", label: { id: "Lingkaran", en: "Circle" }, voice: { id: "bentuk_lingkaran", en: "shape_circle" } },
  { id: "segitiga", kind: "shape", level: 1, shape: "triangle", hex: "#22c55e", label: { id: "Segitiga", en: "Triangle" }, voice: { id: "bentuk_segitiga", en: "shape_triangle" } },
  { id: "kotak", kind: "shape", level: 1, shape: "square", hex: "#f59e0b", label: { id: "Kotak", en: "Square" }, voice: { id: "bentuk_kotak", en: "shape_square" } },
  { id: "bintang", kind: "shape", level: 2, shape: "star", hex: "#facc15", label: { id: "Bintang", en: "Star" }, voice: { id: "bentuk_bintang", en: "shape_star" } },
  { id: "hati", kind: "shape", level: 2, shape: "heart", hex: "#f43f5e", label: { id: "Hati", en: "Heart" }, voice: { id: "bentuk_hati", en: "shape_heart" } },

  // ── HURUF (level 1: A-E, level 2: F-G) ─────────────────────────
  { id: "a", kind: "letter", level: 1, upper: "A", lower: "a", label: { id: "A", en: "A" }, voice: { id: "huruf_a", en: "letter_a" } },
  { id: "b", kind: "letter", level: 1, upper: "B", lower: "b", label: { id: "B", en: "B" }, voice: { id: "huruf_be", en: "letter_b" } },
  { id: "c", kind: "letter", level: 1, upper: "C", lower: "c", label: { id: "C", en: "C" }, voice: { id: "huruf_ce", en: "letter_c" } },
  { id: "d", kind: "letter", level: 1, upper: "D", lower: "d", label: { id: "D", en: "D" }, voice: { id: "huruf_de", en: "letter_d" } },
  { id: "e", kind: "letter", level: 1, upper: "E", lower: "e", label: { id: "E", en: "E" }, voice: { id: "huruf_e", en: "letter_e" } },
  { id: "f", kind: "letter", level: 2, upper: "F", lower: "f", label: { id: "F", en: "F" }, voice: { id: "huruf_ef", en: "letter_f" } },
  { id: "g", kind: "letter", level: 2, upper: "G", lower: "g", label: { id: "G", en: "G" }, voice: { id: "huruf_ge", en: "letter_g" } },

  // ── ANGKA (level 1: 1-5, level 2: 6-8) ─────────────────────────
  { id: "1", kind: "number", level: 1, value: 1, label: { id: "Satu", en: "One" }, voice: { id: "angka_satu", en: "number_one" } },
  { id: "2", kind: "number", level: 1, value: 2, label: { id: "Dua", en: "Two" }, voice: { id: "angka_dua", en: "number_two" } },
  { id: "3", kind: "number", level: 1, value: 3, label: { id: "Tiga", en: "Three" }, voice: { id: "angka_tiga", en: "number_three" } },
  { id: "4", kind: "number", level: 1, value: 4, label: { id: "Empat", en: "Four" }, voice: { id: "angka_empat", en: "number_four" } },
  { id: "5", kind: "number", level: 1, value: 5, label: { id: "Lima", en: "Five" }, voice: { id: "angka_lima", en: "number_five" } },
  { id: "6", kind: "number", level: 2, value: 6, label: { id: "Enam", en: "Six" }, voice: { id: "angka_enam", en: "number_six" } },
  { id: "7", kind: "number", level: 2, value: 7, label: { id: "Tujuh", en: "Seven" }, voice: { id: "angka_tujuh", en: "number_seven" } },
  { id: "8", kind: "number", level: 2, value: 8, label: { id: "Delapan", en: "Eight" }, voice: { id: "angka_delapan", en: "number_eight" } },

  // ── HEWAN (level 1) ────────────────────────────────────────────
  // `sfx` = nama berkas rekaman ASLI di assets/audio/sfx/{sfx}.mp3.
  // Dulu soal "tebak suara" memakai onomatope hasil TTS ("meong", "guk guk").
  // Itu suara manusia, bukan hewan — anak jadi tidak belajar bunyi sebenarnya.
  // Sekarang dipakai rekaman asli dari Wikimedia Commons (lihat
  // docs/animal_sound_credits.json untuk lisensi & pencipta).
  //
  // Suara hewan tidak bergantung bahasa, jadi satu berkas dipakai ID dan EN.
  // `voice` tetap ada untuk menyebut NAMA hewan (dipakai soal lain).
  // `emoji` = cadangan tampilan kalau gambar WebP belum tersedia.
  { id: "kucing", kind: "animal", level: 1, image: "kucing", emoji: "🐱", sfx: "kucing", label: { id: "Kucing", en: "Cat" }, voice: { id: "hewan_kucing", en: "animal_cat" } },
  { id: "anjing", kind: "animal", level: 1, image: "anjing", emoji: "🐶", sfx: "anjing", label: { id: "Anjing", en: "Dog" }, voice: { id: "hewan_anjing", en: "animal_dog" } },
  { id: "sapi", kind: "animal", level: 1, image: "sapi", emoji: "🐮", sfx: "sapi", label: { id: "Sapi", en: "Cow" }, voice: { id: "hewan_sapi", en: "animal_cow" } },
  { id: "ayam", kind: "animal", level: 1, image: "ayam", emoji: "🐔", sfx: "ayam", label: { id: "Ayam", en: "Chicken" }, voice: { id: "hewan_ayam", en: "animal_chicken" } },
  { id: "singa", kind: "animal", level: 1, image: "singa", emoji: "🦁", sfx: "singa", label: { id: "Singa", en: "Lion" }, voice: { id: "hewan_singa", en: "animal_lion" } },
  { id: "katak", kind: "animal", level: 1, image: "katak", emoji: "🐸", sfx: "katak", label: { id: "Katak", en: "Frog" }, voice: { id: "hewan_katak", en: "animal_frog" } },
  { id: "gajah", kind: "animal", level: 1, image: "gajah", emoji: "🐘", sfx: "gajah", label: { id: "Gajah", en: "Elephant" }, voice: { id: "hewan_gajah", en: "animal_elephant" } },
  { id: "bebek", kind: "animal", level: 1, image: "bebek", emoji: "🦆", sfx: "bebek", label: { id: "Bebek", en: "Duck" }, voice: { id: "hewan_bebek", en: "animal_duck" } },
];

/** Ambil semua item dengan kind tertentu, maksimal sampai level tertentu. */
export function pool(kind, maxLevel = 1) {
  return ITEMS.filter((i) => i.kind === kind && i.level <= maxLevel);
}

/** Cari item berdasarkan id. */
export function byId(id) {
  return ITEMS.find((i) => i.id === id) || null;
}

/** Daftar kind yang tersedia — dipakai untuk validasi resep. */
export const KINDS = [...new Set(ITEMS.map((i) => i.kind))];
