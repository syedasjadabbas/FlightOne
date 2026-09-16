"use client";

import { useLayoutEffect } from "react";

/**
 * Marks landing on <html> so flightone-chat-landing.css can override
 * global overflow-x:clip / height:100% without touching active chat.
 * Does NOT mask scrollbars with overflow:hidden.
 */
export function useLandingDocumentFit(isLanding: boolean) {
  useLayoutEffect(() => {
    const root = document.documentElement;

    if (!isLanding) {
      root.classList.remove("fo-chat-landing", "fo-landing-fits");
      document.body.classList.remove("fo-landing-fits");
      root.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
      return;
    }

    root.classList.add("fo-chat-landing");
    root.classList.remove("fo-landing-fits");
    document.body.classList.remove("fo-landing-fits");
    root.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");

    return () => {
      root.classList.remove("fo-chat-landing", "fo-landing-fits");
      document.body.classList.remove("fo-landing-fits");
      root.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
    };
  }, [isLanding]);
}
