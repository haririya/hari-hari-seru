// PENYIMPANAN STATUS
// Semua yang perlu diingat antar sesi: bahasa, pengaturan, bintang.
// localStorage bisa diblokir (mode privat / file://), jadi semua akses dibungkus try.

const KEY = "hariri_hsn_v1";

const DEFAULTS = {
  locale: "id",
  settings: {
    voice: true,
    music: true,
    sfx: true,
    volume: 80,   // 0..100 — satu angka untuk semua suara
  },
  stars: {},   // { "petualangan-unicorn": 12 }
  plays: {},   // { "petualangan-unicorn": 5 }
};

let cache = null;
const listeners = new Set();

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function load() {
  if (cache) return cache;
  let stored = null;
  try {
    stored = safeParse(localStorage.getItem(KEY));
  } catch {
    stored = null;
  }
  cache = {
    ...DEFAULTS,
    ...(stored || {}),
    settings: { ...DEFAULTS.settings, ...(stored?.settings || {}) },
    stars: { ...(stored?.stars || {}) },
    plays: { ...(stored?.plays || {}) },
  };
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // penyimpanan tidak tersedia — game tetap jalan, hanya progres tidak tersimpan
  }
  for (const fn of listeners) {
    try {
      fn(cache);
    } catch {
      /* listener rusak tidak boleh mematikan game */
    }
  }
}

// ── API ──────────────────────────────────────────────────────────

export function getState() {
  return load();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLocale() {
  return load().locale;
}

export function setLocale(locale) {
  if (!["id", "en"].includes(locale)) return;
  load().locale = locale;
  persist();
}

export function getSettings() {
  return load().settings;
}

export function setSetting(name, value) {
  if (!(name in DEFAULTS.settings)) return;
  // volume berupa angka 0..100; sisanya tombol hidup/mati
  if (name === "volume") {
    const n = Math.max(0, Math.min(100, Math.round(Number(value))));
    if (!Number.isFinite(n)) return;
    load().settings.volume = n;
  } else {
    load().settings[name] = !!value;
  }
  persist();
}

export function starsOf(gameId) {
  return load().stars[gameId] || 0;
}

export function addStar(gameId, n = 1) {
  const s = load();
  s.stars[gameId] = (s.stars[gameId] || 0) + n;
  persist();
  return s.stars[gameId];
}

export function addPlay(gameId) {
  const s = load();
  s.plays[gameId] = (s.plays[gameId] || 0) + 1;
  persist();
}

export function totalStars() {
  return Object.values(load().stars).reduce((a, b) => a + b, 0);
}

export function resetProgress() {
  const s = load();
  s.stars = {};
  s.plays = {};
  persist();
}
