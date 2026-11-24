// Tangkapan layar cepat untuk memeriksa visual rintangan.
//   node tools/_shot_lompat.mjs
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "_test", "visual");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9225;
const PROFILE = join(OUT, "profile");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  "--window-size=1600,900",
  "--hide-scrollbars",
  "--autoplay-policy=no-user-gesture-required",
  "--no-first-run",
  "--mute-audio",
  "http://127.0.0.1:8899/?seed=demo",
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
let n = 0;
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const f = join(OUT, `${String(++n).padStart(2, "0")}-${name}.png`);
  writeFileSync(f, Buffer.from(r.data, "base64"));
  console.log("  " + f);
}

await send("Page.enable");
await send("Runtime.enable");
await sleep(1600);
await evaluate(`document.querySelector('.tap-start')?.click()`);
await sleep(700);
await evaluate(`document.querySelector('.game-card')?.click()`);
await sleep(900);
await evaluate(`document.querySelector('.char-card')?.click()`);

// tunggu sampai ada rintangan TEPAT di depan unicorn, lalu lompat,
// lalu tangkap BEBERAPA frame sepanjang lompatan — supaya busur lompatan
// terlihat dan kita bisa pastikan unicorn benar-benar melewati rintangan.
for (let i = 0; i < 300; i++) {
  const ok = await evaluate(`(() => {
    const s = document.querySelector('.runner');
    if (!s) return false;
    const o = document.querySelector('.obstacles .obstacle');
    if (!o) return false;
    const x = o.getBoundingClientRect().left - s.getBoundingClientRect().left;
    return x > 330 && x < 400;
  })()`);
  if (ok) break;
  await sleep(40);
}
await evaluate(`document.querySelector('.runner').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
for (let i = 0; i < 5; i++) {
  await sleep(150);
  await shot(`lompat-${i + 1}`);
}

// tunggu rintangan berikutnya lalu tangkap lagi (jenis lain)
await sleep(1800);
for (let i = 0; i < 200; i++) {
  const ok = await evaluate(`(() => {
    const s = document.querySelector('.runner');
    const o = document.querySelector('.obstacles .obstacle');
    if (!o) return false;
    const x = o.getBoundingClientRect().left - s.getBoundingClientRect().left;
    return x > 500 && x < 900;
  })()`);
  if (ok) break;
  await sleep(80);
}
await shot("rintangan-kedua");

// biarkan menabrak supaya animasi pecah terlihat
await sleep(1400);
await shot("tabrakan-pecah");

ws.close();
chrome.kill();
process.exit(0);
