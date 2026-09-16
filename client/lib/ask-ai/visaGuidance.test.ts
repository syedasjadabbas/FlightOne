import { describe, expect, it } from "vitest";
import {
  extractDestinationIso2,
  extractNationalityIso2,
  formatVisaGuidanceForPrompt,
  isVisaQuestion,
} from "@/lib/ask-ai/visaGuidance";

describe("visaGuidance", () => {
  it("detects visa intent", () => {
    expect(isVisaQuestion("Do I need a visa for Dubai?")).toBe(true);
    expect(isVisaQuestion("Show me flights to DXB")).toBe(false);
  });

  it("extracts destination ISO2 hints", () => {
    expect(extractDestinationIso2("visa for turkey")).toBe("TR");
    expect(extractDestinationIso2("travel to AE")).toBe("AE");
  });

  it("formats guidance without inventing facts", () => {
    const line = formatVisaGuidanceForPrompt({
      isFact: false,
      escalateRecommended: true,
      avaSummary: "No attributed data.",
      requirement: { dataStatus: "DATA_UNAVAILABLE", category: "UNKNOWN" },
    });
    expect(line).toContain("isFact=false");
    expect(line).toContain("Never invent fees");
    expect(line).toContain("VISA_UNCERTAIN");
  });

  it("extracts nationality override from latest user intent", () => {
    expect(extractNationalityIso2("I'm Pakistani — do I need a visa for Dubai?")).toBe("PK");
    expect(extractNationalityIso2("nationality: IN visa for AE")).toBe("IN");
  });
});
