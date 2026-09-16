import { describe, expect, it } from "vitest";
import type { TravelPlan } from "@/lib/consultant/travelPlan";
import type { FlightOffer } from "@/lib/inventory/types";
import {
  buildOpenJawRecoveryPlan,
  hasEmptyInteriorBuckets,
  inferMainDestination,
  mergeRecoveryBuckets,
  partialStopoverReturnOffers,
  planningPlanForOpenJawRecovery,
  shouldReshapeOpenJaw,
} from "./openJawRecovery";
import { fromConsultantPlan } from "./adapter";

const multiCityPlan: Extract<TravelPlan, { action: "search" }> = {
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

function stubFlight(id: string, origin: string, dest: string): FlightOffer {
  return {
    id,
    type: "flight",
    supplier: "test",
    origin,
    originCode: origin,
    destination: dest,
    destinationCode: dest,
    airline: "Test",
    cabin: "economy",
    stops: 1,
    durationMinutes: 600,
    departTimeLocal: "10:00",
    baggageKg: 20,
    airlineScore: 80,
    supplierReliability: 90,
    unitsLeft: 4,
    netFare: { amount: 100_000_00, currency: "PKR" },
    marketPrice: { amount: 120_000_00, currency: "PKR" },
    refundable: false,
    tags: ["live"],
    departureDate: "2026-09-01",
  };
}

describe("openJawRecovery", () => {
  const message =
    "best fare from Lahore or Islamabad to SFO via 2 nights stopover in London stay in SFO 15 days return from Orlando";

  it("detects empty interior buckets", () => {
    expect(
      hasEmptyInteriorBuckets([
        [stubFlight("a", "LHE", "LHR")],
        [],
        [],
        [stubFlight("d", "MCO", "LHE")],
      ]),
    ).toBe(true);
  });

  it("infers SFO as main destination", () => {
    const planning = fromConsultantPlan(multiCityPlan, message);
    expect(
      inferMainDestination(
        planning,
        multiCityPlan.searches.filter((s) => s.product === "FLIGHT") as never,
      ),
    ).toBe("SFO");
  });

  it("searches SFO→MCO positioning via GDS when present in plan", () => {
    const planning = fromConsultantPlan(multiCityPlan, message);
    expect(shouldReshapeOpenJaw(multiCityPlan, planning)).toBe(true);
    const recovery = buildOpenJawRecoveryPlan(multiCityPlan, planning, message);
    expect(recovery).not.toBeNull();
    expect(recovery!.positioningRoute).toBe("SFO→MCO");
    expect(recovery!.positioningSearched).toBe(true);
    expect(recovery!.droppedPositioning).toBeNull();
    expect(recovery!.stopoverAirports.some((a) => a === "LHR" || a === "LGW")).toBe(true);
    expect(recovery!.mainDest).toBe("SFO");

    const stages = recovery!.searchStages;
    expect(stages).toContain("to_stopover");
    expect(stages).toContain("to_main");
    expect(stages).toContain("positioning");
    expect(stages).toContain("return");

    const flights = recovery!.plan.searches.filter((s) => s.product === "FLIGHT");
    const toLon = flights.filter((_, i) => stages[i] === "to_stopover");
    const toSfo = flights.filter((_, i) => stages[i] === "to_main");
    const positioning = flights.filter((_, i) => stages[i] === "positioning");
    const ret = flights.filter((_, i) => stages[i] === "return");

    expect(toLon.length).toBeGreaterThan(0);
    expect(toLon.every((f) => ["LHR", "LGW", "STN", "LTN"].includes(f.query.destination))).toBe(
      true,
    );
    expect(toSfo.length).toBeGreaterThan(0);
    expect(toSfo.every((f) => f.query.destination === "SFO")).toBe(true);
    expect(toSfo.every((f) => ["LHR", "LGW", "STN", "LTN"].includes(f.query.origin))).toBe(true);
    expect(positioning.some((f) => f.query.origin === "SFO" && f.query.destination === "MCO")).toBe(
      true,
    );
    expect(ret.some((f) => f.query.origin === "MCO" && f.query.destination === "LHE")).toBe(true);

    const nonViaDirect = flights.filter((_, i) => stages[i] !== "via_main_direct");
    expect(nonViaDirect.some((f) => f.query.destination === "LHR" || f.query.destination === "LGW")).toBe(
      true,
    );
  });

  it("builds planning plan: London stopover + SFO + positioning + open-jaw return", () => {
    const planning = fromConsultantPlan(multiCityPlan, message);
    const recovery = buildOpenJawRecoveryPlan(multiCityPlan, planning, message)!;
    const recoveredPlanning = planningPlanForOpenJawRecovery(recovery, message, planning);
    expect(recoveredPlanning.tripType).toBe("open_jaw");
    expect(recoveredPlanning.legs).toHaveLength(4);
    expect(recoveredPlanning.legs[0].purpose).toBe("stopover");
    expect(recoveredPlanning.legs[1].destination).toBe("SFO");
    expect(recoveredPlanning.legs[2].purpose).toBe("positioning");
    expect(recoveredPlanning.legs[2].origin).toBe("SFO");
    expect(recoveredPlanning.legs[2].destination).toBe("MCO");
    expect(recoveredPlanning.legs[3].origin).toBe("MCO");
    expect(
      recoveredPlanning.hardConstraints.some(
        (c) => c.type === "visit_destination" && (c.value as { iata: string }).iata === "SFO",
      ),
    ).toBe(true);
    expect(
      recoveredPlanning.hardConstraints.some(
        (c) =>
          c.type === "visit_destination" &&
          ["LHR", "LGW"].includes((c.value as { iata: string }).iata),
      ),
    ).toBe(true);
  });

  it("merges into to-London / London→SFO / positioning / return stage buckets", () => {
    const planning = fromConsultantPlan(multiCityPlan, message);
    const recovery = buildOpenJawRecoveryPlan(multiCityPlan, planning, message)!;
    const buckets = recovery.plan.searches.map((s, i) => {
      if (s.product !== "FLIGHT") return [];
      const stage = recovery.searchStages[i];
      if (stage === "to_stopover" && s.query.origin === "LHE") {
        return [stubFlight("lon", s.query.origin, s.query.destination)];
      }
      if (stage === "to_main" && s.query.origin === "LHR") {
        return [stubFlight("sfo", "LHR", "SFO")];
      }
      if (stage === "positioning") {
        return [stubFlight("pos", "SFO", "MCO")];
      }
      if (stage === "return" && s.query.destination === "LHE") {
        return [stubFlight("ret", "MCO", "LHE")];
      }
      return [];
    });
    const merged = mergeRecoveryBuckets(
      recovery.plan.searches,
      buckets,
      recovery.searchStages,
    );
    expect(merged).toHaveLength(4);
    expect(merged[0][0]).toMatchObject({ destinationCode: "LHR" });
    expect(merged[1][0]).toMatchObject({ originCode: "LHR", destinationCode: "SFO" });
    expect(merged[2][0]).toMatchObject({ originCode: "SFO", destinationCode: "MCO" });
    expect(merged[3][0]).toMatchObject({ originCode: "MCO", destinationCode: "LHE" });
  });

  it("flags missing London→SFO for honest partial", () => {
    const partial = partialStopoverReturnOffers([
      [stubFlight("lon", "LHE", "LHR")],
      [],
      [stubFlight("ret", "MCO", "LHE")],
    ]);
    expect(partial.missingMainHop).toBe(true);
    expect(partial.toStopover).toHaveLength(1);
    expect(partial.homebound).toHaveLength(1);
  });
});
