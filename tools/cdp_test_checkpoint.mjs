// Uji CHECKPOINT + JARAK RINTANGAN.
//
//   node tools/cdp_test_checkpoint.mjs
//   WIN=1280,720 node tools/cdp_test_checkpoint.mjs
//
// Yang dibuktikan:
//   1. jarak antar rintangan cukup jauh (tidak menumpuk)
//   2. menabrak batu/pohon memunculkan kartu checkpoint, bukan "gagal"
//   3. saat checkpoint terbuka, rintangan BERHENTI (posisinya tidak bergeser)
//   4. tombol "Lanjut" melanjutkan dari titik yang sama, bukan mengulang ronde
//   5. ronde tetap selesai dan soal muncul setelahnya
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WIN = (process.env.WIN || "1600,900").split(",").map(Number);
const TAG = WIN[0] === 1280 ? "checkpoint-1280x720" : "checkpoint";
const OUT = join(ROOT, "_test", TAG);
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = WIN[0] === 1280 ? 9241 : 9240;
const PROFILE = join(OUT, "profile");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  `--window-size=${WIN[0]},${WIN[1]}`, "--hide-scrollbars",
  "--autoplay-policy=no-user-gesture-required", "--no-first-run", "--mute-audio",
  "http://127.0.0.1:8899/?seed=checkpoint",
], { stdio: "ignore" });

async function findTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const p = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch {}
    await sleep(250);
  }
  throw new Error("port debug tidak terbuka");
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
};
const send = (method, params = {}) => {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }));
};
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval gagal");
  return r.result.value;
};

let lulus = 0;
let gagal = 0;
function cek(nama, ok, info = "") {
  if (ok) { lulus++; console.log("  ✓ " + nama + (info ? "  " + info : "")); }
  else { gagal++; console.log("  ✗ " + nama + (info ? "  " + info : "")); }
}

async function screenshot(nama) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, nama + ".png"), Buffer.from(r.data, "base64"));
  console.log("  📷 " + join(OUT, nama + ".png"));
}

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
const errs = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === "Runtime.exceptionThrown") {
    errs.push(m.params.exceptionDetails.exception?.description || "exception");
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    errs.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  }
});

await sleep(1700);
await evaluate(`document.querySelector('.tap-start')?.click()`);
await sleep(800);
await evaluate(`document.querySelector('.game-card')?.click()`);
await sleep(1500);
await evaluate(`document.querySelector('.char-card')?.click()`);
await sleep(600);

// ── 1. jarak antar rintangan ────────────────────────────────────
// Ukur jarak NYATA di layar antara dua rintangan yang tampil bersamaan.
// (Mengukur posisi spawn menyesatkan: dua rintangan bisa muncul di x yang
// sama tapi jarak di layar tetap benar.)
console.log("\n── jarak antar rintangan ──");
await evaluate(`(() => {
  window.__gap = [];
  const ukur = () => {
    const xs = [...document.querySelectorAll('.obstacles .obstacle')]
      .map(o => Math.round(o.getBoundingClientRect().left));
    for (let k = 1; k < xs.length; k++) {
      const d = xs[k] - xs[k - 1];
      if (d > 0) window.__gap.push(d);
    }
  };
  window.__ukurId = setInterval(ukur, 30);
  return true;
})()`);

// biarkan rintangan berdatangan; anak diam saja -> akan kena & checkpoint
let kartuMuncul = false;
for (let i = 0; i < 300; i++) {
  kartuMuncul = await evaluate(`!!document.querySelector('.checkpoint.tampil')`);
  if (kartuMuncul) break;
  await sleep(100);
}

const gap = await evaluate(`(() => { clearInterval(window.__ukurId); return window.__gap; })()`);
const gapMin = gap.length ? Math.min(...gap) : 0;
const gapMaks = gap.length ? Math.max(...gap) : 0;
console.log("  jarak terkecil :", gapMin, "px");
console.log("  jarak terbesar :", gapMaks, "px");
cek("jarak antar rintangan terukur", gap.length > 0, gap.length + " sampel");
// satu lompatan menempuh kecepatan x LOMPAT_MS = 370px. Jarak harus jauh di atas itu.
cek("jarak antar rintangan >= 700px (lapang)", gap.length > 0 && gapMin >= 700, "terkecil " + gapMin + "px");

// ── 2. checkpoint muncul saat menabrak ─────────────────────────
console.log("\n── checkpoint saat menabrak ──");
cek("kartu checkpoint muncul", kartuMuncul);
await screenshot("01-checkpoint");

const isi = await evaluate(`(() => {
  const c = document.querySelector('.checkpoint');
  if (!c) return null;
  const b = c.querySelector('.btn-lanjut');
  const r = b ? b.getBoundingClientRect() : null;
  return {
    judul: c.querySelector('.judul-kecil')?.textContent || '',
    tombol: b?.textContent.trim() || '',
    lebarTombol: r ? Math.round(r.width) : 0,
    tinggiTombol: r ? Math.round(r.height) : 0,
    adaKataGagal: /gagal|salah|game over|over|kalah/i.test(c.textContent),
  };
})()`);
console.log("  isi kartu:", JSON.stringify(isi));
cek("tidak ada kata 'gagal'/'kalah'", isi && !isi.adaKataGagal);
cek("tombol lanjut target besar (>=96px tinggi)", isi && isi.tinggiTombol >= 96, isi ? isi.tinggiTombol + "px" : "");

// ── 3. saat checkpoint terbuka, rintangan BERHENTI ─────────────
console.log("\n── rintangan beku saat checkpoint ──");
// rintangan yang ditabrak pecah lalu dihapus dari DOM, jadi yang dibandingkan
// hanya rintangan yang masih ada di kedua sampel.
const posA = await evaluate(`[...document.querySelectorAll('.obstacles .obstacle')].map(o => Math.round(o.getBoundingClientRect().left))`);
await sleep(900);
const posB = await evaluate(`[...document.querySelectorAll('.obstacles .obstacle')].map(o => Math.round(o.getBoundingClientRect().left))`);
const sama = posB.every((p) => posA.includes(p));
console.log("  sebelum:", JSON.stringify(posA), " sesudah 0,9s:", JSON.stringify(posB));
cek("rintangan yang tersisa tidak bergeser selama checkpoint", posB.length > 0 && sama);

const kartuSaatBeku = await evaluate(`!!document.querySelector('.checkpoint.tampil')`);
cek("kartu masih terbuka setelah 0,9s (tidak hilang sendiri)", kartuSaatBeku);

// ── 4. tombol Lanjut melanjutkan dari titik yang sama ──────────
console.log("\n── tombol Lanjut ──");
await evaluate(`document.querySelector('.checkpoint .btn-lanjut').click()`);
await sleep(260);
const sesudahKlik = await evaluate(`(() => ({
  kartu: !!document.querySelector('.checkpoint.tampil'),
  posisi: [...document.querySelectorAll('.obstacles .obstacle')].map(o => Math.round(o.getBoundingClientRect().left)),
}))()`);
cek("kartu tertutup setelah Lanjut", !sesudahKlik.kartu);

await sleep(500);
const posC = await evaluate(`[...document.querySelectorAll('.obstacles .obstacle')].map(o => Math.round(o.getBoundingClientRect().left))`);
console.log("  posisi saat lanjut:", JSON.stringify(sesudahKlik.posisi), " 0,5s kemudian:", JSON.stringify(posC));
cek("rintangan bergerak lagi setelah Lanjut", JSON.stringify(posC) !== JSON.stringify(sesudahKlik.posisi));

// lanjut dari TITIK YANG SAMA: rintangan berikutnya tidak kembali ke kanan layar
const mundur = sesudahKlik.posisi.length && posC.length
  ? sesudahKlik.posisi.every((p, i) => posC[i] === undefined || posC[i] <= p + 2)
  : false;
cek("rintangan melanjutkan dari posisinya, bukan diulang dari kanan", mundur);
await screenshot("02-setelah-lanjut");

// ── 5. ronde tetap selesai, soal muncul ────────────────────────
console.log("\n── ronde selesai setelah checkpoint ──");
let kartuSoal = 0;
for (let i = 0; i < 500; i++) {
  kartuSoal = await evaluate(`document.querySelectorAll('.answers .option-card').length`);
  // kalau checkpoint muncul lagi (kena lagi), tekan Lanjut supaya uji jalan terus
  const perlu = await evaluate(`!!document.querySelector('.checkpoint.tampil')`);
  if (perlu) await evaluate(`document.querySelector('.checkpoint .btn-lanjut').click()`);
  if (kartuSoal > 0) break;
  await sleep(150);
}
cek("soal muncul setelah ronde lari selesai", kartuSoal > 0, kartuSoal + " kartu");
await screenshot("03-soal");

// ── 6. tidak ada error JS ──────────────────────────────────────
console.log("");
cek("tidak ada error JS", errs.length === 0, errs.length ? errs[0] : "");

console.log("\n" + (gagal === 0 ? "HASIL: SEMUA LULUS" : "HASIL: " + gagal + " GAGAL, " + lulus + " lulus"));
ws.close();
chrome.kill();
process.exit(gagal === 0 ? 0 : 1);
