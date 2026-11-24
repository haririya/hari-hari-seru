// RESEP SOAL
// Resep = cara merakit soal dari bank item. Arketipe tinggal minta soal,
// tidak peduli topiknya warna, bentuk, huruf, angka, atau hewan.
//
// Menambah topik baru = tambah resep di sini + item di items.js.
// TIDAK menyentuh core/ maupun games/.
//
// Aturan penting:
//  - TIDAK boleh pakai Date.now() / Math.random() langsung.
//    Semua keacakan lewat `rng` yang dioper, supaya seed bisa mengulang sesi.
//  - Teks soal HARUS menyebut targetnya. Anak 4 tahun belum bisa membaca,
//    tapi orang tua yang menemani perlu tahu soalnya apa.

import { pool } from "./items.js";
import { label } from "./i18n.js";

// ── util ──────────────────────────────────────────────────────────

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr, n, rng) {
  return shuffle(arr, rng).slice(0, n);
}

function tag(rng) {
  return Math.floor(rng() * 1e9).toString(36);
}

// Bagaimana item ditampilkan di layar. Arketipe hanya membaca ini,
// jadi tidak perlu tahu bedanya warna vs hewan vs huruf.
export function displayOf(item) {
  switch (item.kind) {
    case "color":
      return { type: "swatch", value: item.hex };
    case "shape":
      return { type: "shape", value: item.shape, hex: item.hex };
    case "letter":
      return { type: "text", value: item.upper };
    case "number":
      return { type: "text", value: String(item.value) };
    case "animal":
      // pakai gambar kalau sudah ada, kalau belum arketipe ganti emoji/kotak warna
      return { type: "image", value: item.image, emoji: item.emoji };
    default:
      return { type: "text", value: label(item, "id") };
  }
}

function optionFor(item, locale) {
  return {
    itemId: item.id,
    label: label(item, locale),
    display: displayOf(item),
  };
}

// ── resep: sebutkan satu sifat, anak memilih item yang cocok ──────

function recipePilihSatu({ id, kind, maxLevel, count, teksId, teksEn, voicePrefix }) {
  return {
    id,
    kind,
    archetypes: ["runner", "path", "memory"],
    build(rng, ctx) {
      const items = pool(kind, ctx.level ?? maxLevel);
      if (items.length < count) return null;

      const chosen = pick(items, count, rng);
      const answer = chosen[0];

      return {
        id: `${id}:${answer.id}:${tag(rng)}`,
        kind,
        prompt: {
          id: teksId(label(answer, "id")),
          en: teksEn(label(answer, "en")),
          // suara: kalimat soal yang menyebut nama target
          voice: { id: `${voicePrefix}_${answer.id}`, en: `${voicePrefix}_${answer.id}` },
        },
        answerId: answer.id,
        answerLabel: label(answer, ctx.locale),
        answerItemId: answer.id,
        options: shuffle(chosen.map((it) => optionFor(it, ctx.locale)), rng),
      };
    },
  };
}

// ── resep: dengar suara hewan, pilih hewannya ────────────────────

function recipeSuaraHewan() {
  return {
    id: "hewan_suara",
    kind: "animal",
    archetypes: ["runner", "path"],
    build(rng, ctx) {
      const animals = pool("animal", ctx.level ?? 1);
      if (animals.length < 3) return null;

      const chosen = pick(animals, 3, rng);
      const answer = chosen[0];

      return {
        id: `hewan_suara:${answer.id}:${tag(rng)}`,
        kind: "animal",
        // Soal = rekaman asli hewan. Jangan sebut nama hewan di teks soal!
        // `sfx` menunjuk berkas di assets/audio/sfx/ — sama untuk ID dan EN.
        prompt: {
          id: "Suara hewan apa ini?",
          en: "Whose sound is this?",
        },
        sfx: answer.sfx,
        answerId: answer.id,
        answerLabel: label(answer, ctx.locale),
        answerItemId: answer.id,
        isSoundQuestion: true,
        options: shuffle(chosen.map((it) => optionFor(it, ctx.locale)), rng),
      };
    },
  };
}

// ── resep: hitung jumlah benda, pilih angka ──────────────────────

function recipeHitung() {
  return {
    id: "angka_hitung",
    kind: "number",
    archetypes: ["count"],
    build(rng, ctx) {
      const numbers = pool("number", ctx.level ?? 1);
      if (numbers.length < 3) return null;

      const answer = numbers[Math.floor(rng() * numbers.length)];
      const n = answer.value;
      const distractors = pick(numbers.filter((x) => x.value !== n), 2, rng);

      return {
        id: `angka_hitung:${n}:${tag(rng)}`,
        kind: "number",
        prompt: {
          id: "Ada berapa banyak?",
          en: "How many are there?",
          voice: { id: "tanya_hitung", en: "ask_count" },
        },
        answerId: answer.id,
        answerLabel: label(answer, ctx.locale),
        countToShow: n,
        countEmoji: "⭐",
        options: shuffle([answer, ...distractors], rng).map((it) => optionFor(it, ctx.locale)),
      };
    },
  };
}

// ── resep: kelompokkan (sort) ────────────────────────────────────

const GROUP_NAME = {
  color: { id: "Warna", en: "Colors" },
  shape: { id: "Bentuk", en: "Shapes" },
  animal: { id: "Hewan", en: "Animals" },
};

function recipeKelompok() {
  return {
    id: "kelompok_kategori",
    kind: "mixed",
    archetypes: ["sort"],
    build(rng, ctx) {
      const groups = Object.keys(GROUP_NAME).filter(
        (k) => pool(k, ctx.level ?? 1).length >= 2
      );
      if (groups.length < 2) return null;

      const g = groups[Math.floor(rng() * groups.length)];
      const items = pool(g, ctx.level ?? 1);
      const item = items[Math.floor(rng() * items.length)];

      return {
        id: `kelompok:${g}:${item.id}:${tag(rng)}`,
        kind: "mixed",
        prompt: {
          id: `${label(item, "id")} masuk ke kelompok mana?`,
          en: `Which group does ${label(item, "en")} belong to?`,
          voice: { id: "tanya_kelompok", en: "ask_group" },
        },
        answerId: g,
        answerLabel: GROUP_NAME[g][ctx.locale] ?? GROUP_NAME[g].id,
        subjectItem: optionFor(item, ctx.locale),
        options: shuffle(
          groups.map((k) => ({
            itemId: k,
            label: GROUP_NAME[k][ctx.locale] ?? GROUP_NAME[k].id,
            display: { type: "text", value: GROUP_NAME[k][ctx.locale] ?? GROUP_NAME[k].id },
          })),
          rng
        ),
      };
    },
  };
}

// ── daftar resep ─────────────────────────────────────────────────

export const RECIPES = [
  recipePilihSatu({
    id: "warna_pilih",
    kind: "color",
    maxLevel: 1,
    count: 3,
    teksId: (n) => `Mana yang warnanya ${n.toLowerCase()}?`,
    teksEn: (n) => `Which one is ${n.toLowerCase()}?`,
    voicePrefix: "tanya_warna",
  }),
  recipePilihSatu({
    id: "bentuk_pilih",
    kind: "shape",
    maxLevel: 1,
    count: 3,
    teksId: (n) => `Mana yang bentuknya ${n.toLowerCase()}?`,
    teksEn: (n) => `Which one is a ${n.toLowerCase()}?`,
    voicePrefix: "tanya_bentuk",
  }),
  recipePilihSatu({
    id: "huruf_pilih",
    kind: "letter",
    maxLevel: 1,
    count: 3,
    teksId: (n) => `Mana huruf ${n}?`,
    teksEn: (n) => `Which one is letter ${n}?`,
    voicePrefix: "tanya_huruf",
  }),
  recipePilihSatu({
    id: "angka_pilih",
    kind: "number",
    maxLevel: 1,
    count: 3,
    teksId: (n) => `Mana angka ${n.toLowerCase()}?`,
    teksEn: (n) => `Which one is ${n.toLowerCase()}?`,
    voicePrefix: "tanya_angka",
  }),
  recipeSuaraHewan(),
  recipeHitung(),
  recipeKelompok(),
];

export function recipeById(id) {
  return RECIPES.find((r) => r.id === id) || null;
}

export function recipesForArchetype(archetype) {
  return RECIPES.filter((r) => r.archetypes.includes(archetype));
}
