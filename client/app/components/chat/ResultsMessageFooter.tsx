"use client";

import { ArrowRight } from "lucide-react";
import type { ChatResultsState } from "@/lib/ask-ai/chatResultsState";

export function ResultsMessageFooter({
  chatResultsState,
  resultCount,
  resultNoun,
  destinationLabel,
  fromPrice,
  onOpenResults,
}: {
  chatResultsState: ChatResultsState;
  resultCount: number;
  resultNoun: string;
  destinationLabel?: string | null;
  fromPrice?: string | null;
  onOpenResults: () => void;
}) {
  if (chatResultsState !== "results" || resultCount <= 0) {
    return null;
  }

  const destPhrase = destinationLabel ? ` for ${destinationLabel}` : "";

  return (
    <div className="results-msg-cta space-y-2.5">
      <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
        I found{" "}
        <span className="results-msg-cta__highlight">
          {resultCount} live {resultNoun}
        </span>
        {destPhrase}
        {fromPrice ? (
          <>
            {" "}
            from <span className="results-msg-cta__highlight">{fromPrice}</span>
          </>
        ) : null}
        .
      </p>
      <button
        type="button"
        onClick={onOpenResults}
        className="results-msg-cta__btn inline-flex items-center gap-1.5 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--electric)]/40"
      >
        View results
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}
