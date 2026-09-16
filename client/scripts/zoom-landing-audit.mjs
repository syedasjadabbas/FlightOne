import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = path.resolve("tmp-zoom-audit");
fs.mkdirSync(OUT, { recursive: true });

const ZOOMS = [0.75, 0.9, 1, 1.1, 1.25, 1.5];
const PHYS = { w: 1440, h: 900 };

async function measure(page) {
  return page.evaluate(() => {
    const tiles = [...document.querySelectorAll(".chat-page--landing .fo-inspire-tile")];
    const grid = document.querySelector(".chat-suggestions--hero");
    const title = document.querySelector(".chat-hero__title");
    const input = document.querySelector(".composer-shell__input");
    const send = document.querySelector(".send-btn");
    const pills = [...document.querySelectorAll(".chat-composer-actions .quick-chip")];

    const tops = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top)));
    const rows = tops.size;

    const tileOverflow = tiles.some((t) => {
      const titleEl = t.querySelector(".fo-inspire-tile__title");
      const sub = t.querySelector(".fo-inspire-tile__sub");
      return (
        (titleEl && titleEl.scrollWidth > titleEl.clientWidth + 1) ||
        (sub && sub.scrollWidth > sub.clientWidth + 1)
      );
    });

    const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const hScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const sendRect = send?.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    const gridDisplay = grid ? getComputedStyle(grid).display : "";
    const gridWrap = grid ? getComputedStyle(grid).flexWrap : "";
    const footer = document.querySelector(".chat-page--landing .chat-composer-dock");
    const footerPos = footer ? getComputedStyle(footer).position : "";

    return {
      vw,
      vh,
      docH,
      overflowY: docH - vh,
      hScroll,
      rows,
      tileCount: tiles.length,
      tileOverflow,
      gridDisplay,
      gridWrap,
      titleFs: title ? getComputedStyle(title).fontSize : "",
      titleW: titleRect?.width ?? 0,
      inputW: inputRect?.width ?? 0,
      sendInView: sendRect
        ? sendRect.top >= 0 && sendRect.bottom <= vh && sendRect.left >= 0 && sendRect.right <= vw
        : false,
      footerPos,
      pillWrapRows: new Set(pills.map((p) => Math.round(p.getBoundingClientRect().top))).size,
      containerMax: (() => {
        const el = document.querySelector(".chat-page--landing .chat-page__messages-inner");
        return el ? Math.round(el.getBoundingClientRect().width) : 0;
      })(),
      tileWidths: tiles.map((t) => Math.round(t.getBoundingClientRect().width)),
    };
  });
}

const browser = await chromium.launch({ headless: true });
const rows = [];

for (const zoom of ZOOMS) {
  const cssW = Math.round(PHYS.w / zoom);
  const cssH = Math.round(PHYS.h / zoom);
  const context = await browser.newContext({ viewport: { width: cssW, height: cssH } });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/chat", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".chat-page--landing", { timeout: 30000 });
  await page.waitForTimeout(500);
  const m = await measure(page);
  const pct = Math.round(zoom * 100);
  await page.screenshot({ path: path.join(OUT, `zoom-${pct}.png`), fullPage: false });
  rows.push({ zoomPct: pct, cssW, cssH, ...m });
  await context.close();
}

await browser.close();
console.table(
  rows.map((r) => ({
    zoom: `${r.zoomPct}%`,
    css: `${r.cssW}x${r.cssH}`,
    container: r.containerMax,
    rows: r.rows,
    tiles: r.tileWidths?.join(","),
    hScroll: r.hScroll,
    tileOverflow: r.tileOverflow,
    titleFs: r.titleFs,
    overflowY: r.overflowY,
    sendInView: r.sendInView,
    footer: r.footerPos,
  }))
);
