import { describe, expect, it } from "vitest";
import { formatMiceGuidanceForPrompt, isMiceQuestion } from "@/lib/ask-ai/miceGuidance";

describe("miceGuidance", () => {
  it("detects MICE intent", () => {
    expect(isMiceQuestion("What's the event agenda?")).toBe(true);
    expect(isMiceQuestion("What's the event budget?")).toBe(true);
    expect(isMiceQuestion("book a flight")).toBe(false);
  });

  it("formats fail-safe prompt", () => {
    expect(formatMiceGuidanceForPrompt(null)).toMatch(/never invent/i);
  });
});
