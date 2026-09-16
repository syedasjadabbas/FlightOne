import { describe, expect, it, vi } from "vitest";
import { extractTravelPlan } from "./extractTravelPlan";

vi.mock("@/lib/llm", () => ({
  complete: vi.fn(async () => null),
}));

describe("extractTravelPlan complex fallback", () => {
  it("asks for departure date instead of destination when LLM fails on open-jaw", async () => {
    const plan = await extractTravelPlan(
      "I need best fare from Pakistan city may be lahore or Islamabad going SFO via 2 nights stopover in london stay in sfo 15 days return from orlando",
      [],
      {
        today: "2026-09-15",
        defaultOriginIata: "LHE",
        defaultOriginPlace: "Lahore",
      },
    );

    expect(plan).toMatchObject({
      action: "clarify",
      missing: ["departureDate"],
    });
    expect(plan && "ask" in plan ? plan.ask : "").toMatch(/departure date/i);
    expect(plan && "ask" in plan ? plan.ask : "").not.toMatch(/where would you like to fly/i);
  });
});
