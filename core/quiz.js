// MESIN SOAL
// Tugasnya cuma satu: menghasilkan deretan soal yang layak untuk satu sesi main.
// Tidak tahu apa-apa soal tampilan, suara, atau hewan/ warna tertentu.
//
// Dipakai semua arketipe. Menambah game baru tidak mengubah file ini.

import { recipesForArchetype } from "../content/recipes.js";

// ── RNG yang bisa diulang ────────────────────────────────────────
// Seed dipakai supaya rekaman yang gagal bisa diulang dengan soal identik.

export function makeRng(seed) {
  if (seed == null) return Math.random;
  let s = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── penyusun sesi ────────────────────────────────────────────────

/**
 * Bangun satu sesi soal.
 *
 * @param {object} opt
 * @param {string}   opt.archetype  'runner' | 'memory' | 'count' | 'sort' | 'path'
 * @param {number}   opt.count      jumlah soal
 * @param {number}   opt.level      1 = TK, 2 = TK lanjut, 3 = SD awal
 * @param {string}   opt.locale     'id' | 'en'
 * @param {string[]} opt.recipeIds  batasi ke resep tertentu (opsional)
 * @param {number|string} opt.seed  supaya soal bisa diulang
 * @returns {{questions: object[], seed: number|string}}
 */
export function buildSession(opt) {
  const {
    archetype,
    count = 5,
    level = 1,
    locale = "id",
    recipeIds = null,
    seed = null,
  } = opt;

  const rng = makeRng(seed);

  let recipes = recipesForArchetype(archetype);
  if (recipeIds && recipeIds.length) {
    recipes = recipes.filter((r) => recipeIds.includes(r.id));
  }

  if (!recipes.length) {
    return { questions: [], seed, error: `tidak ada resep untuk arketipe "${archetype}"` };
  }

  const ctx = { level, locale };
  const questions = [];
  const usedAnswers = new Set();
  let guard = 0;

  while (questions.length < count && guard < count * 40) {
    guard++;

    const recipe = recipes[Math.floor(rng() * recipes.length)];
    const q = recipe.build(rng, ctx);
    if (!q) continue;

    // Jangan ulang jawaban yang sama dua kali dalam satu sesi —
    // anak 4 tahun cepat bosan kalau soalnya berasa sama.
    const sig = `${q.kind}:${q.answerId}`;
    if (usedAnswers.has(sig)) continue;
    usedAnswers.add(sig);

    q.index = questions.length;
    questions.push(q);
  }

  return { questions, seed };
}

/**
 * Periksa jawaban.
 * Mengembalikan objek, bukan boolean, supaya arketipe bisa memilih
 * animasi/ suara berbeda untuk benar dan salah.
 */
export function checkAnswer(question, itemId) {
  const correct = question.answerId === itemId;
  return {
    correct,
    answerId: question.answerId,
    chosenId: itemId,
  };
}
