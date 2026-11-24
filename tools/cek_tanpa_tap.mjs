// Cek cepat: apakah rintangan muncul walau anak tidak menepuk sama sekali?
//   node tools/_probe_diam2.mjs
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "_test", "probe");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9229;
const PROFILE = join(OUT, "profile3");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  "--window-size=1600,900", "--hide-scrollbars",
  "--autoplay-policy=no-user-gesture-required", "--no-first-run", "--mute-audio",
  "http://127.0.0.1:8899/?seed=diam2",
], { stdio: "ignore" });

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const p = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch {}
    await sleep(250);
  }
  throw new Error("no debug port");
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
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval");
  return r.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await sleep(1600);
await evaluate(`document.querySelector('.tap-start')?.click()`);
await sleep(700);
await evaluate(`document.querySelector('.game-card')?.click()`);
await sleep(1400);
await evaluate(`document.querySelector('.char-card')?.click()`);

// pantau 12 detik tanpa tap sama sekali
const jejak = [];
for (let i = 0; i < 100; i++) {
  const s = await evaluate(`(() => ({
    ada: document.querySelectorAll('.obstacles .obstacle').length,
    pecah: document.querySelectorAll('.obstacles .obstacle.pecah').length,
    bintang: document.querySelectorAll('.pecahan, .bintang').length,
    kartu: document.querySelectorAll('.answers .option-card').length,
    hint: (document.querySelector('.hint')?.textContent || '').slice(0, 30),
  }))()`);
  jejak.push({ detik: +(i * 0.3).toFixed(1), ...s });
  if (s.kartu > 0) break;
  await sleep(300);
}

const maks = Math.max(...jejak.map((j) => j.ada));
const adaKartu = jejak.some((j) => j.kartu > 0);
const adaPecah = jejak.some((j) => j.pecah > 0 || j.bintang > 0);
const akhir = jejak[jejak.length - 1];

console.log("\nrintangan maksimum di layar (tanpa tap):", maks);
console.log("rintangan pernah pecah/berbintang     :", adaPecah ? "ya" : "TIDAK");
console.log("soal muncul                           :", adaKartu ? "ya, pada " + akhir.detik + "s" : "TIDAK (uji berhenti di " + akhir.detik + "s)");
console.log("\njejak (detik: rintangan / kartu):");
for (const j of jejak.filter((x, i) => i % 4 === 0)) {
  console.log("  " + String(j.detik).padStart(5) + "s : " + j.ada + " rintangan, " + j.kartu + " kartu" + (j.hint ? "  hint=" + j.hint : ""));
}

console.log("\nverdict:", maks > 0 && adaKartu
  ? "BAIK — rintangan tetap datang dan ronde selesai tanpa tap"
  : "MASALAH — permainan macet kalau anak tidak menepuk");

ws.close();
chrome.kill();
process.exit(0);
