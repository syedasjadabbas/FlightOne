"use client";

import { RotateCcw } from "lucide-react";

/** Detect inventory / connection failures in assistant copy (fallback until structured flags). */
export function isTravelSearchError(content: string): boolean {
  return /search hit a snag|lost the connection|couldn't retrieve|couldn’t retrieve|temporarily unreachable|trip planning ai|try again|something went wrong while handling/i.test(
    content,
  );
}

export function SearchErrorFooter({
  onRetry,
  disabled = false,
}: {
  onRetry: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="results-msg-cta search-error-footer" role="status">
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className="results-msg-cta__btn search-error-footer__btn inline-flex w-full items-center justify-center gap-1.5 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--electric)]/40 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
        aria-label="Retry live flight search"
      >
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
        Try again
      </button>
    </div>
  );
}
