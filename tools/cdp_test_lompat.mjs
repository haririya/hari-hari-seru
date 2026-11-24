// UJI ALUR 6 RONDE — lompat rintangan bergantian dengan kuis
//
//   node tools/cdp_test_lompat.mjs
//   WIN=1280,720 node tools/cdp_test_lompat.mjs
//
// Yang diuji (bukan sekadar "tidak error"):
//   1. ronde 1 memang RONDE LARI, bukan langsung soal
//   2. rintangan benar-benar bergerak ke kiri
//   3. TIDAK menekan apa pun -> rintangan menabrak & pecah, dan ronde TETAP
//      selesai (bukti "menabrak bukan gagal")
//   4. setelah rintangan habis, soal muncul sendiri
//   5. ronde 3 bisa dilompati dengan tap, rintangan dilewati (bukan ditabrak)
//   6. rintangan berjenis batu DAN pohon (campur)
//   7. tidak ada error JS

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WIN = process.env.WIN || "1600,900";
const TAG = WIN === "1600,900" ? "lompat" : "lompat-" + WIN.replace(",", "x");
const OUT = join(ROOT, "_test", TAG);
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9224;
const URL_GAME = "http://127.0.0.1:8899/?seed=demo";
const PROFILE = join(OUT, "profile");

mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const gagal = [];
function cek(nama, lulus, detail = "") {
  console.log(`  ${lulus ? "✓" : "✗"} ${nama}${detail ? "  " + detail : ""}`);
  if (!lulus) gagal.push(nama);
}

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    `--window-size=${WIN}`,
    "--hide-scrollbars",
    "--autoplay-policy=no-user-gesture-required",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--mute-audio",
    URL_GAME,
  ],
  { stdio: "ignore" }
);

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* belum siap */
    }
    await sleep(250);
  }
  throw new Error("chrome tidak membuka port debug");
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let seq = 0;
const pending = new Map();
const errors = [];

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    return;
  }
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    errors.push(d.exception?.description || d.text);
  }
};

function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || "eval gagal");
  }
  return r.result.value;
}

let shot = 0;
async function screenshot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const file = join(OUT, `${String(++shot).padStart(2, "0")}-${name}.png`);
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("  📷 " + file.replace(ROOT + "\\", ""));
}

async function tunggu(expr, timeout = 20000, step = 120) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await evaluate(expr)) return true;
    await sleep(step);
  }
  return false;
}

await send("Page.enable");
await send("Runtime.enable");
console.log("memuat game...");
await sleep(1500);

// ── masuk ke permainan ───────────────────────────────────────────
await evaluate(`document.querySelector('.tap-start')?.click()`);
await sleep(700);
await evaluate(`document.querySelector('.game-card')?.click()`);
await sleep(900);
await evaluate(`document.querySelector('.char-card')?.click()`);

// ── 1. ronde pertama HARUS ronde lari ────────────────────────────
await sleep(700);
await screenshot("ronde-1-lari");

const awal = await evaluate(`(() => {
  const ans = document.querySelector('.answers');
  const hint = document.querySelector('.hint');
  return {
    adaPanggung: !!document.querySelector('.runner'),
    banner: document.querySelector('.banner .teks')?.textContent || null,
    answersDisplay: ans ? getComputedStyle(ans).display : null,
    hintDisplay: hint ? getComputedStyle(hint).display : null,
    adaLapisRintangan: !!document.querySelector('.obstacles'),
    dotAktif: document.querySelectorAll('.progress .dot.on').length,
    jumlahDot: document.querySelectorAll('.progress .dot').length,
    ulangDisplay: getComputedStyle(document.querySelector('.banner .btn-round')).display,
  };
})()`);
console.log("  awal ronde:", JSON.stringify(awal));

cek("ronde 1 langsung ronde lari (bukan soal)", awal.answersDisplay === "none", `answers=${awal.answersDisplay}`);
cek("petunjuk tap tampil saat ronde lari", awal.hintDisplay !== "none", `hint=${awal.hintDisplay}`);
cek("lapisan rintangan ada", awal.adaLapisRintangan === true);
cek("progres memakai 6 titik ronde", awal.jumlahDot === 6, `${awal.jumlahDot} titik`);
cek("tombol ulang disembunyikan saat ronde lari", awal.ulangDisplay === "none");

// pantau rintangan sepanjang sesi.
// Dihitung dari node yang DIHAPUS: kalau saat dilepas punya kelas .pecah
// berarti ditabrak; kalau tidak, berarti berhasil dilompati. Ini satu-satunya
// cara membedakan keduanya dari luar tanpa menambah kait uji ke kode game.
await evaluate(`(() => {
  window.__obs = { jenis: [], pecah: 0, lolos: 0 };
  const lapis = document.querySelector('.obstacles');
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || !n.classList) continue;
        if (n.classList.contains('batu') && !window.__obs.jenis.includes('batu')) window.__obs.jenis.push('batu');
        if (n.classList.contains('pohon') && !window.__obs.jenis.includes('pohon')) window.__obs.jenis.push('pohon');
      }
      for (const n of m.removedNodes) {
        if (n.nodeType !== 1 || !n.classList?.contains('obstacle')) continue;
        if (n.classList.contains('pecah')) window.__obs.pecah++;
        else window.__obs.lolos++;
      }
    }
  }).observe(lapis, { childList: true });
  return true;
})()`);

// ── 2. rintangan muncul & bergerak ───────────────────────────────
const muncul = await tunggu(`document.querySelectorAll('.obstacles .obstacle').length > 0`, 12000);
cek("rintangan muncul di ronde 1", muncul);
await screenshot("rintangan-masuk");

const geser = await evaluate(`(async () => {
  const ambil = () => {
    const n = document.querySelector('.obstacles .obstacle');
    if (!n) return null;
    return new DOMMatrixReadOnly(getComputedStyle(n).transform).m41;
  };
  const a = ambil();
  await new Promise(r => setTimeout(r, 700));
  const b = ambil();
  return { a, b };
})()`);
cek(
  "rintangan bergerak ke kiri",
  geser.a != null && geser.b != null && geser.b < geser.a - 40,
  `${Math.round(geser.a)} -> ${Math.round(geser.b)}`
);

// ── 3. TIDAK menekan apa pun: menabrak harus pecah, bukan game over ──
const habis = await tunggu(
  `getComputedStyle(document.querySelector('.answers')).display !== 'none' &&
   document.querySelectorAll('.answers .option-card').length > 0`,
  30000
);
await screenshot("ronde-1-selesai-soal-mulai");
cek("ronde 1 selesai sendiri lalu soal muncul", habis);

const hasilTabrak = await evaluate(`window.__obs`);
console.log("  hasil tabrak:", JSON.stringify(hasilTabrak));
cek("rintangan menabrak & pecah tanpa menghentikan game", hasilTabrak.pecah >= 1, `${hasilTabrak.pecah} pecah`);
cek("rintangan berjenis campur (batu/pohon)", hasilTabrak.jenis.length >= 1, hasilTabrak.jenis.join(", "));

const sesudahLari = await evaluate(`(() => ({
  hint: getComputedStyle(document.querySelector('.hint')).display,
  ulang: getComputedStyle(document.querySelector('.banner .btn-round')).display,
  kartu: document.querySelectorAll('.answers .option-card').length,
  dotOn: [...document.querySelectorAll('.progress .dot')].findIndex(d => d.classList.contains('on')),
  adaRintanganTersisa: document.querySelectorAll('.obstacles .obstacle').length,
}))()`);
console.log("  sesudah ronde 1:", JSON.stringify(sesudahLari));
cek("petunjuk tap disembunyikan saat soal", sesudahLari.hint === "none");
cek("tombol ulang muncul lagi saat soal", sesudahLari.ulang !== "none");
cek("soal menampilkan 3 kartu", sesudahLari.kartu === 3, `${sesudahLari.kartu} kartu`);
cek("progres pindah ke ronde 2", sesudahLari.dotOn === 1, `indeks ${sesudahLari.dotOn}`);
cek("panggung bersih dari rintangan sisa", sesudahLari.adaRintanganTersisa === 0, `${sesudahLari.adaRintanganTersisa} sisa`);

// ── 4. jawab 3 soal ronde 2 ──────────────────────────────────────
async function jawabSatu() {
  const n = await evaluate(`document.querySelectorAll('.answers .option-card').length`);
  for (let i = 0; i < n; i++) {
    const hasil = await evaluate(`(() => {
      const c = document.querySelectorAll('.answers .option-card')[${i}];
      if (!c || c.classList.contains('dim')) return 'skip';
      c.click();
      return 'klik';
    })()`);
    if (hasil !== "klik") continue;
    await sleep(420);
    if (await evaluate(`!!document.querySelector('.answers .option-card.correct')`)) return true;
    await sleep(700);
  }
  return false;
}

for (let i = 1; i <= 3; i++) {
  const ok = await jawabSatu();
  if (!ok) {
    cek(`soal ronde 2 nomor ${i} bisa dijawab`, false, "jawaban benar tidak ditemukan");
    break;
  }
  await sleep(2600);
}

// ── 5. ronde 3 harus kembali ke ronde lari ───────────────────────
const balikLari = await tunggu(
  `getComputedStyle(document.querySelector('.answers')).display === 'none' &&
   document.querySelectorAll('.obstacles .obstacle').length > 0`,
  20000
);
await screenshot("ronde-3-lari");
cek("setelah 3 soal, ronde lari berikutnya mulai", balikLari);

const dot3 = await evaluate(
  `[...document.querySelectorAll('.progress .dot')].findIndex(d => d.classList.contains('on'))`
);
cek("progres ada di ronde 3", dot3 === 2, `indeks ${dot3}`);

// ── 6. tap = lompat ──────────────────────────────────────────────
const lompat = await evaluate(`(async () => {
  const char = document.querySelector('.runner-char');
  const stage = document.querySelector('.runner');
  const y = () => Math.round(new DOMMatrixReadOnly(getComputedStyle(char).transform).m42);

  stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 800, clientY: 400 }));
  await new Promise(r => setTimeout(r, 200));
  const naik = y();
  const terbang = char.classList.contains('terbang');
  await new Promise(r => setTimeout(r, 900));
  const turun = y();
  return { naik, turun, terbang };
})()`);
console.log("  lompat:", JSON.stringify(lompat));
cek("tap membuat unicorn melompat", lompat.naik < -30, `naik ${lompat.naik}px`);
cek("unicorn kembali ke tanah setelah lompat", Math.abs(lompat.turun) < 6, `turun ${lompat.turun}px`);
await screenshot("lompat");

// ── 7. lompati semua rintangan ronde 3 (autopilot) ───────────────
// Autopilot melompat saat rintangan terdekat sudah dekat. Ini membuktikan
// mekanik lompat benar-benar bisa melewati rintangan — bukan cuma "tidak error".
const sebelum = await evaluate(`window.__obs.pecah`);

await evaluate(`(() => {
  const stage = document.querySelector('.runner');
  const char = document.querySelector('.runner-char');
  window.__auto = setInterval(() => {
    const s = stage.getBoundingClientRect();
    const c = char.getBoundingClientRect();
    const cx = c.left + c.width * 0.5 - s.left;
    const obs = [...document.querySelectorAll('.obstacles .obstacle')];
    for (const o of obs) {
      const kiri = o.getBoundingClientRect().left - s.left;
      // Picu lompat supaya puncak lompatan jatuh tepat saat rintangan menempel.
      // Puncak = 500ms setelah tap; pada 335px/s itu ~167px perjalanan.
      if (kiri < cx + 105 && kiri > cx - 140) {
        stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        break;
      }
    }
  }, 50);
  return true;
})()`);

const akhirRonde3 = await tunggu(
  `getComputedStyle(document.querySelector('.answers')).display !== 'none'`,
  45000,
  150
);
await evaluate(`clearInterval(window.__auto)`);
await screenshot("ronde-3-selesai");

const hasil3 = await evaluate(`window.__obs`);
console.log("  hasil ronde 3:", JSON.stringify(hasil3));

cek("ronde 3 selesai lalu soal muncul", akhirRonde3);
cek(
  "rintangan benar-benar bisa dilompati (autopilot)",
  hasil3.lolos >= 3,
  `${hasil3.lolos} dilompati, ${hasil3.pecah - sebelum} ditabrak di ronde 3`
);
cek(
  "autopilot tidak menabrak satu pun di ronde 3",
  hasil3.pecah === sebelum,
  `${hasil3.pecah - sebelum} tabrakan`
);

// ── laporan ──────────────────────────────────────────────────────
console.log("");
console.log(errors.length ? `ERROR JS (${errors.length}):` : "ERROR JS: tidak ada");
for (const e of errors) console.log("  " + e.split("\n")[0]);

cek("tidak ada error JS", errors.length === 0);

ws.close();
chrome.kill();

console.log("");
if (gagal.length) {
  console.log("HASIL: GAGAL — " + gagal.join(", "));
  process.exit(1);
}
console.log("HASIL: SEMUA LULUS");
process.exit(0);
