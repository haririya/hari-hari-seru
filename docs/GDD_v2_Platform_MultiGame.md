# GDD v2 — Portal Game Edukasi Anak (Platform Multi-Game)

Status: DRAFT untuk direview
Revisi dari: "Dokumen Rancangan Game - Petualangan Unicorn.pdf" (v1)
Target pemain: TK, usia 4 tahun (fokus utama). SD awal sebagai ekspansi.
Bahasa konten: Indonesia (utama) + Inggris
Konteks produksi: dimainkan lokal, direkam layar + kamera, dipublikasikan sebagai konten Facebook (kategori Game & Komedi)

---

## 0. Ringkasan Perubahan dari v1

v1 merancang **satu game**. v2 merancang **platform** tempat game ke-2 sampai ke-20 bisa ditambah tanpa menyentuh kode game sebelumnya.

| Aspek | v1 | v2 |
|---|---|---|
| Struktur | tiap game punya `game.js` sendiri | ada lapisan `core/` bersama, game hanya menyumbang data + tema |
| Jenis permainan | semua kuis (beda gambar) | 5 arketipe mekanik berbeda, di-reskin jadi banyak game |
| Bank soal | menempel di dalam game | bank konten terpusat, satu soal bisa dipakai banyak game |
| Audio | file mp3 hardcoded per game | manifest suara, mesin TTS bisa diganti tanpa ubah kode |
| Rekam | tidak dipikirkan | dirancang sejak awal (safe area, jeda dramatis, kontrol BGM) |
| Usia | TK & SD dicampur | TK 4 tahun sebagai baseline desain, SD sebagai level lanjutan |

Alasan utama: kalau tiap game berdiri sendiri, game ke-10 akan mewarisi bug game ke-1 dan kamu memperbaiki hal yang sama sepuluh kali. Dengan core bersama, game baru = kerja 1–2 hari, bukan 1 minggu.

---

## 1. Target Pemain: Anak 4 Tahun

Ini baseline yang tidak boleh dilanggar oleh game apa pun di platform ini.

**Kemampuan yang BELUM ada di usia 4:**
- Belum bisa membaca instruksi → semua instruksi WAJIB berupa suara, teks hanya pendukung
- Belum paham konsep "kalah", "nyawa", "waktu habis" → tidak boleh ada game over, timer, atau skor negatif
- Motorik halus belum presisi → target tap minimal 120×120 px, jarak antar tombol minimal 24 px
- Rentang fokus 3–5 menit → satu sesi = 4–6 soal, bukan 10

**Aturan desain wajib (dicek di setiap game baru):**

1. **Nol teks sebagai satu-satunya pembawa pesan.** Setiap instruksi punya audio. Teks besar tetap ada untuk orang tua yang mendampingi.
2. **Maksimal 3 pilihan jawaban** di level TK. 4 pilihan hanya untuk SD.
3. **Tidak ada timer, tidak ada nyawa, tidak ada game over.** Salah = tombol bergetar lembut + redup + suara "Coba lagi yuk!", anak bebas coba sampai benar.
4. **Tombol ulangi suara selalu terlihat** di setiap layar soal.
5. **Setiap aksi dapat respons dalam < 150 ms** (bunyi klik + animasi), supaya anak yakin tap-nya masuk.
6. **Tidak ada iklan, tidak ada tautan keluar, tidak ada pendaftaran akun.** Semua progres di localStorage.
7. **Parent gate**: pengaturan (hapus progres, volume, mode rekam) di balik gerakan tahan-3-detik agar anak tidak masuk sendiri.
8. **Warna pastel terang, kontras teks minimal 4.5:1**, tanpa kedip cepat (hindari pola >3 kedip/detik).

---

## 2. Arsitektur: 4 Lapis

```
┌─────────────────────────────────────────────┐
│  LAPIS 1 — SHELL (portal)                   │
│  Beranda, pilih game, koleksi bintang,      │
│  profil pemain, pengaturan                  │
├─────────────────────────────────────────────┤
│  LAPIS 2 — CORE (mesin bersama)             │
│  quiz · audio · store · ui · scene · fx     │
├─────────────────────────────────────────────┤
│  LAPIS 3 — ARKETIPE (mesin mekanik)         │
│  runner · memory · sort · count · path      │
├─────────────────────────────────────────────┤
│  LAPIS 4 — KONTEN (data, bukan kode)        │
│  items.js · themes/*.css · voice manifest   │
└─────────────────────────────────────────────┘
```

Aturan ketergantungan: lapis atas boleh memanggil lapis bawah, lapis bawah **tidak boleh** tahu apa pun tentang lapis atas. Arketipe tidak boleh memanggil shell. Core tidak boleh tahu ada game bernama "Unicorn".

Konsekuensi praktis: menambah game ke-6 tidak menyentuh `core/` sama sekali. Yang ditulis hanya folder game baru berisi `game.json`, `theme.css`, dan mungkin 0 baris JavaScript.

---

## 3. Lima Arketipe Mekanik

Bukan "kuis dengan gambar berbeda". Lima cara bermain yang benar-benar berbeda, masing-masing satu mesin.

### A. `runner` — Kuis Berjalan (side-scrolling)
Karakter berlari, latar parallax, rintangan muncul, gerak berhenti, panel kuis tampil, jawaban benar = karakter melompati rintangan. Maju sampai garis finis.
Cocok untuk: warna, bentuk, huruf, angka, suara hewan, kosakata.
Contoh game: **Petualangan Unicorn** (game #1), Petualangan Dino, Petualangan Robot.

### B. `memory` — Cari Pasangan
Grid kartu tertutup, anak membuka dua kartu, cari pasangan yang cocok. Pasangan bisa berupa: huruf besar↔huruf kecil, angka↔jumlah titik, gambar↔nama, hewan↔suara.
Cocok untuk: huruf, angka & jumlah, memori visual.
Contoh game: Memori Kebun Binatang, Memori Angka.

### C. `sort` — Kelompokkan (drag & drop)
Objek di tengah, anak menyeret ke dua/tiga keranjang. Kategori: warna, bentuk, besar-kecil, buah vs sayur, hewan darat vs air.
Cocok untuk: klasifikasi, konsep lawan kata.
Contoh game: Pisahkan Buah & Sayur, Sortir Warna.

### D. `count` — Hitung & Tap
Objek muncul di layar (apel, balon, bintang), anak mengetuk untuk menghitung satu per satu (ada bunyi "satu, dua, tiga" per ketukan), lalu memilih angka yang benar.
Cocok untuk: berhitung 1–10, konsep lebih banyak/lebih sedikit.
Contoh game: Kebun Apel, Hitung Balon.

### E. `path` — Pilih Jalur
Labirin/grid sederhana, anak memilih arah untuk membawa karakter ke tujuan. Jalur benar ditentukan oleh jawaban soal (mis. "jalur yang menuju huruf B").
Cocok untuk: pengenalan huruf/angka di lingkungan, logika dasar, arah.
Contoh game: Labirin Huruf, Jalan ke Kandang.

**Mengapa arketipe, bukan tema:** satu mesin `memory` bisa menghasilkan 5 game berbeda hanya dengan mengganti isi kartu dan tema warna. Biaya produksi game ke-2 dan seterusnya turun drastis, tapi penonton tetap melihat permainan yang berbeda.

**Prioritas pembangunan:** `runner` dulu (game #1, sekaligus membuktikan seluruh core), lalu `memory` (paling murah, hasil tercepat), lalu `count`, lalu `sort`, lalu `path`.

---

## 4. Model Konten Terpadu

Ini bagian terpenting dari v2. Satu bank konten, banyak arketipe bisa memakainya.

### 4.1 Primitif konten

Setiap entri konten adalah satu objek dengan `kind`. Arketipe mendeklarasikan `kind` apa yang bisa ia konsumsi.

```js
// content/items.js
export const ITEMS = [
  // kind: "color" — dipakai runner, memory, sort
  { id: "c_merah", kind: "color", label: "Merah", hex: "#ef4444",
    voice: "warna_merah", level: 1 },

  // kind: "shape"
  { id: "s_segitiga", kind: "shape", label: "Segitiga", shape: "triangle",
    color: "#22c55e", voice: "bentuk_segitiga", level: 1 },

  // kind: "letter"
  { id: "l_b", kind: "letter", label: "B", upper: "B", lower: "b",
    voice: "huruf_be", level: 2, wordRef: "w_bola" },

  // kind: "number"
  { id: "n_5", kind: "number", label: "Lima", value: 5,
    voice: "angka_lima", level: 2 },

  // kind: "animal" — punya suara asli
  { id: "a_kucing", kind: "animal", label: "Kucing",
    img: "assets/images/animals/kucing.webp",
    sound: "assets/audio/sfx/sfx_kucing.mp3",
    voice: "hewan_kucing", level: 1 },

  // kind: "word" — kosakata bergambar
  { id: "w_bola", kind: "word", label: "Bola",
    img: "assets/images/words/bola.webp", voice: "kata_bola", level: 2 }
];
```

### 4.2 Soal dibangkitkan, bukan ditulis manual

Menulis 200 soal satu per satu itu pekerjaan sia-sia dan cepat basi. Sebagian besar soal dihasilkan dari kombinasi `ITEMS` oleh `core/quiz.js`:

```js
// Resep soal — deklaratif, bukan hardcode
export const RECIPES = [
  {
    id: "kenali_warna",
    kinds: ["color"],
    level: 1,
    build: (pool, rng) => {
      const answer = rng.pick(pool);
      const distractors = rng.pickN(pool.filter(i => i.id !== answer.id), 2);
      return {
        promptVoice: `tanya_warna_${answer.voice}`,
        promptText: `Manakah warna ${answer.label}?`,
        options: rng.shuffle([answer, ...distractors])
                   .map(i => ({ item: i, swatch: i.hex })),
        correctId: answer.id
      };
    }
  },
  {
    id: "tebak_suara",
    kinds: ["animal"],
    level: 1,
    build: (pool, rng) => {
      const answer = rng.pick(pool);
      const distractors = rng.pickN(pool.filter(i => i.id !== answer.id), 2);
      return {
        promptVoice: "tanya_hewan",
        clueAudio: answer.sound,      // suara hewan diputar dulu
        promptText: "Suara hewan apakah ini?",
        options: rng.shuffle([answer, ...distractors])
                   .map(i => ({ item: i, img: i.img })),
        correctId: answer.id
      };
    }
  }
];
```

Menambah topik baru = menambah `ITEMS` dan/atau satu `RECIPES`. Tidak menyentuh logika game.

### 4.3 Deterministis (penting untuk rekam)

Generator soal memakai RNG ber-seed. Seed disimpan di sesi. Artinya: sesi rekaman bisa diulang persis sama, dan kalau rekaman gagal kita bisa main ulang dengan urutan soal identik.

---

## 5. Spesifikasi Mini-Game #1 — Petualangan Unicorn

Fondasi teknis, sekaligus bukti bahwa seluruh core bekerja.

**Alur:**
1. Pilih karakter (5 unicorn, kartu besar) → klik = lompat + sapaan suara
2. Pilih mode: Campur / Warna / Bentuk / Huruf / Angka / Suara Hewan
3. Layar siap → "Yeay! Ayo kita mulai!"
4. Sesi: 5 rintangan, latar parallax, tiap rintangan = 1 soal
5. Jawab benar → unicorn melompati rintangan + konfeti kecil + suara pujian
6. Jawab salah → tombol redup & bergetar + "Coba pilih yang lain ya!"
7. Rintangan ke-5 lewat → Kastil Pelangi + konfeti besar + bintang masuk koleksi
8. Layar hasil: jumlah bintang, tombol "Main lagi" & "Pilih game lain"

**Target durasi satu sesi: 2–4 menit.**

**Perubahan dari v1:** latar parallax dan karakter dibuat dengan CSS/canvas, bukan aset gambar raksasa, supaya ukuran file kecil dan bisa dianimasikan (karakter harus bergerak, bukan diam).

---

## 6. Progres & Reward

- **Bintang** (`stars`): +1 per sesi selesai. Ditampilkan di portal.
- **Stiker** (`stickers`): dibuka tiap 5 bintang. Ditampilkan di "Album Stiker" — ini pengait retensi utama untuk anak 4 tahun.
- **Lencana** (`badges`): per kategori, mis. "Jago Warna" setelah 10 soal warna benar. Untuk SD nanti.
- Semua di `localStorage` dengan satu kunci namespace: `hsn_edu_v1`.
- Tidak ada leaderboard, tidak ada perbandingan antar anak. Anak 4 tahun tidak butuh kompetisi.

**Struktur penyimpanan:**
```js
{
  version: 1,
  stars: 24,
  stickers: ["s_kucing", "s_pelangi"],
  perGame: { "petualangan-unicorn": { plays: 7, correct: 31, wrong: 4 } },
  settings: { voice: true, bgm: 0.25, sfx: true, recordMode: false }
}
```

---

## 7. Audio & Narasi

Audio adalah **navigasi utama**, bukan hiasan. Karena itu pipeline-nya harus bisa diganti tanpa menyentuh kode.

### 7.1 Manifest suara

Kode tidak pernah menyebut nama file mp3 langsung. Kode menyebut **kunci**:

```js
// content/voice-manifest.js
export const VOICE = {
  "intro_pilih":     "assets/audio/voice/intro_pilih.mp3",
  "warna_merah":     "assets/audio/voice/warna_merah.mp3",
  "tanya_warna_c_merah": "assets/audio/voice/tanya_warna_merah.mp3",
  // ...
};
```

Ganti mesin TTS kapan saja → cukup regenerasi file dan update manifest. Nol perubahan kode game.

### 7.2 Keputusan mesin suara: gTTS

**Diputuskan: pakai gTTS sekarang, jangan tunggu.** Alasannya sederhana — gTTS gratis dan jalan hari ini, jadi game bisa langsung dimainkan dan direkam. ElevenLabs (versi gratis) punya batas karakter dan butuh setup akun; tidak sepadan kalau tujuannya supaya game cepat jadi.

| Mesin | Status | Catatan |
|---|---|---|
| **gTTS (id)** | **DIPAKAI — SUDAH DIVERIFIKASI** | gtts 2.5.4 di `C:\laragon\bin\python\python-3.10`. Tes 24 Nov 2026: kalimat 8 kata → 4.6 detik. Jelas, agak datar, cukup. |
| gTTS (en) | **DIPAKAI — SUDAH DIVERIFIKASI** | pakai `tld='co.uk'`. Kalimat tes → 4.1 detik. |
| edge-tts (Ardi) | sedang 403 semua voice | tidak bisa diandalkan sekarang |
| ElevenLabs | ditunda | kualitas terbaik tapi berbayar/terbatas. Bisa masuk nanti tanpa ubah kode. |

Sampel hasil tes ada di `assets/audio/voice/id/_sample_intro.mp3` dan `assets/audio/voice/en/_sample_intro.mp3` — dengarkan dulu untuk memastikan suaranya bisa diterima.

Karena kode hanya menyebut **kunci** (bukan nama file), pindah ke ElevenLabs kapan pun = regenerasi file + update manifest. Nol perubahan kode.

**Catatan gTTS:** tidak ada kontrol kecepatan. Untuk anak 4 tahun, kalimat narasi harus pendek (maks ±8 kata) supaya tidak terasa terburu-buru. Kalau kalimat panjang, pecah jadi dua file terpisah dan putar berurutan.

### 7.3 Multi-bahasa (ID + EN)

Bahasa adalah **data**, bukan cabang `if`. Tiga lapis yang dipisah:

**1. String antarmuka** — `content/i18n.js`
```js
export const UI = {
  id: {
    pilih_karakter: "Pilih teman unicorn kamu!",
    mulai: "Mulai Main",
    main_lagi: "Main Lagi",
    pilih_game: "Pilih Game Lain",
    bintang: "bintang"
  },
  en: {
    pilih_karakter: "Pick your unicorn friend!",
    mulai: "Start",
    main_lagi: "Play Again",
    pilih_game: "Other Games",
    bintang: "stars"
  }
};
```

**2. Label konten** — setiap item punya label dua bahasa
```js
{ id: "c_merah", kind: "color",
  label: { id: "Merah", en: "Red" },
  voice: { id: "warna_merah", en: "color_red" },
  hex: "#ef4444", level: 1 }
```

**3. Manifest suara per bahasa** — folder terpisah
```
assets/audio/voice/id/intro_pilih.mp3
assets/audio/voice/en/intro_pick.mp3
```
`core/audio.js` memilih folder berdasarkan locale aktif. Satu variabel, bukan duplikasi kode.

**Pemilih bahasa** ada di portal (bendera/bulatan besar ID | EN), tersimpan di `localStorage` sebagai bagian dari `settings.locale`. Default: `id`.

**Aturan penting:** semua file suara ID dan EN harus **diregenerasi bersamaan** saat teks berubah. Kalau tidak, akan ada game yang narasinya setengah Indonesia setengah Inggris.

### 7.4 Audio manager (core)

- Antrean suara: instruksi soal tidak boleh tumpang tindih
- **Ducking**: BGM otomatis turun saat narasi bicara, naik lagi setelahnya
- Tombol ulangi selalu ada
- Autoplay policy browser: audio pertama wajib dipicu interaksi user → layar "Tekan untuk mulai" di awal
- Volume terpisah: voice / sfx / bgm

### 7.5 Daftar suara minimum untuk game #1 (per bahasa)

Navigasi: `intro_pilih`, `mulai_main`, `menang_kastil`, `pilih_mode`
Umpan balik: `benar_1`, `benar_2`, `benar_3`, `salah_coba`
Soal: `tanya_warna_*`, `tanya_bentuk_*`, `tanya_huruf_*`, `tanya_angka_*`, `tanya_hewan`
SFX: `sfx_lompat`, `sfx_bintang`, `sfx_tap`, suara 8 hewan
BGM: `bgm_ceria` (loop, volume rendah)

Total ±55 file per bahasa × 2 bahasa = ±110 file mp3. Dibangkitkan otomatis oleh script `tools/build_voice.py` dari satu file teks naskah — bukan direkam manual.

---

## 8. Aset Visual

**Gaya dasar (wajib sama di semua game):**
> 2D cute children book vector illustration, bright pastel colors, clean flat style, thick soft outlines, isolated on plain white background

### 8.1 Sumber aset: Google Flow (manual, oleh user)

**Diputuskan: aset gambar digenerate manual oleh user di Google Flow. Agent hanya menyediakan prompt.** agy tidak dipakai untuk aset game ini.

Konsekuensinya, yang harus dijaga ketat:

1. **Satu string gaya beku (style bible), ditempel di awal setiap prompt.** Kalau gaya ditulis ulang tiap prompt, hasilnya akan beda-beda dan game terasa tidak menyatu.
2. **Latar putih polos wajib.** Bukan "transparent" (Flow tidak menghasilkan alpha), tapi putih rata. Nanti dihapus otomatis dengan threshold numpy, jadi harus kontras tinggi dan tidak ada bayangan lembut.
3. **Tanpa bayangan, tanpa gradien latar, tanpa teks.** Bayangan lembut gagal dihapus dan meninggalkan kotak abu-abu.
4. **Satu objek per gambar.** Jangan minta 5 unicorn dalam satu gambar — akan kecil, tidak konsisten, dan tidak bisa dipotong.
5. **Rasio 1:1 (square)** untuk karakter dan hewan, karena sprite game dipakai di kotak.
6. **Pose menghadap kanan** untuk unicorn (arah lari game), menghadap depan untuk hewan (kartu kuis).

Prompt lengkap ada di file terpisah: `docs/PROMPT_ASET.md`.

**Setelah user generate:** agent memproses otomatis → hapus latar putih, potong rapat, resize (1024 px unicorn / 512 px hewan), konversi WebP. Ini script `tools/convert_webp.py`.

### 8.2 Urutan produksi aset

Aset **tidak** menjadi penghalang untuk mulai.

1. **Fase 0–1: nol aset.** Semua placeholder (kotak warna, emoji besar, siluet CSS). Game sudah bisa dimainkan penuh.
2. **Prioritas 1 — 5 unicorn.** Paling terlihat, paling menentukan rasa game.
3. **Prioritas 2 — 8 hewan.** Untuk soal tebak suara. Bisa dicicil.
4. **Prioritas 3 — 1 kastil.** Untuk layar finis.

Karena digenerate manual, tidak ada batas kuota agent. Tapi tetap disarankan mencicil: generate 1 unicorn dulu, lihat hasilnya, baru lanjut 4 sisanya. Kalau gaya pertama meleset, kita perbaiki style bible sebelum membuang 13 gambar.

**Format akhir:** WebP, sisi terpanjang maks 1024 px (karakter), 512 px (hewan).

### 8.3 Daftar aset final

| Grup | File | Metode |
|---|---|---|
| Karakter | sparkle, breeze, sunny, berry, coco | Google Flow — 5 prompt |
| Hewan | kucing, anjing, sapi, ayam, singa, katak, gajah, bebek | Google Flow — 8 prompt |
| Finis | kastil pelangi | Google Flow — 1 prompt |
| Rintangan | kristal, batang kayu, sungai, gerbang, awan | SVG oleh agent (0 prompt) |
| Bentuk | lingkaran, segitiga, kotak, bintang, hati | SVG oleh agent (0 prompt) |
| Latar | bukit, langit, awan bergerak, pelangi | CSS/SVG oleh agent (0 prompt) |

**Total yang perlu kamu generate: 14 gambar.** Semua prompt siap tempel ada di `docs/PROMPT_ASET.md`.

---

## 9. Mode Rekam (dirancang sekarang, dibangun nanti)

Tujuan akhirnya adalah video, jadi beberapa hal harus diputuskan di arsitektur sekarang meski fiturnya dibangun belakangan.

**Hook yang dipasang sejak awal:**

1. **Flag URL `?record=1`** → mengubah tata letak:
   - HUD dipindah ke zona aman (tidak di 4 sudut layar)
   - Ruang kosong kanan-bawah disiapkan untuk inset kamera wajah
   - Ukuran font & tombol diperbesar (dibaca di video HP)
2. **Kanvas tetap 16:9, 1920×1080**, tanpa scrollbar, tanpa elemen keluar layar
3. **Kontrol BGM** — bisa dikecilkan/dimute saat rekam supaya audio mic bersih
4. **Jeda dramatis** — opsi tunda 0.8 detik sebelum jawaban benar dibuka, memberi ruang reaksi
5. **Seed sesi** — sesi bisa diulang dengan soal identik kalau rekaman gagal
6. **Log sesi** — catat soal, jawaban, waktu, untuk mempermudah editing nanti
7. **Tombol fullscreen** sekali klik

**Catatan pacing:** sesi 2–4 menit bagus untuk anak, tapi terlalu pendek untuk satu video. Solusi: mode "3 ronde" yang menggabungkan 3 sesi dengan eskalasi kesulitan dan perayaan di akhir. Ini dibangun di lapis shell, bukan di game.

---

## 10. Struktur Direktori

```
portal-edukasi/
├── index.html                  # portal / beranda
├── app.css                     # style shell
├── core/
│   ├── store.js                # localStorage, bintang, stiker
│   ├── audio.js                # antrean voice, ducking, BGM, SFX
│   ├── quiz.js                 # generator soal dari resep + seed
│   ├── ui.js                   # tombol besar, feedback, parent gate
│   ├── scene.js                # parallax, animasi, loop
│   └── fx.js                   # konfeti, kilau, getar
├── archetypes/
│   ├── runner/engine.js
│   ├── memory/engine.js
│   ├── sort/engine.js
│   ├── count/engine.js
│   └── path/engine.js
├── content/
│   ├── items.js                # bank konten terpusat (label ID+EN)
│   ├── recipes.js              # resep soal
│   ├── i18n.js                 # string antarmuka ID+EN
│   └── voice-manifest.js       # kunci -> file mp3 per locale
├── games/
│   └── petualangan-unicorn/
│       ├── game.json           # { id, title, archetype, items, theme }
│       └── theme.css           # warna, font, ornamen khas game ini
├── tools/
│   ├── build_voice.py          # naskah -> mp3 gTTS (ID + EN)
│   ├── build_assets.py         # batch agy resumable
│   └── convert_webp.py         # normalisasi ukuran & format
└── assets/
    ├── images/{unicorns,animals,castle}/
    ├── svg/{obstacles,shapes,bg}/   # digambar tangan, bukan generate
    └── audio/{voice/{id,en},sfx,bgm}/
```

Menambah game baru = buat satu folder di `games/` berisi `game.json` + `theme.css`. Selesai.

Contoh `game.json`:
```json
{
  "id": "petualangan-unicorn",
  "title": "Petualangan Unicorn",
  "archetype": "runner",
  "ages": ["tk"],
  "levels": [1, 2],
  "recipes": ["kenali_warna", "kenali_bentuk", "kenali_huruf", "kenali_angka", "tebak_suara"],
  "itemsPerSession": 5,
  "characters": ["sparkle", "breeze", "sunny", "berry", "coco"],
  "theme": "theme.css"
}
```

---

## 11. Roadmap

**Fase 0 — Fondasi (tanpa aset, semua placeholder)**
- Struktur folder, `index.html` portal, pemilih bahasa ID|EN
- `core/store.js` + `core/ui.js` + `core/audio.js`
- `core/quiz.js` + `content/items.js` + `content/recipes.js` + `content/i18n.js`
- `tools/build_voice.py` — generate suara gTTS ID + EN untuk kunci Fase 0
- 1 game bisa dibuka dari portal, 1 soal tampil, jawaban bisa diklik
- **Bukti:** game bisa dimainkan dengan kotak warna, tanpa satu pun gambar

**Fase 1 — Game #1 lengkap**
- `archetypes/runner/engine.js`: parallax, karakter lari, lompat, rintangan
- 5 soal per sesi, layar finis, bintang masuk
- Naskah suara lengkap, generate gTTS ID + EN sekaligus
- **Bukti:** satu sesi penuh bisa diselesaikan dari awal sampai kastil, dalam dua bahasa

**Fase 2 — Aset & poles (bertahap, tidak memblokir)**
- Batch 1: 5 unicorn → Batch 2: 8 hewan → Batch 3: 1 kastil
- SVG untuk rintangan, bentuk, dan latar parallax
- SFX, BGM, animasi konfeti, transisi
- Uji di 1366×768 dan 1920×1080

**Fase 3 — Game #2 (`memory`)**
- Mesin kedua, bukti bahwa arsitektur benar-benar modular
- Kalau menambah game #2 butuh mengubah `core/`, berarti arsitektur gagal dan harus diperbaiki sekarang, bukan nanti

**Fase 4 — Mode rekam**
- `?record=1`, safe area, kontrol BGM, seed, log sesi
- Uji rekam OBS + kamera

**Fase 5 — Ekspansi**
- Arketipe `count`, `sort`, `path`
- Level SD awal, lencana

---

## 12. Keputusan yang Sudah Dikunci

| Keputusan | Hasil |
|---|---|
| Bahasa | **Indonesia + Inggris**, dipilih di portal, tersimpan di localStorage |
| Mesin suara | **gTTS** (ID + EN). ElevenLabs ditunda, bisa masuk tanpa ubah kode |
| Hosting | **lokal saja** (file:// atau server lokal). Cukup untuk rekam |
| Fokus produksi | **game dulu**, rekam dan publikasi diputuskan setelah game bisa dimainkan |
| Kategori konten | game + komedi, konsisten. Tidak perlu kategori tambahan |
| Target usia | **TK 4 tahun** sebagai baseline desain |

## 12b. Yang Masih Terbuka

Hanya dua, dan keduanya tidak menghalangi Fase 0–1:

1. **Nama platform.** Portal butuh nama, dan ini juga bakal jadi nama seri video. Bisa diberi nama sementara (`Hari-Hari Seru`) dan diganti nanti — jangan sampai menahan pembangunan.
2. **Maskot platform.** Unicorn hanya karakter game #1. Portal butuh satu maskot yang muncul di semua game. Kandidat kuat: kepala Android dari branding hariri.hsn yang sudah ada, supaya nyambung dengan identitas channel.

---

## 13. Prinsip Penutup

Tiga kalimat yang menjaga proyek ini tetap waras:

1. **Konten adalah data, bukan kode.** Kalau menambah topik baru perlu menulis JavaScript, desainnya salah.
2. **Anak 4 tahun tidak boleh bisa "kalah".** Satu-satunya jalan keluar dari soal adalah jawaban benar.
3. **Bangun satu game dengan benar, bukan lima game setengah jadi.** Game #2 hanya boleh dimulai setelah game #1 bisa diselesaikan penuh dari portal sampai kastil.
