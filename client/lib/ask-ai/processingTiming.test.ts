import { describe, expect, it } from "vitest";
import {
  classifyQueryComplexity,
  estimateProcessingDuration,
  getPhaseSchedule,
} from "./processingTiming";

describe("processingTiming", () => {
  describe("classifyQueryComplexity", () => {
    it("classifies greetings and short FAQs as simple", () => {
      expect(classifyQueryComplexity("Hi Ava")).toBe("simple");
      expect(classifyQueryComplexity("hello")).toBe("simple");
      expect(classifyQueryComplexity("Good morning!")).toBe("simple");
      expect(classifyQueryComplexity("Who are you?")).toBe("simple");
      expect(classifyQueryComplexity("What can you do")).toBe("simple");
      expect(classifyQueryComplexity("help")).toBe("simple");
    });

    it("classifies general travel recommendations as travel", () => {
      expect(
        classifyQueryComplexity("What are the best places to visit in Japan in October?"),
      ).toBe("travel");
      expect(
        classifyQueryComplexity("Recommend top 5 luxury beach resorts in Maldives"),
      ).toBe("travel");
      expect(
        classifyQueryComplexity("Things to do in Rome for a 3-day vacation"),
      ).toBe("travel");
    });

    it("classifies flight searches as flight_search", () => {
      expect(
        classifyQueryComplexity("Find flights from Lahore to London next Friday"),
      ).toBe("flight_search");
      expect(
        classifyQueryComplexity("LHE to DXB cheapest fare on 15 Oct"),
      ).toBe("flight_search");
      expect(
        classifyQueryComplexity("Business class tickets to New York"),
      ).toBe("flight_search");
      expect(
        classifyQueryComplexity("Book a flight to Istanbul", { hasRoute: true }),
      ).toBe("flight_search");
    });

    it("classifies multi-city itineraries as complex_multicity", () => {
      expect(
        classifyQueryComplexity("Multi-city trip: Lahore to Rome, Rome to Zurich, Zurich to Lahore"),
      ).toBe("complex_multicity");
      expect(
        classifyQueryComplexity("LHE → DXB → LHR → JFK"),
      ).toBe("complex_multicity");
      expect(
        classifyQueryComplexity("Fly to London, spend 2 days stopover, then fly to New York"),
      ).toBe("complex_multicity");
    });
  });

  describe("estimateProcessingDuration", () => {
    it("simple queries take 3–7 seconds", () => {
      const duration = estimateProcessingDuration("Hello Ava");
      expect(duration).toBeGreaterThanOrEqual(3000);
      expect(duration).toBeLessThanOrEqual(7000);
    });

    it("travel queries take 7–15 seconds", () => {
      const duration = estimateProcessingDuration(
        "Suggest top honeymoon destinations in Europe during spring",
      );
      expect(duration).toBeGreaterThanOrEqual(7000);
      expect(duration).toBeLessThanOrEqual(15000);
    });

    it("flight search queries take 10–20 seconds", () => {
      const duration = estimateProcessingDuration(
        "Find cheapest one-way flights from Lahore to Dubai on 2026-10-15",
      );
      expect(duration).toBeGreaterThanOrEqual(10000);
      expect(duration).toBeLessThanOrEqual(20000);
    });

    it("complex multi-city queries take 15–28 seconds and never exceed 30s", () => {
      const duration = estimateProcessingDuration(
        "Multi-city: LHE to FCO on Oct 5, FCO to ZRH on Oct 10, ZRH to LHE on Oct 15",
      );
      expect(duration).toBeGreaterThanOrEqual(15000);
      expect(duration).toBeLessThanOrEqual(28000);
      expect(duration).toBeLessThan(30000);
    });

    it("is strictly deterministic for identical queries", () => {
      const q = "Flights to Paris from Islamabad";
      const d1 = estimateProcessingDuration(q);
      const d2 = estimateProcessingDuration(q);
      expect(d1).toBe(d2);
    });
  });

  describe("getPhaseSchedule", () => {
    it("returns correctly proportioned phase milestones", () => {
      const schedule = getPhaseSchedule("Flights from LHE to LHR");
      expect(schedule.extractUntilMs).toBeGreaterThan(0);
      expect(schedule.searchUntilMs).toBeGreaterThan(schedule.extractUntilMs);
      expect(schedule.replyUntilMs).toBe(schedule.totalDurationMs);
      expect(schedule.totalDurationMs).toBeLessThanOrEqual(28000);
    });
  });
});
