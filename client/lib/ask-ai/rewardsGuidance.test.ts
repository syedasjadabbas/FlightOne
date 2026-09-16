import { describe, expect, it } from "vitest";
import {
  formatRewardsGuidanceForPrompt,
  isRewardsQuestion,
} from "@/lib/ask-ai/rewardsGuidance";

describe("rewardsGuidance", () => {
  it("detects rewards intent", () => {
    expect(isRewardsQuestion("How many rewards do I have?")).toBe(true);
    expect(isRewardsQuestion("What is my loyalty tier?")).toBe(true);
    expect(isRewardsQuestion("Show me flights to DXB")).toBe(false);
  });

  it("formats without inventing", () => {
    const line = formatRewardsGuidanceForPrompt({
      promptBlock: "REWARDS balance=12; Never invent balances",
    });
    expect(line).toContain("Never invent");
  });
});
