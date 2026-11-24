// UI DASAR
// Pembuat elemen, bentuk SVG, dan kartu jawaban besar.
// Aturan keras untuk usia 4 tahun:
//   - kartu jawaban minimal 120px, sebaiknya jauh lebih besar
//   - tidak ada teks kecil yang harus dibaca
//   - selalu ada tombol ulangi suara
//   - salah tidak mengakhiri apa pun

// ── pembuat elemen ───────────────────────────────────────────────

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "dataset" && typeof v === "object") {
      Object.assign(node.dataset, v);
    } else {
      node.setAttribute(k, v);
    }
  }

  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }

  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// ── bentuk SVG ───────────────────────────────────────────────────
// Dibuat sendiri, bukan gambar: lebih tajam di semua ukuran dan bisa
// diwarnai langsung dari data item.

const SHAPES = {
  circle: (hex) => `<circle cx="50" cy="50" r="44" fill="${hex}" stroke="rgba(0,0,0,.18)" stroke-width="2"/>`,
  square: (hex) => `<rect x="8" y="8" width="84" height="84" rx="12" fill="${hex}" stroke="rgba(0,0,0,.18)" stroke-width="2"/>`,
  triangle: (hex) => `<polygon points="50,8 92,88 8,88" fill="${hex}" stroke="rgba(0,0,0,.18)" stroke-width="2" stroke-linejoin="round"/>`,
  star: (hex) => `<polygon points="50,5 61,38 96,38 68,59 78,93 50,72 22,93 32,59 4,38 39,38" fill="${hex}" stroke="rgba(0,0,0,.18)" stroke-width="2" stroke-linejoin="round"/>`,
  heart: (hex) => `<path d="M50 88 C20 68 8 50 8 35 C8 20 20 10 33 10 C42 10 48 15 50 21 C52 15 58 10 67 10 C80 10 92 20 92 35 C92 50 80 68 50 88 Z" fill="${hex}" stroke="rgba(0,0,0,.18)" stroke-width="2"/>`,
};

export function shapeSVG(shape, hex, size = 96) {
  const inner = SHAPES[shape] || SHAPES.circle;
  const wrap = document.createElement("div");
  wrap.className = "shape";
  wrap.style.width = size + "px";
  wrap.style.height = size + "px";
  wrap.innerHTML = `<svg viewBox="0 0 100 100" width="${size}" height="${size}">${inner(hex)}</svg>`;
  return wrap;
}

// ── tampilan isi jawaban ─────────────────────────────────────────

/**
 * Ubah `display` dari resep menjadi elemen visual.
 * display = { type: 'swatch'|'shape'|'text'|'image', value, hex }
 */
export function displayNode(display, opts = {}) {
  const size = opts.size || 140;

  if (!display) return el("div", { class: "disp-empty" });

  switch (display.type) {
    case "swatch": {
      const d = el("div", { class: "swatch" });
      d.style.width = size + "px";
      d.style.height = size + "px";
      d.style.background = display.value;
      return d;
    }
    case "shape":
      return shapeSVG(display.value, display.hex, size);

    case "text": {
      const d = el("div", { class: "big-text", text: display.value });
      d.style.fontSize = Math.round(size * 0.8) + "px";
      return d;
    }

    case "image": {
      const img = el("img", {
        class: "asset-img",
        src: opts.src || `assets/images/animals/${display.value}.webp`,
        alt: "",
        draggable: "false",
      });
      img.style.width = size + "px";
      img.style.height = size + "px";
      // kalau aset belum ada, ganti kotak warna lembut supaya game tetap jalan
      img.addEventListener("error", () => {
        const ph = el("div", { class: "placeholder" });
        ph.style.width = size + "px";
        ph.style.height = size + "px";
        // emoji harus ikut membesar bersama kartu, bukan tetap kecil
        ph.style.fontSize = Math.round(size * 0.5) + "px";
        ph.textContent = display.emoji || "?";
        img.replaceWith(ph);
      });
      return img;
    }

    default:
      return el("div", { class: "big-text", text: String(display.value ?? "") });
  }
}

// ── kartu jawaban ────────────────────────────────────────────────

/**
 * Kartu jawaban besar. Satu kartu satu pilihan.
 * Mengembalikan elemen <button> supaya otomatis bisa diakses keyboard.
 */
export function optionCard(option, { size = 140, onPick } = {}) {
  const card = el(
    "button",
    {
      class: "option-card",
      type: "button",
      "aria-label": option.label,
      onclick: (e) => {
        e.preventDefault();
        onPick?.(option, card);
      },
    },
    [displayNode(option.display, { size })]
  );
  card.dataset.itemId = option.itemId;
  return card;
}

// ── bintang ──────────────────────────────────────────────────────

export function starRow(count, max = 5) {
  const row = el("div", { class: "stars" });
  for (let i = 0; i < Math.max(count, 0); i++) {
    row.appendChild(el("span", { class: "star", text: "★" }));
  }
  return row;
}

// ── layar ────────────────────────────────────────────────────────

export function screen(className = "") {
  return el("div", { class: "screen " + className });
}

export function show(root, node) {
  clear(root);
  root.appendChild(node);
  return node;
}

// ── umpan balik singkat ──────────────────────────────────────────

export function toast(root, text, ms = 900) {
  const t = el("div", { class: "toast", text });
  root.appendChild(t);
  setTimeout(() => {
    t.classList.add("out");
    setTimeout(() => t.remove(), 300);
  }, ms);
  return t;
}
