import { describe, expect, it } from "vitest";
import {
  formatJourneyGuidanceForPrompt,
  isJourneyQuestion,
} from "@/lib/ask-ai/journeyGuidance";

describe("journeyGuidance", () => {
  it("detects journey / disruption intent", () => {
    expect(isJourneyQuestion("Is my flight delayed?")).toBe(true);
    expect(isJourneyQuestion("Any weather disruption for my trip?")).toBe(true);
    expect(isJourneyQuestion("Hotel check-in time?")).toBe(true);
    expect(isJourneyQuestion("Show me hotels in Dubai")).toBe(false);
  });

  it("formats guidance without inventing status", () => {
    const line = formatJourneyGuidanceForPrompt({
      promptBlock:
        "JOURNEY MONITORING canPollLive=false Never invent flight status. JOURNEY_DISRUPTION",
    });
    expect(line).toContain("Never invent");
    expect(line).toContain("JOURNEY_DISRUPTION");
  });
});
