/**
 * Active-chat layout diagnostics with CDP browser zoom + scroll stress test.
 * Run: node scripts/chat-layout-diagnose-v2.mjs
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = process.env.CHAT_DIAG_URL || "http://localhost:3000";

const VIEWPORTS = [
  { name: "1440x900@100%", width: 1440, height: 900, scale: 1 },
  { name: "1280x800@100%", width: 1280, height: 800, scale: 1 },
  { name: "390x844@100%", width: 390, height: 844, scale: 1 },
  { name: "430x932@100%", width: 430, height: 932, scale: 1 },
  { name: "1440x900@90%", width: 1440, height: 900, scale: 0.9 },
  { name: "1440x900@80%", width: 1440, height: 900, scale: 0.8 },
  { name: "1440x900@110%", width: 1440, height: 900, scale: 1.1 },
  { name: "1440x900@125%", width: 1440, height: 900, scale: 1.25 },
  { name: "1440x900@150%", width: 1440, height: 900, scale: 1.5 },
];

const SELECTORS = [
  { key: "html", sel: "html" },
  { key: "body", sel: "body" },
  { key: "main", sel: "main.fo-stage--chat" },
  { key: "foChatApp", sel: ".fo-chat-app" },
  { key: "askAiShell", sel: ".ask-ai-shell--chat" },
  { key: "chatPane", sel: ".ask-ai-shell__chat-pane" },
  { key: "chatPage", sel: ".chat-page" },
  { key: "chatInner", sel: ".chat-page__inner" },
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
      innerWidth: window.innerWidth,
      visualViewportHeight: window.visualViewport?.height ?? null,
      visualViewportWidth: window.visualViewport?.width ?? null,
      docClientHeight: document.documentElement.clientHeight,
      docScrollHeight: document.documentElement.scrollHeight,
      bodyClientHeight: document.body.clientHeight,
      bodyScrollHeight: document.body.scrollHeight,
      scrollY: window.scrollY,
      foChatActive: document.documentElement.classList.contains("fo-chat-active"),
      bodyChildren: [...document.body.children].map((el) => ({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 80),
        rectH: Math.round(el.getBoundingClientRect().height),
      })),
      cssVars: {
        foNavHeight: getComputedStyle(document.documentElement).getPropertyValue("--fo-nav-height").trim(),
        foChatAppHeight: getComputedStyle(document.documentElement).getPropertyValue("--fo-chat-app-height").trim(),
        chatComposerHeight: getComputedStyle(document.documentElement).getPropertyValue("--chat-composer-height").trim(),
        chatMessagesEndPad: getComputedStyle(document.documentElement).getPropertyValue("--chat-messages-end-pad").trim(),
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
        rect: {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height),
          width: Math.round(r.width),
        },
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        height: cs.height,
        minHeight: cs.minHeight,
        maxHeight: cs.maxHeight,
        overflow: cs.overflow,
        overflowY: cs.overflowY,
        position: cs.position,
        flex: cs.flex,
        flexShrink: cs.flexShrink,
        flexGrow: cs.flexGrow,
        display: cs.display,
      };
    }

    const vh = window.innerHeight;
    const footerBottom = els.footer?.rect?.bottom ?? 0;
    const headerTop = els.chatHeader?.rect?.top ?? 0;
    const docScrolls = document.documentElement.scrollHeight > document.documentElement.clientHeight + 1;
    const bodyScrolls = document.body.scrollHeight > document.body.clientHeight + 1;
    const footerBelowViewport = footerBottom > vh + 1;
    const headerAboveViewport = headerTop < -1;
    const messagesEl = document.querySelector(".chat-page__messages");
    const messagesCanScroll =
      messagesEl && messagesEl.scrollHeight > messagesEl.clientHeight + 1;
    const messagesScrollsNotDoc =
      messagesEl && messagesCanScroll && !docScrolls;

    const sumActive =
      (els.chatHeader?.rect?.height ?? 0) +
      (els.messages?.rect?.height ?? 0) +
      (els.footer?.rect?.height ?? 0);
    const chatPageH = els.chatPage?.rect?.height ?? 0;
    const foChatAppH = els.foChatApp?.rect?.height ?? 0;

    return {
      doc,
      els,
      analysis: {
        documentScrolls: docScrolls,
        bodyScrolls,
        footerBelowViewport,
        headerAboveViewport,
        footerBottomVsInnerHeight: footerBottom - vh,
        messagesIsScrollContainer: els.messages?.overflowY === "auto" || els.messages?.overflowY === "scroll",
        messagesCanScroll,
        messagesScrollsNotDoc,
        chatPageActive: document.querySelector(".chat-page--active") !== null,
        chatInnerSumVsChatPage: Math.round(sumActive - chatPageH),
        chatPageVsFoChatApp: Math.round(chatPageH - foChatAppH),
        foChatAppVsVar: els.foChatApp?.rect?.height ?? null,
      },
    };
  }, SELECTORS);
}

async function activateChat(page, messageCount = 1) {
  const textarea = page.locator("#fo-chat-composer");
  await textarea.waitFor({ state: "visible", timeout: 30000 });
  for (let i = 0; i < messageCount; i++) {
    await textarea.fill(`test message ${i + 1} for layout diagnosis — ${"x".repeat(40)}`);
    await textarea.press("Enter");
    await page.waitForTimeout(400);
  }
  await page.waitForSelector(".chat-page--active", { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(1000);
}

async function applyCdpZoom(page, scale) {
  if (scale === 1) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: scale });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/chat`, { waitUntil: "networkidle", timeout: 60000 });
    await applyCdpZoom(page, vp.scale);
    await page.waitForTimeout(300);

    results[`${vp.name}_landing`] = await collectMetrics(page);

    await activateChat(page, 8);
    results[`${vp.name}_active_stress`] = await collectMetrics(page);

    await context.close();
  }

  await browser.close();
  const out = JSON.stringify(results, null, 2);
  const outPath = "scripts/chat-layout-diagnose-v2-results.json";
  fs.writeFileSync(outPath, out);
  console.log(`Wrote ${outPath}`);
  // Print failures summary only
  for (const [k, v] of Object.entries(results)) {
    if (!k.includes("active")) continue;
    const a = v.analysis;
    if (a.documentScrolls || a.footerBelowViewport || a.bodyScrolls) {
      console.log("FAIL", k, JSON.stringify(a));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
