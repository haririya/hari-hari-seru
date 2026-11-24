// PORTAL
// Tugas: pilih bahasa, pilih game, buka pengaturan, dan serahkan kendali
// ke modul game. Portal tidak tahu apa pun soal mekanik permainan.

import { GAMES } from "./content/games.js";
import { t } from "./content/i18n.js";
import * as store from "./core/store.js";
import * as audio from "./core/audio.js";
import { el, clear, toast } from "./core/ui.js";

const root = document.getElementById("app");
let currentTheme = null;

// ── boot ─────────────────────────────────────────────────────────

function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get("record") === "1") document.body.classList.add("record-mode");

  showTapStart();
}

// ── layar "tekan untuk mulai" ────────────────────────────────────
// Wajib ada: browser memblokir suara sebelum ada interaksi user.

function showTapStart() {
  const locale = store.getLocale();
  const screen = el("div", { class: "tap-start" }, [
    el("div", { class: "bulat", text: "▶" }),
    el("h1", { class: "judul", text: t(locale, "tekan_mulai") }),
    el("p", { class: "sub", text: t(locale, "tekan_mulai_sub") }),
  ]);

  const go = () => {
    audio.unlock();
    audio.sfx.tap();
    showPortal();
  };

  screen.addEventListener("click", go, { once: true });
  screen.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") go();
  });

  clear(root).appendChild(screen);
}

// ── portal ───────────────────────────────────────────────────────

function showPortal() {
  loadTheme(null);
  const locale = store.getLocale();

  const topbar = el("div", { class: "topbar" }, [
    el("h1", { class: "judul", text: t(locale, "judul_portal") }),
    el("div", { class: "spacer" }),
    starsBadge(),
    langSwitch(),
    settingsButton(),
  ]);

  const grid = el("div", { class: "games" });

  for (const g of GAMES) {
    grid.appendChild(gameCard(g, locale));
  }

  const wrap = el("div", { class: "screen" }, [topbar, grid]);
  clear(root).appendChild(wrap);
}

function starsBadge() {
  const n = store.totalStars();
  return el("div", { class: "stars-badge" }, [
    el("span", { class: "star", text: "★" }),
    el("span", { text: String(n) }),
  ]);
}

function langSwitch() {
  const locale = store.getLocale();
  const box = el("div", { class: "lang-switch" });

  for (const code of ["id", "en"]) {
    box.appendChild(
      el("button", {
        class: code === locale ? "on" : "",
        type: "button",
        text: code.toUpperCase(),
        onclick: () => {
          if (code === store.getLocale()) return;
          store.setLocale(code);
          audio.sfx.tap();
          audio.say("intro_pilih", code);
          showPortal();
        },
      })
    );
  }

  return box;
}

function settingsButton() {
  // Parent gate: tahan 3 detik. Anak 4 tahun tidak akan bertahan selama itu.
  const btn = el("button", {
    class: "btn btn-ghost",
    type: "button",
    text: "⚙",
    title: t(store.getLocale(), "pengaturan"),
  });

  let timer = null;
  let ring = null;

  const start = () => {
    btn.style.transition = "box-shadow .1s";
    timer = setTimeout(() => {
      audio.sfx.tap();
      openSettings();
    }, 3000);
    ring = setTimeout(() => {
      btn.textContent = "⚙ ✓";
    }, 1200);
  };

  const stop = () => {
    clearTimeout(timer);
    clearTimeout(ring);
    btn.textContent = "⚙";
  };

  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointerleave", stop);
  btn.addEventListener("pointercancel", stop);

  return btn;
}

function gameCard(g, locale) {
  const title = g.title[locale] ?? g.title.id;
  const tagline = g.tagline ? (g.tagline[locale] ?? g.tagline.id) : "";

  const thumb = el("div", { class: "thumb" });
  if (g.thumb) {
    const img = el("img", { src: g.thumb, alt: "", draggable: "false" });
    img.addEventListener("error", () => {
      img.replaceWith(
        el("div", { class: "placeholder", text: g.placeholder || "?" })
      );
    });
    thumb.appendChild(img);
  } else {
    thumb.appendChild(el("div", { class: "placeholder", text: g.placeholder || "?" }));
  }

  const stars = el("div", { class: "stars" });
  const n = store.starsOf(g.id);
  for (let i = 0; i < Math.min(n, 8); i++) {
    stars.appendChild(el("span", { class: "star", text: "★" }));
  }

  const card = el(
    "button",
    {
      class: "game-card" + (g.ready ? "" : " locked"),
      type: "button",
      onclick: () => {
        audio.sfx.tap();
        if (!g.ready) {
          toast(root, locale === "en" ? "Coming soon!" : "Segera hadir!", 1200);
          return;
        }
        openGame(g);
      },
    },
    [el("h3", { text: title }), el("p", { class: "tagline", text: tagline }), stars, thumb]
  );

  return card;
}

// ── pemilih karakter ─────────────────────────────────────────────
// Hanya untuk game yang punya karakter. Game tanpa karakter langsung mulai.

const CHARACTERS = [
  { id: "sparkle", nama: "Sparkle", warna: "#ff9ec4" },
  { id: "breeze", nama: "Breeze", warna: "#7dd3fc" },
  { id: "sunny", nama: "Sunny", warna: "#fcd34d" },
  { id: "berry", nama: "Berry", warna: "#fb7185" },
  { id: "coco", nama: "Coco", warna: "#c084fc" },
];

function openGame(g) {
  const locale = store.getLocale();

  if (g.archetype !== "runner") {
    launch(g, null);
    return;
  }

  const screen = el("div", { class: "screen" }, [
    el("h2", { class: "screen-title", text: t(locale, "pilih_karakter") }),
    el("div", { class: "picker" }),
    el("div", { style: { display: "flex", justifyContent: "center", padding: "10px 0 4px" } }, [
      el("button", {
        class: "btn btn-ghost",
        type: "button",
        text: "← " + t(locale, "kembali"),
        onclick: () => {
          audio.sfx.tap();
          showPortal();
        },
      }),
    ]),
  ]);

  const picker = screen.querySelector(".picker");

  for (const c of CHARACTERS) {
    const card = el(
      "button",
      {
        class: "char-card",
        type: "button",
        onclick: () => {
          audio.sfx.tap();
          launch(g, c);
        },
      },
      [charThumb(c), el("div", { class: "nama", text: c.nama })]
    );
    picker.appendChild(card);
  }

  clear(root).appendChild(screen);
  audio.say("intro_pilih", locale);
}

function charThumb(c) {
  const holder = el("div");
  const img = el("img", { src: `assets/images/unicorns/${c.id}.webp`, alt: c.nama, draggable: "false" });
  img.addEventListener("error", () => {
    const ph = el("div", { class: "placeholder", text: "🦄" });
    ph.style.background = c.warna;
    img.replaceWith(ph);
  });
  holder.appendChild(img);
  return holder;
}

// ── menjalankan game ─────────────────────────────────────────────

async function launch(g, character) {
  loadTheme(g.theme);
  clear(root);

  const screen = el("div", { class: "screen" });
  root.appendChild(screen);

  try {
    const mod = await import("./" + g.entry);
    const start = mod.start || mod.default?.start;
    if (typeof start !== "function") {
      throw new Error("modul game tidak mengekspor start()");
    }

    await start({
      root: screen,
      locale: store.getLocale(),
      character,
      level: 1,
      onExit: () => {
        loadTheme(null);
        showPortal();
      },
      onStar: () => {
        const total = store.addStar(g.id, 1);
        const badge = document.querySelector(".stars-badge span:last-child");
        if (badge) badge.textContent = String(total);
      },
    });
  } catch (err) {
    console.error(err);
    clear(screen).appendChild(
      el("div", { class: "screen center" }, [
        el("h2", { class: "judul", text: "Gagal membuka game" }),
        el("p", { class: "sub", text: String(err.message || err) }),
        el("button", {
          class: "btn btn-primary",
          type: "button",
          text: "Kembali",
          onclick: () => showPortal(),
        }),
      ])
    );
  }
}

// ── pengaturan ───────────────────────────────────────────────────

function openSettings() {
  const locale = store.getLocale();
  const settings = store.getSettings();

  const sheet = el("div", { class: "sheet" });
  const back = el("div", { class: "sheet-back" }, [sheet]);

  sheet.appendChild(el("h2", { class: "judul", text: t(locale, "pengaturan") }));

  for (const [key, labelKey] of [
    ["voice", "suara"],
    ["music", "musik"],
    ["sfx", "efek"],
  ]) {
    const toggle = el("button", {
      class: "toggle" + (settings[key] ? " on" : ""),
      type: "button",
      "aria-pressed": String(!!settings[key]),
      onclick: () => {
        const next = !store.getSettings()[key];
        store.setSetting(key, next);
        toggle.classList.toggle("on", next);
        toggle.setAttribute("aria-pressed", String(next));
        audio.applySettings();
        if (key === "voice" && next) audio.say("ulangi", store.getLocale());
        if (key === "sfx" && next) audio.sfx.tap();
      },
    });

    sheet.appendChild(
      el("div", { class: "row" }, [el("span", { text: t(locale, labelKey) }), toggle])
    );
  }

  // ── volume ────────────────────────────────────────────────────
  // Satu slider untuk semua suara. Angka besar supaya mudah dilihat orang tua.
  const pctLabel = el("span", { class: "pct", text: `${settings.volume}%` });

  const slider = el("input", {
    class: "slider",
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: String(settings.volume),
    "aria-label": t(locale, "volume"),
  });

  slider.addEventListener("input", () => {
    const v = Number(slider.value);
    pctLabel.textContent = `${v}%`;
    store.setSetting("volume", v);
    audio.applySettings();
  });

  // begitu jari dilepas, bunyikan contoh supaya langsung terdengar hasilnya
  slider.addEventListener("change", () => {
    audio.sfx.tap();
    if (store.getSettings().voice) audio.say("ulangi", locale);
  });

  sheet.appendChild(
    el("div", { class: "row row-volume" }, [
      el("span", { text: t(locale, "volume") }),
      el("div", { class: "slider-wrap" }, [slider, pctLabel]),
    ])
  );

  sheet.appendChild(
    el("div", { class: "row" }, [
      el("span", { text: t(locale, "hapus_progres") }),
      el("button", {
        class: "btn btn-danger",
        type: "button",
        text: "🗑",
        onclick: () => {
          if (confirm(t(locale, "hapus_konfirmasi"))) {
            store.resetProgress();
            back.remove();
            showPortal();
          }
        },
      }),
    ])
  );

  sheet.appendChild(
    el("button", {
      class: "btn btn-primary",
      type: "button",
      text: t(locale, "tutup"),
      onclick: () => {
        audio.sfx.tap();
        back.remove();
      },
    })
  );

  back.addEventListener("click", (e) => {
    if (e.target === back) back.remove();
  });

  root.appendChild(back);
}

// ── tema per game ────────────────────────────────────────────────
// Tema dimuat sebagai <link> supaya variabel CSS game tidak bocor ke portal.

function loadTheme(href) {
  if (currentTheme) {
    currentTheme.remove();
    currentTheme = null;
  }
  if (!href) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
  currentTheme = link;
}

// ── jalan ────────────────────────────────────────────────────────

boot();
