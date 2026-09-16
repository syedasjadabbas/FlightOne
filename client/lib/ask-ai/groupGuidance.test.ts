import { describe, expect, it } from "vitest";
import { formatGroupGuidanceForPrompt, isGroupQuestion } from "@/lib/ask-ai/groupGuidance";

describe("groupGuidance", () => {
  it("detects group intent", () => {
    expect(isGroupQuestion("What's our group itinerary?")).toBe(true);
    expect(isGroupQuestion("Who is attending?")).toBe(true);
    expect(isGroupQuestion("Create a trip memory")).toBe(true);
    expect(isGroupQuestion("book a flight to Dubai")).toBe(false);
  });

  it("formats fail-safe prompt", () => {
    expect(formatGroupGuidanceForPrompt(null)).toMatch(/never invent/i);
  });
});
