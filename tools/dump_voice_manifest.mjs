// Buang manifest suara ke JSON supaya generator Python bisa membacanya.
// Dijalankan sekali sebelum gen_voice.py, atau lewat `npm run voice`.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { VOICE_LINES } from "../content/voice-manifest.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs", "voice_lines.json");

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(VOICE_LINES, null, 2), "utf8");

const n = Object.keys(VOICE_LINES).length;
console.log(`manifest ditulis: ${n} kunci -> ${out}`);
