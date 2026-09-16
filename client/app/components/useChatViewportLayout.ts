"use client";

import { useLayoutEffect } from "react";

/**
 * Measures SiteNav + composer dock and publishes viewport CSS vars so chat
 * layouts fit the visible area at any browser zoom level.
 * Always measures visual viewport; active chat uses the full shell height chain.
 */
export function useChatViewportLayout(
  active: boolean,
  composerDockRef: React.RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    const root = document.documentElement;

    const sync = () => {
      const nav = document.querySelector<HTMLElement>(".fo-chat-nav");
      const navHeight = nav?.getBoundingClientRect().height ?? 0;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

      const composerEl = composerDockRef.current;
      const composerHeight = composerEl?.getBoundingClientRect().height ?? 0;
      const endPad = Math.max(20, Math.round(composerHeight * 0.15 + 8));

      root.style.setProperty("--fo-nav-height", `${navHeight}px`);
      root.style.setProperty("--fo-visual-height", `${viewportHeight}px`);
      root.style.setProperty("--chat-composer-height", `${composerHeight}px`);
      root.style.setProperty("--chat-messages-end-pad", `${endPad}px`);
    };

    sync();

    const ro = new ResizeObserver(sync);
    const nav = document.querySelector(".fo-chat-nav");
    if (nav) ro.observe(nav);

    const observeComposer = () => {
      if (composerDockRef.current) ro.observe(composerDockRef.current);
    };
    observeComposer();

    const raf = requestAnimationFrame(() => {
      observeComposer();
      sync();
    });

    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
      root.style.removeProperty("--fo-nav-height");
      root.style.removeProperty("--fo-visual-height");
      root.style.removeProperty("--chat-composer-height");
      root.style.removeProperty("--chat-messages-end-pad");
    };
  }, [active, composerDockRef]);
}
