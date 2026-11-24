// SUARA
// Tiga lapis, dari yang paling murah ke paling mahal:
//   1. File MP3 hasil gTTS  (assets/audio/voice/{locale}/{kunci}.mp3)
//   2. TTS bawaan browser   (speechSynthesis) — dipakai kalau MP3 belum ada
//   3. Diam                 (tidak pernah melempar error ke game)
//
// Efek suara (benar/salah/tap) dibuat sendiri pakai WebAudio, jadi tidak
// butuh file dan tidak menambah beban aset.

import { voicePath, voiceText } from "../content/voice-manifest.js";
import { getSettings } from "./store.js";

let unlocked = false;
let current = null;          // Audio yang sedang diputar
let pendingResolve = null;   // janji say() yang belum selesai
const cache = new Map();     // path -> Audio
let missing = new Set();     // path yang sudah diketahui 404, jangan dicoba lagi
let audioCtx = null;

// Satu angka volume untuk semua jenis suara (0..1).
function vol() {
  const v = Number(getSettings().volume);
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) / 100 : 0.8;
}

// ── pembukaan kunci audio ────────────────────────────────────────
// Browser memblokir suara sebelum ada interaksi user. Layar "Tekan untuk Mulai"
// memanggil ini, jadi setelah itu semua suara lancar.

export function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

export function isUnlocked() {
  return unlocked;
}

// ── suara hewan asli ─────────────────────────────────────────────
// Rekaman asli dari Wikimedia Commons, sudah dipotong & dinormalkan
// oleh tools/build_animal_sfx.py.
//
// Sengaja TERPISAH dari narasi: narasi memakai kunci bahasa (ID/EN),
// sedangkan suara hewan sama untuk kedua bahasa — kucing di Belanda
// juga "meong". Jadi satu berkas dipakai dua bahasa.

export function animalPath(name) {
  return `assets/audio/sfx/${name}.mp3`;
}

export function playAnimal(name) {
  if (!unlocked || !name) return Promise.resolve();
  if (!getSettings().sfx && !getSettings().voice) return Promise.resolve();

  stopCurrent();   // jangan tumpuk dengan narasi

  const path = animalPath(name);

  return new Promise((resolve) => {
    let audio = cache.get(path);
    if (!audio) {
      audio = new Audio(path);
      cache.set(path, audio);
    }

    const selesai = () => {
      if (pendingResolve === resolve) pendingResolve = null;
      resolve();
    };

    pendingResolve = resolve;
    audio.onended = selesai;
    audio.onerror = () => {
      // rekaman gagal dimuat: jangan hentikan permainan, cukup diam
      missing.add(path);
      cache.delete(path);
      selesai();
    };

    try {
      audio.currentTime = 0;
      audio.volume = vol();
      current = audio;
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          selesai();
        });
      }
    } catch {
      selesai();
    }
  });
}

export function preloadAnimal(names) {
  for (const n of [].concat(names)) {
    const path = animalPath(n);
    if (cache.has(path) || missing.has(path)) continue;
    try {
      const a = new Audio();
      a.preload = "auto";
      a.src = path;
      cache.set(path, a);
    } catch {
      /* diabaikan */
    }
  }
}

// ── narasi ───────────────────────────────────────────────────────

function stopCurrent() {
  if (current) {
    try {
      current.pause();
      current.currentTime = 0;
    } catch {
      /* diabaikan */
    }
    current = null;
  }
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  } catch {
    /* diabaikan */
  }
  // Penting: kalau suara dihentikan di tengah jalan, onended tidak pernah
  // dipanggil. Tanpa ini, `await say(...)` akan menggantung selamanya dan
  // game berhenti di tengah soal.
  if (pendingResolve) {
    const r = pendingResolve;
    pendingResolve = null;
    r();
  }
}

function speakFallback(text, locale, onEnd) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) {
      onEnd?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale === "en" ? "en-GB" : "id-ID";
    u.rate = 0.9;   // lebih lambat: anak 4 tahun butuh waktu mencerna
    u.pitch = 1.15;
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    synth.speak(u);
  } catch {
    onEnd?.();
  }
}

/**
 * Ucapkan satu kunci narasi.
 * @returns {Promise<void>} selesai saat suara habis (atau gagal)
 */
export function say(key, locale = "id", { force = false } = {}) {
  return new Promise((resolve) => {
    if (!key) return resolve();
    const settings = getSettings();
    if (!settings.voice && !force) return resolve();

    stopCurrent();

    const path = voicePath(key, locale);

    // sudah diketahui tidak ada -> langsung fallback, hemat request
    if (missing.has(path)) {
      return speakFallback(voiceText(key, locale), locale, resolve);
    }

    let audio = cache.get(path);
    if (!audio) {
      audio = new Audio(path);
      audio.preload = "auto";
      cache.set(path, audio);
    }

    const done = () => {
      if (pendingResolve === resolve) pendingResolve = null;
      resolve();
    };

    pendingResolve = resolve;

    audio.onended = done;
    audio.onerror = () => {
      missing.add(path);
      cache.delete(path);
      speakFallback(voiceText(key, locale), locale, done);
    };

    // volume bisa berubah kapan saja dari pengaturan
    audio.volume = vol();

    current = audio;
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        missing.add(path);
        cache.delete(path);
        speakFallback(voiceText(key, locale), locale, done);
      });
    }
  });
}

/** Ucapkan teks bebas (bukan kunci manifest). */
export function sayText(text, locale = "id") {
  return new Promise((resolve) => {
    if (!getSettings().voice) return resolve();
    stopCurrent();
    speakFallback(text, locale, resolve);
  });
}

export function stopVoice() {
  stopCurrent();
}

/** Muat file suara lebih awal supaya tidak ada jeda saat soal muncul. */
export function preload(keys, locale) {
  for (const k of keys) {
    const path = voicePath(k, locale);
    if (cache.has(path) || missing.has(path)) continue;
    const a = new Audio(path);
    a.preload = "auto";
    cache.set(path, a);
  }
}

// ── efek suara ───────────────────────────────────────────────────

function tone(freq, dur, type = "sine", gain = 0.15, delay = 0) {
  if (!audioCtx || !getSettings().sfx) return;
  const g0 = gain * vol();
  if (g0 <= 0) return;
  try {
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(g0, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    /* diabaikan */
  }
}

export const sfx = {
  tap() {
    tone(660, 0.08, "triangle", 0.1);
  },
  correct() {
    // naik tiga nada: terasa "berhasil" tanpa terdengar seperti mesin
    tone(523, 0.12, "sine", 0.14, 0);
    tone(659, 0.12, "sine", 0.14, 0.1);
    tone(784, 0.2, "sine", 0.14, 0.2);
  },
  wrong() {
    // turun lembut, TIDAK keras — anak 4 tahun tidak boleh merasa dihukum
    tone(392, 0.14, "sine", 0.1, 0);
    tone(311, 0.22, "sine", 0.1, 0.12);
  },
  star() {
    tone(880, 0.1, "triangle", 0.12, 0);
    tone(1175, 0.14, "triangle", 0.12, 0.08);
    tone(1568, 0.22, "triangle", 0.1, 0.16);
  },
  jump() {
    tone(440, 0.1, "square", 0.06, 0);
    tone(660, 0.12, "square", 0.06, 0.07);
  },
  // Rintangan pecah. Sengaja rendah & lembut — ini BUKAN bunyi gagal.
  // Anak menabrak rintangan tetap lanjut main, jadi nadanya tidak boleh
  // terdengar seperti hukuman.
  puff() {
    tone(240, 0.09, "sine", 0.05, 0);
    tone(170, 0.15, "sine", 0.045, 0.05);
  },
};

// ── musik latar ──────────────────────────────────────────────────
// Belum ada file BGM. Fungsi disiapkan supaya arketipe bisa memanggilnya
// sekarang dan file bisa ditambahkan nanti tanpa mengubah kode.

let bgmEl = null;

export function startBgm(src = "assets/audio/bgm/loop.mp3") {
  if (!getSettings().music) return;
  try {
    if (!bgmEl) {
      bgmEl = new Audio(src);
      bgmEl.loop = true;
    }
    // musik sengaja lebih pelan dari narasi supaya kata-kata tetap jelas
    bgmEl.volume = 0.25 * vol();
    bgmEl.play().catch(() => {
      /* file belum ada -> diam, tidak mengganggu */
    });
  } catch {
    /* diabaikan */
  }
}

export function stopBgm() {
  if (bgmEl) {
    try {
      bgmEl.pause();
    } catch {
      /* diabaikan */
    }
  }
}

export function applySettings() {
  const s = getSettings();
  if (bgmEl) {
    bgmEl.muted = !s.music;
    bgmEl.volume = 0.25 * vol();
  }
  if (current) current.volume = vol();
  if (!s.voice) stopCurrent();
}
