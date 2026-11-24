// DAFTAR GAME DI PORTAL
// Menambah game baru = tambah satu baris di sini + folder games/<id>/.
// Tidak menyentuh app.js, core/, atau game lain.

export const GAMES = [
  {
    id: "petualangan-unicorn",
    archetype: "runner",
    title: { id: "Petualangan Unicorn", en: "Unicorn Adventure" },
    tagline: {
      id: "Lari bersama unicorn ke Kastil Pelangi",
      en: "Run with the unicorn to the Rainbow Castle",
    },
    thumb: "assets/images/unicorns/sparkle.webp",
    placeholder: "🦄",
    theme: "games/petualangan-unicorn/theme.css",
    entry: "games/petualangan-unicorn/runner.js",
    ready: true,
  },
  {
    id: "cari-pasangan",
    archetype: "memory",
    title: { id: "Cari Pasangan", en: "Find the Pair" },
    tagline: {
      id: "Balik kartu dan temukan kembarannya",
      en: "Flip the cards and find the twins",
    },
    placeholder: "🃏",
    ready: false,
  },
  {
    id: "hitung-bintang",
    archetype: "count",
    title: { id: "Hitung Bintang", en: "Count the Stars" },
    tagline: {
      id: "Hitung bintang di langit malam",
      en: "Count the stars in the night sky",
    },
    placeholder: "⭐",
    ready: false,
  },
  {
    id: "kelompokkan",
    archetype: "sort",
    title: { id: "Kelompokkan", en: "Sort Them Out" },
    tagline: {
      id: "Masukkan benda ke keranjang yang benar",
      en: "Drop things into the right basket",
    },
    placeholder: "🧺",
    ready: false,
  },
  {
    id: "pilih-jalan",
    archetype: "path",
    title: { id: "Pilih Jalan", en: "Pick the Path" },
    tagline: {
      id: "Pilih jalan yang benar menuju harta",
      en: "Choose the right path to the treasure",
    },
    placeholder: "🗺️",
    ready: false,
  },
];

export function gameById(id) {
  return GAMES.find((g) => g.id === id) || null;
}
