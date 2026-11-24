// ARKETIPE RUNNER — Petualangan Unicorn
//
// ALUR 6 RONDE bergantian, gaya Chrome Dino / T-Rex Runner:
//
//   RONDE 1  lari  3 rintangan
//   RONDE 2  soal  3 pertanyaan
//   RONDE 3  lari  4 rintangan
//   RONDE 4  soal  3 pertanyaan
//   RONDE 5  lari  5 rintangan
//   RONDE 6  soal  3 pertanyaan
//   SELESAI  kastil + bintang
//
// ATURAN UNTUK USIA 4 TAHUN (jangan diubah tanpa alasan kuat):
//   - tap di mana saja = lompat; tidak perlu tepat sasaran, tidak ada tombol kecil
//   - menabrak rintangan BUKAN gagal: rintangan pecah jadi bintang, unicorn lanjut
//   - tidak ada nyawa, tidak ada timer, tidak ada game over
//   - lompatan tinggi & lambat supaya sempat dilihat mata anak
//   - hitbox sengaja dibuat lebih kecil dari gambarnya (gambar punya ruang
//     kosong transparan), jadi serempet tidak dihitung sebagai tabrakan
//
// CATATAN TEKNIS PENTING:
//   Posisi karakter dan rintangan dikendalikan SATU loop requestAnimationFrame,
//   bukan CSS animation. Alasannya: deteksi tabrakan butuh posisi yang sama
//   persis dengan yang terlihat. Kalau lompatan memakai CSS @keyframes, JS
//   tidak tahu karakter sedang di ketinggian berapa.

import { buildSession, checkAnswer, makeRng } from "../../core/quiz.js";
import * as audio from "../../core/audio.js";
import { el, clear, optionCard } from "../../core/ui.js";
import { t } from "../../content/i18n.js";

// ── rencana ronde ────────────────────────────────────────────────
// Satu-satunya tempat yang perlu diubah kalau mau menambah/mengurangi ronde.
// `kecepatan` = piksel per detik. Naik pelan-pelan tiap ronde, tapi tetap
// santai: rintangan butuh ~4 detik untuk sampai ke karakter.
const RENCANA = [
  { jenis: "lari", rintangan: 3, kecepatan: 300 },
  { jenis: "soal", jumlah: 3 },
  { jenis: "lari", rintangan: 4, kecepatan: 335 },
  { jenis: "soal", jumlah: 3 },
  { jenis: "lari", rintangan: 5, kecepatan: 370 },
  { jenis: "soal", jumlah: 3 },
];

const TOTAL_SOAL = RENCANA.filter((r) => r.jenis === "soal").reduce(
  (n, r) => n + r.jumlah,
  0
);

// ── fisika lompat ─────────────────────────────────────────────────
// Angka-angka ini BUKAN selera, tapi hasil hitungan. Anak 4 tahun hanya bisa
// menepuk kira-kira; jendela waktunya harus lebar.
//
//   lama di atas ambang aman  ≈ 796-876 ms
//   jendela rintangan menempel ≈ 390-415 ms
//   -> kelonggaran menepuk    ≈ 380-490 ms   (manusia: ~250 ms)
//
// Kalau LOMPAT_MS diperkecil atau LOMPAT_TINGGI diturunkan, pohon yang tinggi
// (118px) jadi MUSTAHIL dilompati — sudah pernah kejadian, jangan diulang.
const LOMPAT_MS = 1000;       // lama di udara
const LOMPAT_TINGGI = 180;    // piksel, cukup untuk semua rintangan

// Rintangan dianggap terlewati kalau bagian bawah karakter sudah naik
// melewati 48% tinggi rintangan. Ambang rendah = lebih pemaaf.
const AMBANG_LEWAT = 0.48;

// Kotak tabrakan sengaja lebih kecil dari gambarnya: gambar unicorn punya
// ruang kosong transparan, dan anak tidak boleh dihukum karena "nyerempet".
const KOTAK_KARAKTER = [0.34, 0.66];
const KOTAK_RINTANGAN = [0.28, 0.72];

// ── ritme rintangan ──────────────────────────────────────────────
// Jarak dalam PIKSEl, bukan waktu. Jadi kalau kecepatan naik, jedanya
// otomatis memendek tanpa perlu menyetel ulang angkanya.
//
// Angka ini HARUS lebih besar dari jarak yang ditempuh selama satu lompatan
// (kecepatan × LOMPAT_MS). Kalau lebih kecil, rintangan kedua datang sebelum
// anak sempat mendarat — mustahil dilewati dan terlihat "menumpuk".
//   370 px/s × 1,0 s = 370 px  ->  jarak minimum
// 820 px memberi jeda 2,2 detik di ronde tercepat: cukup untuk mendarat,
// melihat, lalu menepuk lagi.
const JARAK_RINTANGAN = 820;
const JEDA_AWAL = 700;       // ms sebelum rintangan pertama masuk layar

// ── jeda soal (mengikuti panjang suara, bukan angka mati) ────────
const JEDA_BENAR_MIN = 1200;
const JEDA_BENAR_MAX = 2800;
const JEDA_NAPAS = 220;
const JEDA_SALAH = 750;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function start(ctx) {
  const { root, locale, character, level = 1, onExit, onStar } = ctx;

  const seed =
    new URLSearchParams(location.search).get("seed") ||
    String(Math.floor(Math.random() * 1e9));

  const session = buildSession({
    archetype: "runner",
    count: TOTAL_SOAL,
    level,
    locale,
    seed,
  });

  if (!session.questions.length) {
    clear(root).appendChild(
      el("div", { class: "screen center" }, [
        el("h2", { class: "judul", text: t(locale, "soal_kosong") }),
        el("button", {
          class: "btn btn-primary",
          type: "button",
          text: t(locale, "kembali"),
          onclick: onExit,
        }),
      ])
    );
    return;
  }

  // Soal dibagi ke tiga ronde kuis. Kalau bank soal kurang dari TOTAL_SOAL,
  // ronde terakhir cukup lebih sedikit — game tetap jalan, tidak error.
  const paketSoal = [];
  {
    let pos = 0;
    for (const r of RENCANA) {
      if (r.jenis !== "soal") continue;
      paketSoal.push(session.questions.slice(pos, pos + r.jumlah));
      pos += r.jumlah;
    }
  }

  // rintangan dipilih acak (batu / pohon) dengan RNG ber-seed, supaya
  // mode rekam (?seed=) menghasilkan susunan yang sama persis
  const rngRintangan = makeRng(seed + ":rintangan");

  // ── elemen panggung ────────────────────────────────────────────
  const charBox = buildCharacter(character);
  const bannerText = el("span", { class: "teks" });
  const repeatBtn = el("button", {
    class: "btn-round",
    type: "button",
    "aria-label": "ulangi",
    text: "🔊",
  });
  const answers = el("div", { class: "answers" });
  const progress = el("div", { class: "progress" });
  const lapis = el("div", { class: "obstacles" });
  // Bayangan di tanah. Elemen TERPISAH, bukan ::after pada charBox — charBox
  // ikut terangkat saat melompat, sedangkan bayangan harus tetap di tanah dan
  // justru MENGECIL. Ini satu-satunya petunjuk visual yang membuat anak
  // 4 tahun paham "aku sedang di udara", karena gambar unicorn statis.
  const charShadow = el("div", { class: "char-shadow" });

  const hint = el("div", { class: "hint" }, [
    el("div", { class: "jari", text: "👆" }),
    el("div", { class: "kata", text: t(locale, "lompat_ayo") }),
  ]);
  hint.style.display = "none";

  // ── checkpoint ────────────────────────────────────────────────
  // Menabrak batu/pohon BUKAN gagal. Permainan cuma berhenti sebentar di
  // titik itu, lalu anak boleh melanjutkan TEPAT dari tempat ia berhenti —
  // bukan mengulang ronde dari awal. Tanpa tulisan "gagal", tanpa silang merah.
  const btnLanjut = el("button", {
    class: "btn btn-primary btn-lanjut",
    type: "button",
    text: "▶  " + t(locale, "checkpoint_lanjut"),
    onclick: () => lanjutDariCheckpoint(),
  });
  const cardCheckpoint = el("div", { class: "checkpoint" }, [
    el("div", { class: "bendera", text: "🚩" }),
    el("div", { class: "label-cp", text: t(locale, "checkpoint_label") }),
    el("div", { class: "judul-kecil", text: t(locale, "checkpoint_judul") }),
    btnLanjut,
  ]);

  const stage = el("div", { class: "runner" }, [
    el("div", { class: "sky" }, [
      el("div", { class: "rainbow" }),
      el("div", { class: "cloud c1" }),
      el("div", { class: "cloud c2" }),
      el("div", { class: "cloud c3" }),
      el("div", { class: "hills" }),
      el("div", { class: "ground" }),
    ]),
    progress,
    lapis,
    el("div", { class: "banner" }, [bannerText, repeatBtn]),
    charShadow,
    charBox,
    hint,
    cardCheckpoint,
    answers,
  ]);

  const backBtn = el("button", {
    class: "btn btn-ghost",
    type: "button",
    text: "←",
    style: {
      position: "absolute",
      left: "18px",
      bottom: "18px",
      zIndex: "20",
      width: "64px",
      height: "64px",
      minHeight: "64px",
      padding: "0",
      borderRadius: "50%",
    },
    onclick: () => {
      bersih();
      onExit();
    },
  });

  clear(root).appendChild(el("div", { class: "screen" }, [stage]));
  root.querySelector(".screen").appendChild(backBtn);

  // ── progres: satu titik per RONDE (6), bukan per soal ──────────
  const dots = [];
  for (let i = 0; i < RENCANA.length; i++) {
    const d = el("div", { class: "dot" });
    progress.appendChild(d);
    dots.push(d);
  }

  // ── keadaan permainan ──────────────────────────────────────────
  let correctCount = 0;
  let selesai = false;

  // lari
  let lariAktif = false;
  let kecepatan = 250;
  let sisaSpawn = 0;
  let spawnBerikut = 0;
  let xSpawnAwal = 0;        // x saat rintangan terakhir muncul
  let rintangan = [];        // { el, x, w, h, selesai }
  let selesaiLari = null;
  let checkpointAktif = false;
  let jamLanjutOtomatis = 0;

  // lompat
  let sedangLompat = false;
  let lompatMulai = 0;
  let charY = 0;

  // hitbox karakter dalam koordinat panggung
  let hitKiri = 0;
  let hitKanan = 0;

  // ── loop utama ─────────────────────────────────────────────────
  let rafId = 0;
  let waktuLalu = 0;

  function gelung(now) {
    const dt = waktuLalu ? Math.min(64, now - waktuLalu) / 1000 : 0;
    waktuLalu = now;

    // lompatan: kurva sinus -> naik pelan, tahan di puncak, turun pelan
    if (sedangLompat) {
      const p = (now - lompatMulai) / LOMPAT_MS;
      if (p >= 1) {
        sedangLompat = false;
        charY = 0;
        charBox.classList.remove("terbang");
        charShadow.style.transform = "translateX(-50%) scale(1)";
        charShadow.style.opacity = "0.9";
      } else {
        charY = LOMPAT_TINGGI * Math.sin(Math.PI * p);
      }
      // sedikit condong ke depan supaya terbaca "melompat", bukan "melayang"
      charBox.style.transform = `translateY(${-charY}px) rotate(5deg)`;
      // bayangan mengecil & memudar seiring ketinggian: isyarat "di udara"
      const naik = charY / LOMPAT_TINGGI;
      charShadow.style.transform = `translateX(-50%) scale(${1 - naik * 0.55})`;
      charShadow.style.opacity = String(0.9 - naik * 0.62);
    }

    if (lariAktif) {
      // munculkan rintangan berikutnya.
      // Pemicunya JARAK PIKSEl, bukan waktu: rintangan baru boleh masuk
      // setelah rintangan terakhir sudah bergerak sejauh JARAK_RINTANGAN.
      // Kalau memakai waktu, jarak di layar jadi lebih rapat setiap kali
      // frame turun (dt di-clamp), dan rintangan terlihat menumpuk.
      if (sisaSpawn > 0 && now >= spawnBerikut) {
        const terakhir = rintangan[rintangan.length - 1];
        if (!terakhir || xSpawnAwal - terakhir.x >= JARAK_RINTANGAN) spawnRintangan();
      }

      for (const r of rintangan) {
        r.x -= kecepatan * dt;
        r.el.style.transform = `translateX(${r.x}px)`;
        if (r.selesai) continue;

        // hitbox rintangan dipersempit ke 64% tengahnya
        const kiri = r.x + r.w * KOTAK_RINTANGAN[0];
        const kanan = r.x + r.w * KOTAK_RINTANGAN[1];

        if (kanan > hitKiri && kiri < hitKanan && charY <= r.h * AMBANG_LEWAT) {
          r.selesai = true;
          tabrak(r);
        } else if (kanan < hitKiri) {
          // seluruh badan rintangan sudah lewat karakter
          r.selesai = true;
          lolos(r);
        }
      }

      // semua rintangan sudah dilewati -> ronde lari selesai
      if (sisaSpawn === 0 && rintangan.every((r) => r.selesai)) {
        lariAktif = false;
        const f = selesaiLari;
        selesaiLari = null;
        f?.();
      }
    }

    rafId = requestAnimationFrame(gelung);
  }

  // ── rintangan ──────────────────────────────────────────────────
  function spawnRintangan() {
    if (sisaSpawn <= 0) return;
    sisaSpawn--;

    // campur batu & pohon, peluang sama
    const jenis = rngRintangan() < 0.5 ? "batu" : "pohon";

    const bentuk =
      jenis === "batu"
        ? el("div", { class: "bentuk" })
        : el("div", { class: "bentuk" }, [
            el("div", { class: "daun" }),
            el("div", { class: "batang" }),
          ]);

    const node = el("div", { class: `obstacle ${jenis}` }, [bentuk]);
    lapis.appendChild(node);

    // ukuran asli dibaca dari DOM, jadi deteksi tabrakan tetap benar
    // walaupun CSS memakai clamp() dan layar berganti ukuran
    const w = node.offsetWidth || 90;
    const h = node.offsetHeight || 70;

    const x = stage.getBoundingClientRect().width + 40;
    xSpawnAwal = x;
    node.style.transform = `translateX(${x}px)`;

    rintangan.push({ el: node, x, w, h, selesai: false });
  }

  // menabrak: rintangan pecah. TIDAK mengurangi apa pun.
  function tabrak(r) {
    audio.sfx.puff();
    r.el.classList.add("pecah");
    serpih(r.x + r.w / 2, 5);
    setTimeout(() => r.el.remove(), 470);

    // CHECKPOINT. Kalau masih ada rintangan tersisa, permainan berhenti di
    // titik ini dan anak boleh melanjutkan dari sini juga. Kalau yang
    // ditabrak justru rintangan TERAKHIR, tidak ada gunanya berhenti —
    // ronde langsung selesai seperti biasa.
    if (sisaSpawn > 0 || rintangan.some((x) => !x.selesai)) bukaCheckpoint();
  }

  function bukaCheckpoint() {
    if (checkpointAktif) return;
    checkpointAktif = true;
    lariAktif = false;              // bekukan: rintangan berhenti di tempatnya
    sedangLompat = false;           // jangan tinggalkan unicorn melayang
    charY = 0;
    charBox.style.transform = "";
    charBox.classList.remove("terbang");
    charShadow.style.transform = "translateX(-50%) scale(1)";
    charShadow.style.opacity = "0.9";
    cardCheckpoint.classList.add("tampil");
    audio.say("checkpoint_suara", locale);

    // Anak 4 tahun mungkin tidak menepuk tombolnya. Kalau dibiarkan diam,
    // permainan terasa rusak — jadi lanjut sendiri setelah suara selesai
    // diucapkan. 3,4 detik: cukup untuk mendengar "Tap untuk lanjut",
    // tidak terlalu lama sampai anak bosan menunggu.
    jamLanjutOtomatis = setTimeout(lanjutDariCheckpoint, 3400);
  }

  function lanjutDariCheckpoint() {
    if (!checkpointAktif) return;
    checkpointAktif = false;
    clearTimeout(jamLanjutOtomatis);
    jamLanjutOtomatis = 0;
    cardCheckpoint.classList.remove("tampil");
    // rintangan yang tersisa masih di posisinya semula -> lanjut dari titik
    // yang sama, bukan mengulang ronde
    lariAktif = true;
  }

  // berhasil dilompati: bintang kecil terbang ke atas
  function lolos(r) {
    audio.sfx.star();
    serpih(r.x + r.w / 2, 3);
    setTimeout(() => r.el.remove(), 470);
  }

  function serpih(x, jumlah) {
    for (let i = 0; i < jumlah; i++) {
      const s = el("div", { class: "serpih", text: "★" });
      s.style.left = x + "px";
      s.style.fontSize = 16 + Math.random() * 16 + "px";
      s.style.setProperty("--dx", Math.round(Math.random() * 150 - 75) + "px");
      s.style.setProperty("--dy", Math.round(-40 - Math.random() * 80) + "px");
      lapis.appendChild(s);
      setTimeout(() => s.remove(), 820);
    }
  }

  function bersihkanRintangan() {
    for (const r of rintangan) r.el.remove();
    rintangan = [];
    for (const s of lapis.querySelectorAll(".serpih")) s.remove();
  }

  // ── lompat ─────────────────────────────────────────────────────
  function mulaiLompat() {
    if (sedangLompat) return;
    sedangLompat = true;
    lompatMulai = performance.now();
    charBox.classList.add("terbang");
    audio.sfx.jump();
    // anak sudah paham caranya — petunjuk tidak perlu lagi
    if (hint.style.display !== "none") hint.style.display = "none";
  }

  function ukurHitbox() {
    const s = stage.getBoundingClientRect();
    const c = charBox.getBoundingClientRect();
    const kiri = c.left - s.left;
    // 28%..72% dari lebar gambar: bagian tengah tempat badan unicorn berada
    hitKiri = kiri + c.width * KOTAK_KARAKTER[0];
    hitKanan = kiri + c.width * KOTAK_KARAKTER[1];
  }

  stage.addEventListener("pointerdown", (e) => {
    if (!lariAktif) return;
    if (e.target.closest("button")) return;
    e.preventDefault();
    mulaiLompat();
  });

  const onKey = (e) => {
    if (!lariAktif) return;
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      mulaiLompat();
    }
  };
  window.addEventListener("keydown", onKey);

  const onResize = () => {
    if (charBox.isConnected) ukurHitbox();
  };
  window.addEventListener("resize", onResize);

  function bersih() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    clearTimeout(jamLanjutOtomatis);
    jamLanjutOtomatis = 0;
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    audio.stopVoice();
    audio.stopBgm?.();
  }

  // ── ronde lari ─────────────────────────────────────────────────
  async function mainLari(ronde, pertama = false) {
    clear(answers);
    answers.style.display = "none";
    repeatBtn.style.display = "none";

    bannerText.textContent = t(locale, "lari_dimulai");
    // Petunjuk hanya di ronde lari PERTAMA. Setelah anak tahu caranya,
    // teks itu cuma jadi gangguan yang menutupi rintangan.
    hint.style.display = pertama ? "" : "none";
    stage.classList.add("siap-lompat");

    // siapkan
    bersihkanRintangan();
    checkpointAktif = false;
    clearTimeout(jamLanjutOtomatis);
    jamLanjutOtomatis = 0;
    cardCheckpoint.classList.remove("tampil");
    kecepatan = ronde.kecepatan;
    sisaSpawn = ronde.rintangan;
    sedangLompat = false;
    charY = 0;
    charBox.style.transform = "";
    charBox.classList.remove("terbang");
    charShadow.style.transform = "translateX(-50%) scale(1)";
    charShadow.style.opacity = "0.9";
    ukurHitbox();

    // ucapkan instruksi DULU, baru rintangan bergerak.
    // Hanya di ronde lari pertama — di ronde berikutnya anak sudah tahu,
    // dan menunggu 2,7 detik narasi tiap ronde membuat permainan terasa lambat.
    if (pertama) {
      await audio.say("lompat_ayo", locale);
      await wait(200);
    } else {
      await wait(340);
    }

    lariAktif = true;
    spawnBerikut = performance.now() + JEDA_AWAL;

    await new Promise((res) => {
      selesaiLari = res;
    });

    // beri waktu rintangan terakhir keluar layar
    await wait(560);

    hint.style.display = "none";
    stage.classList.remove("siap-lompat");
    answers.style.display = "";
    repeatBtn.style.display = "";

    // selalu dipuji — menabrak pun bukan kegagalan, jadi pujian tidak
    // boleh terasa seperti hadiah bersyarat
    await audio.say("lompat_hebat", locale);
    await wait(200);
  }

  // ── ronde soal ─────────────────────────────────────────────────
  function mainSoal(paket) {
    return paket.reduce(
      (rantai, q) => rantai.then(() => tanyaSatu(q)),
      Promise.resolve()
    );
  }

  function tanyaSatu(q) {
    return new Promise((selesaiSatu) => {
      bannerText.textContent = q.prompt[locale] ?? q.prompt.id;
      clear(answers);
      answers.classList.remove("locked");
      repeatBtn.style.display = "";

      let busy = false;

      // Soal suara hewan: ucapkan pertanyaannya, lalu putar REKAMAN ASLI.
      // Narasi memakai TTS; bunyi hewannya tidak — itu rekaman sungguhan.
      const speakPrompt = async () => {
        repeatBtn.classList.remove("pulse");

        if (q.isSoundQuestion) {
          await audio.say("tanya_suara", locale);
          await wait(220);
          await audio.playAnimal(q.sfx);
        } else {
          await audio.say(q.prompt.voice?.[locale], locale);
        }

        if (!busy) repeatBtn.classList.add("pulse");
      };

      repeatBtn.onclick = () => {
        if (busy) return;
        audio.sfx.tap();
        speakPrompt();
      };

      async function pilih(opt, card) {
        if (busy) return;
        if (card.classList.contains("dim")) return;

        const res = checkAnswer(q, opt.itemId);

        if (res.correct) {
          busy = true;
          answers.classList.add("locked");
          card.classList.add("correct");
          for (const other of answers.children) {
            if (other !== card) other.classList.add("dim");
          }

          // lompatan yang SAMA dengan ronde lari — satu bahasa gerak
          mulaiLompat();
          audio.sfx.correct();

          correctCount++;
          onStar?.();
          audio.sfx.star();

          const pujian = ["benar_1", "benar_2", "benar_3"][
            Math.floor(Math.random() * 3)
          ];
          const suaraPujian = audio.say(pujian, locale);

          await wait(JEDA_BENAR_MIN);
          await Promise.race([
            suaraPujian,
            wait(JEDA_BENAR_MAX - JEDA_BENAR_MIN),
          ]);
          await wait(JEDA_NAPAS);

          selesaiSatu();
          return;
        }

        // salah: lembut, tidak menghukum, soal tidak berganti
        busy = true;
        card.classList.add("wrong");
        audio.sfx.wrong();
        audio.say("salah_coba", locale);

        await wait(JEDA_SALAH);
        card.classList.remove("wrong");
        card.classList.add("dim");
        busy = false;
      }

      for (const opt of q.options) {
        const card = optionCard(opt, {
          size: 190,
          onPick: () => pilih(opt, card),
        });
        answers.appendChild(card);
      }

      audio.preload(["benar_1", "benar_2", "benar_3", "salah_coba"], locale);
      if (q.isSoundQuestion) audio.preloadAnimal(q.sfx);

      setTimeout(speakPrompt, 320);
    });
  }

  // ── selesai ────────────────────────────────────────────────────
  function showFinish() {
    if (selesai) return;
    selesai = true;
    bersih();

    const bintang =
      "★".repeat(correctCount) + "☆".repeat(Math.max(0, TOTAL_SOAL - correctCount));

    const castle = el("img", {
      class: "kastil",
      src: "assets/images/castle/kastil.webp",
      alt: "",
      draggable: "false",
    });
    castle.addEventListener("error", () => {
      castle.replaceWith(el("div", { class: "kastil-placeholder", text: "🏰" }));
    });

    const finish = el("div", { class: "finish" }, [
      castle,
      el("h2", { class: "judul", text: t(locale, "selesai") }),
      el("div", { class: "bintang-besar", text: bintang }),
      el("div", { class: "aksi" }, [
        el("button", {
          class: "btn btn-primary",
          type: "button",
          text: t(locale, "main_lagi"),
          onclick: () => {
            audio.sfx.tap();
            start({ ...ctx, character });
          },
        }),
        el("button", {
          class: "btn btn-ghost",
          type: "button",
          text: t(locale, "pilih_game_lain"),
          onclick: () => {
            audio.sfx.tap();
            onExit();
          },
        }),
      ]),
    ]);

    confetti(finish, 40);

    clear(root).appendChild(el("div", { class: "screen" }, [finish]));

    audio.sfx.star();
    setTimeout(() => audio.say("menang_kastil", locale), 500);
  }

  // ── jalankan ───────────────────────────────────────────────────
  function tandaiRonde(i) {
    dots.forEach((d, k) => {
      d.classList.toggle("on", k === i);
      d.classList.toggle("done", k < i);
    });
  }

  async function main() {
    let idxSoal = 0;
    let sudahLari = false;

    for (let i = 0; i < RENCANA.length; i++) {
      if (selesai) return;
      tandaiRonde(i);

      const r = RENCANA[i];
      if (r.jenis === "lari") {
        await mainLari(r, !sudahLari);
        sudahLari = true;
      } else {
        const paket = paketSoal[idxSoal++] || [];
        if (!paket.length) continue;
        await mainSoal(paket);
      }
    }

    if (!selesai) showFinish();
  }

  audio.startBgm();
  rafId = requestAnimationFrame(gelung);
  main();
}

// ── karakter ─────────────────────────────────────────────────────

function buildCharacter(character) {
  const box = el("div", { class: "runner-char" });

  const id = character?.id || "sparkle";
  const img = el("img", {
    src: `assets/images/unicorns/${id}.webp`,
    alt: character?.nama || "unicorn",
    draggable: "false",
  });

  img.addEventListener("error", () => {
    const ph = el("div", { class: "placeholder", text: "🦄" });
    img.replaceWith(ph);
  });

  box.appendChild(img);
  return box;
}

// ── konfeti ──────────────────────────────────────────────────────

function confetti(parent, n) {
  const warna = ["#ff8fb1", "#a78bfa", "#60a5fa", "#6ee7b7", "#fcd34d"];
  for (let i = 0; i < n; i++) {
    const c = el("div", { class: "confetti" });
    c.style.left = Math.random() * 100 + "%";
    c.style.background = warna[Math.floor(Math.random() * warna.length)];
    c.style.animationDuration = 1.8 + Math.random() * 1.6 + "s";
    c.style.animationDelay = Math.random() * 0.9 + "s";
    parent.appendChild(c);
  }
}
