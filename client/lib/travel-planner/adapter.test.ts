import { describe, expect, it } from "vitest";
import { fromConsultantPlan, shouldBuildItineraries } from "@/lib/travel-planner/adapter";
import type { TravelPlan } from "@/lib/consultant/travelPlan";

const multiCityPlan: TravelPlan = {
  action: "search",
  searches: [
    {
      product: "FLIGHT",
      query: {
        origin: "LHE",
        destination: "LHR",
        departureDate: "2026-09-01",
        passengers: 1,
        cabinClass: "ECONOMY",
      },
    },
    {
      product: "FLIGHT",
      query: {
        origin: "LHR",
        destination: "SFO",
        departureDate: "2026-09-03",
        passengers: 1,
        cabinClass: "ECONOMY",
      },
    },
    {
      product: "FLIGHT",
      query: {
        origin: "SFO",
        destination: "MCO",
        departureDate: "2026-09-18",
        passengers: 1,
        cabinClass: "ECONOMY",
      },
    },
    {
      product: "FLIGHT",
      query: {
        origin: "MCO",
        destination: "LHE",
        departureDate: "2026-09-20",
        passengers: 1,
        cabinClass: "ECONOMY",
      },
    },
  ],
};

describe("fromConsultantPlan", () => {
  it("maps multi-city open-jaw ask with stay heuristics", () => {
    const msg =
      "best fare from Lahore to SFO via 2 nights stopover in London, stay in SFO 15 days, return from Orlando";
    const plan = fromConsultantPlan(multiCityPlan, msg);
    expect(plan).not.toBeNull();
    expect(plan!.tripType).toMatch(/multi_city|open_jaw/);
    expect(plan!.legs.length).toBe(4);
    expect(plan!.hardConstraints.some((c) => c.type === "stay_nights")).toBe(true);
    expect(shouldBuildItineraries(plan, 4)).toBe(true);
  });

  it("keeps simple round-trip off the itinerary multi-leg path when single search", () => {
    const plan = fromConsultantPlan(
      {
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "DXB",
              departureDate: "2026-09-01",
              returnDate: "2026-09-08",
              passengers: 1,
            },
          },
        ],
      },
      "round trip to Dubai",
    );
    expect(plan!.tripType).toBe("round_trip");
    expect(shouldBuildItineraries(plan, 1)).toBe(false);
  });
});
