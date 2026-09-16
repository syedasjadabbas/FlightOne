/**
 * Simulate browser zoom by shrinking CSS viewport (innerWidth/innerHeight).
 * Real zoom: layout viewport ≈ physical / zoomFactor.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000/chat";

const PHYSICAL = [
  { w: 1440, h: 900 },
  { w: 1280, h: 800 },
  { w: 1024, h: 768 },
  { w: 768, h: 1024 },
  { w: 430, h: 932 },
  { w: 390, h: 844 },
];
const ZOOM = [0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

function cssViewport(phys, zoom) {
  return {
    width: Math.round(phys.w / zoom),
    height: Math.round(phys.h / zoom),
  };
}

async function measure(page) {
  return page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        sel,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        pt: parseFloat(cs.paddingTop) || 0,
        pb: parseFloat(cs.paddingBottom) || 0,
        mt: parseFloat(cs.marginTop) || 0,
        mb: parseFloat(cs.marginBottom) || 0,
        gap: cs.gap || cs.rowGap || "",
        minH: cs.minHeight,
        position: cs.position,
      };
    };

    const parts = [
      ".fo-chat-nav",
      ".chat-page__header",
      ".chat-hero--landing",
      ".chat-hero__content",
      ".chat-hero__eyebrow",
      ".chat-hero__title",
      ".chat-hero__lede",
      ".fo-hero-scene",
      ".chat-suggestions--hero",
      ".chat-thread",
      ".chat-composer-dock",
      ".chat-composer-actions",
      ".composer-shell",
    ]
      .map(pick)
      .filter(Boolean);

    const ih = window.innerHeight;
    const sh = document.documentElement.scrollHeight;
    const composer = parts.find((p) => p.sel === ".chat-composer-dock");
    const hero = parts.find((p) => p.sel === ".chat-hero--landing");
    const content = parts.find((p) => p.sel === ".chat-hero__content");
    const tiles = parts.find((p) => p.sel === ".chat-suggestions--hero");
    const title = parts.find((p) => p.sel === ".chat-hero__title");
    const lede = parts.find((p) => p.sel === ".chat-hero__lede");
    const nav = parts.find((p) => p.sel === ".fo-chat-nav");
    const header = parts.find((p) => p.sel === ".chat-page__header");

    // Contribution stack
    const stack = {
      nav: nav?.height ?? 0,
      header: header?.height ?? 0,
      heroPad: (hero?.pt ?? 0) + (hero?.pb ?? 0),
      title: title?.height ?? 0,
      lede: lede?.height ?? 0,
      tiles: tiles?.height ?? 0,
      contentGapEstimate: content ? Math.max(0, content.height - ((title?.height ?? 0) + (lede?.height ?? 0) + (tiles?.height ?? 0) + (parts.find((p)=>p.sel===".chat-hero__eyebrow")?.height ?? 0))) : 0,
      heroTotal: hero?.height ?? 0,
      composer: composer?.height ?? 0,
    };

    return {
      innerH: ih,
      scrollH: sh,
      overflowY: sh - ih,
      composerTop: composer?.top ?? null,
      composerBottom: composer?.bottom ?? null,
      composerInView: composer ? composer.top < ih - 8 && composer.bottom > 0 : false,
      needsScrollForComposer: composer ? composer.bottom > ih + 2 : false,
      heroH: hero?.height ?? null,
      tilesH: tiles?.height ?? null,
      stack,
      parts,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const report = { method: "css-viewport = physical/zoom", cases: [] };

  console.log("phys\tzoom\tcssH\toverflow\theroH\ttilesH\tcomposerBottom\tneedsScroll");

  for (const phys of [{ w: 1440, h: 900 }, { w: 1280, h: 800 }, { w: 390, h: 844 }]) {
    for (const z of ZOOM) {
      const css = cssViewport(phys, z);
      const page = await browser.newPage({ viewport: css });
      await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
      const m = await measure(page);
      const row = {
        phys: `${phys.w}x${phys.h}`,
        zoom: `${Math.round(z * 100)}%`,
        css,
        ...m,
      };
      report.cases.push(row);
      console.log(
        `${phys.w}x${phys.h}\t${Math.round(z * 100)}%\t${css.height}\t${m.overflowY}\t${m.heroH}\t${m.tilesH}\t${m.composerBottom}\t${m.needsScrollForComposer}`,
      );
      await page.close();
    }
  }

  writeFileSync(resolve(__dir, "../chat-landing-zoom-audit.json"), JSON.stringify(report, null, 2));
  await browser.close();
  console.log("\n→ chat-landing-zoom-audit.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
