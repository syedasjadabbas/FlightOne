/**
 * Active-chat layout diagnostics — run: node scripts/chat-layout-diagnose.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.CHAT_DIAG_URL || "http://localhost:3000";

const VIEWPORTS = [
  { name: "1440x900@100%", width: 1440, height: 900, zoomCSS: 1 },
  { name: "1280x800@100%", width: 1280, height: 800, zoomCSS: 1 },
  { name: "390x844@100%", width: 390, height: 844, zoomCSS: 1 },
  { name: "430x932@100%", width: 430, height: 932, zoomCSS: 1 },
  { name: "1440x900@90%", width: 1440, height: 900, zoomCSS: 0.9 },
  { name: "1440x900@80%", width: 1440, height: 900, zoomCSS: 0.8 },
  { name: "1440x900@110%", width: 1440, height: 900, zoomCSS: 1.1 },
  { name: "1440x900@125%", width: 1440, height: 900, zoomCSS: 1.25 },
  { name: "1440x900@150%", width: 1440, height: 900, zoomCSS: 1.5 },
];

const SELECTORS = [
  { key: "html", sel: "html" },
  { key: "body", sel: "body" },
  { key: "root", sel: "body > div" },
  { key: "main", sel: "main.fo-stage--chat" },
  { key: "foChatApp", sel: ".fo-chat-app" },
  { key: "chatPage", sel: ".chat-page" },
  { key: "chatHeader", sel: ".chat-page__header" },
  { key: "messages", sel: ".chat-page__messages" },
  { key: "messagesInner", sel: ".chat-page__messages-inner" },
  { key: "footer", sel: ".chat-page__footer" },
  { key: "nav", sel: ".fo-chat-nav" },
];

async function collectMetrics(page) {
  return page.evaluate((sels) => {
    const doc = {
      innerHeight: window.innerHeight,
      visualViewportHeight: window.visualViewport?.height ?? null,
      docClientHeight: document.documentElement.clientHeight,
      docScrollHeight: document.documentElement.scrollHeight,
      bodyClientHeight: document.body.clientHeight,
      bodyScrollHeight: document.body.scrollHeight,
      foChatActive: document.documentElement.classList.contains("fo-chat-active"),
      cssVars: {
        foNavHeight: getComputedStyle(document.documentElement).getPropertyValue("--fo-nav-height"),
        foChatAppHeight: getComputedStyle(document.documentElement).getPropertyValue("--fo-chat-app-height"),
        chatComposerHeight: getComputedStyle(document.documentElement).getPropertyValue("--chat-composer-height"),
        chatMessagesEndPad: getComputedStyle(document.documentElement).getPropertyValue("--chat-messages-end-pad"),
      },
    };

    const els = {};
    for (const { key, sel } of sels) {
      const el = document.querySelector(sel);
      if (!el) {
        els[key] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      els[key] = {
        rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width) },
        height: cs.height,
        minHeight: cs.minHeight,
        maxHeight: cs.maxHeight,
        overflow: cs.overflow,
        overflowY: cs.overflowY,
        position: cs.position,
        flex: cs.flex,
        flexShrink: cs.flexShrink,
        flexGrow: cs.flexGrow,
      };
    }

    const vh = window.innerHeight;
    const footerBottom = els.footer?.rect?.bottom ?? 0;
    const docScrolls = document.documentElement.scrollHeight > document.documentElement.clientHeight + 1;
    const footerBelowViewport = footerBottom > vh + 1;
    const messagesClip = els.messages?.overflowY === "hidden" || els.messages?.overflowY === "clip";

    return {
      doc,
      els,
      analysis: {
        documentScrolls: docScrolls,
        footerBelowViewport,
        footerBottomVsInnerHeight: footerBottom - vh,
        messagesIsScrollContainer: els.messages?.overflowY === "auto" || els.messages?.overflowY === "scroll",
        messagesClip,
        chatPageActive: document.querySelector(".chat-page--active") !== null,
      },
    };
  }, SELECTORS);
}

async function activateChat(page) {
  const textarea = page.locator("#fo-chat-composer");
  await textarea.waitFor({ state: "visible", timeout: 30000 });
  await textarea.fill("test message for layout diagnosis");
  await textarea.press("Enter");
  await page.waitForSelector(".chat-page--active", { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(800);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor ?? 1,
    });
    const page = await context.newPage();

    if (vp.zoomCSS) {
      await page.addInitScript((z) => {
        document.documentElement.style.zoom = String(z);
      }, vp.zoomCSS);
    }

    await page.goto(`${BASE_URL}/chat`, { waitUntil: "networkidle", timeout: 60000 });

    results[`${vp.name}_landing`] = await collectMetrics(page);

    await activateChat(page);
    results[`${vp.name}_active`] = await collectMetrics(page);

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
