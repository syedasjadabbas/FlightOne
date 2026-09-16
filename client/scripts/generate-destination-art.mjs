/**
 * Generates PLACEHOLDER artwork for the Destination Pan Sequence.
 *
 * There is no licensed photography in this repo yet. Rather than reference
 * image paths that 404, this produces layered SVG scenes — abstract but
 * evocative, in the existing `public/images/destinations/*.svg` house style.
 *
 * These are meant to be REPLACED with real photography. The component takes
 * plain URLs, so swapping them is a data change, not a code change.
 *
 * Run:  node scripts/generate-destination-art.mjs
 * Out:  public/images/destinations/<id>-{bg,inset-a,inset-b}.svg
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "images", "destinations");
mkdirSync(OUT_DIR, { recursive: true });

/** Deterministic pseudo-random so regenerating produces identical files. */
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const grain = (id) => `
    <filter id="${id}">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
    </filter>`;

const vignette = (id, cx = "50%", cy = "45%") => `
    <radialGradient id="${id}" cx="${cx}" cy="${cy}" r="72%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#040405" stop-opacity="0.72"/>
    </radialGradient>`;

/** A soft horizon-lit sky + water scene (Maldives-like). */
function oceanScene(w, h, palette, seed, opts = {}) {
  const rng = makeRng(seed);
  const horizon = h * (opts.horizon ?? 0.56);
  const sunX = w * (opts.sunX ?? 0.72);

  // Distant villa silhouettes on stilts
  let villas = "";
  if (opts.villas) {
    for (let i = 0; i < 5; i++) {
      const bx = w * (0.12 + i * 0.16) + rng() * 20;
      const bw = w * 0.085;
      const bh = h * 0.055;
      const by = horizon - bh * 0.85;
      villas += `
      <g opacity="${0.5 - i * 0.05}">
        <path d="M${bx} ${by + bh} L${bx + bw / 2} ${by} L${bx + bw} ${by + bh} Z" fill="#05202a"/>
        <rect x="${bx + bw * 0.08}" y="${by + bh}" width="${bw * 0.84}" height="${bh * 0.42}" fill="#061a22"/>
        <rect x="${bx + bw * 0.2}" y="${by + bh * 1.42}" width="${bw * 0.03}" height="${h * 0.03}" fill="#04141a"/>
        <rect x="${bx + bw * 0.75}" y="${by + bh * 1.42}" width="${bw * 0.03}" height="${h * 0.03}" fill="#04141a"/>
      </g>`;
    }
  }

  // Sun glitter path on the water
  let glitter = "";
  for (let i = 0; i < 46; i++) {
    const gy = horizon + rng() * (h - horizon) * 0.92;
    const spread = ((gy - horizon) / (h - horizon)) * w * 0.34 + 8;
    const gx = sunX + (rng() - 0.5) * spread * 2;
    const gw = 6 + rng() * 46 * ((gy - horizon) / (h - horizon) + 0.25);
    glitter += `<rect x="${gx.toFixed(1)}" y="${gy.toFixed(1)}" width="${gw.toFixed(1)}" height="1.6" rx="0.8" fill="#ffe9c4" opacity="${(0.5 - (gy - horizon) / (h - horizon) * 0.34).toFixed(2)}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.skyTop}"/>
      <stop offset="62%" stop-color="${palette.skyMid}"/>
      <stop offset="100%" stop-color="${palette.skyLow}"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.seaTop}"/>
      <stop offset="45%" stop-color="${palette.seaMid}"/>
      <stop offset="100%" stop-color="${palette.seaDeep}"/>
    </linearGradient>
    <radialGradient id="sun" cx="${((sunX / w) * 100).toFixed(1)}%" cy="${((horizon / h) * 100).toFixed(1)}%" r="34%">
      <stop offset="0%" stop-color="${palette.sun}" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="${palette.sun}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${palette.sun}" stop-opacity="0"/>
    </radialGradient>
    ${vignette("vig")}
    ${grain("grain")}
  </defs>
  <rect width="${w}" height="${horizon}" fill="url(#sky)"/>
  <rect y="${horizon}" width="${w}" height="${h - horizon}" fill="url(#sea)"/>
  <rect width="${w}" height="${h}" fill="url(#sun)"/>
  <circle cx="${sunX}" cy="${horizon - h * 0.02}" r="${h * 0.045}" fill="${palette.sun}" opacity="0.85"/>
  ${villas}
  ${glitter}
  <rect width="${w}" height="${h}" fill="url(#vig)"/>
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.5"/>
</svg>
`;
}

/** Layered ridge / dune scene with optional balloons (Turkey, Dubai). */
function ridgeScene(w, h, palette, seed, opts = {}) {
  const rng = makeRng(seed);
  const layers = palette.ridges
    .map((color, i) => {
      const baseY = h * (0.5 + i * 0.11);
      const amp = h * (0.075 - i * 0.008);
      let d = `M0 ${h} L0 ${baseY}`;
      const steps = 9;
      for (let s = 0; s <= steps; s++) {
        const x = (w / steps) * s;
        const y = baseY - Math.sin(s * 1.15 + i * 2.1 + rng() * 0.35) * amp;
        d += ` L${x.toFixed(0)} ${y.toFixed(0)}`;
      }
      d += ` L${w} ${h} Z`;
      return `<path d="${d}" fill="${color}"/>`;
    })
    .join("\n  ");

  let balloons = "";
  if (opts.balloons) {
    for (let i = 0; i < opts.balloons; i++) {
      const bx = w * (0.1 + rng() * 0.82);
      const by = h * (0.1 + rng() * 0.34);
      const r = h * (0.022 + rng() * 0.028);
      const c = palette.accents[i % palette.accents.length];
      balloons += `
      <g opacity="${(0.55 + rng() * 0.4).toFixed(2)}">
        <path d="M${bx - r} ${by} a${r} ${r} 0 1 1 ${r * 2} 0 q0 ${r * 0.95} -${r} ${r * 1.5} q-${r} -${r * 0.55} -${r} -${r * 1.5} Z" fill="${c}"/>
        <rect x="${bx - r * 0.18}" y="${by + r * 1.5}" width="${r * 0.36}" height="${r * 0.34}" fill="#1a1208" opacity="0.85"/>
      </g>`;
    }
  }

  let skyline = "";
  if (opts.skyline) {
    let x = w * 0.06;
    while (x < w * 0.94) {
      const bw = w * (0.018 + rng() * 0.032);
      const bh = h * (0.09 + rng() * 0.30);
      skyline += `<rect x="${x.toFixed(0)}" y="${(h * 0.72 - bh).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" fill="#0a0d14" opacity="0.9"/>`;
      x += bw * 1.5;
    }
    // one landmark spire
    const sx = w * 0.5;
    skyline += `<path d="M${sx - w * 0.012} ${h * 0.72} L${sx} ${h * 0.2} L${sx + w * 0.012} ${h * 0.72} Z" fill="#0a0d14" opacity="0.95"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.skyTop}"/>
      <stop offset="55%" stop-color="${palette.skyMid}"/>
      <stop offset="100%" stop-color="${palette.skyLow}"/>
    </linearGradient>
    <radialGradient id="glow" cx="62%" cy="58%" r="46%">
      <stop offset="0%" stop-color="${palette.sun}" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="${palette.sun}" stop-opacity="0"/>
    </radialGradient>
    ${vignette("vig", "55%", "50%")}
    ${grain("grain")}
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <circle cx="${w * 0.62}" cy="${h * 0.58}" r="${h * 0.05}" fill="${palette.sun}" opacity="0.8"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  ${balloons}
  ${skyline}
  ${layers}
  <rect width="${w}" height="${h}" fill="url(#vig)"/>
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.5"/>
</svg>
`;
}

/** Interior / detail scene for the inset cards (villa, dinner, suite). */
function interiorScene(w, h, palette, seed, kind) {
  const rng = makeRng(seed);
  let focal = "";

  if (kind === "villa") {
    // Overwater deck looking out
    focal = `
    <rect x="0" y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="#2a1d12"/>
    ${Array.from({ length: 14 }, (_, i) => `<rect x="0" y="${(h * 0.62 + i * (h * 0.028)).toFixed(0)}" width="${w}" height="2" fill="#1a1109" opacity="0.6"/>`).join("")}
    <rect x="${w * 0.08}" y="${h * 0.18}" width="${w * 0.84}" height="${h * 0.44}" fill="none" stroke="#e8dcc6" stroke-width="3" opacity="0.5"/>`;
  } else if (kind === "dinner") {
    // Table with lanterns on sand
    focal = `
    <ellipse cx="${w * 0.5}" cy="${h * 0.72}" rx="${w * 0.3}" ry="${h * 0.075}" fill="#f3e2c0" opacity="0.92"/>
    <rect x="${w * 0.2}" y="${h * 0.72}" width="${w * 0.6}" height="${h * 0.16}" fill="#e9d5ae" opacity="0.8"/>
    ${Array.from({ length: 5 }, (_, i) => {
      const lx = w * (0.24 + i * 0.13);
      return `<g><circle cx="${lx}" cy="${h * 0.63}" r="${h * 0.022}" fill="#ffd28a" opacity="0.95"/><circle cx="${lx}" cy="${h * 0.63}" r="${h * 0.05}" fill="#ffb347" opacity="0.22"/></g>`;
    }).join("")}`;
  } else {
    // suite: soft geometric interior
    focal = `
    <rect x="${w * 0.1}" y="${h * 0.46}" width="${w * 0.8}" height="${h * 0.3}" rx="${h * 0.02}" fill="#efe4d2" opacity="0.9"/>
    <rect x="${w * 0.16}" y="${h * 0.38}" width="${w * 0.22}" height="${h * 0.1}" rx="${h * 0.015}" fill="#f7efe2" opacity="0.85"/>
    <rect x="${w * 0.62}" y="${h * 0.38}" width="${w * 0.22}" height="${h * 0.1}" rx="${h * 0.015}" fill="#f7efe2" opacity="0.85"/>`;
  }

  let motes = "";
  for (let i = 0; i < 24; i++) {
    motes += `<circle cx="${(rng() * w).toFixed(0)}" cy="${(rng() * h * 0.7).toFixed(0)}" r="${(0.8 + rng() * 1.8).toFixed(1)}" fill="#ffe9c4" opacity="${(0.12 + rng() * 0.3).toFixed(2)}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${palette.skyTop}"/>
      <stop offset="55%" stop-color="${palette.skyMid}"/>
      <stop offset="100%" stop-color="${palette.skyLow}"/>
    </linearGradient>
    ${vignette("vig", "50%", "40%")}
    ${grain("grain")}
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <circle cx="${w * 0.7}" cy="${h * 0.22}" r="${h * 0.07}" fill="${palette.sun}" opacity="0.55"/>
  ${motes}
  ${focal}
  <rect width="${w}" height="${h}" fill="url(#vig)"/>
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.5"/>
</svg>
`;
}

// ——— Palettes per destination ———
const DESTINATIONS = {
  maldives: {
    bg: (w, h) =>
      oceanScene(w, h, {
        skyTop: "#0a1c2e", skyMid: "#1c4f6b", skyLow: "#4d8fa3",
        seaTop: "#2b8a9e", seaMid: "#12566e", seaDeep: "#04222f",
        sun: "#ffd9a0",
      }, 1337, { villas: true, horizon: 0.54, sunX: 0.7 }),
    insetA: (w, h) =>
      interiorScene(w, h, { skyTop: "#0b2334", skyMid: "#2b7f92", skyLow: "#7fc4c9", sun: "#ffe0b0" }, 71, "villa"),
    insetB: (w, h) =>
      interiorScene(w, h, { skyTop: "#1a1020", skyMid: "#5b3352", skyLow: "#c98b6b", sun: "#ffcf94" }, 91, "dinner"),
  },
  turkey: {
    bg: (w, h) =>
      ridgeScene(w, h, {
        skyTop: "#1b1020", skyMid: "#7a3f4a", skyLow: "#d98f5e",
        sun: "#ffc27a",
        ridges: ["#4a2c2a", "#33201f", "#1e1414", "#100b0b"],
        accents: ["#ff6b6b", "#ffd166", "#4ecdc4", "#f7f7f7"],
      }, 2024, { balloons: 9 }),
    insetA: (w, h) =>
      interiorScene(w, h, { skyTop: "#2a1420", skyMid: "#8c4a3f", skyLow: "#e0a878", sun: "#ffd9a0" }, 33, "suite"),
    insetB: (w, h) =>
      interiorScene(w, h, { skyTop: "#160f1c", skyMid: "#4d2b3f", skyLow: "#b87a5e", sun: "#ffc98a" }, 44, "dinner"),
  },
  dubai: {
    bg: (w, h) =>
      ridgeScene(w, h, {
        skyTop: "#0d1220", skyMid: "#3c3a55", skyLow: "#c9925e",
        sun: "#ffd28a",
        ridges: ["#5a4128", "#3d2c1c", "#241a12", "#120d09"],
        accents: ["#ffd166", "#f7f7f7"],
      }, 777, { skyline: true }),
    insetA: (w, h) =>
      interiorScene(w, h, { skyTop: "#14182a", skyMid: "#4a4468", skyLow: "#caa274", sun: "#ffdca8" }, 55, "suite"),
    insetB: (w, h) =>
      interiorScene(w, h, { skyTop: "#1c1408", skyMid: "#6b4a22", skyLow: "#d9a35e", sun: "#ffd9a0" }, 66, "dinner"),
  },
};

// Background is wide (it pans horizontally, so it must be wider than the
// viewport); insets are portrait cards.
const BG = [2400, 1200];
const INSET = [900, 1200];

let count = 0;
for (const [id, gen] of Object.entries(DESTINATIONS)) {
  writeFileSync(join(OUT_DIR, `${id}-bg.svg`), gen.bg(...BG));
  writeFileSync(join(OUT_DIR, `${id}-inset-a.svg`), gen.insetA(...INSET));
  writeFileSync(join(OUT_DIR, `${id}-inset-b.svg`), gen.insetB(...INSET));
  count += 3;
}

console.log(`Wrote ${count} placeholder SVGs → ${OUT_DIR}`);
console.log("Replace these with real photography; the component takes plain URLs.");
