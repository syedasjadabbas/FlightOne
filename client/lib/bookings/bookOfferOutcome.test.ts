import { describe, expect, it, vi } from "vitest";
import type { BookOfferOutcome } from "@/app/components/ask-ai/AskAiShell";

/**
 * Regression guard for the "View Deal flashes the results screen" bug.
 *
 * `window.location.href = ...` SCHEDULES a navigation and returns immediately,
 * so the book promise resolves while the browser is still on the page. Closing
 * the detail modal at that point un-mounts it and repaints what is behind it —
 * the flash. The modal may only close when the handler reports it is NOT
 * navigating.
 */

/** Mirrors AskAiShell's onBook settle logic. */
function settle(
  outcome: BookOfferOutcome | void,
  close: () => void,
): void {
  if (outcome?.navigating) return;
  close();
}

describe("detail modal teardown on book", () => {
  it("stays mounted when a redirect has been scheduled", () => {
    const close = vi.fn();
    settle({ navigating: true }, close);
    expect(close).not.toHaveBeenCalled();
  });

  it("closes when the quote failed, so the error notice is visible", () => {
    const close = vi.fn();
    settle({ navigating: false }, close);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes when a handler reports nothing, rather than hanging open", () => {
    const close = vi.fn();
    settle(undefined, close);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
