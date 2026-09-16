"use client";

import type { SearchPhase } from "@/lib/ask-ai/types";
import type { LoadingRouteCodes } from "@/lib/ask-ai/loadingRoute";
import { loadingBubbleCopy } from "./ThinkingProgress";

export function TypingDots({
  phase = "search",
  loadingRoute = null,
}: {
  phase?: SearchPhase;
  loadingRoute?: LoadingRouteCodes | null;
}) {
  const { primary } = loadingBubbleCopy(phase, loadingRoute);

  return (
    <p className="typing-status" role="status" aria-live="polite">
      <span className="typing-status__pulse" aria-hidden />
      <span className="typing-status__label">{primary}</span>
    </p>
  );
}
