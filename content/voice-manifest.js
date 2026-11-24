// MANIFEST SUARA
// Ini SATU-SATUNYA sumber kebenaran untuk semua narasi.
// Kode memanggil KUNCI, bukan nama file. Pindah mesin TTS nanti = regenerate
// file, manifest dan kode tidak berubah.
//
// Generator: tools/gen_voice.py  ->  assets/audio/voice/{locale}/{kunci}.mp3
//
// Gaya penulisan (penting untuk TTS anak):
//  - Kalimat pendek, maksimal 8 kata.
//  - Tanpa singkatan, tanpa angka numerik (tulis "satu", bukan "1").
//  - Tanpa tanda seru berlebihan; gTTS membacanya datar.

import { ITEMS } from "./items.js";

// ── teks dasar ───────────────────────────────────────────────────

const BASE = {
  // navigasi & alur
  intro_pilih: { id: "Halo teman! Ayo pilih teman unicorn kamu!", en: "Hello friend! Let's pick your unicorn friend!" },
  pilih_mode: { id: "Mau main apa hari ini?", en: "What shall we play today?" },
  mulai_main: { id: "Ayo kita mulai!", en: "Let's start!" },
  tekan_mulai: { id: "Tekan tombol hijau untuk mulai.", en: "Tap the green button to start." },
  ulangi: { id: "Dengar lagi.", en: "Listen again." },
  menang_kastil: { id: "Hore! Kamu sampai di Kastil Pelangi!", en: "Hooray! You reached the Rainbow Castle!" },
  dapat_bintang: { id: "Kamu dapat satu bintang!", en: "You earned one star!" },
  selesai: { id: "Semua soal sudah selesai. Kamu hebat!", en: "All done. You did great!" },

  // umpan balik
  benar_1: { id: "Hebat!", en: "Great job!" },
  benar_2: { id: "Wah, pintar sekali!", en: "Wow, so clever!" },
  benar_3: { id: "Betul sekali!", en: "That's right!" },
  salah_coba: { id: "Belum tepat. Coba lagi yuk!", en: "Not quite. Let's try again!" },

  // soal
  tanya_hitung: { id: "Ada berapa banyak?", en: "How many are there?" },
  tanya_kelompok: { id: "Masuk ke kelompok mana?", en: "Which group does it belong to?" },
  tanya_suara: { id: "Suara hewan apa ini?", en: "Whose sound is this?" },

  // mini-game lompat rintangan
  // Diucapkan SEBELUM rintangan mulai bergerak, jadi anak tahu harus apa.
  lompat_ayo: { id: "Tap layarnya untuk lompat!", en: "Tap the screen to jump!" },
  lompat_hebat: { id: "Hebat lompatnya!", en: "Great jumping!" },
  checkpoint_suara: { id: "Aduh kena! Tap untuk lanjut.", en: "Oops! Tap to continue." },
};

// ── soal per item, dirakit otomatis dari bank item ───────────────
// Jadi kalau nanti tambah warna/ bentuk baru di items.js,
// narasinya ikut terbentuk tanpa edit file ini.

const GENERATED = {};

// warna: "Mana yang warnanya merah?"
for (const it of ITEMS.filter((i) => i.kind === "color")) {
  GENERATED[`tanya_warna_${it.id}`] = {
    id: `Mana yang warnanya ${it.label.id.toLowerCase()}?`,
    en: `Which one is ${it.label.en.toLowerCase()}?`,
  };
}

// bentuk: "Mana yang bentuknya lingkaran?"
for (const it of ITEMS.filter((i) => i.kind === "shape")) {
  GENERATED[`tanya_bentuk_${it.id}`] = {
    id: `Mana yang bentuknya ${it.label.id.toLowerCase()}?`,
    en: `Which one is a ${it.label.en.toLowerCase()}?`,
  };
}

// huruf: sebut nama hurufnya, bukan ejaannya
for (const it of ITEMS.filter((i) => i.kind === "letter")) {
  GENERATED[`tanya_huruf_${it.id}`] = {
    id: `Mana huruf ${it.label.id}?`,
    en: `Which one is letter ${it.label.en}?`,
  };
}

// angka: sebut katanya, bukan digitnya (TTS salah baca digit)
for (const it of ITEMS.filter((i) => i.kind === "number")) {
  GENERATED[`tanya_angka_${it.id}`] = {
    id: `Mana angka ${it.label.id.toLowerCase()}?`,
    en: `Which one is number ${it.label.en.toLowerCase()}?`,
  };
}

// hewan: nama hewan (untuk label jawaban yang diucapkan)
for (const it of ITEMS.filter((i) => i.kind === "animal")) {
  GENERATED[`hewan_${it.id}`] = {
    id: it.label.id,
    en: it.label.en,
  };
}

// CATATAN: onomatope TTS ("Meong meong!") SUDAH TIDAK DIPAKAI.
// Soal "tebak suara hewan" sekarang memutar rekaman asli dari
// assets/audio/sfx/{hewan}.mp3 — lihat tools/build_animal_sfx.py.
// Dulu di sini ada blok SUARA yang membangkitkan kunci `suara_<hewan>`;
// kunci itu dihapus supaya tidak ada yang tanpa sengaja memakainya lagi.

// ── gabungan ─────────────────────────────────────────────────────

export const VOICE_LINES = { ...BASE, ...GENERATED };

export const VOICE_KEYS = Object.keys(VOICE_LINES);

/** Path file suara. Runtime memakai ini; kalau file tidak ada, fallback ke TTS browser. */
export function voicePath(key, locale) {
  return `assets/audio/voice/${locale}/${key}.mp3`;
}

/** Ambil teks untuk satu kunci (dipakai generator dan fallback). */
export function voiceText(key, locale) {
  const line = VOICE_LINES[key];
  if (!line) return null;
  return line[locale] ?? line.id ?? null;
}
