// UJI OTOMATIS LEWAT CHROME DEVTOOLS PROTOCOL
//
// Menjalankan game sungguhan di Chrome headless, menekan tombol seperti anak
// 4 tahun, dan menyimpan tangkapan layar tiap tahap. Tidak menyentuh layar
// user sama sekali.
//
//   node tools/cdp_test.mjs
//
// Hasil: _test/*.png  +  ringkasan di stdout.
// Keluar dengan kode 1 kalau ada yang gagal.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
// Ukuran jendela bisa diganti: WIN=1280,720 node tools/cdp_test.mjs
const WIN = process.env.WIN || "1600,900";
const TAG = WIN === "1600,900" ? "" : WIN.replace(",", "x");
const OUT = join(ROOT, "_test", TAG);
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9223;
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

// ── jalankan chrome ──────────────────────────────────────────────

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

// ── sambung ke target ────────────────────────────────────────────

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
const logs = [];

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
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    logs.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
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

// ── mulai ────────────────────────────────────────────────────────

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable").catch(() => {});

console.log("memuat game...");
await sleep(1500);

// ── tahap 1: layar tekan-untuk-mulai ─────────────────────────────
await screenshot("tekan-mulai");
cek("layar tekan-untuk-mulai muncul", await evaluate(`!!document.querySelector('.tap-start')`));

await evaluate(`document.querySelector('.tap-start').click()`);
await sleep(700);

// ── tahap 2: portal ──────────────────────────────────────────────
await screenshot("portal");
const jumlahGame = await evaluate(`document.querySelectorAll('.game-card').length`);
cek("portal menampilkan kartu game", jumlahGame >= 1, `${jumlahGame} kartu`);

// ── tahap 3: pengaturan & volume ─────────────────────────────────
// Gerbang orang tua: tahan 3 detik.
await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')]
    .find(x => x.textContent.trim().startsWith('⚙'));
  if (!b) return false;
  b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  return true;
})()`);
await sleep(3400);
await screenshot("pengaturan");

const setelan = await evaluate(`(() => {
  const sheet = document.querySelector('.sheet');
  const s = document.querySelector('.slider');
  if (!sheet || !s) return { ada: false };
  const awal = s.value;
  s.value = '35';
  s.dispatchEvent(new Event('input', { bubbles: true }));
  let tersimpan = null;
  try {
    tersimpan = JSON.parse(localStorage.getItem('hariri_hsn_v1') || '{}')?.settings?.volume;
  } catch {}
  return {
    ada: true,
    awal,
    pct: document.querySelector('.pct')?.textContent,
    tersimpan,
    adaToggle: document.querySelectorAll('.toggle').length,
  };
})()`);

cek("pengaturan terbuka (gerbang 3 detik)", setelan.ada === true);
if (setelan.ada) {
  cek("slider volume ada", setelan.awal === "80", `awal ${setelan.awal}%`);
  cek("persen ikut berubah", setelan.pct === "35%", setelan.pct);
  cek("volume tersimpan ke localStorage", setelan.tersimpan === 35, String(setelan.tersimpan));
  cek("tiga tombol suara ada", setelan.adaToggle === 3);
}

// kembalikan ke 80% lalu tutup
await evaluate(`(() => {
  const s = document.querySelector('.slider');
  if (s) { s.value = '80'; s.dispatchEvent(new Event('input', { bubbles: true })); }
  const tutup = [...document.querySelectorAll('.sheet .btn')]
    .find(b => /Tutup|Close/i.test(b.textContent));
  if (tutup) tutup.click();
})()`);
await sleep(400);

// ── tahap 4: pilih karakter ──────────────────────────────────────
await evaluate(`document.querySelector('.game-card').click()`);
await sleep(900);
await screenshot("pilih-karakter");
cek("pemilih karakter muncul", await evaluate(`!!document.querySelector('.char-card')`));

// ── tahap 5: soal pertama ────────────────────────────────────────
// Alur sekarang: ronde LARI dulu, baru soal. Jadi kita harus menunggu
// rintangan selesai dilewati sebelum kartu jawaban muncul.
await evaluate(`document.querySelector('.char-card').click()`);

let kartuSiap = false;
for (let i = 0; i < 240; i++) {
  kartuSiap = await evaluate(`document.querySelectorAll('.answers .option-card').length > 0`);
  if (kartuSiap) break;
  // tap berkala supaya ronde lari cepat selesai walau tidak ada yang melompat
  await evaluate(`document.querySelector('.runner')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
  await sleep(120);
}
cek("ronde lari selesai lalu soal muncul", kartuSiap);

await sleep(1200);
await screenshot("soal-1");

const info = await evaluate(`(() => {
  const banner = document.querySelector('.banner .teks');
  const opts = [...document.querySelectorAll('.answers .option-card')];
  const overflow = opts.map(card => {
    const inner = card.firstElementChild;
    if (!inner) return 0;
    return Math.max(inner.scrollWidth - inner.clientWidth, inner.scrollHeight - inner.clientHeight);
  });
  return {
    soal: banner ? banner.textContent : null,
    jumlahPilihan: opts.length,
    tinggiKartu: opts[0] ? Math.round(opts[0].getBoundingClientRect().height) : 0,
    adaKarakter: !!document.querySelector('.runner-char img, .runner-char .placeholder'),
    luberIsi: overflow,
    tinggiUlang: Math.round(document.querySelector('.banner .btn-round')?.getBoundingClientRect().height || 0),
    adaGambarAsli: [...document.querySelectorAll('.answers img')].every(i => i.naturalWidth > 0),
  };
})()`);

console.log("  soal pertama:", JSON.stringify(info));
cek("soal tampil dengan 3 pilihan", info.jumlahPilihan === 3);
cek("kartu jawaban besar (>=200px)", info.tinggiKartu >= 200, `${info.tinggiKartu}px`);
cek("tombol ulang besar (>=64px)", info.tinggiUlang >= 64, `${info.tinggiUlang}px`);
cek("isi kartu tidak meluber", info.luberIsi.every((v) => v === 0));
cek("karakter unicorn tampil", info.adaKarakter);
cek("gambar hewan asli termuat", info.adaGambarAsli);

// ── tahap 6: ukur jeda antar soal ────────────────────────────────
// Pengamat mencatat kapan jawaban benar muncul dan kapan soal berganti.
await evaluate(`(() => {
  window.__jeda = { mulai: 0, selesai: 0, kartuSalah: 0 };
  const ans = document.querySelector('.answers');
  new MutationObserver(() => {
    const ada = ans.querySelector('.option-card.correct');
    if (ada && !window.__jeda.mulai) window.__jeda.mulai = performance.now();
    if (!ada && window.__jeda.mulai && !window.__jeda.selesai) {
      window.__jeda.selesai = performance.now();
    }
  }).observe(ans, { subtree: true, attributes: true, childList: true });
  return true;
})()`);

async function jawabSatuSoal(nomor, simpanSalah) {
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
    const benar = await evaluate(
      `!!document.querySelector('.answers .option-card.correct')`
    );

    if (benar) {
      if (simpanSalah) await screenshot(`soal-${nomor}-benar`);
      return true;
    }

    if (simpanSalah) await screenshot(`soal-${nomor}-salah`);
    await sleep(700);
  }
  return false;
}

cek("jawaban benar ditemukan di soal 1", await jawabSatuSoal(1, true));

// kartu salah harus tetap memudar setelah animasi selesai
const kartuSalah = await evaluate(`(() => {
  const dim = [...document.querySelectorAll('.answers .option-card.dim')];
  return { jumlah: dim.length, pointerEvents: dim[0] ? getComputedStyle(dim[0]).pointerEvents : null };
})()`);
cek("kartu salah tetap memudar", kartuSalah.jumlah >= 1, `${kartuSalah.jumlah} kartu`);
cek("kartu memudar tidak bisa ditap", kartuSalah.pointerEvents === "none");

await sleep(2600);
await screenshot("soal-2");

const jeda = await evaluate(`window.__jeda`);
if (jeda && jeda.selesai) {
  const ms = Math.round(jeda.selesai - jeda.mulai);
  console.log(`  jeda antar soal: ${ms} ms`);
  cek("jeda antar soal wajar (1200-3200ms)", ms >= 1200 && ms <= 3200, `${ms}ms`);
} else {
  cek("jeda antar soal terukur", false, "pengamat tidak mencatat");
}

// ── tahap 7: tombol ulang suara ──────────────────────────────────
const ulang = await evaluate(`(() => {
  const b = document.querySelector('.banner .btn-round');
  if (!b) return { ada: false };
  const sebelum = b.classList.contains('pulse');
  b.click();
  return { ada: true, pulseSebelum: sebelum, pulseSesudah: b.classList.contains('pulse') };
})()`);
cek("tombol ulang suara ada", ulang.ada === true);
cek("denyut isyarat hilang setelah ditap", ulang.ada && ulang.pulseSesudah === false);
await sleep(400);

// ── tahap 7b: suara hewan harus rekaman asli, bukan TTS ─────────
// Ini inti koreksi: dulu soal "tebak suara" memutar onomatope TTS.
// Sekarang harus memuat berkas MP3 rekaman asli dan benar-benar berbunyi.
const hewanUji = await evaluate(`(async () => {
  const audio = await import('./core/audio.js');
  audio.unlock();
  audio.preloadAnimal('kucing');
  const t0 = performance.now();
  await audio.playAnimal('kucing');
  const ms = performance.now() - t0;

  const res = performance.getEntriesByType('resource')
    .filter(e => e.name.includes('assets/audio/sfx/'))
    .map(e => e.name.split('/').pop());

  // pastikan tidak ada lagi permintaan ke kunci onomatope lama
  const lama = performance.getEntriesByType('resource')
    .filter(e => /suara_(kucing|anjing|sapi|ayam|singa|katak|gajah|bebek)\\.mp3/.test(e.name));

  return { ms: Math.round(ms), berkas: res, adaLama: lama.length };
})()`);
cek("rekaman hewan termuat dari assets/audio/sfx", hewanUji.berkas.length >= 1, hewanUji.berkas.join(", "));
cek("rekaman hewan benar-benar berbunyi (>=1.5s)", hewanUji.ms >= 1500, `${hewanUji.ms}ms`);
cek("tidak ada lagi MP3 onomatope TTS", hewanUji.adaLama === 0, `${hewanUji.adaLama} permintaan lama`);
await sleep(300);

// ── tahap 8: selesaikan SEMUA ronde sampai layar selesai ─────────
// Alur 6 ronde: lari, soal, lari, soal, lari, soal. Jadi kita tidak bisa
// hanya menjawab soal berurutan — di antara blok soal ada ronde lari.
let soalDijawab = 1;
let sampaiSelesai = false;

for (let putaran = 0; putaran < 900; putaran++) {
  const keadaan = await evaluate(`(() => ({
    selesai: !!document.querySelector('.finish'),
    kartu: document.querySelectorAll('.answers .option-card').length,
  }))()`);

  if (keadaan.selesai) { sampaiSelesai = true; break; }

  if (keadaan.kartu > 0) {
    const ok = await jawabSatuSoal(soalDijawab + 1, false);
    if (ok) soalDijawab++;
    await sleep(2400);
  } else {
    // ronde lari — tap terus supaya cepat lewat
    await evaluate(`document.querySelector('.runner')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
    await sleep(160);
  }
}

cek("semua soal bisa dijawab sampai selesai", sampaiSelesai, `${soalDijawab} soal dijawab`);

await sleep(900);
await screenshot("selesai");

const akhir = await evaluate(`(() => {
  const f = document.querySelector('.finish');
  return {
    layarSelesai: !!f,
    judul: f ? f.querySelector('.judul')?.textContent : null,
    bintang: f ? f.querySelector('.bintang-besar')?.textContent : null,
    tombol: f ? [...f.querySelectorAll('.aksi .btn')].map(b => b.textContent) : [],
    kastilAsli: !!f?.querySelector('img.kastil'),
  };
})()`);
console.log("  akhir:", JSON.stringify(akhir));
cek("layar selesai muncul", akhir.layarSelesai);
cek("kastil asli tampil", akhir.kastilAsli);
cek("dua tombol di layar selesai", akhir.tombol.length === 2);

// ── tahap 9: main lagi ───────────────────────────────────────────
// Sesi baru harus benar-benar bersih: soal 1, tiga kartu, tidak ada
// kartu yang masih memudar dari sesi sebelumnya.
await evaluate(`(() => {
  const f = document.querySelector('.finish');
  const b = [...f.querySelectorAll('.aksi .btn')]
    .find(x => /Main Lagi|Play Again/i.test(x.textContent));
  if (b) b.click();
  return !!b;
})()`);

// sesi baru dimulai dengan ronde lari — periksa progres sudah balik ke ronde 1
await sleep(600);
const awalBaru = await evaluate(`(() => {
  const ds = [...document.querySelectorAll('.dot')];
  return {
    rondeAktif: ds.findIndex(d => d.classList.contains('on')) + 1,
    done: ds.filter(d => d.classList.contains('done')).length,
  };
})()`);
cek("sesi baru mulai dari ronde 1", awalBaru.rondeAktif === 1, `ronde ${awalBaru.rondeAktif}`);
cek("tidak ada ronde lama tertinggal 'selesai'", awalBaru.done === 0, `${awalBaru.done} titik done`);

// lalu tunggu sampai soal pertama muncul
let kartuBaru = false;
for (let i = 0; i < 240; i++) {
  kartuBaru = await evaluate(`document.querySelectorAll('.answers .option-card').length > 0`);
  if (kartuBaru) break;
  await evaluate(`document.querySelector('.runner')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
  await sleep(120);
}
await sleep(700);
await screenshot("main-lagi");

const lagi = await evaluate(`(() => {
  const ds = [...document.querySelectorAll('.dot')];
  return {
    kartu: document.querySelectorAll('.answers .option-card').length,
    progres: ds.filter(d => d.classList.contains('on')).length,
    // indeks 1-based titik yang aktif; ronde 1 = lari, jadi soal pertama = ronde 2
    rondeAktif: ds.findIndex(d => d.classList.contains('on')) + 1,
    totalRonde: ds.length,
    dim: document.querySelectorAll('.answers .option-card.dim').length,
    benar: document.querySelectorAll('.answers .option-card.correct').length,
  };
})()`);
console.log("  main lagi:", JSON.stringify(lagi));
cek("Main Lagi memulai sesi baru", lagi.kartu === 3);
cek("tepat satu titik progres aktif", lagi.progres === 1, `${lagi.progres} aktif`);
cek("progres punya 6 titik (6 ronde)", lagi.totalRonde === 6, `${lagi.totalRonde} titik`);
cek("tidak ada kartu memudar di sesi baru", lagi.dim === 0 && lagi.benar === 0);

// ── laporan ──────────────────────────────────────────────────────

console.log("");
if (errors.length) {
  console.log("ERROR JS (" + errors.length + "):");
  for (const e of errors) console.log("  " + e.split("\n")[0]);
} else {
  console.log("ERROR JS: tidak ada");
}
if (logs.length) {
  console.log("console.error (" + logs.length + "):");
  for (const l of logs) console.log("  " + l);
}

const asetGagal = await evaluate(`(() => {
  return [...document.querySelectorAll('img')]
    .filter(i => i.complete && i.naturalWidth === 0)
    .map(i => i.getAttribute('src'));
})()`);
console.log("aset gambar gagal:", asetGagal.length ? asetGagal : "tidak ada");
cek("tidak ada gambar gagal", asetGagal.length === 0);
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
